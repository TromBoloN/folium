-- Finance phases 2b-2d: budgets, spendable accounts (safe to spend) and savings goals.

-- ---------------------------------------------------------------------------
-- Spendable accounts: safe-to-spend sums these. Savings are left out by default.
-- ---------------------------------------------------------------------------
alter table public.accounts add column is_spendable boolean not null default true;
update public.accounts set is_spendable = false where type = 'savings';

-- Lets other tables require an account of a given type with a plain FK.
alter table public.accounts add constraint accounts_id_user_type_key unique (id, user_id, type);

-- ---------------------------------------------------------------------------
-- budgets: a monthly limit per expense category
-- ---------------------------------------------------------------------------
create table public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id   uuid not null,
  -- Always 'expense': part of the FK below, so only expense categories can have a budget.
  category_kind text not null default 'expense',
  -- The first day of the month.
  month         date not null,
  amount        bigint not null,
  -- Carry last month's unspent (or overspent) amount into this one.
  rollover      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint budgets_id_user_key unique (id, user_id),
  constraint budgets_category_kind_check check (category_kind = 'expense'),
  constraint budgets_month_first_day check (extract(day from month) = 1),
  constraint budgets_amount_positive check (amount > 0),
  constraint budgets_user_category_month_key unique (user_id, category_id, month),
  constraint budgets_category_fk
    foreign key (category_id, user_id, category_kind) references public.categories (id, user_id, kind)
    on delete cascade
);

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- goals: a target amount by a date, tracked by a savings account's balance
-- ---------------------------------------------------------------------------
create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null,
  target_amount bigint not null,
  target_on     date,
  account_id    uuid not null,
  -- Always 'savings': part of the FK below, so a goal's account must be a savings account.
  account_type  text not null default 'savings',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint goals_id_user_key unique (id, user_id),
  constraint goals_name_length check (char_length(name) between 1 and 80),
  constraint goals_target_positive check (target_amount > 0),
  constraint goals_account_type_check check (account_type = 'savings'),
  -- Progress is the account's balance, so one goal per account.
  constraint goals_account_key unique (account_id),
  constraint goals_account_fk
    foreign key (account_id, user_id, account_type) references public.accounts (id, user_id, type)
    on delete restrict
);

create unique index goals_user_name_key on public.goals (user_id, lower(name));

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
revoke all on public.budgets, public.goals from anon, authenticated;
grant select, insert, update, delete on public.budgets, public.goals to authenticated;

create policy "budgets: owner can read"   on public.budgets for select to authenticated using ((select auth.uid()) = user_id);
create policy "budgets: owner can insert" on public.budgets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "budgets: owner can update" on public.budgets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "budgets: owner can delete" on public.budgets for delete to authenticated using ((select auth.uid()) = user_id);

create policy "goals: owner can read"   on public.goals for select to authenticated using ((select auth.uid()) = user_id);
create policy "goals: owner can insert" on public.goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goals: owner can update" on public.goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goals: owner can delete" on public.goals for delete to authenticated using ((select auth.uid()) = user_id);

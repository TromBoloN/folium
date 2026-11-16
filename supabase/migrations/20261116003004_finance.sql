-- Finance tracker, phase 1a: accounts, categories, transactions, balances.
--
-- Money is integer rupiah (bigint), never floats. Currency is stored (IDR only
-- for now) so other currencies can come later without rewriting rows.
-- Accounts and categories are archived, never deleted, once a transaction uses
-- them (foreign keys are ON DELETE RESTRICT). Transactions are hard-deleted; the
-- UI's undo re-inserts the same row with the same id.
-- Planned transactions never count toward balances.

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------

create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null,
  type            text not null,
  currency        text not null default 'IDR',
  opening_balance bigint not null default 0,
  color           text not null default '#2f9e44',
  icon            text,
  sort_order      integer not null default 0,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint accounts_id_user_key unique (id, user_id),
  constraint accounts_name_length check (char_length(name) between 1 and 60),
  constraint accounts_type_check check (type in ('cash', 'bank', 'ewallet', 'savings')),
  -- IDR only for now; drop this constraint when other currencies arrive.
  constraint accounts_currency_check check (currency = 'IDR'),
  constraint accounts_color_format check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint accounts_icon_length check (icon is null or char_length(icon) <= 40)
);

comment on column public.accounts.opening_balance is 'Integer rupiah (may be negative, e.g. an overdrawn account).';

create unique index accounts_user_name_key on public.accounts (user_id, lower(name));
create index accounts_user_sort_idx on public.accounts (user_id, sort_order);

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories (one level of nesting)
-- ---------------------------------------------------------------------------

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  kind        text not null,
  parent_id   uuid,
  color       text not null default '#868e96',
  icon        text,
  sort_order  integer not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint categories_id_user_key unique (id, user_id),
  constraint categories_id_user_kind_key unique (id, user_id, kind),
  constraint categories_name_length check (char_length(name) between 1 and 60),
  constraint categories_kind_check check (kind in ('expense', 'income')),
  constraint categories_color_format check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint categories_icon_length check (icon is null or char_length(icon) <= 40),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id),
  -- A parent always has the same owner AND the same kind.
  constraint categories_parent_fk
    foreign key (parent_id, user_id, kind) references public.categories (id, user_id, kind)
    on delete restrict
);

create unique index categories_user_kind_name_key on public.categories (user_id, kind, lower(name));
create index categories_parent_idx on public.categories (parent_id) where parent_id is not null;

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- One level only: a parent can't have a parent, and a category with children
-- can't get one.
create or replace function public.categories_enforce_one_level()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if exists (select 1 from public.categories where id = new.parent_id and parent_id is not null) then
    raise exception 'A subcategory cannot have its own subcategories'
      using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.categories where parent_id = new.id) then
    raise exception 'A category with subcategories cannot become a subcategory'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger categories_enforce_one_level
  before insert or update of parent_id on public.categories
  for each row execute function public.categories_enforce_one_level();

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------

create table public.transactions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind                 text not null,
  status               text not null default 'posted',
  amount               bigint not null,
  account_id           uuid not null,
  to_account_id        uuid,
  fee_amount           bigint not null default 0,
  category_id          uuid,
  payee                text,
  note                 text,
  -- The user's local calendar date (Asia/Makassar by default), not a UTC instant.
  occurred_on          date not null,
  adjustment_direction text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint transactions_kind_check check (kind in ('expense', 'income', 'transfer', 'adjustment')),
  constraint transactions_status_check check (status in ('posted', 'planned')),
  constraint transactions_amount_positive check (amount > 0),
  constraint transactions_fee_non_negative check (fee_amount >= 0),
  constraint transactions_payee_length check (payee is null or char_length(payee) <= 120),
  constraint transactions_note_length check (note is null or char_length(note) <= 1000),
  constraint transactions_direction_values check (adjustment_direction is null or adjustment_direction in ('in', 'out')),

  -- Shape per kind.
  constraint transactions_transfer_target check (
    kind <> 'transfer' or (to_account_id is not null and to_account_id <> account_id)
  ),
  constraint transactions_non_transfer_no_target check (
    kind = 'transfer' or (to_account_id is null and fee_amount = 0)
  ),
  constraint transactions_transfer_adjustment_no_category check (
    kind not in ('transfer', 'adjustment') or category_id is null
  ),
  constraint transactions_adjustment_direction check (
    (kind = 'adjustment') = (adjustment_direction is not null)
  ),

  -- Composite FKs: never another user's account or category. RESTRICT, because
  -- used accounts and categories are archived, never deleted.
  constraint transactions_account_fk
    foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  constraint transactions_to_account_fk
    foreign key (to_account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  -- Including `kind` makes "the category's kind matches the transaction's kind"
  -- declarative: an income category can't be put on an expense, with no trigger.
  -- MATCH SIMPLE (the default) skips the check when category_id is NULL, so
  -- uncategorised rows, transfers and adjustments pass.
  constraint transactions_category_fk
    foreign key (category_id, user_id, kind) references public.categories (id, user_id, kind) on delete restrict
);

comment on table public.transactions is
  'Money in and out, integer rupiah. Hard-deleted; undo re-inserts the same row and id. Planned rows never count toward balances.';

create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);
create index transactions_user_category_date_idx on public.transactions (user_id, category_id, occurred_on);
create index transactions_user_account_date_idx on public.transactions (user_id, account_id, occurred_on);
create index transactions_to_account_idx on public.transactions (to_account_id) where to_account_id is not null;

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

revoke all on public.accounts, public.categories, public.transactions from anon, authenticated;
grant select, insert, update, delete on public.accounts, public.categories, public.transactions to authenticated;

create policy "accounts: owner can read"   on public.accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "accounts: owner can insert" on public.accounts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "accounts: owner can update" on public.accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "accounts: owner can delete" on public.accounts for delete to authenticated using ((select auth.uid()) = user_id);

create policy "categories: owner can read"   on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories: owner can insert" on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories: owner can update" on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories: owner can delete" on public.categories for delete to authenticated using ((select auth.uid()) = user_id);

create policy "transactions: owner can read"   on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions: owner can insert" on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transactions: owner can update" on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions: owner can delete" on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Balances
-- ---------------------------------------------------------------------------
-- security_invoker: the view runs with the caller's rights, so RLS on accounts
-- and transactions applies and nobody sees another user's balances.

create view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  (a.opening_balance + coalesce(sum(
    case
      when t.kind = 'income' then t.amount
      when t.kind = 'expense' then -t.amount
      when t.kind = 'adjustment' and t.adjustment_direction = 'in' then t.amount
      when t.kind = 'adjustment' and t.adjustment_direction = 'out' then -t.amount
      when t.kind = 'transfer' and t.to_account_id = a.id then t.amount
      when t.kind = 'transfer' and t.account_id = a.id then -(t.amount + t.fee_amount)
      else 0
    end
  ), 0))::bigint as balance
from public.accounts a
left join public.transactions t
  on t.status = 'posted'
  and t.user_id = a.user_id
  and (t.account_id = a.id or t.to_account_id = a.id)
group by a.id, a.user_id, a.opening_balance;

comment on view public.account_balances is
  'Opening balance plus posted money in, minus posted money out (transfer fees on the sending account). Planned rows are ignored.';

revoke all on public.account_balances from anon, authenticated;
grant select on public.account_balances to authenticated;

-- ---------------------------------------------------------------------------
-- Default accounts and categories: lazy and idempotent
-- ---------------------------------------------------------------------------
-- Not seeded at sign-up: handle_new_user never runs again for existing users.
-- The app calls this when the finance pages first load. It seeds only when the
-- user has no accounts and no categories at all; archived rows count, so
-- archiving a default never brings it back. The advisory lock serialises two
-- concurrent first loads.

create or replace function public.ensure_finance_defaults()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text));

  if exists (select 1 from public.accounts where user_id = v_user)
     or exists (select 1 from public.categories where user_id = v_user) then
    return;
  end if;

  insert into public.accounts (user_id, name, type, color, sort_order) values
    (v_user, 'Livin'' by Mandiri', 'bank',    '#1c7ed6', 1),
    (v_user, 'DANA',               'ewallet', '#228be6', 2),
    (v_user, 'GoPay',              'ewallet', '#0ca678', 3),
    (v_user, 'Cash',               'cash',    '#5c940d', 4);

  insert into public.categories (user_id, name, kind, color, sort_order) values
    (v_user, 'Food',          'expense', '#f08c00', 1),
    (v_user, 'Transport',     'expense', '#1c7ed6', 2),
    (v_user, 'Kos/Rent',      'expense', '#7048e8', 3),
    (v_user, 'Tuition (UKT)', 'expense', '#e8590c', 4),
    (v_user, 'Subscriptions', 'expense', '#d6336c', 5),
    (v_user, 'Shopping',      'expense', '#ae3ec9', 6),
    (v_user, 'Health',        'expense', '#2f9e44', 7),
    (v_user, 'Entertainment', 'expense', '#0c8599', 8),
    (v_user, 'Other',         'expense', '#868e96', 9),
    (v_user, 'Allowance',     'income',  '#2f9e44', 1),
    (v_user, 'Scholarship',   'income',  '#1c7ed6', 2),
    (v_user, 'Part-time',     'income',  '#f08c00', 3),
    (v_user, 'Other',         'income',  '#868e96', 4);
end;
$$;

revoke execute on function public.ensure_finance_defaults() from public, anon;
grant execute on function public.ensure_finance_defaults() to authenticated;

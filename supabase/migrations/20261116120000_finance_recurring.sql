-- Finance phase 2a: recurring rules (bills, subscriptions, instalments, allowance).
--
-- A rule generates PLANNED transactions ahead of time (lazily, from the app),
-- so balances, budgets and safe-to-spend all read one source. "Mark paid"
-- turns a planned row into a posted one. Unique (recurring_rule_id, due_on)
-- makes generation idempotent; `generated_through` remembers how far a rule
-- was generated, so a deleted (skipped) occurrence is not recreated.

create table public.recurring_rules (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name               text not null,
  kind               text not null,
  amount             bigint not null,
  is_estimate        boolean not null default false,
  account_id         uuid not null,
  to_account_id      uuid,
  category_id        uuid,
  payee              text,
  cadence            text not null,
  interval_count     integer not null default 1,
  -- Day of the month (monthly, yearly); clamped to the month's last day when it's shorter.
  due_day            integer,
  starts_on          date not null,
  ends_on            date,
  instalments_total  integer,
  remind_days_before integer not null default 3,
  active             boolean not null default true,
  paused_until       date,
  create_task        boolean not null default false,
  generated_through  date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint recurring_rules_id_user_key unique (id, user_id),
  constraint recurring_rules_name_length check (char_length(name) between 1 and 80),
  constraint recurring_rules_kind_check check (kind in ('expense', 'income', 'transfer')),
  constraint recurring_rules_amount_positive check (amount > 0),
  constraint recurring_rules_cadence_check check (cadence in ('weekly', 'monthly', 'yearly')),
  constraint recurring_rules_interval_range check (interval_count between 1 and 24),
  constraint recurring_rules_due_day_range check (due_day is null or due_day between 1 and 31),
  constraint recurring_rules_due_day_needed check (cadence = 'weekly' or due_day is not null),
  constraint recurring_rules_end_after_start check (ends_on is null or ends_on >= starts_on),
  constraint recurring_rules_instalments_range check (instalments_total is null or instalments_total between 1 and 120),
  constraint recurring_rules_remind_range check (remind_days_before between 0 and 60),
  constraint recurring_rules_payee_length check (payee is null or char_length(payee) <= 120),
  constraint recurring_rules_transfer_target check (
    kind <> 'transfer' or (to_account_id is not null and to_account_id <> account_id and category_id is null)
  ),
  constraint recurring_rules_non_transfer_no_target check (kind = 'transfer' or to_account_id is null),

  constraint recurring_rules_account_fk
    foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  constraint recurring_rules_to_account_fk
    foreign key (to_account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  -- Same trick as transactions: the category's kind must match the rule's kind.
  constraint recurring_rules_category_fk
    foreign key (category_id, user_id, kind) references public.categories (id, user_id, kind) on delete restrict
);

create unique index recurring_rules_user_name_key on public.recurring_rules (user_id, lower(name));

create trigger recurring_rules_set_updated_at
  before update on public.recurring_rules
  for each row execute function public.set_updated_at();

alter table public.recurring_rules enable row level security;
revoke all on public.recurring_rules from anon, authenticated;
grant select, insert, update, delete on public.recurring_rules to authenticated;

create policy "recurring_rules: owner can read"   on public.recurring_rules for select to authenticated using ((select auth.uid()) = user_id);
create policy "recurring_rules: owner can insert" on public.recurring_rules for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recurring_rules: owner can update" on public.recurring_rules for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recurring_rules: owner can delete" on public.recurring_rules for delete to authenticated using ((select auth.uid()) = user_id);

-- Transactions remember the rule and the occurrence they came from.
alter table public.transactions
  add column recurring_rule_id uuid,
  add column due_on date,
  -- Deleting a rule keeps its posted history (the link is cleared, user_id stays).
  add constraint transactions_recurring_rule_fk
    foreign key (recurring_rule_id, user_id) references public.recurring_rules (id, user_id)
    on delete set null (recurring_rule_id),
  add constraint transactions_rule_due_key unique (recurring_rule_id, due_on);

create index transactions_user_rule_idx on public.transactions (user_id, recurring_rule_id) where recurring_rule_id is not null;

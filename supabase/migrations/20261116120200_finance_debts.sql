-- Finance phase 2d: debts as transaction kinds (not a separate ledger).
--
-- Every balance still comes from transactions. Four new kinds move real money
-- and name a person:
--   lend    you front money        (outflow)   they owe you more
--   repay   they pay you back      (inflow)    they owe you less
--   borrow  you borrow money       (inflow)    you owe them more
--   payback you pay them back      (outflow)   you owe them less
-- They are neither spending nor income: reports leave them out.

create table public.people (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint people_id_user_key unique (id, user_id),
  constraint people_name_length check (char_length(name) between 1 and 60)
);

create unique index people_user_name_key on public.people (user_id, lower(name));

create trigger people_set_updated_at
  before update on public.people
  for each row execute function public.set_updated_at();

alter table public.people enable row level security;
revoke all on public.people from anon, authenticated;
grant select, insert, update, delete on public.people to authenticated;

create policy "people: owner can read"   on public.people for select to authenticated using ((select auth.uid()) = user_id);
create policy "people: owner can insert" on public.people for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "people: owner can update" on public.people for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "people: owner can delete" on public.people for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.transactions
  add column person_id uuid,
  drop constraint transactions_kind_check,
  add constraint transactions_kind_check check (
    kind in ('expense', 'income', 'transfer', 'adjustment', 'lend', 'repay', 'borrow', 'payback')
  ),
  -- Debt kinds need a person; nothing else has one.
  add constraint transactions_debt_person check (
    (kind in ('lend', 'repay', 'borrow', 'payback')) = (person_id is not null)
  ),
  -- Only income and expenses have a category (was: not transfer or adjustment).
  drop constraint transactions_transfer_adjustment_no_category,
  add constraint transactions_only_in_out_category check (kind in ('expense', 'income') or category_id is null),
  -- RESTRICT: a person with history is archived, not deleted.
  add constraint transactions_person_fk
    foreign key (person_id, user_id) references public.people (id, user_id) on delete restrict;

create index transactions_user_person_idx on public.transactions (user_id, person_id) where person_id is not null;

-- Balances: the debt kinds move the account's money like income/expenses do.
create or replace view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  (a.opening_balance + coalesce(sum(
    case
      when t.kind = 'income' then t.amount
      when t.kind = 'expense' then -t.amount
      when t.kind in ('repay', 'borrow') then t.amount
      when t.kind in ('lend', 'payback') then -t.amount
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

-- Per person: positive = they owe you, negative = you owe them. Posted rows only.
create view public.person_balances
with (security_invoker = true) as
select
  p.id as person_id,
  p.user_id,
  coalesce(sum(
    case
      when t.kind = 'lend' then t.amount
      when t.kind = 'repay' then -t.amount
      when t.kind = 'borrow' then -t.amount
      when t.kind = 'payback' then t.amount
      else 0
    end
  ), 0)::bigint as balance
from public.people p
left join public.transactions t
  on t.person_id = p.id
  and t.user_id = p.user_id
  and t.status = 'posted'
group by p.id, p.user_id;

comment on view public.person_balances is
  'Per person: lent + paid back − repaid − borrowed. Positive means they owe you. Planned rows are ignored.';

revoke all on public.person_balances from anon, authenticated;
grant select on public.person_balances to authenticated;

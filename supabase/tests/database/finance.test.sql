-- Finance: shapes, composite FKs, one-level categories, restrict deletes,
-- balances, lazy seeding, grants and cross-user isolation.
begin;
select plan(45);

insert into auth.users (id, email) values
  ('f1000000-0000-4000-8000-000000000001', 'fin-a@test.local'),
  ('f2000000-0000-4000-8000-000000000002', 'fin-b@test.local'),
  ('f3000000-0000-4000-8000-000000000003', 'fin-c@test.local'),
  ('f4000000-0000-4000-8000-000000000004', 'fin-d@test.local');

-- A's accounts: A1 (main), A2 (receives a transfer), A3 (never used).
insert into public.accounts (id, user_id, name, type, opening_balance) values
  ('fa000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-000000000001', 'Livin', 'bank', 1000000),
  ('fa000000-0000-4000-8000-0000000000a2', 'f1000000-0000-4000-8000-000000000001', 'DANA', 'ewallet', 0),
  ('fa000000-0000-4000-8000-0000000000a3', 'f1000000-0000-4000-8000-000000000001', 'Cash', 'cash', 50000);
-- B's own account.
insert into public.accounts (id, user_id, name, type) values
  ('fb000000-0000-4000-8000-0000000000b1', 'f2000000-0000-4000-8000-000000000002', 'B bank', 'bank');

-- A's categories.
insert into public.categories (id, user_id, name, kind) values
  ('fc000000-0000-4000-8000-0000000000e1', 'f1000000-0000-4000-8000-000000000001', 'Food', 'expense'),
  ('fc000000-0000-4000-8000-0000000000e2', 'f1000000-0000-4000-8000-000000000001', 'Transport', 'expense'),
  ('fc000000-0000-4000-8000-0000000000c1', 'f1000000-0000-4000-8000-000000000001', 'Allowance', 'income');

-- Posted: income 500 000, expense 200 000, adjustment in 10 000 and out 5 000,
-- transfer 100 000 + fee 2 500 from A1 to A2. Planned: an expense of 999 000.
insert into public.transactions (user_id, kind, status, amount, account_id, to_account_id, fee_amount, category_id, occurred_on, adjustment_direction) values
  ('f1000000-0000-4000-8000-000000000001', 'income',     'posted',  500000, 'fa000000-0000-4000-8000-0000000000a1', null, 0, 'fc000000-0000-4000-8000-0000000000c1', '2026-11-01', null),
  ('f1000000-0000-4000-8000-000000000001', 'expense',    'posted',  200000, 'fa000000-0000-4000-8000-0000000000a1', null, 0, 'fc000000-0000-4000-8000-0000000000e1', '2026-11-02', null),
  ('f1000000-0000-4000-8000-000000000001', 'adjustment', 'posted',   10000, 'fa000000-0000-4000-8000-0000000000a1', null, 0, null, '2026-11-03', 'in'),
  ('f1000000-0000-4000-8000-000000000001', 'adjustment', 'posted',    5000, 'fa000000-0000-4000-8000-0000000000a1', null, 0, null, '2026-11-04', 'out'),
  ('f1000000-0000-4000-8000-000000000001', 'transfer',   'posted',  100000, 'fa000000-0000-4000-8000-0000000000a1', 'fa000000-0000-4000-8000-0000000000a2', 2500, null, '2026-11-05', null),
  ('f1000000-0000-4000-8000-000000000001', 'expense',    'planned', 999000, 'fa000000-0000-4000-8000-0000000000a1', null, 0, 'fc000000-0000-4000-8000-0000000000e1', '2026-11-30', null);

-- ---------------------------------------------------------------- shape checks (9)
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, occurred_on)
     values ('f1000000-0000-4000-8000-000000000001', 'expense', 0, 'fa000000-0000-4000-8000-0000000000a1', '2026-11-06') $$,
  '23514', null, 'amount 0 rejected'
);
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, to_account_id, occurred_on)
     values ('f1000000-0000-4000-8000-000000000001', 'transfer', 100, 'fa000000-0000-4000-8000-0000000000a1', 'fa000000-0000-4000-8000-0000000000a1', '2026-11-06') $$,
  '23514', null, 'transfer to the same account rejected'
);
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, occurred_on)
     values ('f1000000-0000-4000-8000-000000000001', 'transfer', 100, 'fa000000-0000-4000-8000-0000000000a1', '2026-11-06') $$,
  '23514', null, 'transfer without to_account_id rejected'
);
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, to_account_id, occurred_on)
     values ('f1000000-0000-4000-8000-000000000001', 'expense', 100, 'fa000000-0000-4000-8000-0000000000a1', 'fa000000-0000-4000-8000-0000000000a2', '2026-11-06') $$,
  '23514', null, 'non-transfer with to_account_id rejected'
);
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, fee_amount, occurred_on)
     values ('f1000000-0000-4000-8000-000000000001', 'income', 100, 'fa000000-0000-4000-8000-0000000000a1', 50, '2026-11-06') $$,
  '23514', null, 'non-transfer with a fee rejected'
);
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, category_id, occurred_on)
     values ('f1000000-0000-4000-8000-000000000001', 'expense', 100, 'fa000000-0000-4000-8000-0000000000a1', 'fc000000-0000-4000-8000-0000000000c1', '2026-11-06') $$,
  '23503', null, 'category kind mismatch rejected (income category on an expense)'
);
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, occurred_on)
     values ('f1000000-0000-4000-8000-000000000001', 'adjustment', 100, 'fa000000-0000-4000-8000-0000000000a1', '2026-11-06') $$,
  '23514', null, 'adjustment without direction rejected'
);
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, occurred_on, adjustment_direction)
     values ('f1000000-0000-4000-8000-000000000001', 'expense', 100, 'fa000000-0000-4000-8000-0000000000a1', '2026-11-06', 'out') $$,
  '23514', null, 'expense with a direction rejected'
);
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, to_account_id, category_id, occurred_on)
     values ('f1000000-0000-4000-8000-000000000001', 'transfer', 100, 'fa000000-0000-4000-8000-0000000000a1', 'fa000000-0000-4000-8000-0000000000a2', 'fc000000-0000-4000-8000-0000000000e1', '2026-11-06') $$,
  '23514', null, 'transfer with a category rejected'
);

-- ---------------------------------------------------------------- parent categories (4)
select lives_ok(
  $$ insert into public.categories (id, user_id, name, kind, parent_id)
     values ('fc000000-0000-4000-8000-0000000000e3', 'f1000000-0000-4000-8000-000000000001', 'Snacks', 'expense', 'fc000000-0000-4000-8000-0000000000e1') $$,
  'a subcategory of the same kind is accepted'
);
select throws_ok(
  $$ insert into public.categories (user_id, name, kind, parent_id)
     values ('f1000000-0000-4000-8000-000000000001', 'Chips', 'expense', 'fc000000-0000-4000-8000-0000000000e3') $$,
  '23514', null, 'two-level nesting rejected'
);
select throws_ok(
  $$ update public.categories set parent_id = 'fc000000-0000-4000-8000-0000000000e2'
     where id = 'fc000000-0000-4000-8000-0000000000e1' $$,
  '23514', null, 'a category with children cannot get a parent'
);
select throws_ok(
  $$ insert into public.categories (user_id, name, kind, parent_id)
     values ('f1000000-0000-4000-8000-000000000001', 'Pocket money', 'income', 'fc000000-0000-4000-8000-0000000000e1') $$,
  '23503', null, 'cross-kind parent rejected'
);

-- ---------------------------------------------------------------- restrict deletes (2)
select throws_ok(
  $$ delete from public.accounts where id = 'fa000000-0000-4000-8000-0000000000a1' $$,
  '23503', null, 'an account used by a transaction cannot be deleted'
);
select throws_ok(
  $$ delete from public.categories where id = 'fc000000-0000-4000-8000-0000000000c1' $$,
  '23503', null, 'a category used by a transaction cannot be deleted'
);

-- ---------------------------------------------------------------- balances (3)
-- 1 000 000 + 500 000 - 200 000 + 10 000 - 5 000 - (100 000 + 2 500); the planned 999 000 is ignored.
select is(
  (select balance from public.account_balances where account_id = 'fa000000-0000-4000-8000-0000000000a1'),
  1202500::bigint, 'A1: every kind counted, transfer fee on the sender, planned row ignored'
);
select is(
  (select balance from public.account_balances where account_id = 'fa000000-0000-4000-8000-0000000000a2'),
  100000::bigint, 'A2: an incoming transfer counts without the fee'
);
select is(
  (select balance from public.account_balances where account_id = 'fa000000-0000-4000-8000-0000000000a3'),
  50000::bigint, 'A3: an account with no transactions shows its opening balance'
);

-- ---------------------------------------------------------------- grants (8)
select table_privs_are('public', 'accounts', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'categories', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'transactions', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'account_balances', 'authenticated', array['SELECT']);
select table_privs_are('public', 'accounts', 'anon', array[]::text[]);
select table_privs_are('public', 'categories', 'anon', array[]::text[]);
select table_privs_are('public', 'transactions', 'anon', array[]::text[]);
select table_privs_are('public', 'account_balances', 'anon', array[]::text[]);

-- ---------------------------------------------------------------- isolation: act as B (9)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is((select count(*)::int from public.accounts where user_id = 'f1000000-0000-4000-8000-000000000001'), 0, 'B cannot read A''s accounts');
select is((select count(*)::int from public.categories), 0, 'B cannot read A''s categories');
select is((select count(*)::int from public.transactions), 0, 'B cannot read A''s transactions');
select is(
  (select count(*)::int from public.account_balances where user_id = 'f1000000-0000-4000-8000-000000000001'), 0,
  'B cannot see A''s balances through account_balances'
);

update public.accounts set name = 'hacked' where id = 'fa000000-0000-4000-8000-0000000000a1';
update public.categories set name = 'hacked' where id = 'fc000000-0000-4000-8000-0000000000e1';
delete from public.transactions;
delete from public.categories where id = 'fc000000-0000-4000-8000-0000000000e2';

select throws_ok(
  $$ insert into public.transactions (kind, amount, account_id, occurred_on)
     values ('expense', 100, 'fa000000-0000-4000-8000-0000000000a1', '2026-11-06') $$,
  '23503', null, 'B cannot use A''s account'
);
select throws_ok(
  $$ insert into public.transactions (kind, amount, account_id, category_id, occurred_on)
     values ('expense', 100, 'fb000000-0000-4000-8000-0000000000b1', 'fc000000-0000-4000-8000-0000000000e1', '2026-11-06') $$,
  '23503', null, 'B cannot use A''s category'
);
select throws_ok(
  $$ insert into public.transactions (kind, amount, account_id, to_account_id, occurred_on)
     values ('transfer', 100, 'fb000000-0000-4000-8000-0000000000b1', 'fa000000-0000-4000-8000-0000000000a2', '2026-11-06') $$,
  '23503', null, 'B cannot transfer into A''s account'
);
select throws_ok(
  $$ insert into public.categories (name, kind, parent_id)
     values ('Sneaky', 'expense', 'fc000000-0000-4000-8000-0000000000e1') $$,
  '23503', null, 'B cannot nest a category under A''s'
);
select throws_ok(
  $$ insert into public.accounts (user_id, name, type)
     values ('f1000000-0000-4000-8000-000000000001', 'Forged', 'cash') $$,
  '42501', null, 'B cannot insert an account owned by A'
);

reset role;
select is((select name from public.accounts where id = 'fa000000-0000-4000-8000-0000000000a1'), 'Livin', 'A''s account was not renamed by B');
select is(
  (select count(*)::int from public.categories where user_id = 'f1000000-0000-4000-8000-000000000001'), 4,
  'A''s categories were not renamed or deleted by B'
);
select is(
  (select count(*)::int from public.transactions where user_id = 'f1000000-0000-4000-8000-000000000001'), 6,
  'A''s transactions were not deleted by B'
);

-- ---------------------------------------------------------------- lazy seeding (7)
select is(has_function_privilege('anon', 'public.ensure_finance_defaults()', 'execute'), false, 'anon cannot seed');

-- D only has an archived category (inserted before switching role).
insert into public.categories (user_id, name, kind, archived_at)
  values ('f4000000-0000-4000-8000-000000000004', 'Old', 'expense', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$ begin perform public.ensure_finance_defaults(); end $$;
select is((select count(*)::int from public.accounts), 4, 'first call seeds four accounts');
select is((select count(*)::int from public.categories), 13, 'first call seeds 9 expense + 4 income categories');
do $$ begin perform public.ensure_finance_defaults(); end $$;
select is((select count(*)::int from public.accounts), 4, 'second call adds no accounts');
select is((select count(*)::int from public.categories), 13, 'second call adds no categories');

select set_config('request.jwt.claims', '{"sub":"f4000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin perform public.ensure_finance_defaults(); end $$;
select is((select count(*)::int from public.accounts), 0, 'a user with only archived rows gets no accounts');
select is((select count(*)::int from public.categories), 1, 'a user with only archived rows is not re-seeded');

reset role;
select * from finish();
rollback;

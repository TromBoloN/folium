-- Finance phase 2: recurring rules, budgets, goals, debts (people + kinds),
-- import batches, task/course links, notification log. Shapes, composite FKs,
-- balances and cross-user isolation.
begin;
select plan(57);

insert into auth.users (id, email) values
  ('e1000000-0000-4000-8000-000000000001', 'p2-a@test.local'),
  ('e2000000-0000-4000-8000-000000000002', 'p2-b@test.local');

insert into public.accounts (id, user_id, name, type, opening_balance) values
  ('ea000000-0000-4000-8000-0000000000a1', 'e1000000-0000-4000-8000-000000000001', 'Livin', 'bank', 100000),
  ('ea000000-0000-4000-8000-0000000000a2', 'e1000000-0000-4000-8000-000000000001', 'Tabungan', 'savings', 0),
  ('ea000000-0000-4000-8000-0000000000a3', 'e1000000-0000-4000-8000-000000000001', 'Darurat', 'savings', 0),
  ('eb000000-0000-4000-8000-0000000000b1', 'e2000000-0000-4000-8000-000000000002', 'B bank', 'bank', 0);

insert into public.categories (id, user_id, name, kind) values
  ('ec000000-0000-4000-8000-0000000000e1', 'e1000000-0000-4000-8000-000000000001', 'Food', 'expense'),
  ('ec000000-0000-4000-8000-0000000000c1', 'e1000000-0000-4000-8000-000000000001', 'Allowance', 'income');

insert into public.people (id, user_id, name) values
  ('ed000000-0000-4000-8000-0000000000d1', 'e1000000-0000-4000-8000-000000000001', 'Budi'),
  ('ed000000-0000-4000-8000-0000000000d2', 'e2000000-0000-4000-8000-000000000002', 'B friend');

-- ---------------------------------------------------------------- recurring rules (6)
insert into public.recurring_rules (id, user_id, name, kind, amount, account_id, category_id, cadence, due_day, starts_on) values
  ('ee000000-0000-4000-8000-0000000000f1', 'e1000000-0000-4000-8000-000000000001', 'Kos', 'expense', 900000,
   'ea000000-0000-4000-8000-0000000000a1', 'ec000000-0000-4000-8000-0000000000e1', 'monthly', 31, '2026-11-01');

select throws_ok(
  $$ insert into public.recurring_rules (user_id, name, kind, amount, account_id, cadence, starts_on)
     values ('e1000000-0000-4000-8000-000000000001', 'No day', 'expense', 1, 'ea000000-0000-4000-8000-0000000000a1', 'monthly', '2026-11-01') $$,
  '23514', null, 'a monthly rule needs a due day');
select throws_ok(
  $$ insert into public.recurring_rules (user_id, name, kind, amount, account_id, cadence, starts_on)
     values ('e1000000-0000-4000-8000-000000000001', 'Top up', 'transfer', 1, 'ea000000-0000-4000-8000-0000000000a1', 'weekly', '2026-11-01') $$,
  '23514', null, 'a transfer rule needs a target account');
select throws_ok(
  $$ insert into public.recurring_rules (user_id, name, kind, amount, account_id, category_id, cadence, due_day, starts_on)
     values ('e1000000-0000-4000-8000-000000000001', 'Wrong kind', 'expense', 1, 'ea000000-0000-4000-8000-0000000000a1',
             'ec000000-0000-4000-8000-0000000000c1', 'monthly', 1, '2026-11-01') $$,
  '23503', null, 'a rule''s category must have the rule''s kind');
select throws_ok(
  $$ insert into public.recurring_rules (user_id, name, kind, amount, account_id, cadence, due_day, starts_on)
     values ('e1000000-0000-4000-8000-000000000001', 'Not mine', 'expense', 1, 'eb000000-0000-4000-8000-0000000000b1', 'monthly', 1, '2026-11-01') $$,
  '23503', null, 'a rule can''t use another user''s account');

insert into public.transactions (id, user_id, kind, status, amount, account_id, category_id, occurred_on, recurring_rule_id, due_on) values
  ('ef000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'expense', 'posted', 900000,
   'ea000000-0000-4000-8000-0000000000a1', 'ec000000-0000-4000-8000-0000000000e1', '2026-11-30', 'ee000000-0000-4000-8000-0000000000f1', '2026-11-30');

select throws_ok(
  $$ insert into public.transactions (user_id, kind, status, amount, account_id, occurred_on, recurring_rule_id, due_on)
     values ('e1000000-0000-4000-8000-000000000001', 'expense', 'planned', 1, 'ea000000-0000-4000-8000-0000000000a1', '2026-11-30',
             'ee000000-0000-4000-8000-0000000000f1', '2026-11-30') $$,
  '23505', null, 'one transaction per rule and due date (idempotent generation)');

delete from public.recurring_rules where id = 'ee000000-0000-4000-8000-0000000000f1';
select is(
  (select recurring_rule_id from public.transactions where id = 'ef000000-0000-4000-8000-000000000001'), null,
  'deleting a rule keeps its posted history, unlinked');

-- ---------------------------------------------------------------- budgets and goals (5)
select throws_ok(
  $$ insert into public.budgets (user_id, category_id, month, amount)
     values ('e1000000-0000-4000-8000-000000000001', 'ec000000-0000-4000-8000-0000000000c1', '2026-11-01', 1000) $$,
  '23503', null, 'only expense categories can have a budget');
select throws_ok(
  $$ insert into public.budgets (user_id, category_id, month, amount)
     values ('e1000000-0000-4000-8000-000000000001', 'ec000000-0000-4000-8000-0000000000e1', '2026-11-15', 1000) $$,
  '23514', null, 'a budget month is the first day of the month');
insert into public.budgets (user_id, category_id, month, amount)
  values ('e1000000-0000-4000-8000-000000000001', 'ec000000-0000-4000-8000-0000000000e1', '2026-11-01', 1000000);
select throws_ok(
  $$ insert into public.budgets (user_id, category_id, month, amount)
     values ('e1000000-0000-4000-8000-000000000001', 'ec000000-0000-4000-8000-0000000000e1', '2026-11-01', 5) $$,
  '23505', null, 'one budget per category and month');
select throws_ok(
  $$ insert into public.goals (user_id, name, target_amount, account_id)
     values ('e1000000-0000-4000-8000-000000000001', 'Laptop', 8000000, 'ea000000-0000-4000-8000-0000000000a1') $$,
  '23503', null, 'a goal''s account must be a savings account');
insert into public.goals (user_id, name, target_amount, account_id)
  values ('e1000000-0000-4000-8000-000000000001', 'Laptop', 8000000, 'ea000000-0000-4000-8000-0000000000a2');
select is(
  (select is_spendable from public.accounts where id = 'ea000000-0000-4000-8000-0000000000a2'), true,
  'new accounts default to spendable (savings are flipped by the app and the migration)');

-- ---------------------------------------------------------------- debts (7)
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, occurred_on)
     values ('e1000000-0000-4000-8000-000000000001', 'lend', 10000, 'ea000000-0000-4000-8000-0000000000a1', '2026-11-10') $$,
  '23514', null, 'a lend needs a person');
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, occurred_on, person_id, category_id)
     values ('e1000000-0000-4000-8000-000000000001', 'lend', 10000, 'ea000000-0000-4000-8000-0000000000a1', '2026-11-10',
             'ed000000-0000-4000-8000-0000000000d1', 'ec000000-0000-4000-8000-0000000000e1') $$,
  '23514', null, 'a lend has no category');
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, occurred_on, person_id, category_id)
     values ('e1000000-0000-4000-8000-000000000001', 'expense', 10000, 'ea000000-0000-4000-8000-0000000000a1', '2026-11-10',
             'ed000000-0000-4000-8000-0000000000d1', null) $$,
  '23514', null, 'an expense has no person');
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, occurred_on, person_id)
     values ('e1000000-0000-4000-8000-000000000001', 'lend', 10000, 'ea000000-0000-4000-8000-0000000000a1', '2026-11-10',
             'ed000000-0000-4000-8000-0000000000d2') $$,
  '23503', null, 'can''t lend to another user''s person');

-- Lend 50 000, repaid 20 000, borrow 30 000, paid back 10 000 (posted); a planned lend of 999 is ignored.
insert into public.transactions (user_id, kind, status, amount, account_id, occurred_on, person_id) values
  ('e1000000-0000-4000-8000-000000000001', 'lend',    'posted',  50000, 'ea000000-0000-4000-8000-0000000000a1', '2026-11-10', 'ed000000-0000-4000-8000-0000000000d1'),
  ('e1000000-0000-4000-8000-000000000001', 'repay',   'posted',  20000, 'ea000000-0000-4000-8000-0000000000a1', '2026-11-11', 'ed000000-0000-4000-8000-0000000000d1'),
  ('e1000000-0000-4000-8000-000000000001', 'borrow',  'posted',  30000, 'ea000000-0000-4000-8000-0000000000a1', '2026-11-12', 'ed000000-0000-4000-8000-0000000000d1'),
  ('e1000000-0000-4000-8000-000000000001', 'payback', 'posted',  10000, 'ea000000-0000-4000-8000-0000000000a1', '2026-11-13', 'ed000000-0000-4000-8000-0000000000d1'),
  ('e1000000-0000-4000-8000-000000000001', 'lend',    'planned',   999, 'ea000000-0000-4000-8000-0000000000a1', '2026-11-14', 'ed000000-0000-4000-8000-0000000000d1');

-- 100 000 − 900 000 (kos) − 50 000 + 20 000 + 30 000 − 10 000 = −810 000
select is(
  (select balance from public.account_balances where account_id = 'ea000000-0000-4000-8000-0000000000a1'), -810000::bigint,
  'account balance counts the debt kinds (lend/payback out, repay/borrow in)');
-- 50 000 − 20 000 − 30 000 + 10 000 = 10 000 (Budi owes A)
select is(
  (select balance from public.person_balances where person_id = 'ed000000-0000-4000-8000-0000000000d1'), 10000::bigint,
  'person balance: lent + paid back − repaid − borrowed, posted only');
select throws_ok(
  $$ delete from public.people where id = 'ed000000-0000-4000-8000-0000000000d1' $$,
  '23503', null, 'a person with history can''t be deleted (archive instead)');

-- ---------------------------------------------------------------- import, links (5)
insert into public.import_batches (id, user_id, account_id, filename, row_count) values
  ('e9000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'ea000000-0000-4000-8000-0000000000a1', 'livin.csv', 1);
insert into public.transactions (user_id, kind, amount, account_id, occurred_on, import_batch_id, import_key) values
  ('e1000000-0000-4000-8000-000000000001', 'expense', 15000, 'ea000000-0000-4000-8000-0000000000a1', '2026-11-01',
   'e9000000-0000-4000-8000-000000000001', '2026-11-01|15000|warteg');
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, occurred_on, import_key)
     values ('e1000000-0000-4000-8000-000000000001', 'expense', 15000, 'ea000000-0000-4000-8000-0000000000a1', '2026-11-01', '2026-11-01|15000|warteg') $$,
  '23505', null, 'the same import key on the same account is a duplicate');
delete from public.import_batches where id = 'e9000000-0000-4000-8000-000000000001';
select is(
  (select count(*)::int from public.transactions where import_key = '2026-11-01|15000|warteg'), 0,
  'deleting an import batch undoes its transactions');
select throws_ok(
  $$ insert into public.transactions (user_id, kind, amount, account_id, occurred_on, category_id, course_id)
     values ('e1000000-0000-4000-8000-000000000001', 'income', 1, 'ea000000-0000-4000-8000-0000000000a1', '2026-11-01',
             'ec000000-0000-4000-8000-0000000000c1', gen_random_uuid()) $$,
  '23514', null, 'only expenses can be tagged to a course');

insert into public.notification_log (user_id, kind, ref_key) values
  ('e1000000-0000-4000-8000-000000000001', 'bill_due', 'tx-1');
select throws_ok(
  $$ insert into public.notification_log (user_id, kind, ref_key) values ('e1000000-0000-4000-8000-000000000001', 'bill_due', 'tx-1') $$,
  '23505', null, 'a reminder is logged (and sent) once');

-- ---------------------------------------------------------------- bill-task cleanup (3)
-- A task linked from a transaction (the old bill marker) and an ordinary task with the
-- same title and no link. Only the linked one may go.
insert into public.tasks (id, user_id, title) values
  ('e7000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Pay Kos'),
  ('e7000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'Pay Kos');
update public.transactions set task_id = 'e7000000-0000-4000-8000-000000000001'
  where id = 'ef000000-0000-4000-8000-000000000001';
select is(public.cleanup_bill_tasks(), 1, 'the cleanup deletes only the task a bill links to');
select ok(
  exists (select 1 from public.tasks where id = 'e7000000-0000-4000-8000-000000000002'),
  'a task without the bill link survives, even with the same title');
select is(
  (select task_id from public.transactions where id = 'ef000000-0000-4000-8000-000000000001'), null,
  'the transaction''s link is cleared, the transaction stays');

-- Keep an active recurring rule and import batch for user A so isolation tests verify non-empty tables.
insert into public.recurring_rules (id, user_id, name, kind, amount, account_id, category_id, cadence, due_day, starts_on) values
  ('ee000000-0000-4000-8000-0000000000f2', 'e1000000-0000-4000-8000-000000000001', 'Internet', 'expense', 150000,
   'ea000000-0000-4000-8000-0000000000a1', 'ec000000-0000-4000-8000-0000000000e1', 'monthly', 15, '2026-11-01');
insert into public.import_batches (id, user_id, account_id, filename, row_count) values
  ('e9000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'ea000000-0000-4000-8000-0000000000a1', 'active.csv', 0);

-- ---------------------------------------------------------------- grants (18)
select table_privs_are('public', 'recurring_rules',  'anon',          array[]::text[], 'anon has no privileges on recurring_rules');
select table_privs_are('public', 'recurring_rules',  'authenticated', array['SELECT','INSERT','UPDATE','DELETE'], 'authenticated CRUD on recurring_rules');
select table_privs_are('public', 'budgets',          'anon',          array[]::text[], 'anon has no privileges on budgets');
select table_privs_are('public', 'budgets',          'authenticated', array['SELECT','INSERT','UPDATE','DELETE'], 'authenticated CRUD on budgets');
select table_privs_are('public', 'goals',            'anon',          array[]::text[], 'anon has no privileges on goals');
select table_privs_are('public', 'goals',            'authenticated', array['SELECT','INSERT','UPDATE','DELETE'], 'authenticated CRUD on goals');
select table_privs_are('public', 'people',           'anon',          array[]::text[], 'anon has no privileges on people');
select table_privs_are('public', 'people',           'authenticated', array['SELECT','INSERT','UPDATE','DELETE'], 'authenticated CRUD on people');
select table_privs_are('public', 'import_batches',   'anon',          array[]::text[], 'anon has no privileges on import_batches');
select table_privs_are('public', 'import_batches',   'authenticated', array['SELECT','INSERT','UPDATE','DELETE'], 'authenticated CRUD on import_batches');
select table_privs_are('public', 'notification_log', 'anon',          array[]::text[], 'anon has no privileges on notification_log');
select table_privs_are('public', 'notification_log', 'authenticated', array['SELECT'], 'authenticated read-only on notification_log');
select table_privs_are('public', 'person_balances',  'anon',          array[]::text[], 'anon has no privileges on person_balances');
select table_privs_are('public', 'person_balances',  'authenticated', array['SELECT'], 'authenticated read-only on person_balances');
select is(has_function_privilege('anon', 'public.cleanup_bill_tasks()', 'execute'), false, 'anon cannot run cleanup_bill_tasks');
select is(has_function_privilege('authenticated', 'public.cleanup_bill_tasks()', 'execute'), false, 'authenticated cannot run cleanup_bill_tasks');
select is(has_function_privilege('anon', 'public.set_current_meeting(uuid, smallint)', 'execute'), false, 'anon cannot run set_current_meeting');
select is(has_function_privilege('authenticated', 'public.set_current_meeting(uuid, smallint)', 'execute'), true, 'authenticated can run set_current_meeting');

-- ---------------------------------------------------------------- isolation as B (14)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is((select count(*)::int from public.recurring_rules), 0, 'B sees no recurring rules of A');
select is((select count(*)::int from public.budgets), 0, 'B sees no budgets of A');
select is((select count(*)::int from public.goals), 0, 'B sees no goals of A');
select is((select count(*)::int from public.people), 1, 'B sees only their own people');
select is((select count(*)::int from public.person_balances), 1, 'B sees only their own person balances');
select is((select count(*)::int from public.import_batches), 0, 'B sees no import batches of A');
select is((select count(*)::int from public.notification_log), 0, 'B sees no notification log of A');
select throws_ok(
  $$ insert into public.notification_log (user_id, kind, ref_key) values ('e2000000-0000-4000-8000-000000000002', 'bill_due', 'x') $$,
  '42501', null, 'users can''t write the notification log (only the server''s cron does)');
select throws_ok(
  $$ insert into public.budgets (user_id, category_id, month, amount)
     values ('e1000000-0000-4000-8000-000000000001', 'ec000000-0000-4000-8000-0000000000e1', '2026-12-01', 100) $$,
  '42501', null, 'B cannot forge a budget owned by A');
select throws_ok(
  $$ insert into public.import_batches (account_id, filename, row_count)
     values ('ea000000-0000-4000-8000-0000000000a1', 'hack.csv', 0) $$,
  '23503', null, 'B cannot create an import batch for A''s account');
select throws_ok(
  $$ insert into public.goals (name, target_amount, account_id)
     values ('Steal', 100, 'ea000000-0000-4000-8000-0000000000a3') $$,
  '23503', null, 'B cannot create a goal on A''s savings account');

update public.goals set name = 'hacked' where user_id = 'e1000000-0000-4000-8000-000000000001';
delete from public.recurring_rules where id = 'ee000000-0000-4000-8000-0000000000f2';
delete from public.import_batches where id = 'e9000000-0000-4000-8000-000000000002';

reset role;
select is((select name from public.goals where user_id = 'e1000000-0000-4000-8000-000000000001'), 'Laptop', 'A''s goal was not renamed by B');
select is((select count(*)::int from public.recurring_rules where id = 'ee000000-0000-4000-8000-0000000000f2'), 1, 'A''s recurring rule was not deleted by B');
select is((select count(*)::int from public.import_batches where id = 'e9000000-0000-4000-8000-000000000002'), 1, 'A''s import batch was not deleted by B');

select * from finish();
rollback;

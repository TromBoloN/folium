-- Tests for audit fixes (#3, #4, #8, #15):
--   attendance_number_meeting lowest-free numbering, rollover_semester,
--   split_timetable_slot, delete_all_finance_data, generate_recurring_transactions,
--   settle_person, adjust_account_balance, match_account_balance, and cross-user isolation.
begin;
select plan(24);

insert into auth.users (id, email) values
  ('a7777777-7777-7777-7777-777777777777', 'audit-a@test.local'),
  ('b8888888-8888-8888-8888-888888888888', 'audit-b@test.local');

-- ---------------------------------------------------------------- function grants
select ok(
  not has_function_privilege('anon', 'public.delete_all_finance_data()', 'execute')
  and not has_function_privilege('anon', 'public.rollover_semester(text, boolean, boolean, timestamptz, text, date, date)', 'execute')
  and not has_function_privilege('anon', 'public.split_timetable_slot(uuid, date, smallint, time, time, text)', 'execute')
  and not has_function_privilege('anon', 'public.generate_recurring_transactions(uuid, timestamptz, date, date[])', 'execute')
  and not has_function_privilege('anon', 'public.settle_person(uuid, uuid, date)', 'execute')
  and not has_function_privilege('anon', 'public.adjust_account_balance(uuid, bigint, date, text)', 'execute')
  and not has_function_privilege('anon', 'public.match_account_balance(uuid, bigint)', 'execute'),
  'anon cannot execute any of the new RPC functions'
);

-- ---------------------------------------------------------------- as user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7777777-7777-7777-7777-777777777777","role":"authenticated"}', true);

-- 1. attendance_number_meeting assigns the lowest free number (not max + 1)
insert into public.courses (id, name, semester, total_meetings) values
  ('a7777777-0000-0000-0000-000000000001', 'Algorithms', '2026 Ganjil', 4);
insert into public.timetable_slots (id, course_id, weekday, start_time, end_time) values
  ('a7777777-0000-0000-0000-000000000010', 'a7777777-0000-0000-0000-000000000001', 1, '08:00', '09:40');

insert into public.attendance (course_id, slot_id, occurs_on, status, meeting_number) values
  ('a7777777-0000-0000-0000-000000000001', 'a7777777-0000-0000-0000-000000000010', '2026-11-02', 'attended', 1),
  ('a7777777-0000-0000-0000-000000000001', 'a7777777-0000-0000-0000-000000000010', '2026-11-09', 'attended', 2),
  ('a7777777-0000-0000-0000-000000000001', 'a7777777-0000-0000-0000-000000000010', '2026-11-23', 'attended', 4);

insert into public.attendance (course_id, slot_id, occurs_on, status) values
  ('a7777777-0000-0000-0000-000000000001', 'a7777777-0000-0000-0000-000000000010', '2026-11-16', 'attended');

select is(
  (select meeting_number::int from public.attendance where occurs_on = '2026-11-16'),
  3,
  'attendance_number_meeting fills gap #3 instead of assigning #5'
);

-- 2. rollover_semester sets meetings_counted_from, copies slots, and archives old courses atomically
select is(
  public.rollover_semester('2026 Genap', true, true, '2027-01-31T16:00:00Z', '2026 Ganjil', '2027-02-01', '2027-06-01'),
  1,
  'rollover_semester returns the copied course count'
);
select is(
  (select meetings_counted_from from public.courses where semester = '2026 Genap'),
  '2027-01-31T16:00:00Z'::timestamptz,
  'rolled-over course gets meetings_counted_from'
);
select is(
  (select count(*)::int from public.timetable_slots s
     join public.courses c on c.id = s.course_id
    where c.semester = '2026 Genap' and s.starts_on = '2027-02-01' and s.ends_on = '2027-06-01'),
  1,
  'rolled-over slot copies with the new term dates'
);
select isnt(
  (select archived_at from public.courses where id = 'a7777777-0000-0000-0000-000000000001'),
  null,
  'old course is archived when archive_old is true'
);

-- 3. split_timetable_slot ends old slot, creates new slot, and clears future one-off changes
insert into public.class_changes (course_id, slot_id, kind, original_date, note) values
  ('a7777777-0000-0000-0000-000000000001', 'a7777777-0000-0000-0000-000000000010', 'cancelled', '2026-12-07', 'old'),
  ('a7777777-0000-0000-0000-000000000001', 'a7777777-0000-0000-0000-000000000010', 'cancelled', '2026-11-30', 'before');

select lives_ok(
  $$ select public.split_timetable_slot('a7777777-0000-0000-0000-000000000010', '2026-12-07', 2::smallint, '10:00', '11:40', 'B3.01') $$,
  'split_timetable_slot succeeds'
);
select is(
  (select ends_on from public.timetable_slots where id = 'a7777777-0000-0000-0000-000000000010'),
  '2026-12-06'::date,
  'old slot ends the day before split date'
);
select is(
  (select count(*)::int from public.timetable_slots where course_id = 'a7777777-0000-0000-0000-000000000001' and starts_on = '2026-12-07' and weekday = 2),
  1,
  'new slot starts on the split date with new weekday'
);
select is(
  (select count(*)::int from public.class_changes where slot_id = 'a7777777-0000-0000-0000-000000000010'),
  1,
  'only changes on or after split date are deleted'
);

-- 4. Finance setup for user A
insert into public.accounts (id, name, type, opening_balance) values
  ('a7777777-0000-0000-0000-000000000020', 'Wallet', 'cash', 100000);
insert into public.people (id, name) values
  ('a7777777-0000-0000-0000-000000000030', 'Budi');
insert into public.transactions (kind, amount, account_id, person_id, occurred_on) values
  ('lend', 50000, 'a7777777-0000-0000-0000-000000000020', 'a7777777-0000-0000-0000-000000000030', '2026-11-20');

-- 5. settle_person is idempotent on double-click
select results_eq(
  $$ select kind, amount, person_name from public.settle_person('a7777777-0000-0000-0000-000000000030', 'a7777777-0000-0000-0000-000000000020', '2026-11-22') $$,
  $$ values ('repay'::text, '50000'::text, 'Budi'::text) $$,
  'first settle_person settles the balance'
);
select is_empty(
  $$ select * from public.settle_person('a7777777-0000-0000-0000-000000000030', 'a7777777-0000-0000-0000-000000000020', '2026-11-22') $$,
  'second settle_person is a no-op (no duplicate settlement)'
);

-- 6. adjust_account_balance is idempotent on double-click; match_account_balance updates opening_balance
select is(
  public.adjust_account_balance('a7777777-0000-0000-0000-000000000020', 120000, '2026-11-22', 'Reconcile'),
  true,
  'first adjust_account_balance inserts an adjustment'
);
select is(
  public.adjust_account_balance('a7777777-0000-0000-0000-000000000020', 120000, '2026-11-22', 'Reconcile'),
  false,
  'second adjust_account_balance is a no-op (no duplicate adjustment)'
);
select lives_ok(
  $$ select public.match_account_balance('a7777777-0000-0000-0000-000000000020', 150000) $$,
  'match_account_balance updates opening balance'
);
select is(
  (select balance from public.account_balances where account_id = 'a7777777-0000-0000-0000-000000000020'),
  150000::bigint,
  'account balance matches target after match_account_balance'
);

-- 7. generate_recurring_transactions skips stale updated_at
insert into public.recurring_rules (id, name, kind, amount, account_id, cadence, due_day, starts_on) values
  ('a7777777-0000-0000-0000-000000000040', 'Kos', 'expense', 500000, 'a7777777-0000-0000-0000-000000000020', 'monthly', 1, '2026-11-01');

select is(
  public.generate_recurring_transactions(
    'a7777777-0000-0000-0000-000000000040',
    '2000-01-01T00:00:00Z'::timestamptz,
    '2026-12-31',
    array['2026-12-01'::date]
  ),
  0,
  'generate_recurring_transactions ignores stale updated_at'
);
select is(
  public.generate_recurring_transactions(
    'a7777777-0000-0000-0000-000000000040',
    (select updated_at from public.recurring_rules where id = 'a7777777-0000-0000-0000-000000000040'),
    '2026-12-31',
    array['2026-12-01'::date]
  ),
  1,
  'generate_recurring_transactions inserts planned rows when updated_at matches'
);

-- 8. Cross-user isolation as user B
select set_config('request.jwt.claims', '{"sub":"b8888888-8888-8888-8888-888888888888","role":"authenticated"}', true);

select throws_ok(
  $$ select public.split_timetable_slot('a7777777-0000-0000-0000-000000000010', '2026-12-07', 3::smallint, '10:00', '11:40', null) $$,
  'P0002', null, 'user B cannot split user A''s slot'
);
select throws_ok(
  $$ select public.adjust_account_balance('a7777777-0000-0000-0000-000000000020', 0, '2026-11-22', 'x') $$,
  'P0002', null, 'user B cannot adjust user A''s account'
);
select lives_ok(
  $$ select public.delete_all_finance_data() $$,
  'user B calling delete_all_finance_data succeeds without touching user A'
);

-- Switch back to user A: data still intact, then delete_all_finance_data clears user A's finance tables
select set_config('request.jwt.claims', '{"sub":"a7777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.accounts where id = 'a7777777-0000-0000-0000-000000000020'),
  1,
  'user A''s account survived user B''s delete_all_finance_data'
);
select lives_ok(
  $$ select public.delete_all_finance_data() $$,
  'user A delete_all_finance_data succeeds'
);
select is(
  (select count(*)::int from public.accounts where user_id = 'a7777777-7777-7777-7777-777777777777')
  + (select count(*)::int from public.transactions where user_id = 'a7777777-7777-7777-7777-777777777777')
  + (select count(*)::int from public.recurring_rules where user_id = 'a7777777-7777-7777-7777-777777777777')
  + (select count(*)::int from public.people where user_id = 'a7777777-7777-7777-7777-777777777777'),
  0,
  'all of user A''s finance rows are deleted'
);

reset role;
select * from finish();
rollback;

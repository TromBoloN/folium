-- Tests for mark_attendance_batch and sync_account_balances: status check,
-- multi-course numbering, multi-account sync, idempotency, and cross-user isolation.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('c1111111-1111-1111-1111-111111111111', 'catchup-a@test.local'),
  ('c2222222-2222-2222-2222-222222222222', 'catchup-b@test.local');

select ok(
  not has_function_privilege('anon', 'public.mark_attendance_batch(jsonb, text)', 'execute')
  and not has_function_privilege('anon', 'public.sync_account_balances(jsonb, date)', 'execute'),
  'anon cannot execute catch-up batch RPCs'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into public.courses (id, name, total_meetings) values
  ('c1111111-0000-0000-0000-000000000001', 'Algorithms', 16),
  ('c1111111-0000-0000-0000-000000000002', 'Calculus', 16);
insert into public.timetable_slots (id, course_id, weekday, start_time, end_time) values
  ('c1111111-0000-0000-0000-000000000011', 'c1111111-0000-0000-0000-000000000001', 1, '08:00', '09:40'),
  ('c1111111-0000-0000-0000-000000000012', 'c1111111-0000-0000-0000-000000000002', 2, '10:00', '11:40');
insert into public.class_changes (id, course_id, kind, new_date, start_time, end_time) values
  ('c1111111-0000-0000-0000-000000000021', 'c1111111-0000-0000-0000-000000000001', 'extra', '2026-11-18', '13:00', '14:00');

-- Rejects 'unknown' (only 'attended' or 'missed' allowed).
select throws_ok(
  $$ select public.mark_attendance_batch('[]'::jsonb, 'unknown') $$,
  '22023', null, 'mark_attendance_batch rejects unknown status'
);

-- Marks two courses in reverse course_id order; returns both keys and numbers each course starting at 1.
select is(
  public.mark_attendance_batch(
    jsonb_build_array(
      jsonb_build_object(
        'key', 's.c1111111-0000-0000-0000-000000000012.2026-11-17',
        'course_id', 'c1111111-0000-0000-0000-000000000002',
        'slot_id', 'c1111111-0000-0000-0000-000000000012',
        'occurs_on', '2026-11-17'
      ),
      jsonb_build_object(
        'key', 's.c1111111-0000-0000-0000-000000000011.2026-11-16',
        'course_id', 'c1111111-0000-0000-0000-000000000001',
        'slot_id', 'c1111111-0000-0000-0000-000000000011',
        'occurs_on', '2026-11-16'
      )
    ),
    'attended'
  ),
  array[
    's.c1111111-0000-0000-0000-000000000011.2026-11-16',
    's.c1111111-0000-0000-0000-000000000012.2026-11-17'
  ],
  'marks across multiple courses in sorted course_id order and returns inserted keys'
);

select is(
  (select count(*)::int from public.attendance where user_id = 'c1111111-1111-1111-1111-111111111111' and status = 'attended' and meeting_number = 1),
  2,
  'each course gets meeting_number = 1'
);

-- Re-running skips existing marks and returns empty array.
select is(
  public.mark_attendance_batch(
    jsonb_build_array(
      jsonb_build_object(
        'key', 's.c1111111-0000-0000-0000-000000000011.2026-11-16',
        'course_id', 'c1111111-0000-0000-0000-000000000001',
        'slot_id', 'c1111111-0000-0000-0000-000000000011',
        'occurs_on', '2026-11-16'
      )
    ),
    'missed'
  ),
  '{}'::text[],
  'already-marked occurrence is skipped without overwriting'
);

-- Supports extra sessions with 'missed'.
select is(
  public.mark_attendance_batch(
    jsonb_build_array(
      jsonb_build_object(
        'key', 'x.c1111111-0000-0000-0000-000000000021',
        'course_id', 'c1111111-0000-0000-0000-000000000001',
        'change_id', 'c1111111-0000-0000-0000-000000000021'
      )
    ),
    'missed'
  ),
  array['x.c1111111-0000-0000-0000-000000000021'],
  'marks extra session as missed'
);

select is(
  (select meeting_number::int from public.attendance where change_id = 'c1111111-0000-0000-0000-000000000021'),
  2,
  'extra session gets the next meeting number (2)'
);

-- sync_account_balances: multi-account batch, idempotency, and cross-user isolation.
insert into public.accounts (id, name, type, opening_balance) values
  ('c1111111-0000-0000-0000-000000000031', 'Bank A', 'bank', 500000),
  ('c1111111-0000-0000-0000-000000000032', 'Wallet B', 'cash', 100000);

select is(
  cardinality(
    public.sync_account_balances(
      jsonb_build_array(
        jsonb_build_object('account_id', 'c1111111-0000-0000-0000-000000000032', 'real_balance', 150000, 'note', 'Found cash'),
        jsonb_build_object('account_id', 'c1111111-0000-0000-0000-000000000031', 'real_balance', 350000)
      ),
      '2026-11-22'
    )
  ),
  2,
  'sync_account_balances inserts 2 adjustment rows for 2 changed accounts'
);

select is(
  (select balance from public.account_balances where account_id = 'c1111111-0000-0000-0000-000000000031'),
  350000::bigint,
  'first account balance equals target after sync'
);

select is(
  (select balance from public.account_balances where account_id = 'c1111111-0000-0000-0000-000000000032'),
  150000::bigint,
  'second account balance equals target after sync'
);

select is(
  cardinality(
    public.sync_account_balances(
      jsonb_build_array(
        jsonb_build_object('account_id', 'c1111111-0000-0000-0000-000000000031', 'real_balance', 350000),
        jsonb_build_object('account_id', 'c1111111-0000-0000-0000-000000000032', 'real_balance', 150000)
      ),
      '2026-11-22'
    )
  ),
  0,
  're-running sync_account_balances with same targets is a no-op'
);

-- Cross-user isolation: user B cannot mark user A's course/slot or sync user A's account.
select set_config('request.jwt.claims', '{"sub":"c2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok(
  $$
    select public.sync_account_balances(
      jsonb_build_array(
        jsonb_build_object('account_id', 'c1111111-0000-0000-0000-000000000031', 'real_balance', 0)
      ),
      '2026-11-22'
    )
  $$,
  'P0002', null, 'user B cannot sync user A''s account'
);
select throws_ok(
  $$
    select public.mark_attendance_batch(
      jsonb_build_array(
        jsonb_build_object(
          'key', 's.c1111111-0000-0000-0000-000000000011.2026-11-23',
          'course_id', 'c1111111-0000-0000-0000-000000000001',
          'slot_id', 'c1111111-0000-0000-0000-000000000011',
          'occurs_on', '2026-11-23'
        )
      ),
      'attended'
    )
  $$,
  '23503', null, 'user B cannot mark attendance on user A''s course'
);

reset role;
select * from finish();
rollback;

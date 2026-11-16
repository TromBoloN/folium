-- Schedule changes, breaks and attendance: shape constraints and cross-user isolation.
begin;
select plan(39);

insert into auth.users (id, email) values
  ('a3333333-3333-3333-3333-333333333333', 'sched-a@test.local'),
  ('b4444444-4444-4444-4444-444444444444', 'sched-b@test.local');

insert into public.courses (id, user_id, name) values
  ('a3333333-0000-0000-0000-000000000001', 'a3333333-3333-3333-3333-333333333333', 'Calculus'),
  ('a3333333-0000-0000-0000-000000000002', 'a3333333-3333-3333-3333-333333333333', 'Physics'),
  ('b4444444-0000-0000-0000-000000000001', 'b4444444-4444-4444-4444-444444444444', 'B course');
insert into public.timetable_slots (id, user_id, course_id, weekday, start_time, end_time) values
  ('a3333333-0000-0000-0000-00000000005a', 'a3333333-3333-3333-3333-333333333333',
   'a3333333-0000-0000-0000-000000000001', 1, '07:30', '09:10'),
  ('b4444444-0000-0000-0000-00000000005a', 'b4444444-4444-4444-4444-444444444444',
   'b4444444-0000-0000-0000-000000000001', 1, '07:30', '09:10');

-- ---------------------------------------------------------------- shapes
insert into public.class_changes (id, user_id, course_id, slot_id, kind, original_date, note) values
  ('a3333333-0000-0000-0000-0000000000c1', 'a3333333-3333-3333-3333-333333333333',
   'a3333333-0000-0000-0000-000000000001', 'a3333333-0000-0000-0000-00000000005a', 'cancelled', '2026-11-16', 'Lecturer ill');
select pass('a cancelled change with slot and date is accepted');

-- Postponed: rescheduled, new date not decided yet. Same shape as a cancellation.
select lives_ok(
  $$ insert into public.class_changes (user_id, course_id, slot_id, kind, original_date)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001',
             'a3333333-0000-0000-0000-00000000005a', 'postponed', '2026-11-30') $$,
  'a postponed change (rescheduled, no new date yet) is accepted'
);
select throws_ok(
  $$ insert into public.class_changes (user_id, course_id, slot_id, kind, original_date, new_date)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001',
             'a3333333-0000-0000-0000-00000000005a', 'postponed', '2027-01-04', '2027-01-05') $$,
  '23514', null, 'a postponed change has no new date (setting one makes it a move)'
);
select throws_ok(
  $$ insert into public.class_changes (user_id, course_id, kind, original_date)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001',
             'postponed', '2027-01-11') $$,
  '23514', null, 'only a weekly class (with a slot) can be postponed'
);

select throws_ok(
  $$ insert into public.class_changes (user_id, course_id, slot_id, kind, original_date)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001',
             'a3333333-0000-0000-0000-00000000005a', 'cancelled', '2026-11-16') $$,
  '23505', null, 'only one change per occurrence'
);
select throws_ok(
  $$ insert into public.class_changes (user_id, course_id, slot_id, kind, original_date, new_date)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001',
             'a3333333-0000-0000-0000-00000000005a', 'cancelled', '2026-11-23', '2026-11-24') $$,
  '23514', null, 'a cancellation cannot carry a new date'
);
select throws_ok(
  $$ insert into public.class_changes (user_id, course_id, slot_id, kind, original_date)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001',
             'a3333333-0000-0000-0000-00000000005a', 'moved', '2026-11-23') $$,
  '23514', null, 'a move must change date, time or room'
);
select lives_ok(
  $$ insert into public.class_changes (user_id, course_id, slot_id, kind, original_date, location)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001',
             'a3333333-0000-0000-0000-00000000005a', 'moved', '2026-11-23', 'B2.05') $$,
  'a room-only move is accepted'
);
select throws_ok(
  $$ insert into public.class_changes (user_id, course_id, slot_id, kind, original_date, new_date, start_time)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001',
             'a3333333-0000-0000-0000-00000000005a', 'moved', '2026-11-30', '2026-12-01', '10:00') $$,
  '23514', null, 'start and end time come together'
);
select throws_ok(
  $$ insert into public.class_changes (user_id, course_id, slot_id, kind, original_date, start_time, end_time)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001',
             'a3333333-0000-0000-0000-00000000005a', 'moved', '2026-11-30', '10:00', '09:00') $$,
  '23514', null, 'end time must be after start time'
);
select throws_ok(
  $$ insert into public.class_changes (user_id, course_id, kind, new_date)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001', 'extra', '2026-11-20') $$,
  '23514', null, 'an extra session needs a time'
);
select throws_ok(
  $$ insert into public.class_changes (user_id, course_id, slot_id, kind, new_date, start_time, end_time)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001',
             'a3333333-0000-0000-0000-00000000005a', 'extra', '2026-11-20', '10:00', '11:00') $$,
  '23514', null, 'an extra session is not tied to a weekly slot'
);
select throws_ok(
  $$ insert into public.class_changes (user_id, course_id, kind, new_date, start_time, end_time)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001', 'rescheduled', '2026-11-20', '10:00', '11:00') $$,
  '23514', null, 'unknown kind rejected'
);
select throws_ok(
  $$ insert into public.class_changes (user_id, course_id, slot_id, kind, original_date)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000002',
             'a3333333-0000-0000-0000-00000000005a', 'cancelled', '2026-12-07') $$,
  '23503', null, 'the slot must belong to the change''s course'
);
insert into public.class_changes (id, user_id, course_id, kind, new_date, start_time, end_time, label) values
  ('a3333333-0000-0000-0000-0000000000ea', 'a3333333-3333-3333-3333-333333333333',
   'a3333333-0000-0000-0000-000000000001', 'extra', '2026-11-20', '10:00', '11:40', 'Makeup');
select pass('an extra session is accepted');

-- breaks
select throws_ok(
  $$ insert into public.class_breaks (user_id, label, starts_on, ends_on)
     values ('a3333333-3333-3333-3333-333333333333', 'Backwards', '2026-11-27', '2026-11-23') $$,
  '23514', null, 'a break cannot end before it starts'
);
select throws_ok(
  $$ insert into public.class_breaks (user_id, label, starts_on, ends_on)
     values ('a3333333-3333-3333-3333-333333333333', 'Forever', '2026-01-01', '2026-12-31') $$,
  '23514', null, 'a break is at most about four months'
);
insert into public.class_breaks (id, user_id, label, starts_on, ends_on) values
  ('a3333333-0000-0000-0000-0000000000b1', 'a3333333-3333-3333-3333-333333333333', 'Exam week', '2026-11-23', '2026-11-27');

-- attendance
insert into public.attendance (id, user_id, course_id, slot_id, occurs_on, status) values
  ('a3333333-0000-0000-0000-0000000000a1', 'a3333333-3333-3333-3333-333333333333',
   'a3333333-0000-0000-0000-000000000001', 'a3333333-0000-0000-0000-00000000005a', '2026-11-09', 'attended');
insert into public.attendance (user_id, course_id, change_id, status) values
  ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001', 'a3333333-0000-0000-0000-0000000000ea', 'missed');
select pass('attendance for a slot date and for an extra session');
select throws_ok(
  $$ insert into public.attendance (user_id, course_id, slot_id, occurs_on, status)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001',
             'a3333333-0000-0000-0000-00000000005a', '2026-11-09', 'missed') $$,
  '23505', null, 'one attendance mark per occurrence'
);
select throws_ok(
  $$ insert into public.attendance (user_id, course_id, slot_id, occurs_on, status)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001',
             'a3333333-0000-0000-0000-00000000005a', '2026-11-02', 'late') $$,
  '23514', null, 'unknown attendance status rejected'
);
select throws_ok(
  $$ insert into public.attendance (user_id, course_id, slot_id, status)
     values ('a3333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001',
             'a3333333-0000-0000-0000-00000000005a', 'attended') $$,
  '23514', null, 'a slot mark needs its date'
);

-- links and contacts
select throws_ok(
  $$ update public.timetable_slots set meeting_url = 'javascript:alert(1)' where id = 'a3333333-0000-0000-0000-00000000005a' $$,
  '23514', null, 'only http(s) meeting links'
);
select throws_ok(
  $$ update public.courses set lecturer_phone = 'call me' where id = 'a3333333-0000-0000-0000-000000000001' $$,
  '23514', null, 'phone must look like a number'
);

-- grants
select table_privs_are('public', 'class_changes', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'class_breaks', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'attendance', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'class_changes', 'anon', array[]::text[]);
select table_privs_are('public', 'class_breaks', 'anon', array[]::text[]);
select table_privs_are('public', 'attendance', 'anon', array[]::text[]);

-- ---------------------------------------------------------------- isolation: act as B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b4444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

select is((select count(*)::int from public.class_changes), 0, 'B cannot read A''s changes');
select is((select count(*)::int from public.class_breaks), 0, 'B cannot read A''s breaks');
select is((select count(*)::int from public.attendance), 0, 'B cannot read A''s attendance');

update public.class_changes set note = 'hacked';
delete from public.class_breaks;
delete from public.attendance;

select throws_ok(
  $$ insert into public.class_changes (course_id, slot_id, kind, original_date)
     values ('a3333333-0000-0000-0000-000000000001', 'a3333333-0000-0000-0000-00000000005a', 'cancelled', '2026-12-14') $$,
  '23503', null, 'B cannot cancel A''s class'
);
select throws_ok(
  $$ insert into public.attendance (course_id, slot_id, occurs_on, status)
     values ('a3333333-0000-0000-0000-000000000001', 'a3333333-0000-0000-0000-00000000005a', '2026-12-14', 'attended') $$,
  '23503', null, 'B cannot mark attendance on A''s session'
);
select throws_ok(
  $$ insert into public.class_breaks (user_id, label, starts_on, ends_on)
     values ('a3333333-3333-3333-3333-333333333333', 'Forged', '2026-12-01', '2026-12-02') $$,
  '42501', null, 'B cannot insert a break owned by A'
);
insert into public.class_changes (course_id, slot_id, kind, original_date)
  values ('b4444444-0000-0000-0000-000000000001', 'b4444444-0000-0000-0000-00000000005a', 'cancelled', '2026-11-16');
select is((select count(*)::int from public.class_changes), 1, 'B can change own class; user_id defaults to caller');

reset role;
select is(
  (select note from public.class_changes where id = 'a3333333-0000-0000-0000-0000000000c1'), 'Lecturer ill',
  'A''s change was not updated by B'
);
select is(
  (select count(*)::int from public.class_breaks where user_id = 'a3333333-3333-3333-3333-333333333333')
  + (select count(*)::int from public.attendance where user_id = 'a3333333-3333-3333-3333-333333333333'),
  3, 'A''s break and attendance were not deleted by B'
);

-- deleting the slot removes its changes and marks
delete from public.timetable_slots where id = 'a3333333-0000-0000-0000-00000000005a';
select is(
  (select count(*)::int from public.class_changes where slot_id = 'a3333333-0000-0000-0000-00000000005a')
  + (select count(*)::int from public.attendance where slot_id = 'a3333333-0000-0000-0000-00000000005a'),
  0, 'deleting a slot deletes its changes and attendance'
);

select * from finish();
rollback;

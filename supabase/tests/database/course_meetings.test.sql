-- Course kinds and meeting counts; attendance as the meeting log (numbering,
-- 'unknown' backfill, set_current_meeting) and cross-user isolation.
begin;
select plan(21);

insert into auth.users (id, email) values
  ('a5555555-5555-5555-5555-555555555555', 'meet-a@test.local'),
  ('b6666666-6666-6666-6666-666666666666', 'meet-b@test.local');

insert into public.courses (id, user_id, name, class_type, total_meetings) values
  ('a5555555-0000-0000-0000-000000000001', 'a5555555-5555-5555-5555-555555555555', 'Praktikum Fisika', 'practicum', 8);
insert into public.courses (id, user_id, name, kind) values
  ('a5555555-0000-0000-0000-000000000002', 'a5555555-5555-5555-5555-555555555555', 'Bootcamp', 'external'),
  ('b6666666-0000-0000-0000-000000000001', 'b6666666-6666-6666-6666-666666666666', 'B course', 'campus');
insert into public.timetable_slots (id, user_id, course_id, weekday, start_time, end_time) values
  ('a5555555-0000-0000-0000-00000000005a', 'a5555555-5555-5555-5555-555555555555',
   'a5555555-0000-0000-0000-000000000001', 1, '07:30', '09:10');

-- ---------------------------------------------------------------- course shape
select throws_ok(
  $$ insert into public.courses (user_id, name, kind) values ('a5555555-5555-5555-5555-555555555555', 'X', 'online') $$,
  '23514', null, 'kind is campus or external'
);
select throws_ok(
  $$ insert into public.courses (user_id, name, kind, class_type)
     values ('a5555555-5555-5555-5555-555555555555', 'X', 'external', 'practicum') $$,
  '23514', null, 'an external course has no class type'
);
select throws_ok(
  $$ insert into public.courses (user_id, name, total_meetings) values ('a5555555-5555-5555-5555-555555555555', 'X', 0) $$,
  '23514', null, 'a course has at least one meeting'
);
select is(
  (select total_meetings from public.courses where id = 'a5555555-0000-0000-0000-000000000002'), null,
  'an external course can be open-ended'
);

-- ---------------------------------------------------------------- the log, as user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a5555555-5555-5555-5555-555555555555","role":"authenticated"}', true);

select lives_ok(
  $$ select public.set_current_meeting('a5555555-0000-0000-0000-000000000001', 4::smallint) $$,
  'set_current_meeting backfills the meetings before'
);
select results_eq(
  $$ select meeting_number::int, status from public.attendance
     where course_id = 'a5555555-0000-0000-0000-000000000001' order by meeting_number $$,
  $$ values (1, 'unknown'), (2, 'unknown'), (3, 'unknown') $$,
  'meetings 1-3 are unknown, not attended'
);

insert into public.attendance (course_id, slot_id, occurs_on, status)
values ('a5555555-0000-0000-0000-000000000001', 'a5555555-0000-0000-0000-00000000005a', '2026-11-16', 'attended');
select is(
  (select meeting_number::int from public.attendance where occurs_on = '2026-11-16'), 4,
  'a mark takes the next free number'
);
select throws_ok(
  $$ insert into public.attendance (course_id, slot_id, occurs_on, status)
     values ('a5555555-0000-0000-0000-000000000001', 'a5555555-0000-0000-0000-00000000005a', '2026-11-16', 'missed') $$,
  '23505', null, 'one mark per class'
);
select throws_ok(
  $$ insert into public.attendance (course_id, slot_id, occurs_on, status, meeting_number)
     values ('a5555555-0000-0000-0000-000000000001', 'a5555555-0000-0000-0000-00000000005a', '2026-11-23', 'missed', 4) $$,
  '23505', null, 'one mark per meeting number'
);
select throws_ok(
  $$ insert into public.attendance (course_id, status, meeting_number)
     values ('a5555555-0000-0000-0000-000000000001', 'cancelled', 9) $$,
  '23514', null, 'cancelled classes are schedule changes, not log rows'
);
select throws_ok(
  $$ insert into public.attendance (course_id, slot_id, occurs_on, status, meeting_number)
     values ('a5555555-0000-0000-0000-000000000001', 'a5555555-0000-0000-0000-00000000005a', '2026-11-30', 'unknown', 5) $$,
  '23514', null, 'an unknown meeting points at no class'
);
select isnt(
  (select meetings_counted_from from public.courses where id = 'a5555555-0000-0000-0000-000000000001'), null,
  'setting the current meeting stamps when counting started'
);
select lives_ok(
  $$ update public.attendance set status = 'attended'
     where course_id = 'a5555555-0000-0000-0000-000000000001' and meeting_number = 2 $$,
  'an unknown meeting can be marked by its number, without a date'
);
select throws_ok(
  $$ select public.set_current_meeting('a5555555-0000-0000-0000-000000000001', 3::smallint) $$,
  '23514', null, 'the current meeting cannot leave too little room for the marked meetings'
);
select lives_ok(
  $$ select public.set_current_meeting('a5555555-0000-0000-0000-000000000001', 7::smallint) $$,
  'moving the current meeting forward'
);
select results_eq(
  $$ select meeting_number::int, status from public.attendance
     where course_id = 'a5555555-0000-0000-0000-000000000001' order by meeting_number $$,
  $$ values (1, 'unknown'), (2, 'unknown'), (3, 'unknown'), (4, 'attended'), (5, 'unknown'), (6, 'attended') $$,
  'the marks shift up in order so the newest is meeting 6; the rest is unknown'
);
select lives_ok(
  $$ select public.set_current_meeting('a5555555-0000-0000-0000-000000000001', 5::smallint) $$,
  'moving the current meeting back down'
);
select results_eq(
  $$ select meeting_number::int, status from public.attendance
     where course_id = 'a5555555-0000-0000-0000-000000000001' order by meeting_number $$,
  $$ values (1, 'unknown'), (2, 'attended'), (3, 'unknown'), (4, 'attended') $$,
  'the marks shift down, keeping their order and gap'
);

-- ---------------------------------------------------------------- isolation
select throws_ok(
  $$ select public.set_current_meeting('b6666666-0000-0000-0000-000000000001', 3::smallint) $$,
  'P0002', null, 'another user''s course is invisible to set_current_meeting'
);

select set_config('request.jwt.claims', '{"sub":"b6666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.attendance where course_id = 'a5555555-0000-0000-0000-000000000001'),
  0, 'user B sees none of user A''s meetings'
);
select is(
  (select count(*)::int from public.courses where id = 'a5555555-0000-0000-0000-000000000001'),
  0, 'user B sees none of user A''s courses'
);
reset role;

select * from finish();
rollback;

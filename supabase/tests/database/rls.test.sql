-- RLS isolation: two users must never see or touch each other's rows.
begin;
select plan(12);

-- Two users; the sign-up trigger creates their profile and settings rows.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local');

select is((select count(*)::int from public.profiles where user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')), 2, 'sign-up trigger creates profiles');
select is((select count(*)::int from public.user_settings where user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')), 2, 'sign-up trigger creates settings');

-- Data owned by user A (inserted as superuser).
insert into public.courses (id, user_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Calculus');
insert into public.timetable_slots (user_id, course_id, weekday, start_time, end_time) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 1, '08:00', '09:40');
insert into public.tasks (user_id, course_id, title) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Problem set 1');

-- Act as user B.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'B sees only own profile');
select is((select count(*)::int from public.user_settings), 1, 'B sees only own settings');
select is((select count(*)::int from public.courses), 0, 'B cannot read A''s courses');
select is((select count(*)::int from public.timetable_slots), 0, 'B cannot read A''s slots');
select is((select count(*)::int from public.tasks), 0, 'B cannot read A''s tasks');

update public.courses set name = 'hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.tasks;

select throws_ok(
  $$ insert into public.courses (user_id, name) values ('11111111-1111-1111-1111-111111111111', 'x') $$,
  '42501', null, 'B cannot insert rows owned by A'
);
select throws_ok(
  $$ insert into public.tasks (title, course_id) values ('x', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '23503', null, 'B cannot link a task to A''s course'
);

-- user_id defaults to the caller.
insert into public.courses (name) values ('Physics');
select is((select count(*)::int from public.courses), 1, 'B can create own course');

-- Back to superuser to confirm A's data is untouched.
reset role;
select is((select name from public.courses where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Calculus', 'A''s course was not updated by B');
select is((select count(*)::int from public.tasks where user_id = '11111111-1111-1111-1111-111111111111'), 1, 'A''s task was not deleted by B');

select * from finish();
rollback;

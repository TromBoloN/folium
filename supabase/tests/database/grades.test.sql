-- Grades: credits, assessments constraints, and cross-user isolation.
begin;
select plan(17);

insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'grades-a@test.local'),
  ('b2222222-2222-2222-2222-222222222222', 'grades-b@test.local');

insert into public.courses (id, user_id, name, credits) values
  ('a1111111-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 'Calculus', 3),
  ('b2222222-0000-0000-0000-000000000001', 'b2222222-2222-2222-2222-222222222222', 'B course', 2);

-- credits
select is((select credits from public.courses where id = 'a1111111-0000-0000-0000-000000000001'), 3.0, 'credits stored');
select is(
  (select credits from public.courses where id = 'b2222222-0000-0000-0000-000000000001'), 2.0, 'credits on B course'
);
select throws_ok(
  $$ update public.courses set credits = -1 where id = 'a1111111-0000-0000-0000-000000000001' $$, '23514', null, 'negative credits rejected'
);
select throws_ok(
  $$ update public.courses set credits = 30 where id = 'a1111111-0000-0000-0000-000000000001' $$, '23514', null, 'more than 24 credits rejected'
);

-- assessment constraints (as superuser)
insert into public.assessments (id, user_id, course_id, name, weight, max_score, score) values
  ('a1111111-0000-0000-0000-0000000000a1', 'a1111111-1111-1111-1111-111111111111',
   'a1111111-0000-0000-0000-000000000001', 'Midterm', 30, 100, 82);
select throws_ok(
  $$ insert into public.assessments (user_id, course_id, name, weight)
     values ('a1111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'Zero', 0) $$,
  '23514', null, 'weight must be above 0'
);
select throws_ok(
  $$ insert into public.assessments (user_id, course_id, name, weight, max_score, score)
     values ('a1111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'Too high', 10, 50, 51) $$,
  '23514', null, 'score above max_score rejected'
);
select throws_ok(
  $$ insert into public.assessments (user_id, course_id, name, weight, max_score)
     values ('a1111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'No max', 10, 0) $$,
  '23514', null, 'max_score must be positive'
);
select throws_ok(
  $$ insert into public.assessments (user_id, course_id, name, weight)
     values ('a1111111-1111-1111-1111-111111111111', 'b2222222-0000-0000-0000-000000000001', 'Cross', 10) $$,
  '23503', null, 'cannot attach an assessment to another user''s course'
);

-- grants
select table_privs_are('public', 'assessments', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'assessments', 'anon', array[]::text[]);

-- isolation: act as B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select count(*)::int from public.assessments), 0, 'B cannot read A''s assessments');
update public.assessments set score = 0 where id = 'a1111111-0000-0000-0000-0000000000a1';
delete from public.assessments where id = 'a1111111-0000-0000-0000-0000000000a1';
select throws_ok(
  $$ insert into public.assessments (user_id, course_id, name, weight)
     values ('a1111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'Forged', 10) $$,
  '42501', null, 'B cannot insert rows owned by A'
);
select throws_ok(
  $$ insert into public.assessments (course_id, name, weight)
     values ('a1111111-0000-0000-0000-000000000001', 'Into A course', 10) $$,
  '23503', null, 'B cannot add an assessment to A''s course'
);
insert into public.assessments (course_id, name, weight) values ('b2222222-0000-0000-0000-000000000001', 'Own quiz', 20);
select is((select count(*)::int from public.assessments), 1, 'B can add to own course; user_id defaults to caller');

reset role;
select is(
  (select score from public.assessments where id = 'a1111111-0000-0000-0000-0000000000a1'), 82.00,
  'A''s assessment was not changed or deleted by B'
);

-- deleting a course deletes its assessments
delete from public.courses where id = 'a1111111-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.assessments where user_id = 'a1111111-1111-1111-1111-111111111111'), 0,
  'assessments cascade with their course'
);
select is(
  (select credits from public.courses where id = 'b2222222-0000-0000-0000-000000000001'), 2.0, 'other course untouched'
);

select * from finish();
rollback;

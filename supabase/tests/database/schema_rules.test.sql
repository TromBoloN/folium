-- Sign-up robustness, exact grants, settings size cap and one-level subtasks.
begin;
select plan(23);

-- Sign-up with oversized provider metadata must not fail.
insert into auth.users (id, email, raw_user_meta_data) values (
  '33333333-3333-3333-3333-333333333333', 'long@test.local',
  jsonb_build_object('full_name', repeat('n', 200), 'avatar_url', 'https://x/' || repeat('a', 3000))
);
select is((select count(*)::int from public.profiles where user_id = '33333333-3333-3333-3333-333333333333'), 1, 'profile created despite 200-char name');
select is((select char_length(display_name) from public.profiles where user_id = '33333333-3333-3333-3333-333333333333'), 80, 'display_name truncated to 80');
select is((select avatar_url from public.profiles where user_id = '33333333-3333-3333-3333-333333333333'), null, 'oversized avatar_url dropped');
select is((select count(*)::int from public.user_settings where user_id = '33333333-3333-3333-3333-333333333333'), 1, 'settings created despite long metadata');

-- Grants are exactly what the migration lists.
select table_privs_are('public', 'profiles',        'authenticated', array['SELECT', 'UPDATE']);
select table_privs_are('public', 'user_settings',   'authenticated', array['SELECT', 'UPDATE']);
select table_privs_are('public', 'courses',         'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'timetable_slots', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'tasks',           'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
select table_privs_are('public', 'profiles',        'anon', array[]::text[]);
select table_privs_are('public', 'user_settings',   'anon', array[]::text[]);
select table_privs_are('public', 'courses',         'anon', array[]::text[]);
select table_privs_are('public', 'timetable_slots', 'anon', array[]::text[]);
select table_privs_are('public', 'tasks',           'anon', array[]::text[]);

-- Settings JSON size cap (random text so TOAST compression can't shrink it).
select throws_ok(
  $$ update public.user_settings
     set dashboard_layout = jsonb_build_object('junk', (select string_agg(md5(g::text), '') from generate_series(1, 5000) g))
     where user_id = '33333333-3333-3333-3333-333333333333' $$,
  '23514', null, 'oversized settings JSON rejected'
);

-- One level of subtasks.
insert into public.tasks (id, user_id, title) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Parent'),
  ('bbbbbbbb-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Other');
insert into public.tasks (id, user_id, parent_id, title) values
  ('bbbbbbbb-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-0000-0000-0000-000000000001', 'Child');

select is((select count(*)::int from public.tasks where parent_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 1, 'subtask can be created');
select throws_ok(
  $$ insert into public.tasks (user_id, parent_id, title)
     values ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-0000-0000-0000-000000000002', 'Grandchild') $$,
  '23514', null, 'subtask of a subtask rejected'
);
select throws_ok(
  $$ update public.tasks set parent_id = 'bbbbbbbb-0000-0000-0000-000000000003'
     where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  '23514', null, 'task with subtasks cannot become a subtask'
);
select throws_ok(
  $$ update public.tasks set parent_id = 'bbbbbbbb-0000-0000-0000-000000000002'
     where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  '23514', null, 'A -> B -> A cycle rejected'
);
select throws_ok(
  $$ update public.tasks set parent_id = id where id = 'bbbbbbbb-0000-0000-0000-000000000003' $$,
  '23514', null, 'self-parenting rejected'
);

-- Due date with optional time.
select lives_ok(
  $$ insert into public.tasks (user_id, title, due_at, due_has_time)
     values ('33333333-3333-3333-3333-333333333333', 'Timed', now(), true) $$,
  'a deadline can have a time'
);
select throws_ok(
  $$ insert into public.tasks (user_id, title, due_has_time)
     values ('33333333-3333-3333-3333-333333333333', 'Time without date', true) $$,
  '23514', null, 'a time without a due date is rejected'
);
select is(
  (select due_has_time from public.tasks where title = 'Parent'),
  false, 'due_has_time defaults to false'
);

select * from finish();
rollback;

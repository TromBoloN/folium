-- Demo data for local development.
--
-- Account:  demo@folium.test  /  folium-demo-2026
--
-- Runs automatically on `bunx supabase db reset`, and can be re-run any time
-- with `bun run db:seed` (it deletes and rebuilds only the demo account).
-- Every date is relative to "today" in Asia/Makassar, so the dashboard always
-- has classes, overdue work, things due today and things coming up. Courses
-- have credits and assessments, so Grades shows a GPA for this semester and
-- the archived one.

-- ---------------------------------------------------------------------------
-- Helpers (session-only)
-- ---------------------------------------------------------------------------

-- A local date (today + days) at a local time in Makassar, as an instant.
create or replace function pg_temp.at_local(days int, t time)
returns timestamptz language sql stable as $$
  select (((now() at time zone 'Asia/Makassar')::date + days) + t) at time zone 'Asia/Makassar'
$$;

create or replace function pg_temp.seed_task(
  p_user uuid,
  p_course uuid,
  p_title text,
  p_due_day int default null,        -- days from today; null = no deadline
  p_due_time time default null,      -- null = date-only (end of that day)
  p_priority text default 'medium',
  p_status text default 'todo',
  p_notes text default null,
  p_done_days_ago int default null   -- for done tasks: when it was finished
) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.tasks (user_id, course_id, title, notes, due_at, due_has_time, priority, status, completed_at)
  values (
    p_user, p_course, p_title, p_notes,
    case when p_due_day is null then null
         else pg_temp.at_local(p_due_day, coalesce(p_due_time, time '23:59:59.999')) end,
    p_due_day is not null and p_due_time is not null,
    p_priority, p_status,
    case when p_status = 'done' then now() - make_interval(days => coalesce(p_done_days_ago, 0), hours => 3) end
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function pg_temp.seed_steps(p_user uuid, p_parent uuid, p_titles text[], p_done int default 0)
returns void language plpgsql as $$
declare
  i int;
begin
  for i in 1 .. array_length(p_titles, 1) loop
    insert into public.tasks (user_id, parent_id, title, status, position)
    values (p_user, p_parent, p_titles[i], case when i <= p_done then 'done' else 'todo' end, i);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Demo account
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := 'de300000-0000-4000-8000-000000000001';
  v_today date := (now() at time zone 'Asia/Makassar')::date;
  v_term_start date := v_today - 70;
  v_term_end date := v_today + 50;

  c_calc uuid; c_phys uuid; c_chem uuid; c_prog uuid; c_eng uuid; c_pkn uuid; c_study uuid; c_old uuid;
  t uuid;
begin
  -- Start clean: deleting the user cascades to profile, settings, courses, slots and tasks.
  delete from auth.users where id = v_user;

  -- GoTrue reads the token columns as strings, so they must be '' rather than NULL.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
    'demo@folium.test', extensions.crypt('folium-demo-2026', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', '{"full_name": "Dewi"}', now() - interval '80 days', now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    v_user::text, v_user,
    jsonb_build_object('sub', v_user::text, 'email', 'demo@folium.test', 'email_verified', true),
    'email', now(), now(), now()
  );

  -- The sign-up trigger created the profile and settings rows; fill them in.
  update public.profiles set display_name = 'Dewi', campus = 'Fakultas Teknik' where user_id = v_user;

  -- -------------------------------------------------------------------------
  -- Courses
  -- -------------------------------------------------------------------------
  insert into public.courses (user_id, name, code, color, lecturer, room, semester)
  values (v_user, 'Calculus I', 'MAT101', '#1c7ed6', 'Dr. Siti Rahma', 'B2.04', '2026 Ganjil')
  returning id into c_calc;
  insert into public.courses (user_id, name, code, color, lecturer, room, semester)
  values (v_user, 'Physics I', 'FIS101', '#e8590c', 'Dr. Andi Pratama', 'B1.12', '2026 Ganjil')
  returning id into c_phys;
  insert into public.courses (user_id, name, code, color, lecturer, room, semester)
  values (v_user, 'General Chemistry', 'KIM101', '#2f9e44', 'Ir. Nurul Hidayah', 'C3.01', '2026 Ganjil')
  returning id into c_chem;
  insert into public.courses (user_id, name, code, color, lecturer, room, semester)
  values (v_user, 'Intro to Programming', 'INF101', '#7048e8', 'Budi Santoso, M.Kom.', 'Lab Komputer 2', '2026 Ganjil')
  returning id into c_prog;
  insert into public.courses (user_id, name, code, color, lecturer, room, semester)
  values (v_user, 'Academic English', 'ING101', '#d6336c', 'Ms. Laura Wijaya', 'A2.10', '2026 Ganjil')
  returning id into c_eng;
  insert into public.courses (user_id, name, code, color, lecturer, room, semester)
  values (v_user, 'Pancasila', 'PKN101', '#f08c00', 'Drs. Muh. Yusuf', 'Aula Utama', '2026 Ganjil')
  returning id into c_pkn;
  insert into public.courses (user_id, name, code, color, lecturer, room, semester)
  values (v_user, 'Study group', null, '#0c8599', null, 'Library, room 3', '2026 Ganjil')
  returning id into c_study;
  -- Last semester, archived: hidden from the timetable, still has history.
  insert into public.courses (user_id, name, code, color, lecturer, room, semester, archived_at)
  values (v_user, 'Basic Mathematics', 'MAT100', '#5c940d', 'Dr. Siti Rahma', 'B2.04', '2026 Genap', now() - interval '90 days')
  returning id into c_old;

  -- Credits (SKS). The study group isn't graded.
  update public.courses set credits = 3 where id in (c_calc, c_phys, c_chem, c_old);
  update public.courses set credits = 4 where id = c_prog;
  update public.courses set credits = 2 where id in (c_eng, c_pkn);

  -- -------------------------------------------------------------------------
  -- Assessments (scores: some graded, some still to come)
  -- -------------------------------------------------------------------------
  insert into public.assessments (user_id, course_id, name, weight, max_score, score, due_at) values
    (v_user, c_calc, 'Quiz 1',          10, 20,  17,   pg_temp.at_local(-49, '23:59:59.999')),
    (v_user, c_calc, 'Quiz 2',          10, 20,  14,   pg_temp.at_local(-21, '23:59:59.999')),
    (v_user, c_calc, 'Problem sets',    20, 100, 88,   null),
    (v_user, c_calc, 'Midterm exam',    25, 100, null, pg_temp.at_local(14, '08:00')),
    (v_user, c_calc, 'Final exam',      35, 100, null, pg_temp.at_local(48, '08:00')),
    (v_user, c_phys, 'Lab reports',     25, 100, 81,   null),
    (v_user, c_phys, 'Quiz',            15, 50,  33,   pg_temp.at_local(-14, '23:59:59.999')),
    (v_user, c_phys, 'Midterm exam',    25, 100, null, pg_temp.at_local(15, '13:00')),
    (v_user, c_phys, 'Final exam',      35, 100, null, pg_temp.at_local(49, '13:00')),
    (v_user, c_chem, 'Lab work',        30, 100, 90,   null),
    (v_user, c_chem, 'Presentation',    20, 100, null, pg_temp.at_local(6, '10:00')),
    (v_user, c_chem, 'Final exam',      50, 100, null, pg_temp.at_local(47, '08:00')),
    (v_user, c_prog, 'Assignment 1',    10, 100, 95,   pg_temp.at_local(-42, '23:00')),
    (v_user, c_prog, 'Assignment 2',    10, 100, 100,  pg_temp.at_local(-28, '23:00')),
    (v_user, c_prog, 'Assignment 3',    10, 100, 92,   pg_temp.at_local(-5, '23:00')),
    (v_user, c_prog, 'Assignment 4',    10, 100, null, pg_temp.at_local(0, '23:00')),
    (v_user, c_prog, 'Mini project',    60, 100, null, pg_temp.at_local(40, '23:59:59.999')),
    (v_user, c_eng,  'Vocabulary logs', 20, 100, 78,   null),
    (v_user, c_eng,  'Essay outline',   10, 10,  null, pg_temp.at_local(1, '23:59:59.999')),
    (v_user, c_eng,  'Final essay',     70, 100, null, pg_temp.at_local(28, '23:59:59.999')),
    (v_user, c_pkn,  'Discussion',      40, 100, 85,   null),
    (v_user, c_pkn,  'Reflection paper', 60, 100, null, pg_temp.at_local(21, '23:59:59.999')),
    -- Last semester, fully graded.
    (v_user, c_old,  'Midterm exam',    40, 100, 74,   pg_temp.at_local(-150, '08:00')),
    (v_user, c_old,  'Final exam',      60, 100, 81,   pg_temp.at_local(-100, '08:00'));

  -- -------------------------------------------------------------------------
  -- Weekly class times (ISO weekday: 1 = Monday … 7 = Sunday)
  -- -------------------------------------------------------------------------
  insert into public.timetable_slots (user_id, course_id, weekday, start_time, end_time, location, starts_on, ends_on) values
    (v_user, c_calc,  1, '07:30', '09:10', null,             v_term_start, v_term_end),
    (v_user, c_calc,  3, '07:30', '09:10', null,             v_term_start, v_term_end),
    (v_user, c_phys,  1, '09:20', '11:00', null,             v_term_start, v_term_end),
    -- Physics lab only runs for part of the term.
    (v_user, c_phys,  4, '13:00', '15:30', 'Lab Fisika',     v_today - 28, v_today + 21),
    (v_user, c_chem,  2, '08:00', '09:40', null,             v_term_start, v_term_end),
    (v_user, c_chem,  5, '10:00', '11:40', null,             v_term_start, v_term_end),
    (v_user, c_prog,  2, '13:00', '15:30', null,             v_term_start, v_term_end),
    -- Overlaps Physics lab on Thursday on purpose, so the overlap warning shows.
    (v_user, c_prog,  4, '14:30', '16:10', 'Lab Komputer 1', v_term_start, v_term_end),
    (v_user, c_eng,   3, '10:00', '11:40', null,             v_term_start, v_term_end),
    (v_user, c_eng,   5, '13:30', '15:10', null,             v_term_start, v_term_end),
    (v_user, c_pkn,   6, '08:00', '09:40', null,             v_term_start, v_term_end),
    -- Study group meets every day, so "Today's classes" is never empty in the demo.
    (v_user, c_study, 1, '16:00', '17:30', null, null, null),
    (v_user, c_study, 2, '16:00', '17:30', null, null, null),
    (v_user, c_study, 3, '16:00', '17:30', null, null, null),
    (v_user, c_study, 4, '16:30', '18:00', null, null, null),
    (v_user, c_study, 5, '16:00', '17:30', null, null, null),
    (v_user, c_study, 6, '10:00', '12:00', null, null, null),
    (v_user, c_study, 7, '10:00', '12:00', null, null, null),
    -- Archived course: kept for history, not shown.
    (v_user, c_old,   2, '07:30', '09:10', null, v_today - 200, v_today - 90);

  -- -------------------------------------------------------------------------
  -- Tasks
  -- -------------------------------------------------------------------------

  -- Overdue
  t := pg_temp.seed_task(v_user, c_calc, 'Problem set 5: integration by parts', -2, null, 'high', 'in_progress',
    'Questions 1–12 from chapter 7. Show every step.');
  perform pg_temp.seed_steps(v_user, t, array['Questions 1–4', 'Questions 5–8', 'Questions 9–12', 'Check answers with the key'], 2);
  perform pg_temp.seed_task(v_user, c_eng, 'Vocabulary log, week 11', -1, null, 'low');
  perform pg_temp.seed_task(v_user, c_chem, 'Pre-lab quiz: titration', 0, '07:00', 'medium', 'todo',
    'Online quiz closes at 07:00 sharp.');

  -- Due today
  t := pg_temp.seed_task(v_user, c_prog, 'Assignment 4: loops and lists', 0, '23:00', 'urgent', 'in_progress',
    'Submit the .py file to the course portal. Include test cases.');
  perform pg_temp.seed_steps(v_user, t, array['Read the brief', 'Write the list helpers', 'Write tests', 'Submit'], 2);
  perform pg_temp.seed_task(v_user, c_phys, 'Read chapter 9: momentum', 0, null, 'medium');
  perform pg_temp.seed_task(v_user, null, 'Pay semester fee (UKT)', 0, null, 'high', 'todo',
    'Bank transfer; keep the receipt for the faculty office.');

  -- Next few days
  t := pg_temp.seed_task(v_user, c_phys, 'Lab report: projectile motion', 1, '17:00', 'urgent', 'todo',
    'Template in the shared folder. Graphs for all three launch angles.');
  perform pg_temp.seed_steps(v_user, t, array['Clean up the data', 'Draw the graphs', 'Write the discussion', 'Proofread'], 1);
  perform pg_temp.seed_task(v_user, c_eng, 'Essay outline: renewable energy', 1, null, 'medium');
  perform pg_temp.seed_task(v_user, c_calc, 'Quiz 3 on limits', 2, '07:30', 'high', 'todo', 'Closed book, 45 minutes.');
  perform pg_temp.seed_task(v_user, c_study, 'Bring past exam papers for the group', 2, null, 'low');

  -- Later
  t := pg_temp.seed_task(v_user, c_chem, 'Group presentation: acids and bases', 6, '10:00', 'high', 'todo',
    'Group of four with Rina, Fajar and Yoga. 10 minutes plus questions.');
  perform pg_temp.seed_steps(v_user, t, array['Split the topics', 'Draft my slides', 'Rehearse together', 'Send final deck'], 1);
  perform pg_temp.seed_task(v_user, c_prog, 'Mini project proposal', 9, null, 'medium', 'todo',
    'One page: problem, users, features, timeline.');
  t := pg_temp.seed_task(v_user, c_calc, 'Midterm exam', 14, '08:00', 'urgent', 'todo',
    'Chapters 1–7. Room B2.04. Bring a scientific calculator.');
  perform pg_temp.seed_steps(v_user, t, array[
    'Review limits', 'Review derivatives', 'Review integrals', 'Do last year''s paper', 'Make a formula sheet'], 0);
  perform pg_temp.seed_task(v_user, c_phys, 'Midterm exam', 15, '13:00', 'urgent');
  perform pg_temp.seed_task(v_user, c_eng, 'Final essay: 1500 words', 28, null, 'high', 'todo',
    'Topic agreed with Ms. Wijaya. APA referencing.');
  perform pg_temp.seed_task(v_user, c_pkn, 'Reflection paper', 21, null, 'medium');
  perform pg_temp.seed_task(v_user, null, 'Renew library card', 12, null, 'low');

  -- No deadline
  perform pg_temp.seed_task(v_user, c_prog, 'Set up Git and push the assignments repo', null, null, 'medium');
  perform pg_temp.seed_task(v_user, null, 'Ask about the student exchange program', null, null, 'low');
  perform pg_temp.seed_task(v_user, c_chem, 'Buy safety goggles for the lab', null, null, 'high');
  t := pg_temp.seed_task(v_user, null, 'Plan next semester''s courses', null, null, 'low', 'todo',
    'Check the prerequisites list on the faculty site.');
  perform pg_temp.seed_steps(v_user, t, array['List required courses', 'Pick two electives', 'Talk to my advisor'], 0);
  perform pg_temp.seed_task(v_user, null, 'Read "Atomic Habits" (for fun)', null, null, 'low', 'in_progress');

  -- Done
  perform pg_temp.seed_task(v_user, c_calc, 'Problem set 4: derivatives', -9, null, 'high', 'done', null, 10);
  perform pg_temp.seed_task(v_user, c_phys, 'Lab report: free fall', -7, '17:00', 'urgent', 'done', null, 7);
  perform pg_temp.seed_task(v_user, c_prog, 'Assignment 3: functions', -5, '23:00', 'high', 'done', null, 6);
  perform pg_temp.seed_task(v_user, c_eng, 'Vocabulary log, week 10', -8, null, 'low', 'done', null, 8);
  perform pg_temp.seed_task(v_user, c_chem, 'Read chapter 4: stoichiometry', -4, null, 'medium', 'done', null, 4);
  perform pg_temp.seed_task(v_user, null, 'Register for the campus sports club', null, null, 'low', 'done', null, 20);
  t := pg_temp.seed_task(v_user, c_pkn, 'Group discussion summary', -3, null, 'medium', 'done', null, 3);
  perform pg_temp.seed_steps(v_user, t, array['Take notes', 'Write summary', 'Upload'], 3);
  perform pg_temp.seed_task(v_user, c_old, 'Final exam revision', -95, null, 'high', 'done', null, 96);
end;
$$;

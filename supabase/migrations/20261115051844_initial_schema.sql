-- Folium v1 initial schema
--
-- Five tables, all owned by one user and protected by RLS:
--   profiles, user_settings, courses, timetable_slots, tasks
--
-- Conventions
--   * Every table has user_id, created_at, updated_at and RLS in this file.
--   * Child rows reference parents with a composite (id, user_id) foreign key,
--     so a row can never point at another user's course or task.
--   * Statuses and priorities are text keys guarded by named CHECK constraints.
--     When user-defined values arrive, drop the constraint and point the column
--     at a lookup table; no enum migration or data rewrite needed.
--   * Settings are versioned JSON objects, merged over app defaults on read.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one per auth user
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url   text check (char_length(avatar_url) <= 2048),
  campus       text check (char_length(campus) <= 120),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'Profile details, one row per auth user. Readable only by its owner.';

-- ---------------------------------------------------------------------------
-- user_settings: theme, preferences and dashboard layout as JSON
-- ---------------------------------------------------------------------------

create table public.user_settings (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  version          integer not null default 1 check (version >= 1),
  theme            jsonb not null default '{}'::jsonb,
  preferences      jsonb not null default '{}'::jsonb,
  dashboard_layout jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint user_settings_theme_is_object       check (jsonb_typeof(theme) = 'object'),
  constraint user_settings_preferences_is_object check (jsonb_typeof(preferences) = 'object'),
  constraint user_settings_layout_is_object      check (jsonb_typeof(dashboard_layout) = 'object'),

  -- 64 KB per column is far more than settings need, and stops abuse.
  constraint user_settings_theme_size       check (pg_column_size(theme) < 65536),
  constraint user_settings_preferences_size check (pg_column_size(preferences) < 65536),
  constraint user_settings_layout_size      check (pg_column_size(dashboard_layout) < 65536)
);

comment on table public.user_settings is
  'Per-user settings. Each JSON column holds only overrides; the app validates with Zod and merges over defaults. version tracks the settings shape for upgrades.';

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------

create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  code        text check (char_length(code) <= 40),
  color       text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  lecturer    text check (char_length(lecturer) <= 120),
  room        text check (char_length(room) <= 80),
  semester    text check (char_length(semester) <= 60),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Target for composite foreign keys from child tables.
  constraint courses_id_user_id_key unique (id, user_id)
);

comment on column public.courses.semester is
  'Free-text label for now (e.g. "2026 Ganjil"). Can be promoted to a semesters table later.';
comment on column public.courses.archived_at is
  'Set to hide a finished course without deleting its tasks.';

create index courses_user_id_idx on public.courses (user_id) where archived_at is null;

-- ---------------------------------------------------------------------------
-- timetable_slots: weekly repeating class times
-- ---------------------------------------------------------------------------

create table public.timetable_slots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id  uuid not null,
  weekday    smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday, 7 = Sunday
  start_time time not null,
  end_time   time not null,
  location   text check (char_length(location) <= 80),
  starts_on  date,
  ends_on    date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint timetable_slots_course_fk
    foreign key (course_id, user_id) references public.courses (id, user_id) on delete cascade,
  constraint timetable_slots_time_order check (end_time > start_time),
  constraint timetable_slots_date_order check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

comment on column public.timetable_slots.location is 'Overrides courses.room when set.';
comment on column public.timetable_slots.starts_on is 'Optional: first date this slot applies.';
comment on column public.timetable_slots.ends_on is 'Optional: last date this slot applies.';

create index timetable_slots_user_weekday_idx on public.timetable_slots (user_id, weekday, start_time);
create index timetable_slots_course_id_idx on public.timetable_slots (course_id);

-- ---------------------------------------------------------------------------
-- tasks: deadlines and subtasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id    uuid,
  parent_id    uuid,
  title        text not null check (char_length(title) between 1 and 200),
  notes        text check (char_length(notes) <= 10000),
  due_at       timestamptz,
  priority     text not null default 'medium',
  status       text not null default 'todo',
  completed_at timestamptz,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint tasks_id_user_id_key unique (id, user_id),

  -- Deleting a course keeps its tasks, just unlinked.
  constraint tasks_course_fk
    foreign key (course_id, user_id) references public.courses (id, user_id)
    on delete set null (course_id),
  -- Deleting a task deletes its subtasks.
  constraint tasks_parent_fk
    foreign key (parent_id, user_id) references public.tasks (id, user_id) on delete cascade,
  constraint tasks_not_own_parent check (parent_id is null or parent_id <> id),

  -- v1 defaults. Drop these when user-defined values replace them.
  constraint tasks_priority_check check (priority in ('low', 'medium', 'high', 'urgent')),
  constraint tasks_status_check   check (status in ('todo', 'in_progress', 'done')),

  constraint tasks_completed_matches_status
    check ((status = 'done') = (completed_at is not null))
);

comment on column public.tasks.parent_id is 'Set for subtasks; null for top-level tasks.';
comment on column public.tasks.position is 'Manual sort order among siblings.';

-- Due soon / overdue lookups for open tasks.
create index tasks_user_open_due_idx on public.tasks (user_id, due_at) where status <> 'done';
create index tasks_course_id_idx on public.tasks (course_id) where course_id is not null;
create index tasks_parent_id_idx on public.tasks (parent_id) where parent_id is not null;

-- Keep completed_at in sync with status so the app only has to set status.
create or replace function public.tasks_sync_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and new.completed_at is null then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger tasks_sync_completed_at
  before insert or update of status, completed_at on public.tasks
  for each row execute function public.tasks_sync_completed_at();

-- Subtasks are one level deep: a parent must be top-level, and a task that
-- already has subtasks cannot become a subtask. This also rules out cycles.
create or replace function public.tasks_enforce_one_level()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if exists (select 1 from public.tasks where id = new.parent_id and parent_id is not null) then
    raise exception 'A subtask cannot have its own subtasks'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.tasks where parent_id = new.id) then
    raise exception 'A task with subtasks cannot become a subtask'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger tasks_enforce_one_level
  before insert or update of parent_id on public.tasks
  for each row execute function public.tasks_enforce_one_level();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger profiles_set_updated_at        before update on public.profiles        for each row execute function public.set_updated_at();
create trigger user_settings_set_updated_at   before update on public.user_settings   for each row execute function public.set_updated_at();
create trigger courses_set_updated_at         before update on public.courses         for each row execute function public.set_updated_at();
create trigger timetable_slots_set_updated_at before update on public.timetable_slots for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at           before update on public.tasks           for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New user bootstrap: create profile and settings rows on sign-up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Provider metadata is untrusted: truncate or drop values that would break
  -- the column checks, because an error here fails the whole sign-up.
  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 80),
    case when char_length(new.raw_user_meta_data ->> 'avatar_url') <= 2048
         then new.raw_user_meta_data ->> 'avatar_url' end
  );

  insert into public.user_settings (user_id) values (new.id);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users that existed before this migration (e.g. on a hosted project).
insert into public.profiles (user_id) select id from auth.users on conflict do nothing;
insert into public.user_settings (user_id) select id from auth.users on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.user_settings   enable row level security;
alter table public.courses         enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.tasks           enable row level security;

-- Grants: reset both roles, then the grants below are the complete list.
-- anon gets nothing.
revoke all on public.profiles, public.user_settings, public.courses,
  public.timetable_slots, public.tasks from anon, authenticated;

-- profiles and user_settings are created by the trigger and removed by the
-- auth.users cascade, so users may only read and update their own row.
grant select, update on public.profiles, public.user_settings to authenticated;
grant select, insert, update, delete on public.courses, public.timetable_slots, public.tasks to authenticated;

create policy "profiles: owner can read"   on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles: owner can update" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "user_settings: owner can read"   on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_settings: owner can update" on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "courses: owner can read"   on public.courses for select to authenticated using ((select auth.uid()) = user_id);
create policy "courses: owner can insert" on public.courses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "courses: owner can update" on public.courses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "courses: owner can delete" on public.courses for delete to authenticated using ((select auth.uid()) = user_id);

create policy "timetable_slots: owner can read"   on public.timetable_slots for select to authenticated using ((select auth.uid()) = user_id);
create policy "timetable_slots: owner can insert" on public.timetable_slots for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "timetable_slots: owner can update" on public.timetable_slots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "timetable_slots: owner can delete" on public.timetable_slots for delete to authenticated using ((select auth.uid()) = user_id);

create policy "tasks: owner can read"   on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "tasks: owner can insert" on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tasks: owner can update" on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tasks: owner can delete" on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);

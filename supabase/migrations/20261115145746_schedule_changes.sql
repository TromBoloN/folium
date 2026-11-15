-- Schedule changes: one-date exceptions to the weekly timetable, and breaks.
--
-- timetable_slots stays the default weekly schedule. A class_changes row
-- touches one date only:
--   cancelled  one occurrence of a slot doesn't happen
--   moved      one occurrence of a slot happens at another date, time and/or room
--   extra      a session that isn't in the weekly schedule (makeup class, exam)
-- class_breaks cancels every regular occurrence in a date range (holiday,
-- exam week); explicit changes and extra sessions still apply inside it.
--
-- The app merges slots, changes and breaks into the real occurrences for a
-- date range in ONE pure function (src/features/schedule/occurrences.ts);
-- every screen reads that, so they never disagree.

-- ---------------------------------------------------------------------------
-- Targets for composite foreign keys
-- ---------------------------------------------------------------------------

-- (id, course_id, user_id): a change must name a slot of the same course and user.
alter table public.timetable_slots
  add constraint timetable_slots_id_course_user_key unique (id, course_id, user_id);

-- ---------------------------------------------------------------------------
-- class_changes
-- ---------------------------------------------------------------------------

create table public.class_changes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id     uuid not null,
  slot_id       uuid,
  kind          text not null,
  -- The date of the weekly occurrence this changes (cancelled, moved).
  original_date date,
  -- Where it happens instead (moved: null = unchanged), or when (extra).
  new_date      date,
  start_time    time,
  end_time      time,
  location      text check (char_length(location) <= 80),
  label         text check (char_length(label) <= 40),
  note          text check (char_length(note) <= 200),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint class_changes_id_course_user_key unique (id, course_id, user_id),
  constraint class_changes_course_fk
    foreign key (course_id, user_id) references public.courses (id, user_id) on delete cascade,
  -- MATCH SIMPLE: skipped when slot_id is null (extra sessions). A slot moved to
  -- another course carries its changes along.
  constraint class_changes_slot_fk
    foreign key (slot_id, course_id, user_id) references public.timetable_slots (id, course_id, user_id)
    on delete cascade on update cascade,

  constraint class_changes_kind_check check (kind in ('cancelled', 'moved', 'extra')),
  constraint class_changes_time_pair check ((start_time is null) = (end_time is null)),
  constraint class_changes_time_order check (end_time is null or end_time > start_time),
  constraint class_changes_shape check (
    case kind
      when 'cancelled' then
        slot_id is not null and original_date is not null
        and new_date is null and start_time is null and location is null
      when 'moved' then
        slot_id is not null and original_date is not null
        and (new_date is not null or start_time is not null or location is not null)
      when 'extra' then
        slot_id is null and original_date is null and new_date is not null and start_time is not null
    end
  )
);

comment on table public.class_changes is
  'One-date exceptions to the weekly timetable: cancelled, moved (date/time/room) or an extra session.';
comment on column public.class_changes.original_date is 'cancelled/moved: the date of the weekly occurrence being changed.';
comment on column public.class_changes.new_date is 'moved: new date (null = same day); extra: the date of the session.';
comment on column public.class_changes.label is 'extra: what it is, e.g. "Makeup" or "Midterm exam".';

-- One change per occurrence: cancelling a moved class replaces the move.
create unique index class_changes_one_per_occurrence
  on public.class_changes (slot_id, original_date) where slot_id is not null;
create index class_changes_user_original_idx on public.class_changes (user_id, original_date);
create index class_changes_user_new_idx on public.class_changes (user_id, new_date);
create index class_changes_course_idx on public.class_changes (course_id);

create trigger class_changes_set_updated_at
  before update on public.class_changes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- class_breaks
-- ---------------------------------------------------------------------------

create table public.class_breaks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 60),
  starts_on  date not null,
  ends_on    date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint class_breaks_date_order check (ends_on >= starts_on),
  -- A break is days or weeks, not a whole year of cancelled classes by typo.
  constraint class_breaks_length check (ends_on - starts_on <= 120)
);

comment on table public.class_breaks is
  'No regular classes from starts_on to ends_on (inclusive), e.g. a holiday or exam week.';

create index class_breaks_user_range_idx on public.class_breaks (user_id, starts_on, ends_on);

create trigger class_breaks_set_updated_at
  before update on public.class_breaks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.class_changes enable row level security;
alter table public.class_breaks enable row level security;

revoke all on public.class_changes from anon, authenticated;
revoke all on public.class_breaks from anon, authenticated;
grant select, insert, update, delete on public.class_changes to authenticated;
grant select, insert, update, delete on public.class_breaks to authenticated;

create policy "class_changes: owner can read"   on public.class_changes for select to authenticated using ((select auth.uid()) = user_id);
create policy "class_changes: owner can insert" on public.class_changes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "class_changes: owner can update" on public.class_changes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "class_changes: owner can delete" on public.class_changes for delete to authenticated using ((select auth.uid()) = user_id);

create policy "class_breaks: owner can read"   on public.class_breaks for select to authenticated using ((select auth.uid()) = user_id);
create policy "class_breaks: owner can insert" on public.class_breaks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "class_breaks: owner can update" on public.class_breaks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "class_breaks: owner can delete" on public.class_breaks for delete to authenticated using ((select auth.uid()) = user_id);

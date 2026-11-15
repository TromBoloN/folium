-- Attendance per class, online classes, and lecturer contact details.

-- ---------------------------------------------------------------------------
-- Online classes: a flag and an optional meeting link per weekly slot
-- ---------------------------------------------------------------------------

alter table public.timetable_slots
  add column is_online   boolean not null default false,
  add column meeting_url text;

alter table public.timetable_slots
  add constraint timetable_slots_meeting_url_format
    check (meeting_url is null or (meeting_url ~ '^https?://' and char_length(meeting_url) <= 500));

comment on column public.timetable_slots.meeting_url is 'Zoom/Meet/Teams link; only http(s) links are accepted.';

-- ---------------------------------------------------------------------------
-- Lecturer contact
-- ---------------------------------------------------------------------------

alter table public.courses
  add column lecturer_email text,
  add column lecturer_phone text;

alter table public.courses
  add constraint courses_lecturer_email_format
    check (lecturer_email is null or (lecturer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(lecturer_email) <= 254)),
  add constraint courses_lecturer_phone_format
    check (lecturer_phone is null or lecturer_phone ~ '^\+?[0-9][0-9 ()-]{5,22}$');

comment on column public.courses.lecturer_phone is 'For a WhatsApp link: digits with an optional leading +.';

-- ---------------------------------------------------------------------------
-- attendance: attended or missed, one row per class occurrence
-- ---------------------------------------------------------------------------
-- An occurrence is either a weekly slot on a date (slot_id + occurs_on, the
-- ORIGINAL date even if the class was moved) or an extra session (change_id).

alter table public.class_changes
  add constraint class_changes_id_user_key unique (id, user_id);

create table public.attendance (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id  uuid not null,
  slot_id    uuid,
  occurs_on  date,
  change_id  uuid,
  status     text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint attendance_course_fk
    foreign key (course_id, user_id) references public.courses (id, user_id) on delete cascade,
  constraint attendance_slot_fk
    foreign key (slot_id, course_id, user_id) references public.timetable_slots (id, course_id, user_id)
    on delete cascade on update cascade,
  constraint attendance_change_fk
    foreign key (change_id, course_id, user_id) references public.class_changes (id, course_id, user_id)
    on delete cascade on update cascade,

  constraint attendance_status_check check (status in ('attended', 'missed')),
  constraint attendance_target check (
    (slot_id is not null and occurs_on is not null and change_id is null)
    or (slot_id is null and occurs_on is null and change_id is not null)
  )
);

comment on table public.attendance is
  'Attended/missed per class occurrence. Unmarked classes have no row. Cancelled classes are never counted.';

create unique index attendance_one_per_slot_date on public.attendance (slot_id, occurs_on) where slot_id is not null;
create unique index attendance_one_per_change on public.attendance (change_id) where change_id is not null;
create index attendance_user_course_idx on public.attendance (user_id, course_id);

create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

alter table public.attendance enable row level security;

revoke all on public.attendance from anon, authenticated;
grant select, insert, update, delete on public.attendance to authenticated;

create policy "attendance: owner can read"   on public.attendance for select to authenticated using ((select auth.uid()) = user_id);
create policy "attendance: owner can insert" on public.attendance for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "attendance: owner can update" on public.attendance for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "attendance: owner can delete" on public.attendance for delete to authenticated using ((select auth.uid()) = user_id);

-- Courses: campus or external, a class type, and a meeting count instead of
-- start/end dates. Attendance becomes the meeting log.
--
-- The weekly slots stay the schedule (weekday + time). What changes is how a
-- course ends: after its last meeting, not on a date. Each class the student
-- marks (attended or skipped, "missed" in the table) is logged with its
-- meeting number; "currently at meeting X" is simply the next unlogged number.
-- A cancelled class is a class_changes row as before and never takes a number,
-- so a cancelled week can't push the count off.
--
-- Saying "I'm at meeting 6" mid-semester logs meetings 1-5 as 'unknown': they
-- happened, but the student doesn't say whether they went, so percentages
-- leave them out instead of making numbers up.

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------

alter table public.courses
  add column kind           text not null default 'campus',
  add column class_type     text,
  add column total_meetings smallint;

alter table public.courses
  add constraint courses_kind_check check (kind in ('campus', 'external')),
  -- An id from the user's class types (preferences.classTypes), e.g. "practicum".
  add constraint courses_class_type_format check (class_type is null or class_type ~ '^[a-z0-9-]{1,40}$'),
  add constraint courses_class_type_campus check (class_type is null or kind = 'campus'),
  add constraint courses_total_meetings_range check (total_meetings is null or total_meetings between 1 and 200);

comment on column public.courses.kind is
  'campus: a course at the student''s campus (credits, semester, class type). external: a bootcamp, course or club outside it.';
comment on column public.courses.class_type is
  'Id of one of the user''s class types (preferences.classTypes). An id that no longer exists shows as no type.';
comment on column public.courses.total_meetings is
  'How many meetings the course has (e.g. 16, or 8 for a practicum). Null = open-ended. Its classes stop after the last one.';

-- ---------------------------------------------------------------------------
-- attendance -> the meeting log
-- ---------------------------------------------------------------------------

alter table public.attendance add column meeting_number smallint;

alter table public.attendance drop constraint attendance_status_check;
alter table public.attendance drop constraint attendance_target;

alter table public.attendance
  add constraint attendance_status_check check (status in ('attended', 'missed', 'unknown')),
  add constraint attendance_meeting_number_range check (meeting_number is null or meeting_number between 1 and 200),
  -- A real mark points at one class; an 'unknown' meeting (backfilled) points at none, only a number.
  add constraint attendance_target check (
    case status
      when 'unknown' then
        slot_id is null and occurs_on is null and change_id is null and meeting_number is not null
      else
        (slot_id is not null and occurs_on is not null and change_id is null)
        or (slot_id is null and occurs_on is null and change_id is not null)
    end
  );

comment on column public.attendance.status is
  'attended, missed (skipped) or unknown (a meeting before the student started counting). Cancelled classes are class_changes, never rows here.';
comment on column public.attendance.meeting_number is
  'Which meeting of the course this was (1, 2, ...). Set on insert to the next free number when not given.';

-- Existing marks: number them per course in date order.
with numbered as (
  select a.id,
         row_number() over (
           partition by a.course_id
           order by coalesce(a.occurs_on, c.new_date, a.created_at::date), a.created_at
         ) as n
  from public.attendance a
  left join public.class_changes c on c.id = a.change_id
)
update public.attendance a
   set meeting_number = least(numbered.n, 200)
  from numbered
 where numbered.id = a.id;

create unique index attendance_one_per_meeting on public.attendance (course_id, meeting_number)
  where meeting_number is not null;

-- The next free number for a mark inserted without one. Serialised per course
-- so two quick taps can't take the same number.
create function public.attendance_number_meeting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Only for a course the caller can see (RLS): otherwise the foreign key rejects
  -- the row, and numbering must not collide with another user's log first.
  if new.meeting_number is null
     and exists (select 1 from public.courses c where c.id = new.course_id and c.user_id = new.user_id) then
    perform pg_advisory_xact_lock(hashtext('attendance:' || new.course_id::text));
    select coalesce(max(a.meeting_number), 0) + 1
      into new.meeting_number
      from public.attendance a
     where a.course_id = new.course_id;
  end if;
  return new;
end;
$$;

create trigger attendance_number_meeting
  before insert on public.attendance
  for each row execute function public.attendance_number_meeting();

-- "I'm at meeting N": meetings 1..N-1 that aren't logged become 'unknown';
-- 'unknown' rows from N up are removed. Real marks are never touched, so N
-- can't go below a meeting already marked. Runs as the caller (RLS applies).
create function public.set_current_meeting(p_course_id uuid, p_next smallint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid;
  v_last smallint;
begin
  if p_next is null or p_next < 1 or p_next > 200 then
    raise exception 'meeting number out of range' using errcode = '22023';
  end if;
  select c.user_id into v_user from public.courses c where c.id = p_course_id;
  if v_user is null then
    raise exception 'course not found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtext('attendance:' || p_course_id::text));

  select max(a.meeting_number) into v_last
    from public.attendance a
   where a.course_id = p_course_id and a.status <> 'unknown';
  if v_last is not null and v_last >= p_next then
    raise exception 'meeting % is already marked', v_last using errcode = '23514';
  end if;

  delete from public.attendance a
   where a.course_id = p_course_id and a.status = 'unknown' and a.meeting_number >= p_next;

  insert into public.attendance (user_id, course_id, status, meeting_number)
  select v_user, p_course_id, 'unknown', n
    from generate_series(1, p_next - 1) as n
   where not exists (
     select 1 from public.attendance a where a.course_id = p_course_id and a.meeting_number = n
   );
end;
$$;

revoke execute on function public.set_current_meeting(uuid, smallint) from public, anon;
grant execute on function public.set_current_meeting(uuid, smallint) to authenticated;
revoke execute on function public.attendance_number_meeting() from public, anon, authenticated;

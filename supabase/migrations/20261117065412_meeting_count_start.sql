-- When meeting counting started, and marks for meetings without a date.
--
-- A course added mid-way ("next meeting is 15") has meetings 1-14 logged as
-- 'unknown'. Classes that ended before that moment are those meetings, so the
-- app must not ask about them again or guess which date was which:
-- meetings_counted_from records the moment, and the app only treats classes
-- ending after it as unlogged. An 'unknown' meeting can later be marked
-- attended or missed by its number alone, still without a date.

alter table public.courses add column meetings_counted_from timestamptz;

comment on column public.courses.meetings_counted_from is
  'When "next meeting is N" was last set. Classes that ended before it are covered by the backfilled meetings. Null = count everything.';

-- A mark may now point at a class (slot + date, or an extra session) or at no
-- class at all (a meeting known only by its number).
alter table public.attendance drop constraint attendance_target;
alter table public.attendance
  add constraint attendance_target check (
    (slot_id is not null and occurs_on is not null and change_id is null)
    or (slot_id is null and occurs_on is null and change_id is not null)
    or (slot_id is null and occurs_on is null and change_id is null and meeting_number is not null)
  ),
  -- 'unknown' never points at a class.
  add constraint attendance_unknown_undated check (
    status <> 'unknown' or (slot_id is null and occurs_on is null and change_id is null)
  );

comment on column public.attendance.status is
  'attended, missed (skipped) or unknown (a meeting from before the student started counting). Cancelled classes are class_changes, never rows here.';

-- "I'm at meeting N", for a course that already has marks too: the marks keep
-- their order and gaps but shift so the newest is meeting N-1 (marks numbered
-- before counting began were often off). Meetings below that without a mark
-- become 'unknown'. Refused only when the marks don't fit below N. Stamps when
-- counting (re)started.
create or replace function public.set_current_meeting(p_course_id uuid, p_next smallint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user  uuid;
  v_first smallint;
  v_last  smallint;
  v_shift integer;
  r       record;
begin
  if p_next is null or p_next < 1 or p_next > 200 then
    raise exception 'meeting number out of range' using errcode = '22023';
  end if;
  select c.user_id into v_user from public.courses c where c.id = p_course_id;
  if v_user is null then
    raise exception 'course not found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtext('attendance:' || p_course_id::text));

  delete from public.attendance a where a.course_id = p_course_id and a.status = 'unknown';

  select min(a.meeting_number), max(a.meeting_number) into v_first, v_last
    from public.attendance a
   where a.course_id = p_course_id and a.meeting_number is not null;

  if v_last is not null then
    v_shift := (p_next - 1) - v_last;
    if v_first + v_shift < 1 then
      raise exception 'marked meetings don''t fit below %', p_next using errcode = '23514';
    end if;
    -- Row by row, in the direction that never collides with the unique number index.
    if v_shift > 0 then
      for r in select a.id from public.attendance a
                where a.course_id = p_course_id and a.meeting_number is not null
                order by a.meeting_number desc loop
        update public.attendance set meeting_number = meeting_number + v_shift where id = r.id;
      end loop;
    elsif v_shift < 0 then
      for r in select a.id from public.attendance a
                where a.course_id = p_course_id and a.meeting_number is not null
                order by a.meeting_number asc loop
        update public.attendance set meeting_number = meeting_number + v_shift where id = r.id;
      end loop;
    end if;
  end if;

  insert into public.attendance (user_id, course_id, status, meeting_number)
  select v_user, p_course_id, 'unknown', n
    from generate_series(1, p_next - 1) as n
   where not exists (
     select 1 from public.attendance a where a.course_id = p_course_id and a.meeting_number = n
   );

  update public.courses set meetings_counted_from = now() where id = p_course_id;
end;
$$;

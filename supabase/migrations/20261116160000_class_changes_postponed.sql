-- A class that was rescheduled but whose new date isn't decided yet.
--
-- `postponed` sits beside cancelled / moved / extra. Like `cancelled`, it names
-- one weekly occurrence (slot_id + original_date) and has no new date, time or
-- room. The class doesn't happen on its original date and isn't counted for
-- attendance; the student later sets the agreed date (it becomes `moved`) or
-- drops it (it becomes `cancelled`). The one-change-per-occurrence index still
-- applies, so each step replaces the last.

alter table public.class_changes drop constraint class_changes_kind_check;
alter table public.class_changes
  add constraint class_changes_kind_check check (kind in ('cancelled', 'moved', 'extra', 'postponed'));

alter table public.class_changes drop constraint class_changes_shape;
alter table public.class_changes
  add constraint class_changes_shape check (
    case kind
      when 'cancelled' then
        slot_id is not null and original_date is not null
        and new_date is null and start_time is null and location is null
      when 'postponed' then
        slot_id is not null and original_date is not null
        and new_date is null and start_time is null and location is null
      when 'moved' then
        slot_id is not null and original_date is not null
        and (new_date is not null or start_time is not null or location is not null)
      when 'extra' then
        slot_id is null and original_date is null and new_date is not null and start_time is not null
    end
  );

comment on table public.class_changes is
  'One-date exceptions to the weekly timetable: cancelled, moved (date/time/room), postponed (rescheduled, new date not decided yet) or an extra session.';

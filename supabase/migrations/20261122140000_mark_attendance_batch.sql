-- Step 1 catch-up: atomic batch attendance marking across multiple courses.
-- Acquires per-course advisory locks (via attendance_number_meeting trigger) in
-- sorted course_id order so concurrent batches never deadlock, skips rows
-- already marked, and returns the exact occurrence keys inserted for Undo.

create or replace function public.mark_attendance_batch(
  p_rows jsonb,
  p_status text
)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row record;
  v_count integer;
  v_inserted text[] := '{}';
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if p_status not in ('attended', 'missed') then
    raise exception 'invalid attendance status' using errcode = '22023';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return v_inserted;
  end if;

  -- Sort by course_id so attendance_number_meeting() locks courses in a fixed order.
  for v_row in
    select
      elem->>'key' as occ_key,
      (elem->>'course_id')::uuid as course_id,
      nullif(elem->>'slot_id', '')::uuid as slot_id,
      nullif(elem->>'occurs_on', '')::date as occurs_on,
      nullif(elem->>'change_id', '')::uuid as change_id
    from jsonb_array_elements(p_rows) as elem
    order by
      (elem->>'course_id')::uuid::text,
      nullif(elem->>'occurs_on', '')::date nulls last,
      nullif(elem->>'slot_id', '')::uuid::text nulls last,
      nullif(elem->>'change_id', '')::uuid::text nulls last
  loop
    if v_row.slot_id is not null and v_row.occurs_on is not null and v_row.change_id is null then
      insert into public.attendance (user_id, course_id, slot_id, occurs_on, status)
      values (v_user, v_row.course_id, v_row.slot_id, v_row.occurs_on, p_status)
      on conflict (slot_id, occurs_on) where slot_id is not null do nothing;
      get diagnostics v_count = row_count;
      if v_count > 0 then
        v_inserted := array_append(v_inserted, v_row.occ_key);
      end if;
    elsif v_row.change_id is not null and v_row.slot_id is null and v_row.occurs_on is null then
      insert into public.attendance (user_id, course_id, change_id, status)
      values (v_user, v_row.course_id, v_row.change_id, p_status)
      on conflict (change_id) where change_id is not null do nothing;
      get diagnostics v_count = row_count;
      if v_count > 0 then
        v_inserted := array_append(v_inserted, v_row.occ_key);
      end if;
    else
      raise exception 'invalid attendance target' using errcode = '22023';
    end if;
  end loop;

  return v_inserted;
end;
$$;

revoke execute on function public.mark_attendance_batch(jsonb, text) from public, anon;
grant execute on function public.mark_attendance_batch(jsonb, text) to authenticated;

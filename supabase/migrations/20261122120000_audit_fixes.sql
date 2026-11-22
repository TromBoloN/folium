-- Audit fixes (#3, #4, #8, #15):
--   1. attendance_number_meeting(): assign the lowest free meeting number in 1..200.
--   2. Atomic SECURITY INVOKER functions for multi-step writes and race-prone money actions:
--      delete_all_finance_data, rollover_semester, split_timetable_slot,
--      generate_recurring_transactions, settle_person, adjust_account_balance,
--      match_account_balance.

-- ---------------------------------------------------------------------------
-- 1. Attendance numbering: lowest free meeting number (not max + 1)
-- ---------------------------------------------------------------------------

create or replace function public.attendance_number_meeting()
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
    select coalesce(
      (select n
         from generate_series(1, 200) as n
        where not exists (
          select 1 from public.attendance a
           where a.course_id = new.course_id and a.meeting_number = n
        )
        order by n
        limit 1),
      201
    ) into new.meeting_number;
  end if;
  return new;
end;
$$;

revoke execute on function public.attendance_number_meeting() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Atomic multi-step writes (all SECURITY INVOKER so RLS applies)
-- ---------------------------------------------------------------------------

create or replace function public.delete_all_finance_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  -- Children before parents (foreign keys are RESTRICT).
  delete from public.transactions where user_id = v_user;
  delete from public.import_batches where user_id = v_user;
  delete from public.recurring_rules where user_id = v_user;
  delete from public.budgets where user_id = v_user;
  delete from public.goals where user_id = v_user;
  delete from public.people where user_id = v_user;
  delete from public.categories where user_id = v_user and parent_id is not null;
  delete from public.categories where user_id = v_user;
  delete from public.accounts where user_id = v_user;
end;
$$;

revoke execute on function public.delete_all_finance_data() from public, anon;
grant execute on function public.delete_all_finance_data() to authenticated;

create or replace function public.rollover_semester(
  p_to text,
  p_copy_slots boolean,
  p_archive_old boolean,
  p_counted_from timestamptz,
  p_from text default null,
  p_starts_on date default null,
  p_ends_on date default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old_ids uuid[] := '{}';
  v_new_id uuid;
  v_course record;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  for v_course in
    select id, name, code, color, lecturer, lecturer_email, lecturer_phone,
           room, credits, kind, class_type, total_meetings
      from public.courses
     where user_id = v_user
       and ((p_from is null and semester is null) or semester = p_from)
     order by created_at, id
  loop
    v_old_ids := array_append(v_old_ids, v_course.id);

    insert into public.courses (
      user_id, name, code, color, lecturer, lecturer_email, lecturer_phone,
      room, credits, kind, class_type, total_meetings, semester, meetings_counted_from
    ) values (
      v_user, v_course.name, v_course.code, v_course.color, v_course.lecturer,
      v_course.lecturer_email, v_course.lecturer_phone, v_course.room,
      v_course.credits, v_course.kind, v_course.class_type, v_course.total_meetings,
      p_to, coalesce(p_counted_from, now())
    )
    returning id into v_new_id;

    if p_copy_slots then
      insert into public.timetable_slots (
        user_id, course_id, weekday, start_time, end_time,
        location, is_online, meeting_url, starts_on, ends_on
      )
      select v_user, v_new_id, s.weekday, s.start_time, s.end_time,
             s.location, s.is_online, s.meeting_url, p_starts_on, p_ends_on
        from public.timetable_slots s
       where s.course_id = v_course.id and s.user_id = v_user;
    end if;
  end loop;

  if p_archive_old and coalesce(array_length(v_old_ids, 1), 0) > 0 then
    update public.courses
       set archived_at = now()
     where id = any(v_old_ids)
       and user_id = v_user
       and archived_at is null;
  end if;

  return coalesce(array_length(v_old_ids, 1), 0);
end;
$$;

revoke execute on function public.rollover_semester(text, boolean, boolean, timestamptz, text, date, date) from public, anon;
grant execute on function public.rollover_semester(text, boolean, boolean, timestamptz, text, date, date) to authenticated;

create or replace function public.split_timetable_slot(
  p_slot_id uuid,
  p_from date,
  p_weekday smallint,
  p_start_time time,
  p_end_time time,
  p_location text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_slot public.timetable_slots%rowtype;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_slot
    from public.timetable_slots
   where id = p_slot_id and user_id = v_user
   for update;
  if not found then
    raise exception 'slot not found' using errcode = 'P0002';
  end if;

  if v_slot.starts_on is null or v_slot.starts_on < p_from then
    update public.timetable_slots
       set ends_on = p_from - 1
     where id = v_slot.id;
    insert into public.timetable_slots (
      user_id, course_id, weekday, start_time, end_time,
      location, starts_on, ends_on, is_online, meeting_url
    ) values (
      v_user, v_slot.course_id, p_weekday, p_start_time, p_end_time,
      p_location, p_from, v_slot.ends_on, v_slot.is_online, v_slot.meeting_url
    );
  else
    update public.timetable_slots
       set weekday = p_weekday,
           start_time = p_start_time,
           end_time = p_end_time,
           location = p_location
     where id = v_slot.id;
  end if;

  delete from public.class_changes
   where slot_id = v_slot.id
     and user_id = v_user
     and original_date >= p_from;
end;
$$;

revoke execute on function public.split_timetable_slot(uuid, date, smallint, time, time, text) from public, anon;
grant execute on function public.split_timetable_slot(uuid, date, smallint, time, time, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Atomic money actions (prevent double-click duplicates & stale generation)
-- ---------------------------------------------------------------------------

create or replace function public.generate_recurring_transactions(
  p_rule_id uuid,
  p_expected_updated_at timestamptz,
  p_to date,
  p_dates date[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rule public.recurring_rules%rowtype;
  v_inserted integer := 0;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_rule
    from public.recurring_rules
   where id = p_rule_id and user_id = v_user
   for update;

  if not found
     or not v_rule.active
     or v_rule.updated_at <> p_expected_updated_at
     or (v_rule.generated_through is not null and v_rule.generated_through >= p_to) then
    return 0;
  end if;

  if coalesce(array_length(p_dates, 1), 0) > 0 then
    insert into public.transactions (
      user_id, kind, status, amount, account_id, to_account_id, category_id,
      payee, note, occurred_on, due_on, recurring_rule_id
    )
    select v_user,
           v_rule.kind,
           'planned',
           v_rule.amount,
           v_rule.account_id,
           v_rule.to_account_id,
           v_rule.category_id,
           case when v_rule.kind = 'transfer' then null else coalesce(v_rule.payee, v_rule.name) end,
           case when v_rule.kind = 'transfer' then v_rule.name else null end,
           d,
           d,
           v_rule.id
      from unnest(p_dates) as d
    on conflict (recurring_rule_id, due_on) do nothing;
    get diagnostics v_inserted = row_count;
  end if;

  update public.recurring_rules
     set generated_through = p_to
   where id = v_rule.id;

  return v_inserted;
end;
$$;

revoke execute on function public.generate_recurring_transactions(uuid, timestamptz, date, date[]) from public, anon;
grant execute on function public.generate_recurring_transactions(uuid, timestamptz, date, date[]) to authenticated;

create or replace function public.settle_person(
  p_person_id uuid,
  p_account_id uuid,
  p_occurred_on date
)
returns table (kind text, amount text, person_name text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_balance bigint;
  v_kind text;
  v_amount bigint;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('settle:' || p_person_id::text));

  select p.name, pb.balance into v_name, v_balance
    from public.people p
    join public.person_balances pb on pb.person_id = p.id
   where p.id = p_person_id and p.user_id = v_user;

  if not found or v_balance = 0 then
    return;
  end if;

  v_kind := case when v_balance > 0 then 'repay' else 'payback' end;
  v_amount := abs(v_balance);

  insert into public.transactions (
    user_id, kind, amount, account_id, person_id, occurred_on, note
  ) values (
    v_user, v_kind, v_amount, p_account_id, p_person_id, p_occurred_on, 'Settled'
  );

  return query select v_kind, v_amount::text, v_name;
end;
$$;

revoke execute on function public.settle_person(uuid, uuid, date) from public, anon;
grant execute on function public.settle_person(uuid, uuid, date) to authenticated;

create or replace function public.adjust_account_balance(
  p_account_id uuid,
  p_real_balance bigint,
  p_occurred_on date,
  p_note text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_balance bigint;
  v_diff bigint;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('account:' || p_account_id::text));

  select ab.balance into v_balance
    from public.account_balances ab
   where ab.account_id = p_account_id and ab.user_id = v_user;

  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  v_diff := p_real_balance - v_balance;
  if v_diff = 0 then
    return false;
  end if;

  insert into public.transactions (
    user_id, kind, amount, account_id, adjustment_direction, occurred_on, note
  ) values (
    v_user,
    'adjustment',
    abs(v_diff),
    p_account_id,
    case when v_diff > 0 then 'in' else 'out' end,
    p_occurred_on,
    p_note
  );

  return true;
end;
$$;

revoke execute on function public.adjust_account_balance(uuid, bigint, date, text) from public, anon;
grant execute on function public.adjust_account_balance(uuid, bigint, date, text) to authenticated;

create or replace function public.match_account_balance(
  p_account_id uuid,
  p_real_balance bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_opening bigint;
  v_balance bigint;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('account:' || p_account_id::text));

  select a.opening_balance, ab.balance into v_opening, v_balance
    from public.accounts a
    join public.account_balances ab on ab.account_id = a.id
   where a.id = p_account_id and a.user_id = v_user;

  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  update public.accounts
     set opening_balance = p_real_balance - (v_balance - v_opening)
   where id = p_account_id;
end;
$$;

revoke execute on function public.match_account_balance(uuid, bigint) from public, anon;
grant execute on function public.match_account_balance(uuid, bigint) to authenticated;

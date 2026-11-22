-- Step 2: batch balance sync (silent adjustments only).
-- Locks accounts in sorted account_id order using the same 'account:' advisory
-- lock key as adjust_account_balance / match_account_balance so concurrent
-- syncs never deadlock. Client sends real_balance (never the diff); zero-diff
-- rows are skipped so double-taps are harmless. Returns inserted tx ids for Undo.

create or replace function public.sync_account_balances(
  p_items jsonb,
  p_occurred_on date
)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item record;
  v_balance bigint;
  v_diff bigint;
  v_tx_id uuid;
  v_inserted uuid[] := '{}';
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return v_inserted;
  end if;

  for v_item in
    select
      (elem->>'account_id')::uuid as account_id,
      (elem->>'real_balance')::bigint as real_balance,
      nullif(btrim(coalesce(elem->>'note', '')), '') as note
    from jsonb_array_elements(p_items) as elem
    order by (elem->>'account_id')::uuid::text
  loop
    perform pg_advisory_xact_lock(hashtext('account:' || v_item.account_id::text));

    select ab.balance into v_balance
      from public.account_balances ab
     where ab.account_id = v_item.account_id and ab.user_id = v_user;

    if not found then
      raise exception 'account not found' using errcode = 'P0002';
    end if;

    v_diff := v_item.real_balance - v_balance;
    if v_diff = 0 then
      continue;
    end if;

    insert into public.transactions (
      user_id, kind, amount, account_id, adjustment_direction, occurred_on, note
    ) values (
      v_user,
      'adjustment',
      abs(v_diff),
      v_item.account_id,
      case when v_diff > 0 then 'in' else 'out' end,
      p_occurred_on,
      coalesce(v_item.note, 'Synced balance')
    )
    returning id into v_tx_id;

    v_inserted := array_append(v_inserted, v_tx_id);
  end loop;

  return v_inserted;
end;
$$;

revoke execute on function public.sync_account_balances(jsonb, date) from public, anon;
grant execute on function public.sync_account_balances(jsonb, date) to authenticated;

-- Bills never create tasks; Tasks is for class assignments only.
--
-- Recurring rules used to create an opt-in "Pay …" task per bill. That is
-- removed from the app. This deletes ONLY tasks that carry the bill marker:
-- a transaction points at them through transactions.task_id, which nothing
-- but bill generation ever set. A task with no such link is never touched
-- (no matching by title). Subtasks of a deleted bill task go with it
-- (tasks_parent_fk cascades); the link on the transaction is cleared by
-- transactions_task_fk (on delete set null (task_id)).
--
-- The old columns (transactions.task_id, recurring_rules.create_task) stay,
-- unused, for now; a later migration may drop them.

create or replace function public.cleanup_bill_tasks()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with gone as (
    delete from public.tasks t
    where exists (
      select 1 from public.transactions x
      where x.task_id = t.id and x.user_id = t.user_id
    )
    returning 1
  )
  select count(*)::integer from gone;
$$;

comment on function public.cleanup_bill_tasks() is
  'Deletes tasks linked from transactions.task_id (bill tasks). Returns how many. Admin only; never matches by title.';

-- Not callable by app users.
revoke execute on function public.cleanup_bill_tasks() from public, anon, authenticated;

select public.cleanup_bill_tasks();

-- No new bill tasks: switch the old toggle off everywhere.
update public.recurring_rules set create_task = false where create_task;

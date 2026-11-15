-- Deadlines are a date with an optional time.
--
-- due_at stays the single instant used for sorting and "overdue" checks.
-- A date-only deadline is stored as the end of that day (23:59:59.999) in the
-- user's time zone, and due_has_time = false says "show only the date".
-- Without this flag a real 23:59 deadline and a date-only one look the same.

alter table public.tasks
  add column due_has_time boolean not null default false;

alter table public.tasks
  add constraint tasks_due_time_needs_date check (due_at is not null or not due_has_time);

comment on column public.tasks.due_has_time is
  'True when the user gave a time. False: due_at is the end of the due date in the user''s time zone.';

-- Subtasks are checklist items, listed under their parent in order.
create index tasks_parent_position_idx on public.tasks (parent_id, position, created_at) where parent_id is not null;
drop index if exists public.tasks_parent_id_idx;

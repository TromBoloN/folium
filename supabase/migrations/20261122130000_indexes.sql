-- Audit #17: missing indexes for unfiltered course/task listings, import batches,
-- budgets by month, transactions.task_id FK checks, and planned bill queries.

create index courses_user_all_idx on public.courses (user_id);
create index tasks_user_all_idx on public.tasks (user_id);
create index import_batches_user_created_idx on public.import_batches (user_id, created_at desc);
create index import_batches_account_idx on public.import_batches (account_id);
create index budgets_user_month_idx on public.budgets (user_id, month);
create index transactions_task_idx on public.transactions (task_id) where task_id is not null;
create index transactions_user_planned_date_idx on public.transactions (user_id, occurred_on) where status = 'planned';

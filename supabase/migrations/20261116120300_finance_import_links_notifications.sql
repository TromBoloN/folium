-- Finance phases 2e-2f: CSV import batches (with undo), links to tasks and
-- courses, and a notification log that makes reminder sends idempotent.

-- ---------------------------------------------------------------------------
-- import_batches: deleting a batch deletes its transactions ("Undo this import")
-- ---------------------------------------------------------------------------
create table public.import_batches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  source     text not null default 'csv',
  filename   text,
  row_count  integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint import_batches_id_user_key unique (id, user_id),
  constraint import_batches_source_check check (source in ('csv')),
  constraint import_batches_filename_length check (filename is null or char_length(filename) <= 200),
  constraint import_batches_row_count_check check (row_count >= 0),
  constraint import_batches_account_fk
    foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict
);

create trigger import_batches_set_updated_at
  before update on public.import_batches
  for each row execute function public.set_updated_at();

alter table public.transactions
  add column import_batch_id uuid,
  -- Dedupe key (date|amount|payee) per account: re-importing a file adds nothing.
  add column import_key text,
  add column task_id uuid,
  add column course_id uuid,
  add constraint transactions_import_key_length check (import_key is null or char_length(import_key) <= 300),
  add constraint transactions_import_batch_fk
    foreign key (import_batch_id, user_id) references public.import_batches (id, user_id) on delete cascade,
  add constraint transactions_account_import_key unique (account_id, import_key),
  -- An opt-in "Pay UKT" task created for a bill; deleting the task just unlinks it.
  add constraint transactions_task_fk
    foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id),
  -- An expense tagged to a course (books, printing, lab fees).
  add constraint transactions_course_fk
    foreign key (course_id, user_id) references public.courses (id, user_id) on delete set null (course_id),
  add constraint transactions_course_only_expense check (course_id is null or kind = 'expense');

create index transactions_user_batch_idx on public.transactions (user_id, import_batch_id) where import_batch_id is not null;
create index transactions_user_course_idx on public.transactions (user_id, course_id) where course_id is not null;

-- ---------------------------------------------------------------------------
-- notification_log: one row per sent reminder; the unique key stops double sends
-- ---------------------------------------------------------------------------
create table public.notification_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  ref_key    text not null,
  channel    text not null default 'email',
  sent_at    timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notification_log_kind_check check (kind in ('bill_due', 'weekly_summary')),
  constraint notification_log_channel_check check (channel in ('email')),
  constraint notification_log_ref_key_length check (char_length(ref_key) between 1 and 200),
  constraint notification_log_once unique (user_id, kind, ref_key, channel)
);

create trigger notification_log_set_updated_at
  before update on public.notification_log
  for each row execute function public.set_updated_at();

-- RLS: users may read their own log; only the server's cron (secret key) writes it.
alter table public.import_batches enable row level security;
alter table public.notification_log enable row level security;
revoke all on public.import_batches, public.notification_log from anon, authenticated;
grant select, insert, update, delete on public.import_batches to authenticated;
grant select on public.notification_log to authenticated;

create policy "import_batches: owner can read"   on public.import_batches for select to authenticated using ((select auth.uid()) = user_id);
create policy "import_batches: owner can insert" on public.import_batches for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "import_batches: owner can update" on public.import_batches for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "import_batches: owner can delete" on public.import_batches for delete to authenticated using ((select auth.uid()) = user_id);

create policy "notification_log: owner can read" on public.notification_log for select to authenticated using ((select auth.uid()) = user_id);

-- Grades: course credits and per-course assessments.
--
-- A course grade is the weighted average of its assessment percentages; the
-- semester GPA is the credit-weighted average of course grade points. All of
-- that is computed in the app (src/features/grades/logic.ts); the database only
-- stores the inputs and keeps them valid.

-- ---------------------------------------------------------------------------
-- courses.credits (SKS)
-- ---------------------------------------------------------------------------

alter table public.courses
  add column credits numeric(4, 1) not null default 0;

alter table public.courses
  add constraint courses_credits_range check (credits >= 0 and credits <= 24);

comment on column public.courses.credits is
  'Credit units (SKS). 0 = not counted in the GPA (e.g. a study group).';

-- ---------------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------------

create table public.assessments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id  uuid not null,
  name       text not null check (char_length(name) between 1 and 120),
  weight     numeric(5, 2) not null,
  max_score  numeric(8, 2) not null default 100,
  score      numeric(8, 2),
  due_at     timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Same pattern as timetable_slots: can't point at another user's course.
  constraint assessments_course_fk
    foreign key (course_id, user_id) references public.courses (id, user_id) on delete cascade,
  constraint assessments_weight_range check (weight > 0 and weight <= 100),
  constraint assessments_max_score_positive check (max_score > 0),
  -- No extra credit in v1: a score is between 0 and the maximum.
  constraint assessments_score_range check (score is null or (score >= 0 and score <= max_score))
);

comment on table public.assessments is
  'Graded work for a course. weight is the share of the course grade (percent); score null = not graded yet.';
comment on column public.assessments.weight is
  'Percent of the course grade. Weights of one course are not forced to sum to 100; the app warns instead.';

create index assessments_user_course_idx on public.assessments (user_id, course_id);

create trigger assessments_set_updated_at
  before update on public.assessments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.assessments enable row level security;

revoke all on public.assessments from anon, authenticated;
grant select, insert, update, delete on public.assessments to authenticated;

create policy "assessments: owner can read"   on public.assessments for select to authenticated using ((select auth.uid()) = user_id);
create policy "assessments: owner can insert" on public.assessments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "assessments: owner can update" on public.assessments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "assessments: owner can delete" on public.assessments for delete to authenticated using ((select auth.uid()) = user_id);

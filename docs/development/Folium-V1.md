Padu v1 Plan
Nov 15, 2026 · @A
Vision
Padu is a personal student dashboard that brings classes, deadlines and tasks into one place, and lets each student shape how it looks and what it shows.
The idea it is built under: personal software that fits one student's life, not a generic productivity tool. Padu ("united, cohesive") pulls the scattered parts of student life into one app, and the student decides how it looks and what matters most.
It is also a portfolio project. Every stage must end in something deployed and demonstrable, so the project is worth showing even if it stops early.
Design principles
Five rules decide every trade-off during the build.
1.  Useful on day one. The core four features must be good enough to replace whatever the student uses today, with real classes and deadlines entered in the first week.
2.  Shippable at every step. No stage is "half done". Each one is deployed and usable before the next begins.
3.  Customizable by design. No hardcoded colours, labels or layouts. Theme tokens, user settings and widget registries exist from the first commit, so customization is cheap instead of a rewrite.
4.  Private by default. Every table has RLS and every row belongs to one user. Nothing is visible to anyone else unless the student shares it.
5.  Mobile first. Students check this between classes, so the phone layout is designed first and the desktop layout adapts.
V1 scope
V1 is four features plus customization. If the project stopped here it would still be a complete app.
Feature
What it does
Done when
Auth and profile
Email and OAuth sign-in, one profile per user, sign-out, delete account
A new user can sign up and sees only their own data
Courses and timetable
Add courses (name, colour, lecturer, room), set weekly class slots, week view
A full weekly schedule can be entered and viewed on a phone
Tasks and deadlines
Tasks linked to a course, with due date, priority, status and subtasks; list and filter views
A task can be created, edited, completed and filtered by course or due date
Today dashboard
Today's classes, tasks due soon, overdue items, all as widgets
Opening the app answers "what do I need to do today?" at a glance
Customization
Theme, preferences and widget layout (next section)
Two accounts with different settings look and behave differently
Customization in v1
Three layers ship in v1, because they are cheap when planned early and are what makes the app feel personal.
Theming
• All colours, radius and fonts are CSS variables that Tailwind reads, so a theme is a set of values.
• Light and dark mode, an accent colour picker, a few presets, font choice and density (compact or comfortable).
• The saved theme is applied on the server render so the page never flashes the wrong colours.
Preferences
• Week start day, 12 or 24-hour time, language (Indonesian and English), default views and grade scale.
• Stored as one validated JSON object per user, merged over defaults when read, so adding a preference needs no migration.
Dashboard widgets
• The dashboard is built from widgets: today's classes, due soon, overdue, and a quick-add task box.
• Users can show, hide and reorder them with drag and drop (dnd-kit). The layout is saved as JSON per user.
• Widgets are registered in one place (id, component, default size), so adding a new one never touches dashboard code.
Not in v1
These are good ideas that are deliberately left out, so v1 stays small enough to finish.
Later feature
Why it waits
User-defined statuses, tags and custom fields
Needs the core data model proven first; v1 ships sensible defaults
Shareable themes and layouts
Depends on the theme system being stable
Grades and GPA tracker
Standalone module; add once the core is in daily use
Study timer and streaks
Standalone module with its own data
Expenses and budget
Standalone module with its own data
Markdown notes with search
Standalone module; adds full-text search
Reminders by email or push
Needs scheduled jobs and notification setup
PWA and offline support
Worth doing once the screens stop changing
AI helper (syllabus to deadlines)
Best added on top of a working tasks module
Campus lost and found
Separate project with its own audience problem
Stack and engineering practices
The stack stays the one already known (Next.js, React, strict TypeScript, Tailwind, Supabase), with a few additions that remove whole classes of bugs.
Area
Choice
Reason
Framework
Next.js App Router, React, strict TypeScript
Already known; server components and server actions cover most needs
Styling
Tailwind with CSS variable tokens, shadcn/ui
Theming for free; components are owned, not a dependency
Database
Supabase Postgres with RLS, Supabase Auth
Per-user security enforced in the database
Schema
Supabase CLI migrations, generated TypeScript types
Schema lives in version control and types never drift from it
Validation
Zod at every boundary, including env vars
One schema for forms, actions and settings
Dates
date-fns
Timetables and deadlines are date-heavy
Drag and drop
dnd-kit
Widget reordering
Tooling
Biome (or ESLint and Prettier), GitHub Actions CI
Typecheck, lint and tests on every push
Testing
Vitest for logic, pgTAP for RLS, one Playwright flow
Test where bugs hide, not every component
Practices
• Organize code by feature (features/tasks, features/timetable), each holding its own components, actions, schemas and queries.
• Components never call Supabase directly; data access sits in one layer per feature.
• Every table gets user_id, created_at, updated_at and an RLS policy in the same migration.
• Separate Supabase projects for development and production; seed script for realistic demo data.
• Small commits with conventional messages, work on branches, merge by pull request even when solo.
• A README with screenshot and setup steps, and a docs/decisions.md that records each real choice in a few lines.
Data model overview
V1 needs five tables, all owned by one user and protected by RLS. Detailed columns and policies come in the migration stage.
Table
Holds
Key relations
profiles
Display name, avatar, campus, created date
One per auth user
user_settings
Theme, preferences and dashboard layout as validated JSON
One per user
courses
Name, code, colour, lecturer, room, semester
Belongs to a user
timetable_slots
Weekday, start time, end time, location, optional date range
Belongs to a course
tasks
Title, notes, due date, priority, status, parent task for subtasks
Belongs to a user, optionally to a course
Two decisions are fixed now because they are hard to change later. Statuses and priorities ship as defaults in v1 but are stored in a way that lets user-defined ones replace them later. Settings are versioned JSON merged over defaults, so older accounts keep working when new options appear.
Build order
Six stages, in order. Each one ends deployed and usable, so stopping after any of them still leaves a working app.
1.  Foundation. Repo, strict TypeScript, linting, CI, Supabase CLI, env validation, theme tokens and the app shell. Ends with a deployed empty app that already supports light and dark mode.
2.  Auth and settings. Sign-up, sign-in, profile, the user_settings table, and the theme and preferences screens. Ends with two accounts that can look different.
3.  Courses and timetable. Course CRUD and weekly slots with a week view. Ends with a real schedule entered and readable on a phone.
4.  Tasks and deadlines. Task CRUD, subtasks, course links, filters and the due-date logic. Ends with real deadlines tracked.
5.  Today dashboard. Widget registry, the four default widgets, show, hide and reorder with saved layout. Ends with the app answering "what is today?" at a glance.
6.  Polish. Empty and error states, loading skeletons, accessibility pass, README, screenshots, seed data and a demo account. Ends with a project that is ready to show.
Definition of done and open questions
V1 is done when all of these are true.
[ ] A new user can sign up, add courses, timetable slots and tasks, and see them on the dashboard.
[ ] Two accounts cannot read each other's data, proven by RLS tests.
[ ] Theme, preferences and widget layout persist per user and apply on first paint.
[ ] The app is deployed, installable-feeling on a phone, and has a README with screenshots.
[ ] CI passes on main, and the one end-to-end flow (sign up to seeing a task on the dashboard) is automated.
[ ] The author has used it for real classes for at least two weeks.
Open questions
[ ] Which languages ship in v1: Indonesian and English, or English only?
[ ] Sign-in methods: email only, or Google as well?
[ ] Is the semester a first-class object (archive old courses) or just a label on each course?
[ ] Should the timetable support one-off events (exams, guest lectures) in v1 or only weekly repeating slots?
[ ] Which hosting and domain: Vercel default URL, or a custom domain?
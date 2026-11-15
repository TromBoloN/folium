# Recipes

Step-by-step for common changes. Each ends with the same checks: `bun run typecheck`, `bunx biome check .`, `bun run test`, `bun run test:db`.

## Add a dashboard widget

1. Add the id to `src/features/dashboard/widget-ids.ts` (its position there is the default order).
2. Write the component in `src/features/dashboard/widgets/<name>-widget.tsx`: an async server component that loads its own data through feature queries. If it reads the clock, `await io()` first. Return a `WidgetEmpty` when there's nothing to show.
3. Add an entry to `WIDGETS` in `registry.tsx` (title, description, icon, `Component`, optional `href`, `skeletonRows`).

That's all: the dashboard renders it in its own Suspense boundary, the editor lists it, and users with a saved layout get it appended automatically. Put any selection logic in a pure function with a test.

## Add a setting

1. Add the field to `themeSchema` or `preferencesSchema` and its default to `DEFAULT_THEME` / `DEFAULT_PREFERENCES` in `src/features/settings/schema.ts`. No migration, no version bump (old rows get the default).
2. Read it in `updateSettings` (`src/features/settings/actions.ts`) from `formData`.
3. Add the control to `components/settings-form.tsx` using `value("<name>", saved)` for its default.
4. Use it via `getSettings()`. If it affects the theme, extend `themeAttributes()` and `globals.css`.
5. Bump `SETTINGS_VERSION` and add an `upgrade()` step only if an existing field changes meaning or shape.

## Add a table

1. `bunx supabase migration new <name>`.
2. In the same migration: `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `created_at`, `updated_at` + `set_updated_at` trigger, CHECK constraints (named, text not enum), composite FKs `(x_id, user_id) → x(id, user_id)` for references, `enable row level security`, `revoke all … from anon, authenticated`, explicit grants to `authenticated`, and one policy per operation using `(select auth.uid()) = user_id`.
3. pgTAP test in `supabase/tests/database/` proving a second user can't read or change rows.
4. `bunx supabase migration up`, then `bun run db:types`.
5. Optionally extend `supabase/seed.sql` for the demo account.

## Add a feature

Create `src/features/<name>/` with `schema.ts`, `queries.ts` (`import "server-only"`), `actions.ts` (`"use server"`, contract in [12-forms-and-server-actions.md](12-forms-and-server-actions.md)), pure logic files with tests, and `components/`. Routes in `src/app/(app)/<name>/` stay thin. If it needs a top-level nav entry, add it to `src/components/app-shell/nav-items.ts` and bump the bottom nav's `grid-cols-5` in `app-nav.tsx` (five fit at 390px; six would need a "More" menu). Add its pages to `e2e/accessibility.spec.ts`.

## Add a page

```tsx
export const metadata = { title: "Thing" };
export default function ThingPage({ params }: PageProps<"/things/[id]">) {
  return (
    <>
      <PageHeader title="…" />                       {/* static: in the shell */}
      <Suspense fallback={<ListSkeleton />}>
        <ThingContent params={params} />             {/* reads params/cookies/data */}
      </Suspense>
    </>
  );
}
async function ThingContent({ params }) {
  await requireUser();
  const { id } = await params;
  const thing = await getThing(id);
  if (!thing) notFound();
  …
}
```

Run `bun run typecheck` to regenerate `PageProps` route types. Every page needs empty, loading (the Suspense fallback) and error states (the `(app)/error.tsx` boundary covers thrown query errors).

## Change a theme colour

Edit the token in `src/app/globals.css` (both halves of `light-dark()`). For a new preset: add it to `PRESETS` in `settings/schema.ts`, a label in `theme.ts`, and a `[data-preset="…"] { --hue; --chroma }` rule.

# Forms and server actions

Every write in Folium is a server action called from a `<form action>`. Follow this pattern for new forms.

## Action contract

```ts
// src/lib/action-result.ts
type ActionResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };
type FormState = (ActionResult & { values?: Record<string, string> }) | null;
```

An action (`"use server"`, in `src/features/<name>/actions.ts`):

1. `await requireUser()` (identity check; redirects if signed out).
2. `const values = formValues(formData)`, the submitted strings, echoed back on error.
3. Parse with the feature's Zod schema. On failure return `{ ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues), values }`.
4. Write with `await createClient()` (RLS applies). Map Postgres codes to friendly messages (`23503` = referenced row isn't yours or is gone; `23514` = a check/trigger rejected it). Log the raw error with `console.error`.
5. `revalidatePath(...)`, then `redirect(...)` or `return { ok: true }`.

Actions **return** errors; they don't throw. (`redirect()` throwing is Next's control flow and is fine.)

## Form contract

```tsx
"use client";
const [state, action, pending] = useActionState(createThing, null);
const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
const submitted = state && !state.ok ? state.values : undefined;
const value = (name) => submitted?.[name] ?? defaults[name];

<form key={JSON.stringify(state)} action={action} noValidate>
  <Field id="title" label="Title" error={errors.title}>
    <Input id="title" name="title" defaultValue={value("title")}
           aria-invalid={errors.title ? true : undefined}
           aria-describedby={describedBy("title", errors.title)} />
  </Field>
</form>
```

Why each piece:

- **`values` echo + `defaultValue`**: React 19 resets uncontrolled fields after a form action finishes, even when it returns an error. Without the echo, a rejected save wipes what the user typed. Verified in a real browser for every form.
- **`key={JSON.stringify(state)}`**: remounts after each result so selects and radios pick up their new defaults.
- **`noValidate`**: the server's messages are the single source of truth.
- **`Field`** (`src/components/ui/field.tsx`): label, optional marker, hint, error, with matching ids for `aria-describedby`.

## One-button actions

For archive, delete, complete, toggle: `ActionForm` + `SubmitButton` (`src/components/action-form.tsx`). Hidden `fields`, inline error, pending state via `useFormStatus`. Children are plain nodes, so server components can render it (a server component can't pass a function child to a client component).

Destructive confirmations use `<details>`/`<summary>`: a confirm step that also works without JavaScript.

## Shared primitives

`Input`, `Textarea`, `NativeSelect` (styled native select; best on phones), `ChoiceGroup` (radio tiles), `Button` (`asChild` for links), `Label`, `Card`, `EmptyState`, `PageHeader`, `BackLink`, `ListSkeleton`/`FormSkeleton`.

## Without JavaScript

Forms are real forms, so they submit without JS. Two limits: in production, the action's returned state (error text, echoed values) doesn't render into the server HTML of a no-JS response; and in `next dev` a no-JS submission that returns an error can 500 (a Next dev-only bug). See [15-known-issues-and-gotchas.md](15-known-issues-and-gotchas.md).

# Auth

Email + password with email confirmation, via Supabase Auth and `@supabase/ssr` cookie sessions. Google sign-in is planned but not built (the profile trigger already reads Google's `full_name`/`avatar_url`).

## Flow

1. **Sign up** (`/signup`, `signUp` action): validates (email normalised to lower case, password 8–72 chars), calls `supabase.auth.signUp` with `emailRedirectTo = <origin>/auth/confirm`. Always shows "Check your email", even if the address is already registered, so the form can't reveal who has an account.
2. **Confirmation email** (`supabase/templates/confirmation.html`) links to `{{ .SiteURL }}/auth/confirm?token_hash=…&type=email`. Token-hash links work on any device (unlike PKCE `?code=` links, which only work in the browser that started sign-up).
3. **`/auth/confirm`** (`src/app/auth/confirm/route.ts`) verifies `token_hash` with `verifyOtp`, or exchanges `code` (default template). Success → redirect to `next` (same-site only) or `/`; failure → `/login?error=confirm_failed` (only known codes are rendered, so the URL can't inject text).
4. **Sign in** (`/login`, `signIn` action): friendly messages for wrong password, unconfirmed email, rate limits. Redirects to `?next` after `safeNextPath()` rejects anything not starting with a single `/`.
5. **Sign out**: `signOut` action, redirect to `/login`.
6. **Forgot password** (`/forgot-password`, `requestPasswordReset`): always answers "If an account exists for …" (no enumeration, even on provider errors). The recovery email (`supabase/templates/recovery.html`) links to `/auth/confirm?token_hash=…&type=recovery&next=/update-password`, which signs the user in.
7. **Set a new password** (`/update-password`, `updatePassword`): signed-in only (proxy redirects otherwise); new password + repeat, 8–72 chars. Also linked from Settings → Account. `secure_password_change = true` means a long-lived session must sign in again first (`reauthentication_needed` gets a friendly message).

Locally all emails land in Mailpit (http://127.0.0.1:54324).

## Identity checks

- **Proxy** (`src/lib/supabase/proxy.ts`): refreshes cookies with `getClaims()` and routes. Public: `/login`, `/signup`, `/forgot-password`, `/auth/*`. Guest-only: `/login`, `/signup`. Logged-out deep links keep `?next=<path>`.
- **`requireUser()`** (`src/features/auth/queries.ts`): the authoritative check in pages and actions. Uses `getUser()` (verified by the auth server), cached per request, redirects to `/login`.
- **RLS** is the final guard for data.
- Never use `getSession()` on the server.

## Config (local; mirror it in the hosted dashboard)

`supabase/config.toml`: `enable_confirmations = true`, `minimum_password_length = 8` (keep in sync with `MIN_PASSWORD_LENGTH` in `src/features/auth/schemas.ts`), `site_url = http://127.0.0.1:3000`, redirect URLs for `127.0.0.1:3000/**` and `localhost:3000/**`, `secure_password_change = true`, and the confirmation and recovery templates.

## Tests

`src/features/auth/schemas.test.ts` (open-redirect cases, email normalisation, password length). Sign-up via Mailpit is exercised by every e2e test (`e2e/helpers.ts`).

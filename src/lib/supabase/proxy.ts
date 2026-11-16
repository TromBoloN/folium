import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/** Pages a logged-out user may visit, plus the files that make the app installable. */
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
  "/sw.js",
  "/offline.html",
  // Vercel Cron: no session; the route checks its own CRON_SECRET bearer token.
  "/api/cron",
];
/** Pages a logged-in user has no reason to see. */
const GUEST_ONLY_PATHS = ["/login", "/signup"];

function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the auth cookies and routes users by sign-in state.
 * This is only for routing; pages still check identity with requireUser().
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Nothing may run between createServerClient and getClaims(), or sessions
  // can be dropped at random.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  if (!signedIn && !matches(pathname, PUBLIC_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return redirectWithCookies(url, response);
  }

  if (signedIn && matches(pathname, GUEST_ONLY_PATHS)) {
    // Claims only prove the token is validly signed (verified locally); the account may
    // be gone (deleted, or the local demo reseeded). Pages check with getUser() and send
    // such a session here, so trusting the claims would bounce /login <-> / forever.
    // Ask the auth server on these two pages only, and drop a dead session.
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      await supabase.auth.signOut({ scope: "local" });
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  // Return this exact response so refreshed auth cookies reach the browser.
  return response;
}

function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

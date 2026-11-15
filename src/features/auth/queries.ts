import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The one place identity is checked. Verifies the session with the auth server
 * (getUser, never getSession) and sends logged-out visitors to /login.
 * Cached per request, so calling it from a layout and a page costs one check.
 */
export const requireUser = cache(async (): Promise<User> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return data.user;
});

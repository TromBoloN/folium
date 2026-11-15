import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/features/auth/schemas";
import { createClient } from "@/lib/supabase/server";

/**
 * Completes email confirmation. Handles both link styles:
 * - ?token_hash=&type= from our email template (works on any device)
 * - ?code= from Supabase's default template (PKCE; same browser only)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const next = safeNextPath(params.get("next"));

  const supabase = await createClient();
  let failed = true;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = Boolean(error);
    if (error) console.error("[auth/confirm] verifyOtp", error.code, error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
    if (error) console.error("[auth/confirm] exchangeCode", error.code, error.message);
  }

  redirect(failed ? "/login?error=confirm_failed" : next);
}

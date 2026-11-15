"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type ActionResult, type FormState, fieldErrorsFrom } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./queries";
import { forgotPasswordSchema, safeNextPath, signInSchema, signUpSchema, updatePasswordSchema } from "./schemas";

export type AuthFormState = (ActionResult<{ needsConfirmation: boolean }> & { email?: string }) | null;

function friendlyError(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "Confirm your email first. Check your inbox for the link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try signing in.";
    case "reauthentication_needed":
      // secure_password_change: changing the password needs a recent sign-in.
      return "For your security, sign out and sign in again (or use “Forgot password?”) before changing your password.";
    case "same_password":
      return "Choose a password different from your current one.";
    case "weak_password":
      return "That password is too weak. Try a longer one.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    default:
      console.error("[auth]", error.code, error.message);
      return "Something went wrong. Please try again.";
  }
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: friendlyError(error), email };

  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message, email };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: origin ? { emailRedirectTo: `${origin}/auth/confirm` } : undefined,
  });
  if (error) return { ok: false, error: friendlyError(error), email };

  // Email confirmation turned off: the user is signed in already.
  if (data.session) redirect("/");

  // Same response whether or not the email was already registered, so the form
  // can't be used to discover who has an account.
  return { ok: true, data: { needsConfirmation: true }, email: parsed.data.email };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Sends a reset link. Always reports success (even for unknown addresses or
 * provider errors), so the form can't be used to discover who has an account.
 * The link comes from the recovery email template and lands on /update-password.
 */
export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);
  if (error) console.error("[auth] reset request", error.code, error.message);
  return { ok: true, data: { needsConfirmation: true }, email: parsed.data.email };
}

/** Sets a new password for the signed-in user (after a recovery link, or from settings). */
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password") ?? "",
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}

import { z } from "zod";

/** Keep in sync with auth.minimum_password_length in supabase/config.toml. */
export const MIN_PASSWORD_LENGTH = 8;

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(72, "Use at most 72 characters.");

export const signUpSchema = z.object({ email, password: newPassword });

export const forgotPasswordSchema = z.object({ email });

export const updatePasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." });

/** Email link types /auth/confirm accepts (anything else is rejected before reaching Supabase). */
export const EMAIL_OTP_TYPES = ["email", "signup", "recovery", "email_change", "invite", "magiclink"] as const;

/**
 * Only allow same-site relative paths as post-login destinations, so a crafted
 * ?next= link can't send someone to another site after they sign in.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  // Browsers drop tabs/newlines in URLs, so "/\t/evil.com" would become "//evil.com".
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

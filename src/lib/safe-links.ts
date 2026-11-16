/**
 * Links built from user data. Everything that ends up in an href (or an .ics
 * URL line) goes through these, so a stored value can never become a
 * `javascript:`/`data:` URL, carry a line break, or smuggle extra parameters.
 * Rows can be written through the API without the app's forms, so these are
 * applied when reading as well as in the Zod schemas.
 */

// Control characters, including tab, CR and LF.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point.
const CONTROL = /[\u0000-\u001f\u007f]/;

/** An absolute https URL with a host, normalised; anything else (http, javascript:, data:, junk) → null. */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  // A host must follow "https://" directly ("https:///x" would otherwise parse as host "x").
  if (!/^https:\/\/[^/\\]/i.test(trimmed) || /\s/.test(trimmed) || CONTROL.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** "+62 812-3456 (7890)" → "+6281234567890": digits with an optional leading +, 6–15 digits (E.164); else null. */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\+?[0-9 ()-]+$/.test(trimmed)) return null;
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/[^0-9]/g, "");
  return digits.length >= 6 && digits.length <= 15 ? `${plus}${digits}` : null;
}

/**
 * wa.me wants digits only, with the country code. Indonesian numbers are often
 * written 0812…; that leading 0 becomes 62. Other numbers need their own "+".
 */
export function whatsappLink(phone: unknown): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  let digits = normalized.replace("+", "");
  if (!normalized.startsWith("+") && digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

/** A plain address only (no "?cc=", spaces or line breaks), so mailto: can't gain extra headers. */
export const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function mailtoLink(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim();
  return trimmed.length <= 254 && EMAIL_PATTERN.test(trimmed) ? `mailto:${trimmed}` : null;
}

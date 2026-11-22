/**
 * Parse what a student types as an amount into whole rupiah (bigint).
 *
 * Accepted: "25k", "25rb", "25 ribu", "1,5jt", "1.5jt", "2 juta", "25.000",
 * "25000", "1,250,000", "Rp 25.000", "Rp25k", "25 K".
 *
 * Separator rules (the tests encode these):
 * - WITH a suffix (k, rb, ribu = ×1 000; jt, juta = ×1 000 000), one "." or ","
 *   is a DECIMAL separator: "1,5jt" = "1.5jt" = 1 500 000, "2.25k" = 2 250.
 * - WITHOUT a suffix, "." or "," is a THOUSANDS separator and must be followed
 *   by exactly three digits, the same separator throughout, with 1–3 digits
 *   before the first: "25.000", "1,250,000", "1.250.000". Anything else
 *   ("25.5", "1,5", "1.000.5", "1,250.000") is invalid: there are no
 *   sub-rupiah amounts.
 * - The result must be a whole number of rupiah: "1.2345jt" = 1 234 500,
 *   "0.0005jt" = 500, but "1.0001k" (1 000.1) is rejected.
 * - Empty, zero, negative, non-numeric, several suffixes or trailing junk are
 *   rejected.
 *
 * Decimal scaling is done with BigInt on the digit strings, never parseFloat.
 */

export type ParseAmountResult =
  | { ok: true; value: bigint }
  | { ok: false; reason: "empty" | "negative" | "zero" | "invalid" | "fraction" };

const MULTIPLIERS: Record<string, bigint> = {
  k: 1_000n,
  rb: 1_000n,
  ribu: 1_000n,
  jt: 1_000_000n,
  juta: 1_000_000n,
};

const WITH_SUFFIX = /^(\d+)(?:[.,](\d+))?\s*(k|rb|ribu|jt|juta)$/;
const PLAIN = /^\d+$/;
const GROUPED_DOT = /^\d{1,3}(?:\.\d{3})+$/;
const GROUPED_COMMA = /^\d{1,3}(?:,\d{3})+$/;

export function parseAmount(input: string): ParseAmountResult {
  if (typeof input !== "string" || input.length > 64) return { ok: false, reason: "invalid" };
  let text = input.trim().toLowerCase();
  if (text === "") return { ok: false, reason: "empty" };
  if (text.startsWith("-") || text.startsWith("−")) return { ok: false, reason: "negative" };
  // "Rp 25.000", "Rp25k", "Rp. 25.000"
  text = text.replace(/^rp\.?\s*/, "");
  if (text.startsWith("-")) return { ok: false, reason: "negative" };
  if (text === "") return { ok: false, reason: "empty" };
  if (text.length > 40) return { ok: false, reason: "invalid" };

  let value: bigint;
  const suffixed = WITH_SUFFIX.exec(text);
  if (suffixed) {
    const [, whole, rawFraction = "", suffix] = suffixed;
    // Largest multiplier is 10^6 (jt/juta); any non-zero digit past 6 places can never be whole rupiah.
    const fraction = rawFraction.replace(/0+$/, "");
    if (fraction.length > 6) return { ok: false, reason: "fraction" };
    const scale = 10n ** BigInt(fraction.length);
    const scaled = (BigInt(whole) * scale + BigInt(fraction || "0")) * MULTIPLIERS[suffix];
    if (scaled % scale !== 0n) return { ok: false, reason: "fraction" };
    value = scaled / scale;
  } else if (PLAIN.test(text) || GROUPED_DOT.test(text) || GROUPED_COMMA.test(text)) {
    value = BigInt(text.replace(/[.,]/g, ""));
  } else {
    return { ok: false, reason: "invalid" };
  }

  if (value === 0n) return { ok: false, reason: "zero" };
  return { ok: true, value };
}

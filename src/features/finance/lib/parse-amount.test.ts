import { describe, expect, it } from "vitest";
import { parseAmount } from "./parse-amount";

const VALID: [string, bigint][] = [
  // Plain and grouped (no suffix: "." / "," are thousands separators)
  ["25000", 25_000n],
  ["25.000", 25_000n],
  ["25,000", 25_000n],
  ["1.250.000", 1_250_000n],
  ["1,250,000", 1_250_000n],
  ["999", 999n],
  ["1", 1n],
  ["007", 7n],
  // Rp prefix
  ["Rp 25.000", 25_000n],
  ["Rp25.000", 25_000n],
  ["rp. 25.000", 25_000n],
  ["RP 25k", 25_000n],
  // Suffixes (with a suffix, "." / "," are decimal separators)
  ["25k", 25_000n],
  ["25K", 25_000n],
  ["25 K", 25_000n],
  ["25rb", 25_000n],
  ["25 ribu", 25_000n],
  ["2jt", 2_000_000n],
  ["2 juta", 2_000_000n],
  ["1,5jt", 1_500_000n],
  ["1.5jt", 1_500_000n],
  ["2.25k", 2_250n],
  ["1.5rb", 1_500n],
  ["1,250k", 1_250n],
  ["1.2345jt", 1_234_500n],
  ["0.0005jt", 500n],
  ["0,5k", 500n],
  ["  32k  ", 32_000n],
];

const INVALID: [string, string][] = [
  ["", "empty"],
  ["   ", "empty"],
  ["Rp", "empty"],
  ["-25k", "negative"],
  ["-25.000", "negative"],
  ["Rp -5000", "negative"],
  ["0", "zero"],
  ["0k", "zero"],
  ["0.000", "zero"],
  ["Rp 0", "zero"],
  ["1.0001k", "fraction"],
  ["0.0000001jt", "fraction"],
  ["25.5", "invalid"],
  ["1,5", "invalid"],
  ["1.000.5", "invalid"],
  ["1,250.000", "invalid"],
  ["1234.567", "invalid"],
  ["25.00", "invalid"],
  [".5k", "invalid"],
  ["5.k", "invalid"],
  ["abc", "invalid"],
  ["NaN", "invalid"],
  ["Infinity", "invalid"],
  ["1e5", "invalid"],
  ["25kk", "invalid"],
  ["1jtk", "invalid"],
  ["25 k rb", "invalid"],
  ["25k!", "invalid"],
  ["25$", "invalid"],
  ["k25", "invalid"],
  ["2 5k", "invalid"],
  ["1.5.5jt", "invalid"],
  ["0x10", "invalid"],
];

describe("parseAmount: valid", () => {
  it.each(VALID)("%s → %s", (input, expected) => {
    expect(parseAmount(input)).toEqual({ ok: true, value: expected });
  });
});

describe("parseAmount: invalid", () => {
  it.each(INVALID)("%j → %s", (input, reason) => {
    expect(parseAmount(input)).toEqual({ ok: false, reason });
  });
});

describe("parseAmount: big values stay exact", () => {
  it("handles amounts above Number.MAX_SAFE_INTEGER", () => {
    const big = "9.007.199.254.740.993"; // MAX_SAFE_INTEGER + 2
    expect(parseAmount(big)).toEqual({ ok: true, value: 9_007_199_254_740_993n });
    expect(parseAmount("123456789012345678901234567890")).toEqual({
      ok: true,
      value: 123456789012345678901234567890n,
    });
    expect(parseAmount("9007199254740.993jt")).toEqual({ ok: true, value: 9_007_199_254_740_993_000n });
  });

  it("never goes through floating point", () => {
    // 0.1 + 0.2 style traps: these would round wrongly via parseFloat × 1 000 000.
    expect(parseAmount("0.3jt")).toEqual({ ok: true, value: 300_000n });
    expect(parseAmount("1.15jt")).toEqual({ ok: true, value: 1_150_000n });
    expect(parseAmount("4.35k")).toEqual({ ok: true, value: 4_350n });
  });

  it("rejects non-strings without throwing", () => {
    expect(parseAmount(undefined as unknown as string)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects absurdly long decimal strings quickly", () => {
    expect(parseAmount(`1.${"0".repeat(200_000)}k`)).toEqual({ ok: false, reason: "invalid" });
  });
});

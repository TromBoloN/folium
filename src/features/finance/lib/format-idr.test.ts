import { describe, expect, it } from "vitest";
import { formatIdr } from "./format-idr";

describe("formatIdr", () => {
  it.each([
    [0n, "Rp 0"],
    [1n, "Rp 1"],
    [999n, "Rp 999"],
    [1_000n, "Rp 1.000"],
    [25_000n, "Rp 25.000"],
    [100_000n, "Rp 100.000"],
    [1_250_000n, "Rp 1.250.000"],
    [-25_000n, "-Rp 25.000"],
    [-1n, "-Rp 1"],
  ])("%s → %s", (amount, expected) => {
    expect(formatIdr(amount)).toBe(expected);
  });

  it("accepts whole numbers too, and -0 is Rp 0", () => {
    expect(formatIdr(25000)).toBe("Rp 25.000");
    expect(formatIdr(-1250000)).toBe("-Rp 1.250.000");
    expect(formatIdr(-0)).toBe("Rp 0");
  });

  it("formats bigints above Number.MAX_SAFE_INTEGER exactly", () => {
    expect(formatIdr(9_007_199_254_740_993n)).toBe("Rp 9.007.199.254.740.993");
    expect(formatIdr(-123456789012345678901234567890n)).toBe("-Rp 123.456.789.012.345.678.901.234.567.890");
  });

  it("throws on non-integer or unsafe numbers", () => {
    for (const bad of [1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60]) {
      expect(() => formatIdr(bad)).toThrow(RangeError);
    }
  });

  it("doesn't depend on locale data (always '.' grouping)", () => {
    expect(formatIdr(1_000_000n)).not.toContain(",");
  });
});

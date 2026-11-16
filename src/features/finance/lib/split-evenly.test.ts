import { describe, expect, it } from "vitest";
import { splitEvenly } from "./split-evenly";

const sum = (parts: bigint[]) => parts.reduce((a, b) => a + b, 0n);

describe("splitEvenly", () => {
  it("gives the remainder to the first parts, one rupiah each", () => {
    expect(splitEvenly(100n, 3)).toEqual([34n, 33n, 33n]);
    expect(splitEvenly(101n, 4)).toEqual([26n, 25n, 25n, 25n]);
    expect(splitEvenly(90_000n, 3)).toEqual([30_000n, 30_000n, 30_000n]);
  });

  it("total smaller than n, zero total, and n = 1", () => {
    expect(splitEvenly(2n, 5)).toEqual([1n, 1n, 0n, 0n, 0n]);
    expect(splitEvenly(0n, 3)).toEqual([0n, 0n, 0n]);
    expect(splitEvenly(12_345n, 1)).toEqual([12_345n]);
  });

  it("rejects n < 1, a non-integer n and a negative total", () => {
    for (const n of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => splitEvenly(100n, n), String(n)).toThrow(RangeError);
    }
    expect(() => splitEvenly(-1n, 2)).toThrow(RangeError);
  });

  it("property: parts always sum to the total and differ by at most 1, larger first", () => {
    let seed = 42;
    const next = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return seed;
    };
    for (let round = 0; round < 500; round++) {
      const total = BigInt(next()) * BigInt(next() % 1000);
      const n = (next() % 25) + 1;
      const parts = splitEvenly(total, n);
      expect(parts).toHaveLength(n);
      expect(sum(parts)).toBe(total);
      const max = parts[0];
      const min = parts[parts.length - 1];
      expect(max - min <= 1n).toBe(true);
      expect(parts.every((p, i) => i === 0 || p <= parts[i - 1])).toBe(true);
    }
  });

  it("works above Number.MAX_SAFE_INTEGER", () => {
    const total = 9_007_199_254_740_993n;
    const parts = splitEvenly(total, 7);
    expect(sum(parts)).toBe(total);
  });
});

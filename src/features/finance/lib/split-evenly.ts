/**
 * Split a whole-rupiah total into n parts that add up to exactly the total.
 * The remainder goes one rupiah at a time to the first parts:
 * splitEvenly(100n, 3) = [34n, 33n, 33n].
 */
export function splitEvenly(total: bigint, n: number): bigint[] {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError(`n must be a whole number ≥ 1, got ${n}`);
  if (total < 0n) throw new RangeError("total can't be negative");
  const count = BigInt(n);
  const base = total / count;
  const remainder = total % count;
  return Array.from({ length: n }, (_, i) => base + (BigInt(i) < remainder ? 1n : 0n));
}

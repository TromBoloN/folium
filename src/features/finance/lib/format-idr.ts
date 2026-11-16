/**
 * "Rp 25.000", "Rp 0", "-Rp 1.250.000". Groups with "." by hand, so it doesn't
 * depend on the runtime having Indonesian locale data. Works for bigints of any
 * size; a number must be a safe integer (amounts are whole rupiah).
 */
export function formatIdr(amount: bigint | number): string {
  let value: bigint;
  if (typeof amount === "bigint") {
    value = amount;
  } else {
    if (!Number.isSafeInteger(amount)) throw new RangeError(`formatIdr needs whole rupiah, got ${amount}`);
    value = BigInt(amount);
  }
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}Rp ${grouped}`;
}

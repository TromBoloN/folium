import { describe, expect, it } from "vitest";
import { realBalanceSchema, transactionFiltersSchema, transactionFormSchema, transactionRow } from "./index";
import { adjustmentFor, groupByDay, monthBounds, monthRange, monthTotals, reconciledOpening } from "./money-math";

const A = "0b9f4b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const B = "1b9f4b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const C = "2b9f4b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const base = {
  kind: "expense",
  status: "posted",
  amount: "32k",
  accountId: A,
  toAccountId: "",
  feeAmount: "",
  categoryId: "",
  payee: " GoFood ",
  note: "",
  occurredOn: "2026-11-16",
  adjustmentDirection: "",
};

describe("transactionFormSchema", () => {
  it("parses an expense from form strings", () => {
    const t = transactionFormSchema.parse({ ...base, categoryId: C });
    expect(t).toEqual({
      kind: "expense",
      status: "posted",
      amount: 32_000n,
      accountId: A,
      toAccountId: null,
      feeAmount: 0n,
      categoryId: C,
      payee: "GoFood",
      note: null,
      occurredOn: "2026-11-16",
      adjustmentDirection: null,
      personId: null,
      personName: null,
      courseId: null,
    });
    expect(transactionRow(t)).toMatchObject({ amount: 32000, fee_amount: 0, account_id: A, category_id: C });
  });

  it("needs a person for debt kinds, and drops person and course where they don't belong", () => {
    const missing = transactionFormSchema.safeParse({ ...base, kind: "lend" });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]).toMatchObject({ path: ["personId"], message: "Who is it with?" });
    const lend = transactionFormSchema.parse({ ...base, kind: "lend", personName: " Budi ", courseId: B });
    expect(lend).toMatchObject({ kind: "lend", personId: null, personName: "Budi", courseId: null, payee: null });
    const expense = transactionFormSchema.parse({ ...base, personId: B, courseId: C });
    expect(expense).toMatchObject({ personId: null, courseId: C });
    expect(transactionRow(expense)).toMatchObject({ person_id: null, course_id: C });
  });

  it("gives amount errors in words", () => {
    for (const [amount, message] of [
      ["", "Enter an amount."],
      ["0", "The amount must be more than 0."],
      ["25.5", "Enter an amount like 25.000, 25k or 1,5jt."],
      ["1.0001k", "Use whole rupiah."],
      ["99999999999999999", "That amount is too large."],
    ]) {
      const result = transactionFormSchema.safeParse({ ...base, amount });
      expect(result.success, amount).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({ path: ["amount"], message });
    }
  });

  it("a transfer needs a different destination and keeps its fee", () => {
    const ok = transactionFormSchema.parse({
      ...base,
      kind: "transfer",
      toAccountId: B,
      feeAmount: "2.500",
      categoryId: C,
    });
    expect(ok).toMatchObject({ toAccountId: B, feeAmount: 2_500n, categoryId: null, payee: null });
    for (const toAccountId of ["", A]) {
      const r = transactionFormSchema.safeParse({ ...base, kind: "transfer", toAccountId });
      expect(r.error?.issues[0].path).toEqual(["toAccountId"]);
    }
  });

  it("drops fields that don't belong to the kind (no DB CHECK failures)", () => {
    const t = transactionFormSchema.parse({ ...base, toAccountId: B, feeAmount: "1k", adjustmentDirection: "in" });
    expect(t).toMatchObject({ toAccountId: null, feeAmount: 0n, adjustmentDirection: null });
  });

  it("an adjustment needs a direction, and has no category", () => {
    const missing = transactionFormSchema.safeParse({ ...base, kind: "adjustment" });
    expect(missing.error?.issues[0].path).toEqual(["adjustmentDirection"]);
    const t = transactionFormSchema.parse({ ...base, kind: "adjustment", adjustmentDirection: "out", categoryId: C });
    expect(t).toMatchObject({ adjustmentDirection: "out", categoryId: null });
  });

  it("rejects bad ids, dates and kinds", () => {
    expect(transactionFormSchema.safeParse({ ...base, accountId: "x" }).success).toBe(false);
    expect(transactionFormSchema.safeParse({ ...base, categoryId: "x" }).success).toBe(false);
    expect(transactionFormSchema.safeParse({ ...base, occurredOn: "2026-02-30" }).success).toBe(false);
    expect(transactionFormSchema.safeParse({ ...base, kind: "refund" }).success).toBe(false);
  });
});

describe("filters and real balance", () => {
  it("junk filters fall back to none", () => {
    expect(transactionFiltersSchema.parse({ account: "x", kind: "nope", month: "2026-13", q: "  " })).toEqual({
      account: undefined,
      kind: undefined,
      month: undefined,
      q: undefined,
    });
    expect(transactionFiltersSchema.parse({ kind: "income", month: "2026-11", q: " kopi " })).toMatchObject({
      kind: "income",
      month: "2026-11",
      q: "kopi",
    });
  });

  it("a real balance may be zero or negative", () => {
    expect(realBalanceSchema.parse({ accountId: A, real: "1.250.000" }).real).toBe(1_250_000n);
    expect(realBalanceSchema.parse({ accountId: A, real: "-50k" }).real).toBe(-50_000n);
    expect(realBalanceSchema.parse({ accountId: A, real: "0" }).real).toBe(0n);
    expect(realBalanceSchema.safeParse({ accountId: A, real: "abc" }).success).toBe(false);
  });
});

describe("money math", () => {
  it("reconciledOpening makes the balance equal the real amount", () => {
    // opening 100k, movements −30k → balance 70k; the bank says 95k → opening becomes 125k.
    expect(reconciledOpening(70_000n, 100_000n, 95_000n)).toBe(125_000n);
    const opening = reconciledOpening(70_000n, 100_000n, 95_000n);
    expect(opening + (70_000n - 100_000n)).toBe(95_000n);
    expect(reconciledOpening(0n, 0n, -5_000n)).toBe(-5_000n);
  });

  it("adjustmentFor is the signed difference, or nothing", () => {
    expect(adjustmentFor(70_000n, 95_000n)).toEqual({ direction: "in", amount: 25_000n });
    expect(adjustmentFor(70_000n, 60_000n)).toEqual({ direction: "out", amount: 10_000n });
    expect(adjustmentFor(70_000n, 70_000n)).toBeNull();
  });

  it("month ranges, leap years and December", () => {
    expect(monthRange("2026-11-16")).toEqual({ month: "2026-11", from: "2026-11-01", to: "2026-11-30" });
    expect(monthBounds("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthBounds("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("groups by day, newest first, keeping order within a day", () => {
    const rows = [
      { id: "a", occurredOn: "2026-11-15" },
      { id: "b", occurredOn: "2026-11-16" },
      { id: "c", occurredOn: "2026-11-15" },
    ];
    expect(groupByDay(rows).map((g) => [g.date, g.rows.map((r) => r.id)])).toEqual([
      ["2026-11-16", ["b"]],
      ["2026-11-15", ["a", "c"]],
    ]);
  });

  it("month totals count income and expense only", () => {
    expect(
      monthTotals([
        { kind: "income", amount: 500_000n },
        { kind: "expense", amount: 32_000n },
        { kind: "transfer", amount: 100_000n },
        { kind: "adjustment", amount: 5_000n },
        { kind: "expense", amount: 8_000n },
      ]),
    ).toEqual({ income: 500_000n, expense: 40_000n });
  });
});

describe("account opening balance", () => {
  it("keeps a negative opening balance when an account is edited", async () => {
    const { accountFormSchema } = await import("./index");
    const base = { name: "Livin", type: "bank", color: "#1c7ed6" };
    expect(accountFormSchema.parse({ ...base, openingBalance: "-12.500" }).openingBalance).toBe(-12_500n);
    expect(accountFormSchema.parse({ ...base, openingBalance: "" }).openingBalance).toBe(0n);
    expect(accountFormSchema.parse({ ...base, openingBalance: "250k" }).openingBalance).toBe(250_000n);
  });
});

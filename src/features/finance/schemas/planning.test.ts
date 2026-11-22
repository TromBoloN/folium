import { describe, expect, it } from "vitest";
import { budgetFormSchema, goalFormSchema, ruleFormSchema } from "./planning";

const A = "0b9f4b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const B = "1b9f4b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const C = "2b9f4b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";

const baseRule = {
  name: "Kos",
  kind: "expense",
  amount: "900k",
  isEstimate: false,
  accountId: A,
  toAccountId: "",
  categoryId: C,
  payee: " Bu Kos ",
  cadence: "monthly",
  intervalCount: "1",
  dueDay: "5",
  startsOn: "2026-11-01",
  endsOn: "",
  instalmentsTotal: "",
  remindDaysBefore: "3",
};

describe("ruleFormSchema", () => {
  it("parses a monthly expense rule and normalises optional fields", () => {
    const parsed = ruleFormSchema.parse(baseRule);
    expect(parsed).toMatchObject({
      name: "Kos",
      kind: "expense",
      amount: 900_000n,
      toAccountId: null,
      categoryId: C,
      payee: "Bu Kos",
      dueDay: 5,
      intervalCount: 1,
      remindDaysBefore: 3,
    });
  });

  it("requires dueDay for monthly/yearly and drops it for weekly", () => {
    const missing = ruleFormSchema.safeParse({ ...baseRule, dueDay: "" });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(["dueDay"]);

    const weekly = ruleFormSchema.parse({ ...baseRule, cadence: "weekly", dueDay: "5" });
    expect(weekly.dueDay).toBeNull();
  });

  it("requires a different destination account on transfers and drops categoryId", () => {
    expect(ruleFormSchema.safeParse({ ...baseRule, kind: "transfer", toAccountId: "" }).success).toBe(false);
    expect(ruleFormSchema.safeParse({ ...baseRule, kind: "transfer", toAccountId: A }).success).toBe(false);

    const transfer = ruleFormSchema.parse({ ...baseRule, kind: "transfer", toAccountId: B, categoryId: C });
    expect(transfer).toMatchObject({ toAccountId: B, categoryId: null });
  });

  it("rejects impossible dates, endsOn before startsOn, and unsafe amounts", () => {
    expect(ruleFormSchema.safeParse({ ...baseRule, startsOn: "2026-02-30" }).success).toBe(false);
    expect(ruleFormSchema.safeParse({ ...baseRule, endsOn: "2026-10-31" }).success).toBe(false);
    expect(ruleFormSchema.safeParse({ ...baseRule, amount: "99999999999999999" }).success).toBe(false);
  });
});

describe("budgetFormSchema & goalFormSchema", () => {
  it("validates budgets and goals", () => {
    expect(budgetFormSchema.parse({ categoryId: C, month: "2026-11", amount: "600k", rollover: true })).toMatchObject({
      amount: 600_000n,
      rollover: true,
    });
    expect(
      budgetFormSchema.safeParse({ categoryId: C, month: "2026-13", amount: "600k", rollover: false }).success,
    ).toBe(false);

    expect(
      goalFormSchema.parse({ name: "Laptop", targetAmount: "8jt", targetOn: "2027-06-01", accountId: A }),
    ).toMatchObject({ targetAmount: 8_000_000n, targetOn: "2027-06-01" });
    expect(goalFormSchema.safeParse({ name: "Laptop", targetAmount: "0", targetOn: "", accountId: A }).success).toBe(
      false,
    );
  });
});

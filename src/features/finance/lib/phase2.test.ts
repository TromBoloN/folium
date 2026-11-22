import { describe, expect, it } from "vitest";
import { effectOn } from "./balance-series";
import { budgetLabel, budgetProgress, suggestBudget } from "./budgets";
import { guessMapping, mapRows, parseCsv, parseDateCell, parseSignedCell } from "./csv-import";
import { formatIdr } from "./format-idr";
import { goalPace, personBalanceLabel, settlementFor, splitBill } from "./goals-debts";
import { cadenceLabel, clampedDate, dueDatesUntil, monthlyEquivalent, occurrencesBetween } from "./recurrence";
import { remindersDue, upcomingBills, weekKey } from "./reminders";
import {
  categoryTrends,
  insights,
  monthlyInOut,
  netWorthByMonth,
  type ReportRow,
  savingsRate,
  topPayees,
} from "./reports";
import { forecast, nextPayday, type PlannedRow, safeToSpend } from "./safe-to-spend";

const monthly = (dueDay: number, startsOn: string, extra = {}) => ({
  cadence: "monthly" as const,
  intervalCount: 1,
  dueDay,
  startsOn,
  endsOn: null,
  instalmentsTotal: null,
  ...extra,
});

describe("recurrence", () => {
  it("clamps day 31 to the end of 30-day months and February", () => {
    expect(dueDatesUntil(monthly(31, "2026-01-01"), "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("handles 29 February in leap and other years (yearly)", () => {
    const s = { ...monthly(29, "2028-02-01"), cadence: "yearly" as const };
    expect(dueDatesUntil(s, "2030-12-31")).toEqual(["2028-02-29", "2029-02-28", "2030-02-28"]);
    expect(clampedDate(2027, 2, 30)).toBe("2027-02-28");
  });

  it("starts in the next period when the due day is before the start", () => {
    expect(dueDatesUntil(monthly(5, "2026-11-16"), "2027-01-31")).toEqual(["2026-12-05", "2027-01-05"]);
  });

  it("ends after the instalments or the end date", () => {
    expect(dueDatesUntil(monthly(10, "2026-11-01", { instalmentsTotal: 3 }), "2027-12-31")).toHaveLength(3);
    expect(dueDatesUntil(monthly(10, "2026-11-01", { endsOn: "2026-12-31" }), "2027-12-31")).toEqual([
      "2026-11-10",
      "2026-12-10",
    ]);
  });

  it("steps weekly and every n months", () => {
    const weekly = { ...monthly(1, "2026-11-02"), cadence: "weekly" as const, dueDay: null, intervalCount: 2 };
    expect(dueDatesUntil(weekly, "2026-11-30")).toEqual(["2026-11-02", "2026-11-16", "2026-11-30"]);
    expect(dueDatesUntil(monthly(1, "2026-11-01", { intervalCount: 3 }), "2027-06-30")).toEqual([
      "2026-11-01",
      "2027-02-01",
      "2027-05-01",
    ]);
  });

  it("skips paused dates but keeps counting instalments", () => {
    const s = monthly(1, "2026-11-01", { instalmentsTotal: 3, pausedUntil: "2026-12-15" });
    expect(occurrencesBetween(s, "2026-11-01", "2027-12-31")).toEqual(["2027-01-01"]);
  });

  it("gives a monthly equivalent and a label", () => {
    expect(monthlyEquivalent(120_000n, "yearly", 1)).toBe(10_000n);
    expect(monthlyEquivalent(30_000n, "monthly", 3)).toBe(10_000n);
    expect(monthlyEquivalent(12_000n, "weekly", 1)).toBe(52_000n);
    expect(cadenceLabel({ cadence: "monthly", intervalCount: 1, dueDay: 5 })).toBe("Every month on day 5");
    expect(cadenceLabel({ cadence: "weekly", intervalCount: 2, dueDay: null })).toBe("Every 2 weeks");
  });
});

describe("budgets", () => {
  const categories = [
    { id: "food", name: "Food", parentId: null, color: "#000000" },
    { id: "coffee", name: "Coffee", parentId: "food", color: "#000000" },
    { id: "fun", name: "Fun", parentId: null, color: "#000000" },
  ];
  it("includes children, separates committed, and labels without colour", () => {
    const [p] = budgetProgress({
      budgets: [{ id: "b", categoryId: "food", amount: 100_000n, rollover: false }],
      previous: [],
      categories,
      spent: [
        { categoryId: "food", amount: 50_000n },
        { categoryId: "coffee", amount: 32_000n },
        { categoryId: "fun", amount: 99_000n },
      ],
      previousSpent: [],
      planned: [{ categoryId: "food", amount: 10_000n }],
    });
    expect(p).toMatchObject({ spent: 82_000n, committed: 10_000n, left: 8_000n, percent: 82, state: "warn" });
    expect(budgetLabel(p, formatIdr)).toBe("82% used");
  });

  it("says over by, and rolls last month's leftover over", () => {
    const [p] = budgetProgress({
      budgets: [{ id: "b", categoryId: "fun", amount: 100_000n, rollover: true }],
      previous: [{ id: "a", categoryId: "fun", amount: 100_000n, rollover: true }],
      categories,
      spent: [{ categoryId: "fun", amount: 160_000n }],
      previousSpent: [{ categoryId: "fun", amount: 80_000n }],
      planned: [],
    });
    expect(p.carry).toBe(20_000n);
    expect(p.limit).toBe(120_000n);
    expect(p.state).toBe("over");
    expect(budgetLabel(p, formatIdr)).toBe("Over by Rp 40.000");
  });

  it("suggests the 3-month average rounded up to Rp 5.000, or nothing", () => {
    expect(suggestBudget([100_000n, 200_000n, 151_000n])).toBe(155_000n);
    expect(suggestBudget([0n, 0n, 0n])).toBeNull();
  });
});

const planned = (r: Partial<PlannedRow>): PlannedRow => ({
  kind: "expense",
  amount: 0n,
  feeAmount: 0n,
  accountId: "wallet",
  toAccountId: null,
  occurredOn: "2026-11-20",
  ...r,
});
const spendable = new Set(["wallet", "bank"]);

describe("safe to spend", () => {
  it("divides what's left after bills by the days to the next allowance", () => {
    const result = safeToSpend({
      liquid: 1_000_000n,
      today: "2026-11-16",
      spendable,
      planned: [
        planned({ amount: 300_000n, occurredOn: "2026-11-20" }),
        planned({ kind: "income", amount: 1_500_000n, occurredOn: "2026-11-26" }),
        planned({ amount: 900_000n, occurredOn: "2026-11-26" }), // on payday: paid from the new money
      ],
    });
    expect(result).toMatchObject({ payday: "2026-11-26", days: 10, outflows: 300_000n, perDay: 70_000n, over: null });
  });

  it("falls back to month end without income, counts overdue and month-end bills, and ignores non-spendable income", () => {
    const result = safeToSpend({
      liquid: 100_000n,
      today: "2026-11-16",
      spendable,
      planned: [
        planned({ amount: 40_000n, occurredOn: "2026-11-10" }),
        planned({ amount: 25_000n, occurredOn: "2026-11-30" }),
        // Income into non-spendable savings is NOT payday for spendable accounts.
        planned({ kind: "income", accountId: "savings", amount: 500_000n, occurredOn: "2026-11-20" }),
      ],
    });
    expect(result.payday).toBe("2026-11-30");
    expect(result.paydayFromIncome).toBe(false);
    expect(result.outflows).toBe(65_000n);
  });

  it("is 'over by' instead of a negative per day, and payday today counts as one day", () => {
    const over = safeToSpend({
      liquid: 50_000n,
      today: "2026-11-16",
      spendable,
      planned: [planned({ amount: 80_000n, occurredOn: "2026-11-17" })],
    });
    expect(over).toMatchObject({ perDay: null, over: 30_000n });
    const payday = nextPayday([planned({ kind: "income", amount: 1n, occurredOn: "2026-11-16" })], "2026-11-16");
    expect(payday.date).toBe("2026-11-16");
    expect(
      safeToSpend({
        liquid: 10_000n,
        today: "2026-11-16",
        spendable,
        planned: [planned({ kind: "income", amount: 1n, occurredOn: "2026-11-16" })],
      }).days,
    ).toBe(1);
  });

  it("counts a sinking-fund transfer to savings as an outflow, not one between spendable accounts", () => {
    const toSavings = planned({ kind: "transfer", amount: 100_000n, toAccountId: "savings" });
    const between = planned({ kind: "transfer", amount: 100_000n, toAccountId: "bank" });
    expect(safeToSpend({ liquid: 0n, today: "2026-11-16", spendable, planned: [toSavings] }).outflows).toBe(100_000n);
    expect(safeToSpend({ liquid: 0n, today: "2026-11-16", spendable, planned: [between] }).outflows).toBe(0n);
  });

  it("forecasts day by day and finds the first negative day", () => {
    const f = forecast({
      liquid: 100_000n,
      today: "2026-11-16",
      spendable,
      days: 5,
      planned: [planned({ amount: 150_000n, occurredOn: "2026-11-18" })],
    });
    expect(f.points.map((p) => p.balance)).toEqual([100_000n, 100_000n, -50_000n, -50_000n, -50_000n]);
    expect(f.firstNegative).toBe("2026-11-18");
  });
});

describe("goals and debts", () => {
  it("works out the monthly amount and pace", () => {
    const pace = goalPace({
      target: 6_000_000n,
      saved: 1_000_000n,
      createdOn: "2026-01-01",
      targetOn: "2027-01-01",
      today: "2026-07-01",
    });
    expect(pace.status).toBe("behind");
    expect(pace.remaining).toBe(5_000_000n);
    expect(pace.monthlyNeeded).toBe(833_334n);
    expect(
      goalPace({ target: 10n, saved: 12n, createdOn: "2026-01-01", targetOn: null, today: "2026-02-01" }).status,
    ).toBe("done");
    expect(
      goalPace({ target: 10n, saved: 1n, createdOn: "2026-01-01", targetOn: null, today: "2026-02-01" }).status,
    ).toBe("no-date");
  });

  it("splits a bill: my share is the first, the rest are lends", () => {
    expect(splitBill(100_000n, 2, true)).toEqual({ mine: 33_334n, theirs: [33_333n, 33_333n] });
    expect(splitBill(90_000n, 3, false)).toEqual({ mine: 0n, theirs: [30_000n, 30_000n, 30_000n] });
    expect(splitBill(100n, 0, true)).toBeNull();
  });

  it("labels and settles a person's balance", () => {
    expect(personBalanceLabel("Budi", 45_000n, formatIdr)).toBe("Budi owes you Rp 45.000");
    expect(personBalanceLabel("Budi", -5_000n, formatIdr)).toBe("You owe Budi Rp 5.000");
    expect(settlementFor(45_000n)).toEqual({ kind: "repay", amount: 45_000n });
    expect(settlementFor(-5_000n)).toEqual({ kind: "payback", amount: 5_000n });
    expect(settlementFor(0n)).toBeNull();
  });

  it("moves account balances for the debt kinds", () => {
    const row = {
      status: "posted",
      amount: 10n,
      feeAmount: 0n,
      accountId: "a",
      toAccountId: null,
      adjustmentDirection: null,
      occurredOn: "2026-11-16",
    };
    expect(effectOn("a", { ...row, kind: "lend" })).toBe(-10n);
    expect(effectOn("a", { ...row, kind: "repay" })).toBe(10n);
    expect(effectOn("a", { ...row, kind: "borrow" })).toBe(10n);
    expect(effectOn("a", { ...row, kind: "payback" })).toBe(-10n);
  });
});

const report = (r: Partial<ReportRow>): ReportRow => ({
  kind: "expense",
  status: "posted",
  amount: 0n,
  feeAmount: 0n,
  adjustmentDirection: null,
  categoryId: null,
  payee: null,
  occurredOn: "2026-11-05",
  ...r,
});

describe("reports", () => {
  const rows = [
    report({ kind: "income", amount: 1_000_000n, occurredOn: "2026-10-01" }),
    report({ amount: 200_000n, categoryId: "food", payee: "GoFood", occurredOn: "2026-10-05" }),
    report({ amount: 300_000n, categoryId: "food", payee: "gofood", occurredOn: "2026-11-05" }),
    report({ amount: 50_000n, categoryId: "coffee", payee: "Kopi", occurredOn: "2026-11-06" }),
    report({ kind: "lend", amount: 70_000n, occurredOn: "2026-11-07" }),
    report({ kind: "transfer", amount: 100_000n, feeAmount: 2_500n, occurredOn: "2026-11-08" }),
    report({ amount: 1n, status: "planned", occurredOn: "2026-11-09" }),
  ];
  const categories = [
    { id: "food", name: "Food", parentId: null },
    { id: "coffee", name: "Coffee", parentId: "food" },
  ];

  it("totals income and expense by month, excluding debts, transfers and planned rows", () => {
    expect(monthlyInOut(rows, ["2026-10", "2026-11"])).toEqual([
      { month: "2026-10", income: 1_000_000n, expense: 200_000n },
      { month: "2026-11", income: 0n, expense: 350_000n },
    ]);
    expect(savingsRate(1_000_000n, 200_000n)).toBe(80);
    expect(savingsRate(0n, 5n)).toBeNull();
  });

  it("works net worth backwards from today's total", () => {
    // From 2026-10-31 to now: −300 000 −50 000 −70 000 −2 500 = −422 500
    expect(netWorthByMonth(1_000_000n, rows, ["2026-10-31", "2026-11-30"])).toEqual([
      { month: "2026-10", total: 1_422_500n },
      { month: "2026-11", total: 1_000_000n },
    ]);
  });

  it("rolls trends into parents, ranks payees, and writes insights", () => {
    const trends = categoryTrends(rows, categories, "2026-11", "2026-10");
    expect(trends[0]).toMatchObject({ name: "Food", current: 350_000n, previous: 200_000n });
    expect(trends[0].change).toEqual({ direction: "more", percent: 75 });
    expect(topPayees(rows)[0]).toEqual({ payee: "GoFood", total: 500_000n, count: 2 });
    expect(insights({ trends, previousLabel: "October", renewingThisWeek: 3 })).toEqual([
      "Food is 75% higher than October",
      "3 bills or subscriptions are due this week",
    ]);
  });
});

describe("csv import", () => {
  it("parses quotes, semicolons and CRLF", () => {
    expect(parseCsv('Tanggal;Keterangan;Jumlah\r\n05/11/2026;"Kopi; ""enak""";-18.000\r\n')).toEqual([
      ["Tanggal", "Keterangan", "Jumlah"],
      ["05/11/2026", 'Kopi; "enak"', "-18.000"],
    ]);
  });

  it("reads dates and signed amounts in common bank shapes", () => {
    expect(parseDateCell("05/11/2026 14:02", "dmy")).toBe("2026-11-05");
    expect(parseDateCell("2026-11-05", "ymd")).toBe("2026-11-05");
    expect(parseDateCell("31/02/2026", "dmy")).toBeNull();
    expect(parseSignedCell("-25.000")).toBe(-25_000n);
    expect(parseSignedCell("(25.000)")).toBe(-25_000n);
    expect(parseSignedCell("Rp 25.000,00")).toBe(25_000n);
    expect(parseSignedCell("25,000.00 DB")).toBe(-25_000n);
    expect(parseSignedCell("abc")).toBeNull();
  });

  it("maps rows to drafts with stable dedupe keys, and reports bad lines", () => {
    const rows = [
      ["05/11/2026", "Kopi", "-18.000"],
      ["05/11/2026", "Kopi", "-18.000"],
      ["06/11/2026", "Mama", "1.500.000"],
      ["??", "x", "1"],
    ];
    const { drafts, errors } = mapRows(rows, { date: 0, payee: 1, amount: 2, dateFormat: "dmy" });
    expect(drafts.map((d) => [d.kind, d.amount, d.key])).toEqual([
      ["expense", 18_000n, "2026-11-05|-18000|kopi"],
      ["expense", 18_000n, "2026-11-05|-18000|kopi#2"],
      ["income", 1_500_000n, "2026-11-06|1500000|mama"],
    ]);
    expect(errors).toEqual([{ line: 5, message: "Can't read the date “??”." }]);
  });

  it("handles separate debit/credit columns and guesses headers", () => {
    const { drafts } = mapRows([["2026-11-05", "", "50.000"]], { date: 0, debit: 1, credit: 2, dateFormat: "ymd" });
    expect(drafts[0]).toMatchObject({ kind: "income", amount: 50_000n });
    expect(guessMapping(["Tanggal", "Keterangan", "Debet", "Kredit"])).toMatchObject({
      date: 0,
      payee: 1,
      debit: 2,
      credit: 3,
    });
  });
});

describe("reminders", () => {
  const bill = { id: "t1", name: "Kos", amount: 900_000n, dueOn: "2026-11-20", remindDaysBefore: 3 };
  it("reminds from n days before until the due date, with a unique key", () => {
    expect(remindersDue([bill], "2026-11-16")).toEqual([]);
    expect(remindersDue([bill], "2026-11-17")[0]?.refKey).toBe("t1:2026-11-20");
    expect(remindersDue([bill], "2026-11-21")).toEqual([]);
  });
  it("keys weekly summaries by the week's Monday and splits upcoming bills", () => {
    expect(weekKey("2026-11-16")).toBe("week:2026-11-16");
    expect(weekKey("2026-11-22")).toBe("week:2026-11-16");
    const { overdue, soon } = upcomingBills(
      [{ dueOn: "2026-11-10" }, { dueOn: "2026-11-18" }, { dueOn: "2026-12-30" }],
      "2026-11-16",
    );
    expect(overdue).toHaveLength(1);
    expect(soon).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { balanceSeries, effectOn, type SeriesRow, seriesChange } from "./balance-series";
import { compareMonths } from "./compare-months";
import { largestRemainder, OTHER, rollupByCategory, type SpendRow, UNCATEGORISED } from "./rollup-by-category";

const cat = (id: string, name: string, parentId: string | null = null) => ({ id, name, parentId, color: "#123456" });
const spend = (categoryId: string | null, amount: number, extra: Partial<SpendRow> = {}): SpendRow => ({
  kind: "expense",
  status: "posted",
  categoryId,
  amount: BigInt(amount),
  ...extra,
});

describe("rollupByCategory", () => {
  const categories = [
    cat("food", "Food"),
    cat("coffee", "Coffee", "food"),
    cat("transport", "Transport"),
    cat("rent", "Kos"),
    cat("subs", "Subscriptions"),
    cat("fun", "Entertainment"),
    cat("health", "Health"),
    cat("books", "Books"),
  ];

  it("is empty (no NaN) without data", () => {
    expect(rollupByCategory([], categories)).toEqual({ total: 0n, slices: [] });
  });

  it("gives a single category 100%", () => {
    const { slices, total } = rollupByCategory([spend("food", 32_000)], categories);
    expect(total).toBe(32_000n);
    expect(slices).toEqual([{ id: "food", name: "Food", color: "#123456", amount: 32_000n, percent: 100 }]);
  });

  it("rolls children into their parent", () => {
    const { slices } = rollupByCategory([spend("food", 10_000), spend("coffee", 5_000)], categories);
    expect(slices.map((s) => [s.id, s.amount])).toEqual([["food", 15_000n]]);
  });

  it("excludes transfers, adjustments, income and planned rows", () => {
    const { slices, total } = rollupByCategory(
      [
        spend("food", 10_000),
        spend(null, 50_000, { kind: "transfer" }),
        spend(null, 7_000, { kind: "adjustment" }),
        spend("food", 9_000, { kind: "income" }),
        spend("food", 99_000, { status: "planned" }),
      ],
      categories,
    );
    expect(total).toBe(10_000n);
    expect(slices).toHaveLength(1);
  });

  it("keeps the top 5 and folds the rest into Other; percentages sum to 100", () => {
    const rows = [
      spend("rent", 1_000_000),
      spend("food", 600_000),
      spend("transport", 300_000),
      spend("subs", 100_000),
      spend("fun", 90_000),
      spend("health", 70_000),
      spend("books", 10_000),
      spend(null, 5_000),
    ];
    const { slices } = rollupByCategory(rows, categories);
    expect(slices.map((s) => s.id)).toEqual(["rent", "food", "transport", "subs", "fun", OTHER]);
    expect(slices.at(-1)?.amount).toBe(85_000n);
    expect(slices.reduce((s, x) => s + x.percent, 0)).toBe(100);
  });

  it("shows a single leftover by name instead of Other", () => {
    const rows = ["rent", "food", "transport", "subs", "fun", "health"].map((id, i) => spend(id, 600 - i * 10));
    const { slices } = rollupByCategory(rows, categories);
    expect(slices).toHaveLength(6);
    expect(slices.some((s) => s.id === OTHER)).toBe(false);
  });

  it("labels rows without a category (or with an unknown one) as Uncategorised", () => {
    const { slices } = rollupByCategory([spend(null, 1), spend("gone", 1)], categories);
    expect(slices).toEqual([{ id: UNCATEGORISED, name: "Uncategorised", color: null, amount: 2n, percent: 100 }]);
  });
});

describe("largestRemainder", () => {
  it("sums to exactly 100 for thirds", () => {
    expect(largestRemainder([1n, 1n, 1n], 3n)).toEqual([34, 33, 33]);
  });
  it("is all zeros for a zero total", () => {
    expect(largestRemainder([0n, 0n], 0n)).toEqual([0, 0]);
  });
});

const row = (r: Partial<SeriesRow>): SeriesRow => ({
  kind: "expense",
  status: "posted",
  amount: 0n,
  feeAmount: 0n,
  accountId: "a",
  toAccountId: null,
  adjustmentDirection: null,
  occurredOn: "2026-11-16",
  ...r,
});

describe("balanceSeries", () => {
  // 2026-11-16 10:00 in Makassar (UTC+8).
  const opts = { days: 7, timeZone: "Asia/Makassar", now: new Date("2026-11-16T02:00:00Z") };

  it("carries a flat balance forward when nothing happened", () => {
    const series = balanceSeries("a", 50_000n, [], opts);
    expect(series).toHaveLength(7);
    expect(series[0]).toEqual({ date: "2026-11-10", balance: 50_000n });
    expect(series.every((p) => p.balance === 50_000n)).toBe(true);
    expect(seriesChange(series)).toBe(0n);
  });

  it("works backwards from the current balance", () => {
    const rows = [
      row({ kind: "expense", amount: 32_000n, occurredOn: "2026-11-16" }),
      row({ kind: "income", amount: 100_000n, occurredOn: "2026-11-14" }),
    ];
    const series = balanceSeries("a", 68_000n, rows, opts);
    expect(series.at(-1)?.balance).toBe(68_000n); // today
    expect(series.at(-2)?.balance).toBe(100_000n); // before the expense
    expect(series.find((p) => p.date === "2026-11-13")?.balance).toBe(0n); // before the income
    expect(seriesChange(series)).toBe(68_000n);
  });

  it("ignores planned rows and undoes future-dated posted rows", () => {
    const rows = [
      row({ kind: "expense", status: "planned", amount: 1_000n, occurredOn: "2026-11-15" }),
      row({ kind: "expense", amount: 5_000n, occurredOn: "2026-11-20" }),
    ];
    const series = balanceSeries("a", 5_000n, rows, opts);
    expect(series.every((p) => p.balance === 10_000n)).toBe(true);
  });

  it("handles transfers and fees per account", () => {
    const t = row({ kind: "transfer", amount: 50_000n, feeAmount: 2_500n, toAccountId: "b", occurredOn: "2026-11-16" });
    expect(effectOn("a", t)).toBe(-52_500n);
    expect(effectOn("b", t)).toBe(50_000n);
    expect(effectOn("c", t)).toBe(0n);
    expect(balanceSeries("a", 0n, [t], opts).at(-2)?.balance).toBe(52_500n);
    expect(balanceSeries("b", 50_000n, [t], opts).at(-2)?.balance).toBe(0n);
  });

  it("handles adjustments and negative balances", () => {
    const rows = [row({ kind: "adjustment", adjustmentDirection: "out", amount: 20_000n, occurredOn: "2026-11-15" })];
    const series = balanceSeries("a", -15_000n, rows, opts);
    expect(series.at(-1)?.balance).toBe(-15_000n);
    expect(series.find((p) => p.date === "2026-11-14")?.balance).toBe(5_000n);
  });

  it("takes today from the user's zone around midnight", () => {
    // 16:30 UTC on the 16th is already 00:30 on the 17th in Makassar.
    const late = { ...opts, now: new Date("2026-11-16T16:30:00Z") };
    const rows = [row({ kind: "expense", amount: 1_000n, occurredOn: "2026-11-17" })];
    const series = balanceSeries("a", 9_000n, rows, late);
    expect(series.at(-1)).toEqual({ date: "2026-11-17", balance: 9_000n });
    expect(series.at(-2)?.balance).toBe(10_000n);
  });

  it("returns nothing for zero days", () => {
    expect(balanceSeries("a", 1n, [], { ...opts, days: 0 })).toEqual([]);
  });
});

describe("compareMonths", () => {
  it("is null when last month had nothing", () => {
    expect(compareMonths(50_000n, 0n)).toBeNull();
  });
  it("says less or more, rounded", () => {
    expect(compareMonths(88_000n, 100_000n)).toEqual({ direction: "less", percent: 12 });
    expect(compareMonths(150_000n, 100_000n)).toEqual({ direction: "more", percent: 50 });
    expect(compareMonths(1n, 3n)).toEqual({ direction: "less", percent: 67 });
  });
  it("says same when equal, and 100% less for nothing this month", () => {
    expect(compareMonths(5n, 5n)).toEqual({ direction: "same", percent: 0 });
    expect(compareMonths(0n, 5n)).toEqual({ direction: "less", percent: 100 });
  });
});

describe("money palette", () => {
  it("every swatch has at least 3:1 contrast on a white card", async () => {
    const { relativeLuminance } = await import("@/lib/color");
    const { MONEY_PALETTE } = await import("./money-palette");
    for (const { hex } of MONEY_PALETTE) {
      expect(1.05 / (relativeLuminance(hex) + 0.05), hex).toBeGreaterThanOrEqual(3);
    }
  });

  it("uses the stored icon, else guesses from the name", async () => {
    const { iconFor } = await import("./money-palette");
    expect(iconFor("coffee", "Food")).toBe("coffee");
    expect(iconFor("not-an-icon", "Tuition (UKT)")).toBe("graduation-cap");
    expect(iconFor(null, "Kos/Rent")).toBe("house");
    expect(iconFor(null, "Misc")).toBeNull();
  });
});

describe("quick line fixes", () => {
  const accounts = [
    { id: "l", name: "Livin' by Mandiri" },
    { id: "d", name: "DANA" },
    { id: "s", name: "Dana Darurat" },
  ];
  it("picks the shortest word that parses back to the item", async () => {
    const { tokenFor } = await import("./quick-line");
    expect(tokenFor(accounts[0], accounts)).toBe("livin'");
    expect(tokenFor(accounts[1], accounts)).toBe("dana");
    // Unreachable by one word (the parser matches whole-name prefixes and "dana" is DANA): first word as a fallback.
    expect(tokenFor(accounts[2], accounts)).toBe("dana");
  });
  it("replaces the account, category or destination in the line", async () => {
    const { withToken } = await import("./quick-line");
    expect(withToken("gofood 32k @gop #fod", "account", "dana")).toBe("gofood 32k #fod @dana");
    expect(withToken("gofood 32k #fod", "category", "food")).toBe("gofood 32k #food");
    expect(withToken("50k from cash to go", "toAccount", "gopay")).toBe("50k from cash to gopay");
    expect(withToken("50k from cash to go", "account", "dana")).toBe("50k to go @dana");
  });
});

describe("months", () => {
  it("shifts across years", async () => {
    const { shiftMonth } = await import("./compare-months");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-11", 0)).toBe("2026-11");
  });
  it("resolves ?month= to a valid month no later than now", async () => {
    const { resolveMonth } = await import("./compare-months");
    expect(resolveMonth("2026-10", "2026-11")).toBe("2026-10");
    expect(resolveMonth("2027-01", "2026-11")).toBe("2026-11");
    expect(resolveMonth("junk", "2026-11")).toBe("2026-11");
    expect(resolveMonth(["2026-10"], "2026-11")).toBe("2026-11");
  });
});

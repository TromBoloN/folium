import { describe, expect, it } from "vitest";
import { matchByName, parseQuickTransaction, type QuickContext } from "./parse-quick-transaction";

const ACCOUNTS = [
  { id: "livin", name: "Livin' by Mandiri" },
  { id: "dana", name: "DANA" },
  { id: "gopay", name: "GoPay" },
  { id: "cash", name: "Cash" },
];
const CATEGORIES = [
  { id: "food", name: "Food", kind: "expense" as const },
  { id: "transport", name: "Transport", kind: "expense" as const },
  { id: "tuition", name: "Tuition (UKT)", kind: "expense" as const },
  { id: "subs", name: "Subscriptions", kind: "expense" as const },
  { id: "shopping", name: "Shopping", kind: "expense" as const },
  { id: "other-exp", name: "Other", kind: "expense" as const },
  { id: "allowance", name: "Allowance", kind: "income" as const },
  { id: "scholarship", name: "Scholarship", kind: "income" as const },
  { id: "other-inc", name: "Other", kind: "income" as const },
];

// 2026-11-16 17:00 UTC = 2026-11-17 01:00 in Makassar: "today" is the 17th, not the UTC date.
const ctx: QuickContext = {
  accounts: ACCOUNTS,
  categories: CATEGORIES,
  now: new Date("2026-11-16T17:00:00Z"),
  timeZone: "Asia/Makassar",
  defaultAccountId: "livin",
};
const parse = (input: string, extra: Partial<QuickContext> = {}) => parseQuickTransaction(input, { ...ctx, ...extra });
const chip = (r: ReturnType<typeof parse>, type: string) => r.chips.find((c) => c.type === type);

describe("parseQuickTransaction: expenses", () => {
  it("parses the example line", () => {
    const r = parse("gofood 32k #food @gopay");
    expect(r).toMatchObject({
      kind: "expense",
      amount: 32_000n,
      payee: "gofood",
      categoryId: "food",
      accountId: "gopay",
      occurredOn: "2026-11-17",
      errors: [],
    });
    expect(chip(r, "amount")).toEqual({ type: "amount", label: "Rp 32.000", state: "matched" });
    expect(chip(r, "account")).toEqual({ type: "account", label: "GoPay", state: "matched" });
    expect(chip(r, "date")).toMatchObject({ state: "default", label: "Today" });
  });

  it("uses the default account, and leaves payee words in order, single-spaced", () => {
    const r = parse("  nasi   goreng   pak  budi   25.000  ");
    expect(r).toMatchObject({ kind: "expense", amount: 25_000n, payee: "nasi goreng pak budi", accountId: "livin" });
    expect(chip(r, "account")).toEqual({ type: "account", label: "Livin' by Mandiri", state: "default" });
    expect(r.categoryId).toBeUndefined();
    expect(r.chips.some((c) => c.type === "category")).toBe(false);
  });

  it("takes the first token that is an amount, including two-word amounts", () => {
    expect(parse("Rp 25.000 kopi").amount).toBe(25_000n);
    expect(parse("kopi 25 K").amount).toBe(25_000n);
    expect(parse("kopi 25 ribu").payee).toBe("kopi");
    expect(parse("parkir 2k 5k").amount).toBe(2_000n);
    expect(parse("parkir 2k 5k").payee).toBe("parkir 5k");
  });

  it("no amount: a missing chip and an error", () => {
    const r = parse("gofood #food");
    expect(r.amount).toBeUndefined();
    expect(chip(r, "amount")?.state).toBe("missing");
    expect(r.errors).toContain("Add an amount, like 32k or 25.000.");
  });

  it("rejects amounts above MAX_SAFE_INTEGER and payees over 120 characters", () => {
    const huge = parse("kopi 9007199254740993");
    expect(huge.amount).toBeUndefined();
    expect(huge.errors).toContain("That amount is too large.");

    const longPayee = parse(`${"a".repeat(121)} 10k`);
    expect(longPayee.errors).toContain("Payee can be at most 120 characters.");
  });
});

describe("parseQuickTransaction: income", () => {
  it("'+' before the amount or as its prefix means income", () => {
    expect(parse("+500k allowance #allowance")).toMatchObject({
      kind: "income",
      amount: 500_000n,
      categoryId: "allowance",
    });
    expect(parse("beasiswa + 1,5jt #scholar")).toMatchObject({
      kind: "income",
      amount: 1_500_000n,
      categoryId: "scholarship",
      payee: "beasiswa",
    });
  });

  it("categories match only the parsed kind", () => {
    expect(parse("+100k #other").categoryId).toBe("other-inc");
    expect(parse("100k #other").categoryId).toBe("other-exp");
    const r = parse("+100k #food");
    expect(r.categoryId).toBeUndefined();
    expect(chip(r, "category")?.state).toBe("missing");
  });
});

describe("parseQuickTransaction: transfers", () => {
  it("'to <account>' with the default source", () => {
    const r = parse("to dana 100k");
    expect(r).toMatchObject({
      kind: "transfer",
      amount: 100_000n,
      accountId: "livin",
      toAccountId: "dana",
      errors: [],
    });
    expect(chip(r, "toAccount")).toEqual({ type: "toAccount", label: "DANA", state: "matched" });
  });

  it("the source can be 'from <account>' or '@account'", () => {
    expect(parse("from gopay to cash 50k")).toMatchObject({ accountId: "gopay", toAccountId: "cash" });
    expect(parse("to cash 50k @gopay")).toMatchObject({ accountId: "gopay", toAccountId: "cash" });
  });

  it("the same account on both sides is an error", () => {
    expect(parse("to livin 100k").errors).toContain("A transfer needs two different accounts.");
    expect(parse("to gopay 10k @gopay").errors).toContain("A transfer needs two different accounts.");
  });

  it("a category on a transfer is an error", () => {
    const r = parse("to dana 100k #food");
    expect(r.categoryId).toBeUndefined();
    expect(r.errors).toContain("Transfers don't have a category.");
  });
});

describe("parseQuickTransaction: matching names", () => {
  it("exact first, then a unique prefix, case-insensitive", () => {
    expect(matchByName("DANA", ACCOUNTS)).toEqual({ state: "matched", item: ACCOUNTS[1] });
    expect(matchByName("livin", ACCOUNTS)).toEqual({ state: "matched", item: ACCOUNTS[0] });
    expect(matchByName("tui", CATEGORIES)).toEqual({ state: "matched", item: CATEGORIES[2] });
  });

  it("an exact match wins over a longer prefix match", () => {
    const items = [
      { id: "1", name: "Go" },
      { id: "2", name: "GoPay" },
    ];
    expect(matchByName("go", items)).toEqual({ state: "matched", item: items[0] });
  });

  it("several prefix matches are ambiguous and set no id", () => {
    const r = parse("10k #s");
    expect(r.categoryId).toBeUndefined();
    expect(chip(r, "category")).toEqual({ type: "category", label: "#s", state: "ambiguous" });
    expect(r.errors[0]).toMatch(/several categories/);
  });

  it("an unknown account or category is missing, with an error", () => {
    const r = parse("10k @ovo #zzz");
    expect(r.accountId).toBeUndefined();
    expect(chip(r, "account")?.state).toBe("missing");
    expect(chip(r, "category")?.state).toBe("missing");
    expect(r.errors).toHaveLength(2);
  });

  it("no default account and none named: missing account", () => {
    const r = parse("kopi 10k", { defaultAccountId: undefined });
    expect(r.accountId).toBeUndefined();
    expect(r.errors).toContain("Choose an account.");
  });
});

describe("parseQuickTransaction: dates", () => {
  it("today / hari ini, yesterday / kemarin, in the user's zone", () => {
    expect(parse("kopi 10k today").occurredOn).toBe("2026-11-17");
    expect(parse("kopi 10k hari ini")).toMatchObject({ occurredOn: "2026-11-17", payee: "kopi" });
    expect(parse("kopi 10k yesterday").occurredOn).toBe("2026-11-16");
    expect(parse("kemarin kopi 10k")).toMatchObject({ occurredOn: "2026-11-16", payee: "kopi" });
    expect(chip(parse("kopi 10k kemarin"), "date")).toEqual({ type: "date", label: "Yesterday", state: "matched" });
  });

  it("defaults to today in the given zone, not UTC", () => {
    expect(parse("kopi 10k").occurredOn).toBe("2026-11-17");
    expect(parse("kopi 10k", { timeZone: "UTC" }).occurredOn).toBe("2026-11-16");
  });
});

describe("parseQuickTransaction: never throws", () => {
  it.each([
    "",
    "   ",
    "#",
    "@",
    "+",
    "to",
    "from",
    "to to to",
    "-25k",
    "🍜🍜 50k",
    "a".repeat(5000),
    "1.000.5 #food @gopay",
  ])("%j returns a result", (input) => {
    const r = parse(input);
    expect(Array.isArray(r.errors)).toBe(true);
    expect(typeof r.occurredOn).toBe("string");
  });

  it("survives a bad zone or date in the context", () => {
    expect(() => parse("kopi 10k", { timeZone: "Not/AZone" })).not.toThrow();
    expect(() => parse("kopi 10k", { now: new Date(Number.NaN) })).not.toThrow();
    expect(() => parseQuickTransaction(undefined as unknown as string, ctx)).not.toThrow();
  });
});

import { formatIdr } from "./format-idr";
import { addDays, type IsoDate, localDateFor } from "./local-date";
import { parseAmount } from "./parse-amount";

/**
 * One line → a transaction draft, e.g. "gofood 32k #food @gopay".
 *
 * - Amount: the first token parseAmount accepts ("32k", "Rp 25.000", "25 K").
 * - "+" (alone before the amount, or as its prefix: "+500k") makes it income;
 *   otherwise expense.
 * - Transfer: "to <account>" names the destination; the source is "@<account>"
 *   or "from <account>", else the default account. Same account → error.
 * - "#category" / "@account": case-insensitive exact name first, then a unique
 *   prefix. Several matches → ambiguous (no id); none → missing. Categories only
 *   match the parsed kind; transfers have no category.
 * - Dates: today / hari ini, yesterday / kemarin (in the user's zone); default today.
 * - Leftover words are the payee.
 *
 * Never throws on user input: problems come back in `errors`.
 */

export type QuickAccount = { id: string; name: string };
export type QuickCategory = { id: string; name: string; kind: "expense" | "income" };

export type QuickContext = {
  accounts: readonly QuickAccount[];
  categories: readonly QuickCategory[];
  now: Date;
  timeZone: string;
  defaultAccountId?: string;
};

export type ChipState = "matched" | "default" | "ambiguous" | "missing";
export type ChipType = "amount" | "kind" | "category" | "account" | "toAccount" | "date";
export type Chip = { type: ChipType; label: string; state: ChipState };

export type QuickTransaction = {
  kind: "expense" | "income" | "transfer";
  amount?: bigint;
  payee?: string;
  categoryId?: string;
  accountId?: string;
  toAccountId?: string;
  occurredOn: IsoDate;
  chips: Chip[];
  errors: string[];
};

type Match<T> = { state: "matched"; item: T } | { state: "ambiguous" | "missing" };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Exact (case-insensitive) name first, then a unique prefix. */
export function matchByName<T extends { name: string }>(query: string, items: readonly T[]): Match<T> {
  const q = norm(query);
  if (!q) return { state: "missing" };
  const exact = items.filter((i) => norm(i.name) === q);
  if (exact.length === 1) return { state: "matched", item: exact[0] };
  if (exact.length > 1) return { state: "ambiguous" };
  const prefix = items.filter((i) => norm(i.name).startsWith(q));
  if (prefix.length === 1) return { state: "matched", item: prefix[0] };
  return { state: prefix.length > 1 ? "ambiguous" : "missing" };
}

const SUFFIX_WORDS = new Set(["k", "rb", "ribu", "jt", "juta"]);

export function parseQuickTransaction(input: string, ctx: QuickContext): QuickTransaction {
  const errors: string[] = [];
  const chips: Chip[] = [];
  const today = safeLocalDate(ctx.now, ctx.timeZone);
  const words = (typeof input === "string" ? input : "").trim().split(/\s+/).filter(Boolean);
  const used = new Array<boolean>(words.length).fill(false);
  const lower = words.map((w) => w.toLowerCase());

  let income = false;
  let amount: bigint | undefined;
  let date: { value: IsoDate; label: string } | null = null;
  let categoryQuery: string | null = null;
  let sourceQuery: string | null = null;
  let targetQuery: string | null = null;

  for (let i = 0; i < words.length; i++) {
    if (used[i]) continue;
    const w = lower[i];

    // Date words.
    if (!date && (w === "today" || w === "kemarin" || w === "yesterday")) {
      date = w === "today" ? { value: today, label: "Today" } : { value: addDaysSafe(today, -1), label: "Yesterday" };
      used[i] = true;
      continue;
    }
    if (!date && w === "hari" && lower[i + 1] === "ini") {
      date = { value: today, label: "Today" };
      used[i] = used[i + 1] = true;
      continue;
    }

    // Transfer target and source.
    if (w === "to" && words[i + 1] && !targetQuery) {
      targetQuery = words[i + 1].replace(/^@/, "");
      used[i] = used[i + 1] = true;
      continue;
    }
    if (w === "from" && words[i + 1] && !sourceQuery) {
      sourceQuery = words[i + 1].replace(/^@/, "");
      used[i] = used[i + 1] = true;
      continue;
    }
    if (w.startsWith("@") && w.length > 1 && !sourceQuery) {
      sourceQuery = words[i].slice(1);
      used[i] = true;
      continue;
    }
    if (w.startsWith("#") && w.length > 1 && categoryQuery === null) {
      categoryQuery = words[i].slice(1);
      used[i] = true;
      continue;
    }

    // Amount: "+" alone before it, "+32k", "32 k", "Rp 25.000".
    if (amount === undefined) {
      if (w === "+" && words[i + 1]) {
        const next = amountAt(words, i + 1);
        if (next) {
          income = true;
          amount = next.value;
          used[i] = true;
          for (let k = 0; k < next.length; k++) used[i + 1 + k] = true;
          continue;
        }
      }
      const plus = w.startsWith("+") && w.length > 1;
      const found = amountAt(plus ? [words[i].slice(1), ...words.slice(i + 1)] : words.slice(i), 0);
      if (found) {
        if (plus) income = true;
        amount = found.value;
        for (let k = 0; k < found.length; k++) used[i + k] = true;
      }
    }
  }

  const kind: QuickTransaction["kind"] = targetQuery !== null ? "transfer" : income ? "income" : "expense";
  const result: QuickTransaction = { kind, occurredOn: date?.value ?? today, chips, errors };

  // Kind
  chips.push({
    type: "kind",
    label: kind === "transfer" ? "Transfer" : kind === "income" ? "Income" : "Expense",
    state: kind === "expense" && !income ? "default" : "matched",
  });

  // Amount
  if (amount === undefined) {
    chips.push({ type: "amount", label: "Amount", state: "missing" });
    errors.push("Add an amount, like 32k or 25.000.");
  } else if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    chips.push({ type: "amount", label: formatIdr(amount), state: "missing" });
    errors.push("That amount is too large.");
  } else {
    result.amount = amount;
    chips.push({ type: "amount", label: formatIdr(amount), state: "matched" });
  }

  // Source account (all kinds)
  const sourceLabel = kind === "transfer" ? "From" : "Account";
  if (sourceQuery !== null) {
    const m = matchByName(sourceQuery, ctx.accounts);
    if (m.state === "matched") {
      result.accountId = m.item.id;
      chips.push({ type: "account", label: m.item.name, state: "matched" });
    } else {
      chips.push({ type: "account", label: `@${sourceQuery}`, state: m.state });
      errors.push(
        m.state === "ambiguous" ? `“${sourceQuery}” matches several accounts.` : `No account called “${sourceQuery}”.`,
      );
    }
  } else {
    const fallback = ctx.accounts.find((a) => a.id === ctx.defaultAccountId);
    if (fallback) {
      result.accountId = fallback.id;
      chips.push({ type: "account", label: fallback.name, state: "default" });
    } else {
      chips.push({ type: "account", label: sourceLabel, state: "missing" });
      errors.push("Choose an account.");
    }
  }

  // Transfer destination
  if (kind === "transfer" && targetQuery !== null) {
    const m = matchByName(targetQuery, ctx.accounts);
    if (m.state === "matched") {
      result.toAccountId = m.item.id;
      chips.push({ type: "toAccount", label: m.item.name, state: "matched" });
      if (result.accountId === m.item.id) errors.push("A transfer needs two different accounts.");
    } else {
      chips.push({ type: "toAccount", label: `to ${targetQuery}`, state: m.state });
      errors.push(
        m.state === "ambiguous" ? `“${targetQuery}” matches several accounts.` : `No account called “${targetQuery}”.`,
      );
    }
  }

  // Category (expense/income only, matched within that kind)
  if (categoryQuery !== null) {
    if (kind === "transfer") {
      chips.push({ type: "category", label: `#${categoryQuery}`, state: "missing" });
      errors.push("Transfers don't have a category.");
    } else {
      const m = matchByName(
        categoryQuery,
        ctx.categories.filter((c) => c.kind === kind),
      );
      if (m.state === "matched") {
        result.categoryId = m.item.id;
        chips.push({ type: "category", label: m.item.name, state: "matched" });
      } else {
        chips.push({ type: "category", label: `#${categoryQuery}`, state: m.state });
        errors.push(
          m.state === "ambiguous"
            ? `“${categoryQuery}” matches several categories.`
            : `No ${kind} category called “${categoryQuery}”.`,
        );
      }
    }
  }

  // Date
  chips.push({ type: "date", label: date?.label ?? "Today", state: date ? "matched" : "default" });

  // Payee: everything left, single-spaced.
  const payee = words
    .filter((_, i) => !used[i])
    .join(" ")
    .trim();
  if (payee) {
    result.payee = payee;
    if (payee.length > 120) errors.push("Payee can be at most 120 characters.");
  }

  return result;
}

/** An amount starting at words[i]: one token, or two when the second is a suffix ("25 K") or the first is "Rp". */
function amountAt(words: readonly string[], i: number): { value: bigint; length: number } | null {
  const first = words[i];
  if (!first) return null;
  const second = words[i + 1];
  if (second && (SUFFIX_WORDS.has(second.toLowerCase()) || /^rp\.?$/i.test(first))) {
    const two = parseAmount(`${first} ${second}`);
    if (two.ok) return { value: two.value, length: 2 };
  }
  const one = parseAmount(first);
  return one.ok ? { value: one.value, length: 1 } : null;
}

function safeLocalDate(now: Date, timeZone: string): IsoDate {
  try {
    return localDateFor(now, timeZone);
  } catch {
    return Number.isNaN(now.getTime()) ? "1970-01-01" : now.toISOString().slice(0, 10);
  }
}

function addDaysSafe(date: IsoDate, n: number): IsoDate {
  try {
    return addDays(date, n);
  } catch {
    return date;
  }
}

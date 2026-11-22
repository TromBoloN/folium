import { z } from "zod";
import { isCivilDate } from "@/lib/dates";
import type { MessageKey } from "@/lib/i18n/core";
import { isMoneyIcon } from "../lib/money-palette";
import { parseAmount } from "../lib/parse-amount";

export const TRANSACTION_KINDS = [
  "expense",
  "income",
  "transfer",
  "adjustment",
  "lend",
  "repay",
  "borrow",
  "payback",
] as const;
/** Debts: real money moving to or from a person. Never spending or income in reports. */
export const DEBT_KINDS = ["lend", "repay", "borrow", "payback"] as const;
export type DebtKind = (typeof DEBT_KINDS)[number];
export const isDebtKind = (kind: string): kind is DebtKind => (DEBT_KINDS as readonly string[]).includes(kind);
export const TRANSACTION_STATUSES = ["posted", "planned"] as const;
export const ACCOUNT_TYPES = ["bank", "ewallet", "cash", "savings"] as const;
export const CATEGORY_KINDS = ["expense", "income"] as const;

export type TransactionKind = (typeof TRANSACTION_KINDS)[number];
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const KIND_LABELS: Record<TransactionKind, MessageKey> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  adjustment: "Adjustment",
  lend: "Lent",
  repay: "Got paid back",
  borrow: "Borrowed",
  payback: "Paid back",
};
export const ACCOUNT_TYPE_LABELS: Record<AccountType, MessageKey> = {
  bank: "Bank",
  ewallet: "E-wallet",
  cash: "Cash",
  savings: "Savings",
};

const AMOUNT_MESSAGES: Record<string, string> = {
  empty: "Enter an amount.",
  zero: "The amount must be more than 0.",
  negative: "Enter the amount without a minus sign.",
  fraction: "Use whole rupiah.",
  invalid: "Enter an amount like 25.000, 25k or 1,5jt.",
};

/** A typed amount ("25k", "25.000") → bigint rupiah, within what JSON numbers carry exactly. */
export const amountField = z.string().transform((text, ctx) => {
  const parsed = parseAmount(text);
  if (!parsed.ok) {
    ctx.addIssue({ code: "custom", message: AMOUNT_MESSAGES[parsed.reason] });
    return z.NEVER;
  }
  if (parsed.value > BigInt(Number.MAX_SAFE_INTEGER)) {
    ctx.addIssue({ code: "custom", message: "That amount is too large." });
    return z.NEVER;
  }
  return parsed.value;
});

/** Blank → 0, else an amount (fees, opening balances). */
const optionalAmount = z.string().transform((text, ctx) => {
  if (text.trim() === "" || /^0+$/.test(text.trim())) return 0n;
  const parsed = amountField.safeParse(text);
  if (!parsed.success) {
    ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Invalid amount." });
    return z.NEVER;
  }
  return parsed.data;
});

function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v));
}

export const optionalId = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || z.uuid().safeParse(v).success, "Choose from the list.");

const hexColor = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "Pick a colour.");

/** An icon key from the picker; blank = automatic (guessed from the name). */
const optionalIcon = z
  .string()
  .default("")
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || isMoneyIcon(v), "Pick an icon from the list.");

export const transactionFormSchema = z
  .object({
    kind: z.enum(TRANSACTION_KINDS, "Choose a kind."),
    status: z.enum(TRANSACTION_STATUSES).default("posted"),
    amount: amountField,
    accountId: z.uuid("Choose an account."),
    toAccountId: optionalId,
    feeAmount: optionalAmount,
    categoryId: optionalId,
    payee: optionalText(120, "Payee"),
    note: optionalText(1000, "Note"),
    occurredOn: z.string().refine(isCivilDate, "Enter a valid date."),
    adjustmentDirection: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || v === "in" || v === "out", "Choose in or out."),
    /** Debt kinds: an existing person… */
    personId: z.preprocess((v) => v ?? "", optionalId),
    /** …or a new name (created on save). */
    personName: z.preprocess((v) => v ?? "", optionalText(60, "Name")),
    /** Expenses only: books, printing, lab fees for a course. */
    courseId: z.preprocess((v) => v ?? "", optionalId),
  })
  .superRefine((t, ctx) => {
    // Mirrors the database's named CHECKs, so the message lands on the right field.
    if (t.kind === "transfer") {
      if (!t.toAccountId)
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Choose where the money goes." });
      else if (t.toAccountId === t.accountId)
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Pick a different account." });
    }
    if (t.kind === "adjustment" && !t.adjustmentDirection) {
      ctx.addIssue({ code: "custom", path: ["adjustmentDirection"], message: "Is money going in or out?" });
    }
    if (isDebtKind(t.kind) && !t.personId && !t.personName) {
      ctx.addIssue({ code: "custom", path: ["personId"], message: "Who is it with?" });
    }
  })
  .transform((t) => ({
    kind: t.kind,
    status: t.status,
    amount: t.amount,
    accountId: t.accountId,
    toAccountId: t.kind === "transfer" ? t.toAccountId : null,
    feeAmount: t.kind === "transfer" ? t.feeAmount : 0n,
    categoryId: t.kind === "expense" || t.kind === "income" ? t.categoryId : null,
    payee: t.kind === "expense" || t.kind === "income" ? t.payee : null,
    note: t.note,
    occurredOn: t.occurredOn,
    adjustmentDirection: t.kind === "adjustment" ? (t.adjustmentDirection as "in" | "out") : null,
    personId: isDebtKind(t.kind) ? t.personId : null,
    personName: isDebtKind(t.kind) && !t.personId ? t.personName : null,
    courseId: t.kind === "expense" ? t.courseId : null,
  }));

export type TransactionInput = z.infer<typeof transactionFormSchema>;

/** The database row (amounts as numbers: the schema keeps them within the safe range). */
export function transactionRow(t: TransactionInput) {
  return {
    kind: t.kind,
    status: t.status,
    amount: Number(t.amount),
    account_id: t.accountId,
    to_account_id: t.toAccountId,
    fee_amount: Number(t.feeAmount),
    category_id: t.categoryId,
    payee: t.payee,
    note: t.note,
    occurred_on: t.occurredOn,
    adjustment_direction: t.adjustmentDirection,
    person_id: t.personId,
    course_id: t.courseId,
  };
}

/**
 * A balance: may be 0 or negative (an overdrawn account), so a leading "-" is
 * allowed here, unlike transaction amounts.
 */
export const signedAmount = z.string().transform((text, ctx) => {
  const trimmed = text.trim();
  const negative = trimmed.startsWith("-");
  const body = negative ? trimmed.slice(1) : trimmed;
  if (body.trim() === "" || /^(rp\.?\s*)?0+$/i.test(body.trim())) return 0n;
  const parsed = amountField.safeParse(body);
  if (!parsed.success) {
    ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Invalid amount." });
    return z.NEVER;
  }
  return negative ? -parsed.data : parsed.data;
});

export const accountFormSchema = z.object({
  name: z.string().trim().min(1, "Give the account a name.").max(60, "Name can be at most 60 characters."),
  type: z.enum(ACCOUNT_TYPES, "Choose a type."),
  color: hexColor,
  icon: optionalIcon,
  openingBalance: signedAmount,
});

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Give the category a name.").max(60, "Name can be at most 60 characters."),
  kind: z.enum(CATEGORY_KINDS, "Choose expense or income."),
  parentId: optionalId,
  color: hexColor,
  icon: optionalIcon,
});

/** List filters from the URL. Junk falls back to "no filter" instead of an error page. */
export const transactionFiltersSchema = z.object({
  account: z.uuid().optional().catch(undefined),
  /** A category id, or "none" for uncategorised income and expenses. */
  category: z
    .union([z.uuid(), z.literal("none")])
    .optional()
    .catch(undefined),
  kind: z.enum(TRANSACTION_KINDS).optional().catch(undefined),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
  q: z
    .string()
    .trim()
    .max(100)
    .transform((v) => v || undefined)
    .optional()
    .catch(undefined),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

export const realBalanceSchema = z.object({
  accountId: z.uuid(),
  real: signedAmount,
});

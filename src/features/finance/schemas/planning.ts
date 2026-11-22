import { z } from "zod";
import { isCivilDate } from "@/lib/dates";
import { amountField, optionalId } from "./index";

/** Form schemas for recurring rules, budgets and goals (form strings in, typed values out). */

const optionalDate = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || isCivilDate(v), "Enter a valid date.");

const optionalInt = (min: number, max: number, message: string) =>
  z
    .string()
    .transform((v) => (v.trim() === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), message);

export const RULE_KINDS = ["expense", "income", "transfer"] as const;
export const CADENCES = ["weekly", "monthly", "yearly"] as const;

export const ruleFormSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name.").max(80, "A name can be at most 80 characters."),
    kind: z.enum(RULE_KINDS, "Choose a kind."),
    amount: amountField,
    isEstimate: z.boolean(),
    accountId: z.uuid("Choose an account."),
    toAccountId: optionalId,
    categoryId: optionalId,
    payee: z
      .string()
      .trim()
      .max(120)
      .transform((v) => v || null),
    cadence: z.enum(CADENCES, "Choose how often."),
    intervalCount: optionalInt(1, 24, "Every 1 to 24.").transform((v) => v ?? 1),
    dueDay: optionalInt(1, 31, "A day from 1 to 31."),
    startsOn: z.string().refine(isCivilDate, "Enter a valid date."),
    endsOn: optionalDate,
    instalmentsTotal: optionalInt(1, 120, "From 1 to 120 payments."),
    remindDaysBefore: optionalInt(0, 60, "0 to 60 days.").transform((v) => v ?? 3),
  })
  .superRefine((r, ctx) => {
    if (r.cadence !== "weekly" && !r.dueDay) {
      ctx.addIssue({ code: "custom", path: ["dueDay"], message: "Which day of the month?" });
    }
    if (r.kind === "transfer" && (!r.toAccountId || r.toAccountId === r.accountId)) {
      ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Choose a different account to move money to." });
    }
    if (r.endsOn && r.endsOn < r.startsOn) {
      ctx.addIssue({ code: "custom", path: ["endsOn"], message: "The end is before the start." });
    }
  })
  .transform((r) => ({
    ...r,
    toAccountId: r.kind === "transfer" ? r.toAccountId : null,
    categoryId: r.kind === "transfer" ? null : r.categoryId,
    dueDay: r.cadence === "weekly" ? null : r.dueDay,
  }));

export type RuleInput = z.infer<typeof ruleFormSchema>;

export const budgetFormSchema = z.object({
  categoryId: z.uuid("Choose a category."),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month."),
  amount: amountField,
  rollover: z.boolean(),
});

export const goalFormSchema = z.object({
  name: z.string().trim().min(1, "Give the goal a name.").max(80, "A name can be at most 80 characters."),
  targetAmount: amountField,
  targetOn: optionalDate,
  accountId: z.uuid("Choose a savings account."),
});

import type { MessageKey } from "@/lib/i18n/core";
import { addDays, type IsoDate } from "./local-date";

/** Starting points for a recurring rule. Category and account are matched by name when they exist. */
export const RULE_TEMPLATES = [
  { key: "subscription", label: "Subscription" },
  { key: "kos", label: "Kos / rent" },
  { key: "ukt", label: "UKT instalments" },
  { key: "data", label: "Data credit" },
  { key: "service", label: "Service reminder" },
  { key: "allowance", label: "Allowance" },
  { key: "sinking", label: "Set aside monthly" },
] as const satisfies readonly { key: string; label: MessageKey }[];

export type TemplateKey = (typeof RULE_TEMPLATES)[number]["key"];

type Named = { id: string; name: string };

export type TemplateDefaults = {
  name: string;
  kind: "expense" | "income" | "transfer";
  amount: string;
  isEstimate: boolean;
  categoryId: string;
  toAccountId: string;
  cadence: "weekly" | "monthly" | "yearly";
  intervalCount: string;
  dueDay: string;
  startsOn: IsoDate;
  instalmentsTotal: string;
  remindDaysBefore: string;
};

function find(items: readonly Named[], re: RegExp) {
  return items.find((i) => re.test(i.name.toLowerCase()))?.id ?? "";
}

export function ruleTemplate(
  key: string | undefined,
  ctx: { today: IsoDate; expense: readonly Named[]; income: readonly Named[]; savings: readonly Named[] },
): TemplateDefaults {
  const day = Number(ctx.today.slice(8, 10));
  const base: TemplateDefaults = {
    name: "",
    kind: "expense",
    amount: "",
    isEstimate: false,
    categoryId: "",
    toAccountId: "",
    cadence: "monthly",
    intervalCount: "1",
    dueDay: String(day),
    startsOn: ctx.today,
    instalmentsTotal: "",
    remindDaysBefore: "3",
  };
  switch (key) {
    case "subscription":
      return { ...base, name: "", categoryId: find(ctx.expense, /subscri|langganan/) };
    case "kos":
      return {
        ...base,
        name: "Kos",
        dueDay: "1",
        remindDaysBefore: "5",
        categoryId: find(ctx.expense, /kos|rent|sewa/),
      };
    case "ukt":
      return {
        ...base,
        name: "UKT",
        instalmentsTotal: "6",
        remindDaysBefore: "7",
        categoryId: find(ctx.expense, /ukt|tuition|kuliah/),
      };
    case "data":
      return {
        ...base,
        name: "Data credit",
        isEstimate: true,
        categoryId: find(ctx.expense, /data|pulsa|internet|other/),
      };
    case "service":
      return {
        ...base,
        name: "Motorbike service",
        intervalCount: "3",
        remindDaysBefore: "7",
        startsOn: addDays(ctx.today, 1),
        categoryId: find(ctx.expense, /transport/),
      };
    case "allowance":
      return {
        ...base,
        name: "Allowance",
        kind: "income",
        dueDay: "1",
        remindDaysBefore: "0",
        categoryId: find(ctx.income, /allowance|uang saku/),
      };
    case "sinking":
      return {
        ...base,
        name: "Savings",
        kind: "transfer",
        remindDaysBefore: "0",
        toAccountId: ctx.savings[0]?.id ?? "",
      };
    default:
      return base;
  }
}

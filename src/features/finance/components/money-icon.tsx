import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Award,
  Banknote,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Clapperboard,
  Coffee,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  type LucideIcon,
  PiggyBank,
  Receipt,
  Repeat,
  ShoppingBag,
  Smartphone,
  Utensils,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { iconFor, type MoneyIcon } from "../lib/money-palette";
import type { AccountType } from "../schemas";

export const MONEY_ICON_GLYPHS: Record<MoneyIcon, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  bus: Bus,
  house: House,
  "graduation-cap": GraduationCap,
  repeat: Repeat,
  "shopping-bag": ShoppingBag,
  "heart-pulse": HeartPulse,
  clapperboard: Clapperboard,
  "book-open": BookOpen,
  gift: Gift,
  "hand-coins": HandCoins,
  award: Award,
  briefcase: Briefcase,
  landmark: Landmark,
  wallet: Wallet,
  smartphone: Smartphone,
  banknote: Banknote,
  "piggy-bank": PiggyBank,
  receipt: Receipt,
};

export const ACCOUNT_ICONS: Record<AccountType, LucideIcon> = {
  bank: Building2,
  ewallet: Wallet,
  cash: Banknote,
  savings: PiggyBank,
};

/** Fallbacks when a row has no category (or its icon is unknown). */
export const KIND_ICONS = {
  expense: ArrowUpRight,
  income: ArrowDownLeft,
  transfer: ArrowRightLeft,
  adjustmentIn: ArrowDownRight,
  adjustmentOut: ArrowUpRight,
} as const;

export function categoryGlyph(category: { icon: string | null; name: string } | undefined, fallback: LucideIcon) {
  const key = category ? iconFor(category.icon, category.name) : null;
  return key ? MONEY_ICON_GLYPHS[key] : fallback;
}

export function accountGlyph(account: { icon: string | null; name: string; type: AccountType }) {
  const key = iconFor(account.icon, "");
  return key ? MONEY_ICON_GLYPHS[key] : ACCOUNT_ICONS[account.type];
}

/** A round, softly tinted badge with the glyph in the "ink" of the colour (readable in light and dark). Decorative. */
export function IconBadge({
  icon: Icon,
  color,
  size = "md",
  className,
  dashed,
}: {
  icon: LucideIcon;
  color?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  dashed?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "money-badge flex shrink-0 items-center justify-center rounded-pill",
        size === "sm" && "size-7 [&_svg]:size-3.5",
        size === "md" && "size-9 [&_svg]:size-4",
        size === "lg" && "size-11 [&_svg]:size-5",
        dashed && "border border-current border-dashed",
        className,
      )}
      style={{ "--c": color ?? "var(--muted-foreground)" } as React.CSSProperties}
    >
      <Icon />
    </span>
  );
}

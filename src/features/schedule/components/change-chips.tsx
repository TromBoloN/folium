import { ArrowRightLeft, CircleSlash, MapPin, Plus, Video } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import type { Chip, ChipKind } from "../format";

const ICONS: Record<ChipKind, typeof Plus> = {
  cancelled: CircleSlash,
  moved: ArrowRightLeft,
  extra: Plus,
  room: MapPin,
  online: Video,
};

/**
 * The one look for schedule changes, used on every screen:
 * cancelled red, moved amber, extra dashed outline, room and online neutral.
 */
export function ChangeChip({ chip, compact = false }: { chip: Chip; compact?: boolean }) {
  const Icon = ICONS[chip.kind];
  const tone = chip.kind === "cancelled" ? "danger" : chip.kind === "moved" ? "warning" : "neutral";
  return (
    <Pill
      tone={tone}
      className={cn(
        chip.kind === "extra" && "border border-current border-dashed bg-transparent text-foreground",
        chip.kind === "online" && "bg-accent text-accent-foreground",
        compact && "min-w-0 max-w-full px-1.5 py-0 text-[0.6875rem]",
      )}
      title={compact ? chip.text : undefined}
    >
      <Icon aria-hidden />
      <span className={compact ? "truncate" : undefined}>{chip.text}</span>
    </Pill>
  );
}

export function ChangeChips({
  chips,
  compact = false,
  className,
}: {
  chips: Chip[];
  compact?: boolean;
  className?: string;
}) {
  if (chips.length === 0) return null;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {chips.map((c) => (
        <ChangeChip key={c.kind} chip={c} compact={compact} />
      ))}
    </span>
  );
}

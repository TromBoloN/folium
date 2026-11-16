import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Tile } from "@/components/ui/tile";
import { TrL } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { WidgetSize } from "../widget-ids";

/**
 * Grid footprint per size hint. The dashboard grid is a container: 1 column
 * when narrow, 2 from @xl, 12 from @4xl. Rows size to content (no stretching).
 */
export const SIZE_CLASSES: Record<WidgetSize, string> = {
  hero: "@xl:col-span-2 @4xl:col-span-8",
  wide: "@xl:col-span-2 @4xl:col-span-8",
  tall: "@4xl:col-span-4 @4xl:row-span-2",
  small: "@4xl:col-span-4",
};

type Props = {
  id: string;
  title: string;
  icon: LucideIcon;
  size: WidgetSize;
  /** "tile": a titled card. "bare": the widget draws its own tiles; the title is for screen readers. */
  frame: "tile" | "bare";
  stretch?: boolean;
  href?: string;
  hrefLabel?: string;
  /** Position in the staggered entrance. */
  index: number;
  children: React.ReactNode;
};

/** The section every widget sits in: a grid item sized by its hint, usually a titled tile. */
export function WidgetFrame({
  id,
  title,
  icon: Icon,
  size,
  frame,
  stretch,
  href,
  hrefLabel = "See all",
  index,
  children,
}: Props) {
  const heading = `widget-${id}`;
  if (frame === "bare") {
    return (
      <section aria-labelledby={heading} className={cn("min-w-0", SIZE_CLASSES[size])}>
        <h2 id={heading} className="sr-only">
          <TrL text={title} />
        </h2>
        {children}
      </section>
    );
  }
  return (
    <Tile
      as="section"
      aria-labelledby={heading}
      spotlight
      reveal={index}
      className={cn("flex min-w-0 flex-col gap-3 p-4 sm:p-5", SIZE_CLASSES[size], stretch && "self-stretch")}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 id={heading} className="flex items-center gap-2.5 font-medium">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon aria-hidden className="size-4" />
          </span>
          <TrL text={title} />
        </h2>
        {href ? (
          <Link
            href={href}
            className="group/more inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            <TrL text={hrefLabel} />
            <ArrowRight
              aria-hidden
              className="size-3.5 transition-transform duration-(--dur-fast) group-hover/more:translate-x-0.5"
            />
          </Link>
        ) : null}
      </header>
      {children}
    </Tile>
  );
}

export function WidgetSkeleton({ rows = 2, label }: { rows?: number; label: string }) {
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">
        <TrL text={label} />
      </span>
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

export function WidgetEmpty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed px-3 py-4 text-muted-foreground text-sm">{children}</p>;
}

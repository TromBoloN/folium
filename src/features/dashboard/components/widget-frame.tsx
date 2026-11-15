import type { LucideIcon } from "lucide-react";
import Link from "next/link";

type Props = {
  id: string;
  title: string;
  icon: LucideIcon;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
};

/** The card every widget sits in: a titled section, with an optional "see all" link. */
export function WidgetFrame({ id, title, icon: Icon, href, hrefLabel = "See all", children }: Props) {
  return (
    <section aria-labelledby={`widget-${id}`} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 id={`widget-${id}`} className="flex items-center gap-2 font-medium">
          <Icon aria-hidden className="size-4 text-primary" />
          {title}
        </h2>
        {href ? (
          <Link href={href} className="text-muted-foreground text-sm hover:text-foreground">
            {hrefLabel}
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function WidgetSkeleton({ rows = 2, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

export function WidgetEmpty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed px-3 py-4 text-muted-foreground text-sm">{children}</p>;
}

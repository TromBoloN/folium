import type { LucideIcon } from "lucide-react";

type Props = { icon: LucideIcon; title: string; description: string; children?: React.ReactNode };

/** A friendly empty state: a small leaf-motif illustration, a title and one line of copy. */
export function EmptyState({ icon: Icon, title, description, children }: Props) {
  return (
    <div className="tile reveal flex flex-col items-center gap-4 border-dashed px-6 py-12 text-center">
      <span aria-hidden className="relative flex size-24 items-center justify-center">
        <span className="leaf-veins absolute inset-0 opacity-25" />
        <span className="relative flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-tile">
          <Icon className="size-6" />
        </span>
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-display font-medium text-xl">{title}</h2>
        <p className="max-w-sm text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </div>
  );
}

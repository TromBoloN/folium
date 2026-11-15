import type { LucideIcon } from "lucide-react";

type Props = { icon: LucideIcon; title: string; description: string; children?: React.ReactNode };

export function EmptyState({ icon: Icon, title, description, children }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon aria-hidden className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">{title}</h2>
        <p className="max-w-sm text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </div>
  );
}

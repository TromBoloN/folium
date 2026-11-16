import { TrL } from "@/lib/i18n/client";

type Props = { title: string; description?: string; action?: React.ReactNode; back?: React.ReactNode };

export function PageHeader({ title, description, action, back }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-3">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display font-medium text-3xl tracking-tight md:text-4xl">
            <TrL text={title} />
          </h1>
          {description ? (
            <p className="text-muted-foreground text-sm">
              <TrL text={description} />
            </p>
          ) : null}
        </div>
        {action}
      </div>
    </header>
  );
}

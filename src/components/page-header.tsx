type Props = { title: string; description?: string; action?: React.ReactNode; back?: React.ReactNode };

export function PageHeader({ title, description, action, back }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-3">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}

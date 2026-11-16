/** Loading placeholders shaped like the final /money blocks, so nothing jumps when they arrive. */

const bar = "animate-pulse rounded bg-muted";

export function QuickAddSkeleton() {
  return (
    <div role="status" aria-label="Loading quick add" className="tile flex items-center gap-2 p-3 sm:p-4">
      <div className={`${bar} ml-1 size-5 rounded-full`} />
      <div className={`${bar} h-11 flex-1 rounded-lg`} />
      <div className={`${bar} h-10 w-16 rounded-lg`} />
    </div>
  );
}

export function AccountsSkeleton() {
  return (
    <div role="status" aria-label="Loading accounts" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className={`${bar} h-4 w-40`} />
        <div className={`${bar} h-10 w-56 sm:h-12`} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <div key={i} className="tile flex h-40 flex-col gap-3 p-4">
            <div className={`${bar} h-4 w-24`} />
            <div className={`${bar} h-6 w-28`} />
            <div className={`${bar} mt-auto h-7 w-full`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelSkeleton({ label, rows }: { label: string; rows: number }) {
  return (
    <div role="status" aria-label={label} className="tile flex flex-col gap-4 p-5">
      <div className={`${bar} h-5 w-36`} />
      <div className={`${bar} h-3 w-full rounded-full`} />
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={i} className={`${bar} h-5 w-full`} />
      ))}
    </div>
  );
}

export function ListRowsSkeleton({ rows, label }: { rows: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-1.5">
      <div className={`${bar} mx-1 h-4 w-20`} />
      <div className="tile flex flex-col divide-y divide-border-soft">
        {Array.from({ length: rows }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <div className={`${bar} size-9 rounded-full`} />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className={`${bar} h-4 w-32`} />
              <div className={`${bar} h-3 w-48`} />
            </div>
            <div className={`${bar} h-4 w-20`} />
          </div>
        ))}
      </div>
    </div>
  );
}

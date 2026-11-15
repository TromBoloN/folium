import { cn } from "@/lib/utils";

type Option<V extends string> = { value: V; label: string; swatch?: string };

type Props<V extends string> = {
  name: string;
  legend: string;
  options: readonly Option<V>[];
  defaultValue: string;
  columns?: 2 | 3 | 4 | 5;
};

const COLS = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-3 sm:grid-cols-5",
} as const;

/** A radio group drawn as selectable tiles. Real radio inputs, so keyboard and forms just work. */
export function ChoiceGroup<V extends string>({ name, legend, options, defaultValue, columns = 3 }: Props<V>) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium text-sm">{legend}</legend>
      <div className={cn("grid gap-2", COLS[columns])}>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/60 has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === defaultValue}
              className="sr-only"
            />
            {option.swatch ? (
              <span aria-hidden data-preset={option.swatch} className="swatch size-4 shrink-0 rounded-full" />
            ) : null}
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

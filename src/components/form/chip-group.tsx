import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string /** Accessible name when the label is short ("M" -> "Monday"). */;
  title?: string;
};

type Props = {
  name: string;
  legend: string;
  options: readonly Option[];
  /** checkbox: pick several (e.g. weekdays). radio: pick one. */
  type?: "radio" | "checkbox";
  defaultValue?: string | readonly string[];
  /** Square chips of equal width, for one-letter labels. */
  compact?: boolean;
  error?: string;
  hint?: string;
  optional?: boolean;
  onChange?: (values: string[]) => void;
};

/**
 * Small choices as chips: real radio/checkbox inputs inside labels, so keyboard,
 * screen readers and forms without JavaScript all just work.
 */
export function ChipGroup({
  name,
  legend,
  options,
  type = "radio",
  defaultValue,
  compact = false,
  error,
  hint,
  optional,
  onChange,
}: Props) {
  const selected = new Set(typeof defaultValue === "string" ? [defaultValue] : (defaultValue ?? []));
  return (
    <fieldset
      className="flex min-w-0 flex-col gap-2"
      aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
      onChange={
        onChange
          ? (e) => {
              const form = (e.currentTarget as HTMLFieldSetElement).elements;
              const values = [...form]
                .filter(
                  (el): el is HTMLInputElement => el instanceof HTMLInputElement && el.name === name && el.checked,
                )
                .map((el) => el.value);
              onChange(values);
            }
          : undefined
      }
    >
      <legend className="mb-1.5 font-medium text-sm">
        {legend}
        {optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
      </legend>
      <div className={cn("flex flex-wrap gap-1.5", compact && "grid grid-cols-7 sm:flex")}>
        {options.map((o) => (
          <label
            key={o.value}
            title={o.title}
            className={cn(
              "flex cursor-pointer select-none items-center justify-center rounded-full border border-border bg-surface-1 font-medium text-sm transition-colors duration-(--dur-fast) hover:border-foreground/25 has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/30",
              compact ? "h-11 min-w-11 px-0 md:h-10 md:min-w-10" : "h-11 px-4 md:h-9",
            )}
          >
            <input
              type={type}
              name={name}
              value={o.value}
              defaultChecked={selected.has(o.value)}
              className="sr-only"
              aria-label={o.title}
            />
            {o.label}
          </label>
        ))}
      </div>
      {hint && !error ? (
        <p id={`${name}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MONEY_ICONS, MONEY_PALETTE } from "../lib/money-palette";
import { MONEY_ICON_GLYPHS } from "./money-icon";

const swatchRing =
  "has-checked:ring-2 has-checked:ring-foreground has-checked:ring-offset-2 has-checked:ring-offset-background has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50";

/**
 * Colour and icon pickers for an account or category: real radio inputs
 * (no JavaScript needed). The colour list is the money palette; a stored
 * colour outside it stays selectable so editing never changes it by surprise.
 */
export function AppearanceFields({
  color,
  icon,
  errors,
}: {
  color: string;
  icon: string;
  errors: Record<string, string>;
}) {
  const current = color.toLowerCase();
  const swatches = MONEY_PALETTE.some((p) => p.hex === current)
    ? [...MONEY_PALETTE]
    : [{ hex: current, name: "Current colour" }, ...MONEY_PALETTE];
  return (
    <>
      <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={errors.color ? "color-error" : undefined}>
        <legend className="mb-1.5 font-medium text-sm">Colour</legend>
        <div className="flex flex-wrap gap-2.5">
          {swatches.map((s) => (
            <label
              key={s.hex}
              title={s.name}
              className={cn(
                "relative size-8 cursor-pointer rounded-full transition-transform active:scale-90",
                swatchRing,
              )}
              style={{ background: s.hex }}
            >
              <input
                type="radio"
                name="color"
                value={s.hex}
                defaultChecked={current === s.hex}
                className="sr-only"
                aria-label={s.name}
              />
            </label>
          ))}
        </div>
        {errors.color ? (
          <p id="color-error" className="text-destructive text-xs">
            {errors.color}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={errors.icon ? "icon-error" : "icon-hint"}>
        <legend className="mb-1.5 font-medium text-sm">Icon</legend>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          <label
            title="Automatic"
            className="flex size-10 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/30"
          >
            <input
              type="radio"
              name="icon"
              value=""
              defaultChecked={!icon}
              className="sr-only"
              aria-label="Automatic"
            />
            <Sparkles aria-hidden className="size-4" />
          </label>
          {MONEY_ICONS.map((key) => {
            const Glyph = MONEY_ICON_GLYPHS[key];
            const label = key.replace(/-/g, " ");
            return (
              <label
                key={key}
                title={label}
                className="flex size-10 cursor-pointer items-center justify-center rounded-lg border border-border transition-colors has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/30"
              >
                <input
                  type="radio"
                  name="icon"
                  value={key}
                  defaultChecked={icon === key}
                  className="sr-only"
                  aria-label={label}
                />
                <Glyph aria-hidden className="size-4" />
              </label>
            );
          })}
        </div>
        {errors.icon ? (
          <p id="icon-error" className="text-destructive text-xs">
            {errors.icon}
          </p>
        ) : (
          <p id="icon-hint" className="text-muted-foreground text-xs">
            Automatic picks one from the name.
          </p>
        )}
      </fieldset>
    </>
  );
}

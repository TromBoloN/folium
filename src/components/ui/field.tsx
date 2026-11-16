"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/client";

type Props = {
  id: string;
  label: string;
  /** From the server (wins over the browser's own check). */
  error?: string;
  hint?: string;
  optional?: boolean;
  /** Shown when a required field is left empty. Defaults to "<Label> is required." */
  requiredMessage?: string;
  children: React.ReactNode;
};

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const isControl = (el: EventTarget): el is Control =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;

/**
 * Label, control, hint and error for one field. The control uses the same `id`
 * and aria-describedby={describedBy(id, error, hint)}.
 *
 * Checks itself when you leave it (required, email, url, min/max, pattern: the
 * control's own constraints), so mistakes show before submitting. The server
 * still validates everything; without JavaScript its errors are what you see.
 */
export function Field({ id, label, error, hint, optional, requiredMessage, children }: Props) {
  const { t, tl } = useI18n();
  const [local, setLocal] = useState<string | null>(null);
  // Labels, hints and server errors arrive in English; they're looked up here (unknown text shows as is).
  const shown = error ? tl(error) : (local ?? undefined);

  const check = (el: Control, final: boolean) => {
    if (el.id !== id) return;
    if (el.validity.valid) {
      if (local) {
        setLocal(null);
        if (!error) el.removeAttribute("aria-invalid");
      }
      return;
    }
    if (!final) return; // while typing, only clear; complain on leaving
    const message = el.validity.valueMissing
      ? requiredMessage
        ? tl(requiredMessage)
        : t("{label} is required.", { label: tl(label) })
      : el.validationMessage;
    setLocal(message);
    el.setAttribute("aria-invalid", "true");
    el.setAttribute("aria-describedby", `${id}-error`);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: listens for blur/input bubbling up from the field's own control; the div itself isn't interactive.
    <div
      className="grid gap-1.5"
      onBlur={(e) => isControl(e.target) && check(e.target, true)}
      onInput={(e) => isControl(e.target) && check(e.target, false)}
    >
      <Label htmlFor={id}>
        {tl(label)}
        {optional ? <span className="font-normal text-muted-foreground"> {t("(optional)")}</span> : null}
      </Label>
      {children}
      {hint && !shown ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {tl(hint)}
        </p>
      ) : null}
      {shown ? (
        <p id={`${id}-error`} className="text-destructive text-xs" aria-live="polite">
          {shown}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

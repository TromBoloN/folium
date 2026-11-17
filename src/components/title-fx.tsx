"use client";

import { useI18n } from "@/lib/i18n/client";

/**
 * An empty, aria-hidden layer over a heading that carries the translated text in
 * `data-text`, so a theme pack can draw effects from it (`content: attr(data-text)`
 * on its ::before/::after) without the heading's accessible name changing.
 * The heading must be `position: relative`. Draws nothing on its own.
 */
export function TitleFx({ text }: { text: string }) {
  return (
    <span
      aria-hidden
      data-slot="title-fx"
      data-text={useI18n().tl(text)}
      className="pointer-events-none absolute inset-0"
    />
  );
}

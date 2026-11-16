import "server-only";
import { cache } from "react";
import { getSettings } from "@/features/settings/queries";
import { type I18n, i18nFor } from "./core";

/** The signed-in user's language (from Settings), with its translator and Intl locale. */
export const getI18n = cache(async (): Promise<I18n> => {
  const { preferences } = await getSettings();
  return i18nFor(preferences.language);
});

/** Shorthand for server components and actions that only need `t`. */
export async function getT() {
  return (await getI18n()).t;
}

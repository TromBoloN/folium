import { id } from "./id";
import { idPatterns } from "./id/patterns";

/**
 * Translations, gettext style: the English text is the key, so components
 * keep reading in English and `t("Save")` is checked at compile time against
 * the Indonesian dictionary (a string with no translation doesn't typecheck).
 * Placeholders are `{name}`; pass them as `t("Hi, {name}", { name })`.
 */
export type Locale = "en" | "id";
export type MessageKey = keyof typeof id;
export type Vars = Record<string, string | number>;
export type T = (key: MessageKey, vars?: Vars) => string;

/** The Intl locale used for dates and numbers. */
export function intlLocale(locale: Locale): string {
  return locale === "id" ? "id-ID" : "en-GB";
}

export function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

const dictionaries: Record<Locale, Partial<Record<string, string>>> = { en: {}, id };

export function makeT(locale: Locale): T {
  const dict = dictionaries[locale];
  return (key, vars) => interpolate(dict[key] ?? key, vars);
}

/**
 * For text that isn't a literal in the code (a validation message, an error
 * from a server action): translated when the dictionary knows it, else as is.
 */
export function translateLoose(locale: Locale, text: string, vars?: Vars): string {
  const exact = dictionaries[locale][text];
  if (exact !== undefined) return interpolate(exact, vars);
  // Messages built with values ("Name can be at most 60 characters."): match a pattern,
  // translating each captured part too (the field name), then fill the template.
  if (locale === "id") {
    for (const [pattern, template] of idPatterns) {
      const match = pattern.exec(text);
      if (match) {
        return template.replace(/\{(\d)\}/g, (_, i: string) => translateLoose(locale, match[Number(i)] ?? ""));
      }
    }
  }
  return interpolate(text, vars);
}

/** English, for tests and code that runs without a user (e.g. defaults). */
export const tEn: T = makeT("en");

/** Pick the key for a count: `t(plural(n, "{n} class", "{n} classes"), { n })`. */
export function plural<K extends MessageKey>(n: number, one: K, other: K): K {
  return n === 1 ? one : other;
}

export type I18n = { locale: Locale; intl: string; t: T; tl: (text: string, vars?: Vars) => string };

export function i18nFor(locale: Locale): I18n {
  return { locale, intl: intlLocale(locale), t: makeT(locale), tl: (text, vars) => translateLoose(locale, text, vars) };
}

/** English defaults for pure helpers called without a user (tests, fallbacks). */
export const EN: I18n = i18nFor("en");

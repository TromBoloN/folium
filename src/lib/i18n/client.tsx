"use client";

import { createContext, useContext, useMemo } from "react";
import { type I18n, i18nFor, type Locale, type MessageKey, type Vars } from "./core";

const I18nContext = createContext<I18n>(i18nFor("en"));

/** Set once in the root layout from the saved language. */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => i18nFor(locale), [locale]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}

export function useT() {
  return useContext(I18nContext).t;
}

/** Translated text for components that may render on either side and can't await `getT()`. */
export function Tr({ k, vars }: { k: MessageKey; vars?: Vars }) {
  return useT()(k, vars);
}

/** Loose translation of text passed in from elsewhere (a prop, a server message): as is when unknown. */
export function TrL({ text }: { text: string }) {
  return useI18n().tl(text);
}

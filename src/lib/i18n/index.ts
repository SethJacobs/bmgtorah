import en, { type Dict, type DictKey } from "./en";
import he from "./he";
import yi from "./yi";

export const LOCALES = ["en", "he", "yi"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "bmg_locale";
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", he: "עברית", yi: "אידיש" };

export const DICTS: Record<Locale, Dict> = { en, he, yi };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export function dirOf(locale: Locale) {
  return locale === "en" ? "ltr" : "rtl";
}

export type TFn = (key: DictKey, vars?: Record<string, string | number>) => string;

export function makeT(locale: Locale): TFn {
  const dict = DICTS[locale];
  return (key, vars) => {
    let s = dict[key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export type { DictKey };

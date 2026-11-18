import "server-only";
import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE, makeT, type Locale } from "./index";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const accept = (await headers()).get("accept-language") ?? "";
  if (/^(he|iw)\b/i.test(accept)) return "he";
  if (/^yi\b/i.test(accept)) return "yi";
  return "en";
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(locale) };
}

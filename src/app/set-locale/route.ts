import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";

export function GET(req: NextRequest) {
  const l = req.nextUrl.searchParams.get("l");
  const back = req.headers.get("referer");
  const dest = back && new URL(back).host === req.nextUrl.host ? back : new URL("/", req.url).toString();
  const res = NextResponse.redirect(dest);
  if (isLocale(l)) res.cookies.set(LOCALE_COOKIE, l, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}

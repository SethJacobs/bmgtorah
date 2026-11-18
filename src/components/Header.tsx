import Link from "next/link";
import { getSession, hasRole } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n";
import { hebrewDate } from "@/lib/calendar";

export async function Header() {
  const { t, locale } = await getT();
  const { user, profile } = await getSession();

  return (
    <header className="site-header">
      <div className="topbar container">
        <span className="muted small">{hebrewDate()}</span>
        <nav className="lang-switch" aria-label={t("common.language")}>
          {LOCALES.map((l) => (
            <a key={l} href={`/set-locale?l=${l}`} className={l === locale ? "active" : ""} lang={l}>
              {LOCALE_NAMES[l]}
            </a>
          ))}
        </nav>
      </div>
      <div className="mainbar container">
        <Link href="/" className="logo">
          <span className="logo-mark">ב</span>
          <span>
            <strong>{t("site.name")}</strong>
            <small>{t("site.tagline")}</small>
          </span>
        </Link>
        <form action="/search" className="header-search" role="search">
          <input name="q" type="search" placeholder={t("search.placeholder")} aria-label={t("search.button")} />
          <button type="submit">{t("search.button")}</button>
        </form>
        <div className="account">
          {hasRole(profile, "uploader") && <Link href="/upload" className="btn small">{t("nav.upload")}</Link>}
          {hasRole(profile, "editor") && <Link href="/admin" className="btn small">{t("nav.admin")}</Link>}
          <Link href="/my">{t("nav.myLibrary")}</Link>
          {user ? (
            <form action="/auth/signout" method="post"><button className="linklike">{t("nav.logout")}</button></form>
          ) : (
            <Link href="/login">{t("nav.login")}</Link>
          )}
        </div>
      </div>
      <nav className="mainnav">
        <div className="container">
          <Link href="/">{t("nav.home")}</Link>
          <Link href="/speakers">{t("nav.speakers")}</Link>
          <Link href="/categories">{t("nav.topics")}</Link>
          <Link href="/series">{t("nav.series")}</Link>
          <Link href="/parsha">{t("nav.parsha")}</Link>
          <Link href="/daf-yomi">{t("nav.dafYomi")}</Link>
          <Link href="/venues">{t("nav.venues")}</Link>
        </div>
      </nav>
    </header>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { I18nProvider } from "@/components/I18nProvider";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { PlayerBar } from "@/components/player/PlayerBar";
import { getT } from "@/lib/i18n/server";
import { dirOf } from "@/lib/i18n";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "BMGTorah", template: "%s | BMGTorah" },
  description: "Shiurim from Beis Medrash Gevoha, Lakewood — Gemara, Halacha, Mussar, Parsha and more.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getT();
  return (
    <html lang={locale} dir={dirOf(locale)}>
      <body>
        <I18nProvider locale={locale}>
          <PlayerProvider>
            <Header />
            <main className="container page">{children}</main>
            <footer className="site-footer">
              <div className="container small muted">
                © {new Date().getFullYear()} Beis Medrash Gevoha · BMGTorah ·{" "}
                <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
              </div>
            </footer>
            <PlayerBar />
          </PlayerProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

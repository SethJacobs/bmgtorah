import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getCategoryTree, getMyLibraryState, searchShiurim, siteTotal } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { dafYomi, parshaOfWeek } from "@/lib/calendar";
import { localName } from "@/lib/format";
import { ShiurCard } from "@/components/ShiurCard";


export default async function Home() {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const parsha = parshaOfWeek();
  const daf = dafYomi();

  const [featured, recent, popular, total, tree, lib, featuredSeries] = await Promise.all([
    searchShiurim({ featured: true }, "recent", 4),
    searchShiurim({}, "recent", 8),
    searchShiurim({ uploaded: "month" }, "top", 6),
    siteTotal(),
    getCategoryTree(),
    getMyLibraryState(),
    supabase.from("series").select("slug, name, name_he, description").eq("featured", true).eq("is_active", true).limit(8),
  ]);

  return (
    <div>
      <section className="hero-boxes">
        <div className="hero-box">
          <h2>{t("home.parsha")}</h2>
          {parsha.length ? (
            parsha.map((p, i) => (
              <span key={p.slug}>{i > 0 && " – "}<Link href={`/categories/parsha/${p.slug}`}>{locale === "en" ? p.name : p.he}</Link></span>
            ))
          ) : (
            <Link href="/categories/parsha">{t("nav.parsha")}</Link>
          )}
        </div>
        <div className="hero-box">
          <h2>{t("home.dafYomi")}</h2>
          {daf ? (
            <Link href="/daf-yomi">{locale === "en" ? daf.masechta.name : daf.masechta.he} {daf.daf}</Link>
          ) : (
            <Link href="/daf-yomi">{t("nav.dafYomi")}</Link>
          )}
        </div>
        <div className="hero-box">
          <h2>{t("site.name")}</h2>
          <span className="muted">{t("home.welcome", { n: total.toLocaleString() })}</span>
        </div>
      </section>

      {featured.rows.length > 0 && (
        <>
          <h2>{t("home.featured")}</h2>
          <div className="shiur-list">
            {featured.rows.map((s) => <ShiurCard key={s.id} s={s} t={t} locale={locale} inPlayLater={lib.playLater.has(s.id)} />)}
          </div>
        </>
      )}

      <div className="two-col">
        <section>
          <div className="section-head">
            <h2>{t("home.recent")}</h2>
            <Link href="/search" className="small">{t("home.seeAll")} →</Link>
          </div>
          <div className="shiur-list">
            {recent.rows.map((s) => <ShiurCard key={s.id} s={s} t={t} locale={locale} inPlayLater={lib.playLater.has(s.id)} />)}
          </div>
        </section>
        <aside>
          <h2>{t("home.browseTopics")}</h2>
          <div className="shiur-list">
            {tree.roots.map((c) => (
              <Link key={c.id} href={`/categories/${c.slug}`} className="tile">
                <strong>{localName(c, locale)}</strong>
                <span className="count">{Number(c.n).toLocaleString()}</span>
              </Link>
            ))}
          </div>
          {popular.rows.length > 0 && (
            <>
              <h2>{t("home.popular")}</h2>
              <ol className="small">
                {popular.rows.map((s) => (
                  <li key={s.id} style={{ marginBottom: 6 }}>
                    <Link href={`/shiur/${s.id}/${s.slug}`}>{s.title}</Link>
                    <div className="muted">{s.speaker_name}</div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </aside>
      </div>

      {(featuredSeries.data?.length ?? 0) > 0 && (
        <>
          <h2>{t("home.featuredSeries")}</h2>
          <div className="grid small-cards">
            {featuredSeries.data!.map((s) => (
              <Link key={s.slug} className="tile" href={`/series/${s.slug}`}>
                <strong>{localName(s, locale)}</strong>
                {s.description && <span className="count">{s.description}</span>}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

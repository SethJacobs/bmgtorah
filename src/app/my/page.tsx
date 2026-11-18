import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { searchShiurim } from "@/lib/data";
import { ShiurCard } from "@/components/ShiurCard";
import { clock, localName } from "@/lib/format";

export const metadata = { title: "My Library" };

export default async function MyLibrary() {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="form-card" style={{ maxWidth: 520 }}>
        <h1>{t("library.title")}</h1>
        <p>{t("library.loginPrompt")}</p>
        <Link className="btn primary" href="/login">{t("nav.login")}</Link>
      </div>
    );
  }

  const [progress, later, follows] = await Promise.all([
    supabase.from("listening_progress").select("shiur_id, position_seconds, completed, updated_at").order("updated_at", { ascending: false }).limit(30),
    supabase.from("play_later").select("shiur_id, added_at").order("added_at", { ascending: false }).limit(50),
    supabase.from("follows").select("kind, target_id"),
  ]);

  // fetch the shiur rows we need in one go per list
  const byIds = async (ids: number[]) => {
    if (!ids.length) return [];
    const { rows } = await searchShiurim({ ids }, "recent", 100);
    const map = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => map.get(id)).filter((r): r is NonNullable<typeof r> => !!r); // keep list order
  };
  const inProgressRows = (progress.data ?? []).filter((p) => !p.completed && p.position_seconds > 30).slice(0, 6);
  const recentRows = (progress.data ?? []).slice(0, 10);
  const [inProgress, recent, playLater] = await Promise.all([
    byIds(inProgressRows.map((p) => p.shiur_id)),
    byIds(recentRows.map((p) => p.shiur_id)),
    byIds((later.data ?? []).map((p) => p.shiur_id)),
  ]);
  const posById = new Map<number, number>((progress.data ?? []).map((p: { shiur_id: number; position_seconds: number }) => [p.shiur_id, p.position_seconds]));

  const ids = (k: string) => (follows.data ?? []).filter((f) => f.kind === k).map((f) => f.target_id);
  const [fSpeakers, fSeries, fCats] = await Promise.all([
    ids("speaker").length ? supabase.from("speakers").select("id, slug, name, name_he").in("id", ids("speaker")) : Promise.resolve({ data: [] }),
    ids("series").length ? supabase.from("series").select("id, slug, name, name_he").in("id", ids("series")) : Promise.resolve({ data: [] }),
    ids("category").length ? supabase.from("categories").select("id, slug, name, name_he, parent:parent_id(slug)").in("id", ids("category")) : Promise.resolve({ data: [] }),
  ]);
  const playLaterSet = new Set(playLater.map((s) => s.id));

  return (
    <div>
      <h1>{t("library.title")}</h1>

      <h2>{t("library.inProgress")}</h2>
      {inProgress.length === 0 ? <p className="muted">{t("library.empty")}</p> : (
        <div className="shiur-list">
          {inProgress.map((s) => (
            <div key={s.id}>
              <ShiurCard s={s} t={t} locale={locale} inPlayLater={playLaterSet.has(s.id)} />
              <div className="muted small" style={{ marginTop: 2 }}>⏱ {clock(posById.get(s.id) ?? 0)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="two-col">
        <section>
          <h2>{t("library.playLater")}</h2>
          {playLater.length === 0 ? <p className="muted">{t("library.empty")}</p> : (
            <div className="shiur-list">{playLater.map((s) => <ShiurCard key={s.id} s={s} t={t} locale={locale} inPlayLater />)}</div>
          )}
          <h2>{t("library.recent")}</h2>
          {recent.length === 0 ? <p className="muted">{t("library.empty")}</p> : (
            <ul>{recent.map((s) => <li key={s.id}><Link href={`/shiur/${s.id}/${s.slug}`}>{s.title}</Link> <span className="muted small">– {s.speaker_name}</span></li>)}</ul>
          )}
        </section>
        <aside>
          <h2>{t("library.following")}</h2>
          {(fSpeakers.data ?? []).length + (fSeries.data ?? []).length + (fCats.data ?? []).length === 0 && <p className="muted">{t("library.empty")}</p>}
          <div className="shiur-list">
            {(fSpeakers.data ?? []).map((s) => <Link key={`s${s.id}`} className="tile" href={`/speakers/${s.slug}`}><strong>{localName(s, locale)}</strong></Link>)}
            {(fSeries.data ?? []).map((s) => <Link key={`r${s.id}`} className="tile" href={`/series/${s.slug}`}><strong>{localName(s, locale)}</strong><span className="count">{t("nav.series")}</span></Link>)}
            {(fCats.data ?? []).map((c) => {
              const parent = (c as unknown as { parent: { slug: string } | null }).parent;
              return <Link key={`c${c.id}`} className="tile" href={parent ? `/categories/${parent.slug}/${c.slug}` : `/categories/${c.slug}`}><strong>{localName(c, locale)}</strong><span className="count">{t("nav.topics")}</span></Link>;
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

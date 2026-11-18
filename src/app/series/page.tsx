import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { localName } from "@/lib/format";

export const metadata = { title: "Series" };

export default async function SeriesIndex() {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const [{ data: series }, { data: facets }] = await Promise.all([
    supabase.from("series").select("id, slug, name, name_he, description, featured, speakers(name)").eq("is_active", true).order("name"),
    supabase.rpc("shiur_facets", { f: {} }),
  ]);
  const counts = new Map<number, number>(
    ((facets ?? []) as { kind: string; id: number; n: number }[]).filter((f) => f.kind === "series").map((f) => [f.id, Number(f.n)]),
  );
  const list = (series ?? []).filter((s) => (counts.get(s.id) ?? 0) > 0);
  const featured = list.filter((s) => s.featured);

  const tile = (s: (typeof list)[number]) => (
    <Link key={s.id} className="tile" href={`/series/${s.slug}`}>
      <strong>{localName(s, locale)}</strong>
      {(s.speakers as unknown as { name: string } | null)?.name && <span className="count">{(s.speakers as unknown as { name: string }).name}</span>}
      <span className="count"> · {t("listing.count", { n: counts.get(s.id) ?? 0 })}</span>
    </Link>
  );

  return (
    <div>
      <h1>{t("nav.series")}</h1>
      {featured.length > 0 && (<><h2>{t("home.featuredSeries")}</h2><div className="grid small-cards">{featured.map(tile)}</div></>)}
      <h2>{t("nav.series")}</h2>
      <div className="grid small-cards">{list.map(tile)}</div>
    </div>
  );
}

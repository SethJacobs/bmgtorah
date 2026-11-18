import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { localName } from "@/lib/format";

export const metadata = { title: "Rebbeim" };

export default async function SpeakersIndex() {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const [{ data: speakers }, { data: facets }] = await Promise.all([
    supabase.from("speakers").select("id, slug, name, name_he, sort_name").eq("is_active", true),
    supabase.rpc("shiur_facets", { f: {} }),
  ]);
  const counts = new Map<number, number>(
    ((facets ?? []) as { kind: string; id: number; n: number }[]).filter((f) => f.kind === "speaker").map((f) => [f.id, Number(f.n)]),
  );
  const list = (speakers ?? [])
    .map((s) => ({ ...s, n: counts.get(s.id) ?? 0 }))
    .filter((s) => s.n > 0)
    .sort((a, b) => (a.sort_name ?? a.name).localeCompare(b.sort_name ?? b.name));

  // group A–Z by sort name (last name)
  const groups = new Map<string, typeof list>();
  for (const s of list) {
    const letter = (s.sort_name ?? s.name).replace(/^(Rabbi|Rav|Harav|R\.)\s+/i, "").charAt(0).toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), s]);
  }

  return (
    <div>
      <h1>{t("nav.speakers")}</h1>
      <p className="row small">{[...groups.keys()].map((l) => <a key={l} href={`#l-${l}`}>{l}</a>)}</p>
      {[...groups.entries()].map(([letter, items]) => (
        <section key={letter} id={`l-${letter}`}>
          <h2>{letter}</h2>
          <div className="grid small-cards">
            {items.map((s) => (
              <Link key={s.id} className="tile" href={`/speakers/${s.slug}`}>
                <strong>{localName(s, locale)}</strong>
                <span className="count">{t("listing.count", { n: s.n })}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

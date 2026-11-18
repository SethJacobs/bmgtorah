import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { localName } from "@/lib/format";

export const metadata = { title: "Locations" };

export default async function VenuesIndex() {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const [{ data: venues }, { data: facets }] = await Promise.all([
    supabase.from("venues").select("id, slug, name, name_he, location").order("name"),
    supabase.rpc("shiur_facets", { f: {} }),
  ]);
  const counts = new Map<number, number>(
    ((facets ?? []) as { kind: string; id: number; n: number }[]).filter((f) => f.kind === "venue").map((f) => [f.id, Number(f.n)]),
  );
  return (
    <div>
      <h1>{t("nav.venues")}</h1>
      <div className="grid small-cards">
        {(venues ?? []).filter((v) => counts.get(v.id)).map((v) => (
          <Link key={v.id} className="tile" href={`/venues/${v.slug}`}>
            <strong>{localName(v, locale)}</strong>
            <span className="count">{v.location} · {t("listing.count", { n: counts.get(v.id) ?? 0 })}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

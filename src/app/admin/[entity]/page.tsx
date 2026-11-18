import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { first, type SearchParams } from "@/lib/filters";
import { deleteEntity, saveEntity } from "../actions";
import type { DictKey } from "@/lib/i18n";

// One manager page for speakers, series and venues.
const CONFIG: Record<string, { title: string; fields: [string, string][] }> = {
  speakers: { title: "admin.speakers", fields: [["name", "admin.name"], ["name_he", "admin.nameHe"], ["sort_name", "Sort as (Last, First)"], ["photo_url", "Photo URL"], ["bio", "Bio"]] },
  series: { title: "admin.series", fields: [["name", "admin.name"], ["name_he", "admin.nameHe"], ["image_url", "Cover image URL"], ["description", "upload.description"]] },
  venues: { title: "admin.venues", fields: [["name", "admin.name"], ["name_he", "admin.nameHe"], ["location", "Location (city, state)"]] },
};

type Row = Record<string, string | number | boolean | null>;

export default async function EntityAdmin({ params, searchParams }: { params: Promise<{ entity: string }>; searchParams: Promise<SearchParams> }) {
  const [{ entity }, sp] = await Promise.all([params, searchParams]);
  if (!(entity in CONFIG)) notFound();
  const cfg = CONFIG[entity];
  const { t } = await getT();
  const label = (k: string) => (k.includes(".") ? t(k as DictKey) : k);
  const db = createAdminClient();
  const [{ data: rows }, { data: speakers }] = await Promise.all([
    db.from(entity).select("*").order("name"),
    entity === "series" ? db.from("speakers").select("id, name").order("sort_name") : Promise.resolve({ data: [] as { id: number; name: string }[] }),
  ]);

  const fields = (r?: Row) => (
    <>
      <input type="hidden" name="entity" value={entity} />
      {r && <input type="hidden" name="id" value={String(r.id)} />}
      <div className="form-grid">
        {cfg.fields.map(([k, l]) => (
          <div key={k}>
            <label>{label(l)}</label>
            {k === "bio" || k === "description"
              ? <textarea name={k} defaultValue={(r?.[k] as string) ?? ""} />
              : <input type="text" name={k} defaultValue={(r?.[k] as string) ?? ""} dir={k === "name_he" ? "rtl" : undefined} required={k === "name"} />}
          </div>
        ))}
        <div><label>{t("admin.slug")}</label><input type="text" name="slug" defaultValue={(r?.slug as string) ?? ""} dir="ltr" placeholder="auto" /></div>
        {entity === "series" && (
          <div>
            <label>{t("upload.speaker")}</label>
            <select name="speaker_id" defaultValue={String(r?.speaker_id ?? "")}>
              <option value="">{t("upload.none")}</option>
              {(speakers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {entity === "series" && <label className="row"><input type="checkbox" name="featured" defaultChecked={!!r?.featured} /> {t("upload.featured")}</label>}
        {entity !== "venues" && <label className="row"><input type="checkbox" name="archived" defaultChecked={r ? r.is_active === false : false} /> Archived (hide from lists)</label>}
      </div>
    </>
  );

  return (
    <section>
      <h2>{t(cfg.title as DictKey)}</h2>
      {first(sp.error) && <p className="error">{first(sp.error)}</p>}
      <details className="form-card" style={{ marginBottom: 16 }}>
        <summary className="btn gold">+ {t("admin.add")}</summary>
        <form action={saveEntity}>{fields()}<p><button className="btn primary">{t("admin.save")}</button></p></form>
      </details>
      <div className="shiur-list">
        {((rows ?? []) as Row[]).map((r) => (
          <details key={String(r.id)} className="card">
            <summary className="spread">
              <span><strong>{String(r.name)}</strong> {r.name_he && <span className="muted" dir="rtl">· {String(r.name_he)}</span>} {r.is_active === false && <span className="badge status-draft">archived</span>}</span>
              <span className="small muted ltr">/{entity}/{String(r.slug)}</span>
            </summary>
            <form action={saveEntity}>{fields(r)}<p><button className="btn primary">{t("admin.save")}</button></p></form>
            <form action={deleteEntity}>
              <input type="hidden" name="entity" value={entity} /><input type="hidden" name="id" value={String(r.id)} />
              <button className="btn small danger">{t("admin.delete")}</button>
            </form>
          </details>
        ))}
      </div>
    </section>
  );
}

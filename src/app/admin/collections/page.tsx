import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { first, type SearchParams } from "@/lib/filters";
import { collectionMember, deleteCollection, saveCollection } from "../actions";

type Col = { id: number; slug: string; name: string; name_he: string | null; description: string | null; speaker_id: number | null; category_id: number | null };

export default async function CollectionsAdmin({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { t } = await getT();
  const db = createAdminClient();
  const selected = Number(first(sp.id)) || null;
  const [{ data: cols }, { data: speakers }, { data: cats }] = await Promise.all([
    db.from("collections").select("*").order("name"),
    db.from("speakers").select("id, name").order("sort_name"),
    db.from("categories").select("id, name, parent_id").order("sort_order"),
  ]);
  const roots = (cats ?? []).filter((c) => !c.parent_id);
  const current = (cols as Col[] | null)?.find((c) => c.id === selected);
  const members = current
    ? (await db.from("collection_shiurim").select("shiur_id, position, shiurim(id, slug, title, speakers(name))").eq("collection_id", current.id).order("position")).data ?? []
    : [];

  const form = (c?: Col) => (
    <form action={saveCollection} className="form-grid">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div><label>{t("admin.name")}</label><input type="text" name="name" defaultValue={c?.name ?? ""} required /></div>
      <div><label>{t("admin.nameHe")}</label><input type="text" name="name_he" dir="rtl" defaultValue={c?.name_he ?? ""} /></div>
      <div>
        <label>Show on speaker page</label>
        <select name="speaker_id" defaultValue={String(c?.speaker_id ?? "")}>
          <option value="">{t("upload.none")}</option>
          {(speakers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label>Show on topic page</label>
        <select name="category_id" defaultValue={String(c?.category_id ?? "")}>
          <option value="">{t("upload.none")}</option>
          {roots.map((r) => (
            <optgroup key={r.id} label={r.name}>
              <option value={r.id}>{r.name} (all)</option>
              {(cats ?? []).filter((x) => x.parent_id === r.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div style={{ gridColumn: "1 / -1" }}><label>{t("upload.description")}</label><textarea name="description" defaultValue={c?.description ?? ""} /></div>
      <div><label>{t("admin.slug")}</label><input type="text" name="slug" dir="ltr" defaultValue={c?.slug ?? ""} placeholder="auto" /></div>
      <div style={{ alignSelf: "end" }}><button className="btn primary">{t("admin.save")}</button></div>
    </form>
  );

  return (
    <section className="two-col">
      <div>
        {current ? (
          <>
            <h2>{current.name} <Link className="small" href={`/collections/${current.slug}`}>↗</Link></h2>
            {form(current)}
            <h3 style={{ marginTop: 18 }}>Shiurim in this collection ({members.length})</h3>
            <form action={collectionMember} className="row" style={{ margin: "8px 0" }}>
              <input type="hidden" name="collection_id" value={current.id} />
              <input type="text" name="shiur_ids" placeholder="Shiur IDs or links, e.g. 120 121 /shiur/122" style={{ flex: 1 }} />
              <button className="btn">{t("admin.add")}</button>
            </form>
            <table className="data">
              <tbody>
                {members.map((m) => {
                  const s = m.shiurim as unknown as { id: number; slug: string; title: string; speakers: { name: string } | null };
                  return (
                    <tr key={m.shiur_id}>
                      <td><Link href={`/shiur/${s.id}/${s.slug}`}>{s.title}</Link> <span className="small muted">– {s.speakers?.name}</span></td>
                      <td>
                        <form action={collectionMember}>
                          <input type="hidden" name="collection_id" value={current.id} />
                          <input type="hidden" name="shiur_id" value={s.id} />
                          <button className="btn small danger" name="op" value="remove">✕</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <form action={deleteCollection} style={{ marginTop: 14 }}>
              <input type="hidden" name="id" value={current.id} />
              <button className="btn small danger">{t("admin.delete")}</button>
            </form>
          </>
        ) : (
          <>
            <h2>+ {t("admin.collections")}</h2>
            {first(sp.error) && <p className="error">{first(sp.error)}</p>}
            {form()}
          </>
        )}
      </div>
      <aside>
        <h2>{t("admin.collections")}</h2>
        <p><Link className="btn small gold" href="/admin/collections">+ {t("admin.add")}</Link></p>
        <ul>{(cols as Col[] | null ?? []).map((c) => <li key={c.id}><Link href={`/admin/collections?id=${c.id}`}>{c.name}</Link></li>)}</ul>
      </aside>
    </section>
  );
}

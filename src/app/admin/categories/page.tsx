import { createAdminClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { first, type SearchParams } from "@/lib/filters";
import { deleteCategory, saveCategory } from "../actions";

type Cat = { id: number; parent_id: number | null; slug: string; name: string; name_he: string | null; aliases: string[]; sort_order: number };

export default async function CategoriesAdmin({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { t } = await getT();
  const { data } = await createAdminClient().from("categories").select("*").order("sort_order").order("name");
  const cats = (data ?? []) as Cat[];
  const roots = cats.filter((c) => !c.parent_id);

  const form = (c: Partial<Cat>, parentId: number | null) => (
    <form action={saveCategory} className="form-grid">
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <div><label>{t("admin.name")}</label><input type="text" name="name" defaultValue={c.name ?? ""} required /></div>
      <div><label>{t("admin.nameHe")}</label><input type="text" name="name_he" dir="rtl" defaultValue={c.name_he ?? ""} /></div>
      <div><label>Other spellings (comma separated)</label><input type="text" name="aliases" defaultValue={(c.aliases ?? []).join(", ")} /></div>
      <div className="row">
        <div style={{ flex: 1 }}><label>{t("admin.slug")}</label><input type="text" name="slug" dir="ltr" defaultValue={c.slug ?? ""} placeholder="auto" /></div>
        <div style={{ width: 90 }}><label>Order</label><input type="text" name="sort_order" defaultValue={String(c.sort_order ?? 0)} /></div>
      </div>
      <div>
        <label>{t("admin.parent")}</label>
        <select name="parent_id" defaultValue={String(parentId ?? "")}>
          <option value="">— top level —</option>
          {roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <div style={{ alignSelf: "end" }}><button className="btn primary">{t("admin.save")}</button></div>
    </form>
  );

  return (
    <section>
      <h2>{t("admin.categories")}</h2>
      {first(sp.error) && <p className="error">{first(sp.error)}</p>}
      <details className="form-card" style={{ marginBottom: 16 }}>
        <summary className="btn gold">+ {t("admin.add")}</summary>
        {form({}, null)}
      </details>
      {roots.map((root) => (
        <details key={root.id} className="card" style={{ marginBottom: 10 }}>
          <summary><strong>{root.name}</strong> <span className="muted" dir="rtl">{root.name_he}</span> <span className="small muted">({cats.filter((c) => c.parent_id === root.id).length})</span></summary>
          {form(root, null)}
          <h3 style={{ marginTop: 14 }}>Sub-topics</h3>
          <details style={{ margin: "8px 0" }}><summary className="btn small">+ {t("admin.add")}</summary>{form({}, root.id)}</details>
          <table className="data">
            <tbody>
              {cats.filter((c) => c.parent_id === root.id).map((c) => (
                <tr key={c.id}>
                  <td>
                    <details>
                      <summary>{c.name} <span className="muted" dir="rtl">{c.name_he}</span> {c.aliases.length > 0 && <span className="small muted">({c.aliases.join(", ")})</span>}</summary>
                      {form(c, root.id)}
                      <form action={deleteCategory}><input type="hidden" name="id" value={c.id} /><button className="btn small danger">{t("admin.delete")}</button></form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </section>
  );
}

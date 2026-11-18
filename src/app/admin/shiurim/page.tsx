import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/format";
import { first, type SearchParams } from "@/lib/filters";
import { requireRole, hasRole } from "@/lib/auth";
import { deleteShiur, setFeatured } from "../actions";

export default async function AdminShiurim({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { profile } = await requireRole("editor");
  const { t, locale } = await getT();
  const q = first(sp.q) ?? "";
  const status = first(sp.status) ?? "";
  const page = Math.max(1, Number(first(sp.page) ?? 1));
  let query = createAdminClient()
    .from("shiurim")
    .select("id, slug, title, status, featured, play_count, created_at, speakers(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  if (q) query = query.ilike("title", `%${q}%`);
  if (status) query = query.eq("status", status);
  const { data, count } = await query;

  return (
    <section>
      <form className="row" style={{ marginBottom: 12 }}>
        <input type="search" name="q" defaultValue={q} placeholder={t("search.placeholder")} style={{ flex: 1 }} />
        <select name="status" defaultValue={status} style={{ width: 200 }}>
          <option value="">{t("filter.all")}</option>
          {["published", "pending", "draft", "rejected"].map((s) => <option key={s} value={s}>{t(`status.${s}` as never)}</option>)}
        </select>
        <button className="btn">{t("search.button")}</button>
      </form>
      <p className="muted small">{count ?? 0}</p>
      <table className="data">
        <thead><tr><th>ID</th><th>{t("upload.titleField")}</th><th>{t("upload.speaker")}</th><th></th><th>★</th><th>▶</th><th></th></tr></thead>
        <tbody>
          {(data ?? []).map((s) => (
            <tr key={s.id}>
              <td className="small muted">{s.id}</td>
              <td><Link href={`/shiur/${s.id}/${s.slug}`}>{s.title}</Link><div className="small muted">{formatDate(s.created_at, locale)}</div></td>
              <td className="small">{(s.speakers as unknown as { name: string } | null)?.name}</td>
              <td><span className={`badge status-${s.status}`}>{t(`status.${s.status}` as never)}</span></td>
              <td>
                <form action={setFeatured}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="featured" value={s.featured ? "false" : "true"} />
                  <button className="btn small" title={t("upload.featured")}>{s.featured ? "★" : "☆"}</button>
                </form>
              </td>
              <td className="small">{s.play_count}</td>
              <td className="row">
                <Link className="btn small" href={`/upload?edit=${s.id}`}>{t("shiur.edit")}</Link>
                {hasRole(profile, "editor") && (
                  <form action={deleteShiur}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn small danger">{t("admin.delete")}</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        {page > 1 && <Link className="btn" href={`?q=${encodeURIComponent(q)}&status=${status}&page=${page - 1}`}>{t("common.prev")}</Link>}
        {(count ?? 0) > page * 50 && <Link className="btn" href={`?q=${encodeURIComponent(q)}&status=${status}&page=${page + 1}`}>{t("common.next")}</Link>}
      </div>
    </section>
  );
}

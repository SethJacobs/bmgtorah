import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatDuration, mediaUrl } from "@/lib/format";
import { reviewShiur } from "./actions";

export const metadata = { title: "Review queue" };

export default async function ReviewQueue() {
  const { t, locale } = await getT();
  const db = createAdminClient();
  const { data: pending } = await db
    .from("shiurim")
    .select("id, slug, title, media_key, external_url, duration_seconds, created_at, uploaded_by, speakers(name), series(name)")
    .eq("status", "pending").order("created_at");
  const uploaderIds = [...new Set((pending ?? []).map((p) => p.uploaded_by).filter(Boolean))] as string[];
  const { data: uploaders } = uploaderIds.length
    ? await db.from("profiles").select("id, display_name, email").in("id", uploaderIds)
    : { data: [] };
  const who = new Map((uploaders ?? []).map((u) => [u.id, u.display_name || u.email]));

  return (
    <section>
      <h2>{t("admin.review")} ({pending?.length ?? 0})</h2>
      {!pending?.length && <p className="muted">{t("admin.queueEmpty")}</p>}
      <div className="shiur-list">
        {(pending ?? []).map((s) => (
          <div key={s.id} className="card">
            <div className="spread">
              <div>
                <strong><Link href={`/shiur/${s.id}/${s.slug}`}>{s.title}</Link></strong>
                <div className="small muted">
                  {(s.speakers as unknown as { name: string } | null)?.name}
                  {(s.series as unknown as { name: string } | null)?.name && ` · ${(s.series as unknown as { name: string }).name}`}
                  {s.duration_seconds ? ` · ${formatDuration(s.duration_seconds)}` : ""}
                  {` · ${formatDate(s.created_at, locale)}`}
                  {s.uploaded_by && ` · ${who.get(s.uploaded_by) ?? ""}`}
                </div>
              </div>
              <Link className="btn small" href={`/upload?edit=${s.id}`}>{t("shiur.edit")}</Link>
            </div>
            {s.media_key && /\.(mp3|m4a|aac|ogg|wav)$/i.test(s.media_key) && <audio controls preload="none" src={mediaUrl(s.media_key)} style={{ width: "100%", marginTop: 8 }} />}
            {s.external_url && <p className="small"><a href={s.external_url} target="_blank" rel="noreferrer">{s.external_url}</a></p>}
            <form action={reviewShiur} className="row" style={{ marginTop: 8 }}>
              <input type="hidden" name="id" value={s.id} />
              <button className="btn gold" name="decision" value="approve">✓ {t("admin.approve")}</button>
              <input type="text" name="note" placeholder={t("admin.rejectReason")} style={{ flex: 1, minWidth: 180 }} />
              <button className="btn danger" name="decision" value="reject">{t("admin.reject")}</button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}

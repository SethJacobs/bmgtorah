import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { first, type SearchParams } from "@/lib/filters";
import { saveUser } from "../actions";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Users" };

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const { t } = await getT();
  const db = createAdminClient();
  const q = first(sp.q) ?? "";
  let query = db.from("profiles").select("*").order("role", { ascending: false }).order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`email.ilike.%${q}%,display_name.ilike.%${q}%`);
  const [{ data: users }, { data: speakers }, { data: links }] = await Promise.all([
    query,
    db.from("speakers").select("id, name").order("sort_name"),
    db.from("uploader_speakers").select("user_id, speaker_id"),
  ]);
  const assigned = (uid: string) => new Set((links ?? []).filter((l) => l.user_id === uid).map((l) => l.speaker_id));

  return (
    <section>
      <h2>{t("admin.users")}</h2>
      <div className="notice small">
        <strong>Roles:</strong> <em>listener</em> – saves &amp; follows · <em>uploader</em> – uploads for the speakers you tick below
        (or any speaker) · <em>editor</em> – uploads anything, approves the review queue, manages topics/series ·
        <em> admin</em> – editor + manages users. People appear here after they sign in once.
      </div>
      <form className="row" style={{ margin: "10px 0" }}>
        <input type="search" name="q" defaultValue={q} placeholder="email or name" style={{ flex: 1 }} />
        <button className="btn">{t("search.button")}</button>
      </form>
      <div className="shiur-list">
        {((users ?? []) as Profile[]).map((u) => {
          const mine = assigned(u.id);
          return (
            <details key={u.id} className="card">
              <summary className="spread">
                <span><strong>{u.display_name}</strong> <span className="muted small ltr">{u.email}</span></span>
                <span className="badge">{u.role}{u.role === "uploader" && !u.requires_review ? " · trusted" : ""}</span>
              </summary>
              <form action={saveUser}>
                <input type="hidden" name="id" value={u.id} />
                <div className="form-grid">
                  <div>
                    <label>{t("admin.role")}</label>
                    <select name="role" defaultValue={u.role}>
                      {["listener", "uploader", "editor", "admin"].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="row"><input type="checkbox" name="requires_review" defaultChecked={u.requires_review} /> {t("admin.requiresReview")}</label>
                    <label className="row"><input type="checkbox" name="can_upload_any_speaker" defaultChecked={u.can_upload_any_speaker} /> {t("admin.anySpeaker")}</label>
                  </div>
                </div>
                <label>{t("admin.assigned")}</label>
                <div className="topic-picker"><div className="opts">
                  {(speakers ?? []).map((s) => (
                    <label key={s.id}><input type="checkbox" name="speaker_ids" value={s.id} defaultChecked={mine.has(s.id)} /> {s.name}</label>
                  ))}
                </div></div>
                <p><button className="btn primary">{t("admin.save")}</button></p>
              </form>
            </details>
          );
        })}
      </div>
    </section>
  );
}

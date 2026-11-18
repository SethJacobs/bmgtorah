import Link from "next/link";
import { redirect } from "next/navigation";
import { allowedSpeakerIds, getSession, hasRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getCategoryTree } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import { first, type SearchParams } from "@/lib/filters";
import { UploadForm, type Initial } from "./UploadForm";

export const metadata = { title: "Upload" };

export default async function UploadPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { t } = await getT();
  const { user, profile } = await getSession();
  if (!user) redirect("/login");
  if (!profile || !hasRole(profile, "uploader")) {
    return <div className="form-card" style={{ maxWidth: 560 }}><h1>{t("upload.title")}</h1><p>{t("upload.notAllowed")}</p></div>;
  }

  const db = createAdminClient();
  const allowed = await allowedSpeakerIds(profile);
  let speakersQ = db.from("speakers").select("id, name").eq("is_active", true).order("sort_name");
  if (allowed) speakersQ = speakersQ.in("id", allowed.length ? allowed : [-1]);
  const [speakers, series, venues, tree] = await Promise.all([
    speakersQ,
    db.from("series").select("id, name, speaker_id").eq("is_active", true).order("name"),
    db.from("venues").select("id, name").order("name"),
    getCategoryTree(),
  ]);

  let initial: Initial | undefined;
  const editId = Number(first(sp.edit));
  if (editId) {
    const { data: s } = await db.from("shiurim").select("*").eq("id", editId).maybeSingle();
    if (!s) redirect("/upload");
    if (!hasRole(profile, "editor") && s.uploaded_by !== user.id) redirect("/upload");
    const [{ data: cats }, { data: srcs }] = await Promise.all([
      db.from("shiur_categories").select("category_id").eq("shiur_id", editId),
      db.from("shiur_sources").select("id, label, file_key").eq("shiur_id", editId),
    ]);
    initial = {
      id: s.id, title: s.title, title_he: s.title_he ?? "", description: s.description ?? "",
      speaker_id: s.speaker_id, series_id: s.series_id, venue_id: s.venue_id, recorded_on: s.recorded_on ?? "",
      language: s.language, media_type: s.media_type, media_key: s.media_key, external_url: s.external_url ?? "",
      duration_seconds: s.duration_seconds, file_size_bytes: s.file_size_bytes, featured: s.featured, status: s.status,
      category_ids: (cats ?? []).map((c) => c.category_id), sources: srcs ?? [],
    };
  }

  const topics = tree.roots.map((r) => ({
    id: r.id, name: r.name, name_he: r.name_he,
    children: r.children.map((c) => ({ id: c.id, name: c.name, name_he: c.name_he })),
  }));

  return (
    <div>
      <div className="spread">
        <h1>{initial ? t("upload.edit") : t("upload.title")}</h1>
        <Link href="/upload/mine" className="btn">{t("upload.mine")}</Link>
      </div>
      {profile.requires_review && !hasRole(profile, "editor") && <p className="notice">{t("upload.pendingNote")}</p>}
      <UploadForm
        speakers={speakers.data ?? []}
        series={series.data ?? []}
        venues={venues.data ?? []}
        topics={topics}
        initial={initial}
        isEditor={hasRole(profile, "editor")}
        needsReview={profile.requires_review && !hasRole(profile, "editor")}
        canAddSpeaker={hasRole(profile, "editor") || profile.can_upload_any_speaker}
        mediaBase={process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? ""}
      />
    </div>
  );
}

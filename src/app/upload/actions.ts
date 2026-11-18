"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { canUploadFor, getSession, hasRole } from "@/lib/auth";
import { slugify } from "@/lib/format";
import type { Lang, MediaType, ShiurStatus } from "@/lib/types";

export type ShiurInput = {
  id?: number;
  title: string;
  title_he?: string;
  description?: string;
  speaker_id: number;
  series_id?: number | null;
  venue_id?: number | null;
  recorded_on?: string | null;
  language: Lang;
  media_type: MediaType;
  media_key?: string | null;
  external_url?: string | null;
  duration_seconds?: number | null;
  file_size_bytes?: number | null;
  category_ids: number[];
  sources: { id?: number; label: string; file_key: string }[];
  featured?: boolean;
  intent: "draft" | "submit";
};

export async function saveShiur(input: ShiurInput): Promise<{ ok: true; id: number; status: ShiurStatus } | { ok: false; error: string }> {
  const { user, profile } = await getSession();
  if (!user || !profile || !hasRole(profile, "uploader")) return { ok: false, error: "Not allowed" };

  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Title is required" };
  if (!Number.isInteger(input.speaker_id)) return { ok: false, error: "Choose a speaker" };
  if (!(await canUploadFor(profile, input.speaker_id))) return { ok: false, error: "You can't upload for this speaker" };
  if (input.intent === "submit" && !input.media_key && !input.external_url) return { ok: false, error: "Add a file or a link" };
  if (input.external_url && !/^https?:\/\//i.test(input.external_url)) return { ok: false, error: "Link must start with http(s)://" };

  const db = createAdminClient();
  const isEditor = hasRole(profile, "editor");

  type Existing = { id: number; uploaded_by: string | null; status: ShiurStatus };
  let existing: Existing | null = null;
  if (input.id) {
    const { data } = await db.from("shiurim").select("id, uploaded_by, status").eq("id", input.id).maybeSingle();
    if (!data) return { ok: false, error: "Shiur not found" };
    if (!isEditor && data.uploaded_by !== user.id) return { ok: false, error: "Not your shiur" };
    existing = data as Existing;
  }

  // Decide where it lands
  let status: ShiurStatus;
  if (input.intent === "draft") status = "draft";
  else if (isEditor || !profile.requires_review) status = "published";
  else status = "pending";

  const row = {
    slug: slugify(title),
    title,
    title_he: input.title_he?.trim() || null,
    description: input.description?.trim() || null,
    speaker_id: input.speaker_id,
    series_id: input.series_id || null,
    venue_id: input.venue_id || null,
    recorded_on: input.recorded_on || null,
    language: input.language,
    media_type: input.media_type,
    media_key: input.media_key || null,
    external_url: input.external_url?.trim() || null,
    duration_seconds: input.duration_seconds ? Math.round(input.duration_seconds) : null,
    file_size_bytes: input.file_size_bytes || null,
    status,
    review_note: null,
    ...(isEditor ? { featured: !!input.featured, approved_by: status === "published" ? user.id : null } : {}),
  };

  let id: number;
  if (existing) {
    const { error } = await db.from("shiurim").update(row).eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    id = existing.id;
  } else {
    const { data, error } = await db.from("shiurim").insert({ ...row, uploaded_by: user.id }).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Could not save" };
    id = data.id;
  }

  // topics: replace
  await db.from("shiur_categories").delete().eq("shiur_id", id);
  const cats = [...new Set(input.category_ids.filter(Number.isInteger))];
  if (cats.length) await db.from("shiur_categories").insert(cats.map((category_id) => ({ shiur_id: id, category_id })));

  // source sheets: keep the ones still listed, add new ones
  const keepIds = input.sources.filter((s) => s.id).map((s) => s.id!);
  const del = db.from("shiur_sources").delete().eq("shiur_id", id);
  await (keepIds.length ? del.not("id", "in", `(${keepIds.join(",")})`) : del);
  const fresh = input.sources.filter((s) => !s.id && s.file_key);
  if (fresh.length) await db.from("shiur_sources").insert(fresh.map((s) => ({ shiur_id: id, label: s.label || "Mareh Mekomos", file_key: s.file_key })));

  revalidatePath("/");
  return { ok: true, id, status };
}

export async function addSpeaker(name: string, name_he?: string) {
  const { profile } = await getSession();
  if (!profile || !(hasRole(profile, "editor") || profile.can_upload_any_speaker)) return { ok: false as const, error: "Not allowed" };
  const clean = name.trim();
  if (!clean) return { ok: false as const, error: "Name required" };
  const db = createAdminClient();
  let slug = slugify(clean);
  const { data: clash } = await db.from("speakers").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const last = clean.replace(/^(Rabbi|Rav|Harav|R\.|Reb|Mr\.|Dr\.)\s+/i, "");
  const parts = last.split(/\s+/);
  const sort_name = parts.length > 1 ? `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}` : last;
  const { data, error } = await db.from("speakers").insert({ slug, name: clean, name_he: name_he?.trim() || null, sort_name }).select("id, name").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Could not add" };
  return { ok: true as const, speaker: data };
}

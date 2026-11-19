"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/format";

export type SeriesEntry = { id: number; title: string; status: string; media_key: string | null };

export async function listSeriesShiurim(seriesId: number): Promise<SeriesEntry[]> {
  await requireRole("editor");
  const { data } = await createAdminClient()
    .from("shiurim").select("id, title, status, media_key").eq("series_id", seriesId).order("id");
  return (data ?? []) as SeriesEntry[];
}

type AttachInput = {
  seriesId: number;
  shiurId: number | null; // existing entry to attach to, or null to create one
  title: string;
  mediaKey: string;
  mediaType: "audio" | "video";
  size: number;
  duration: number | null;
};

/** Puts an uploaded file on an existing entry (and publishes it), or creates a new published entry. */
export async function attachFile(input: AttachInput): Promise<{ ok: true; id: number; created: boolean } | { ok: false; error: string }> {
  const { user } = await requireRole("editor");
  const db = createAdminClient();
  const media = {
    media_type: input.mediaType,
    media_key: input.mediaKey,
    file_size_bytes: input.size,
    external_url: null,
    status: "published" as const,
    approved_by: user.id,
    ...(input.duration ? { duration_seconds: Math.round(input.duration) } : {}),
  };

  if (input.shiurId) {
    const { data: s } = await db.from("shiurim").select("id, series_id").eq("id", input.shiurId).maybeSingle();
    if (!s || s.series_id !== input.seriesId) return { ok: false, error: "Entry not found in this series" };
    const { error } = await db.from("shiurim").update(media).eq("id", input.shiurId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    return { ok: true, id: input.shiurId, created: false };
  }

  // New entry: take speaker from the series; venue, language and topics from an existing shiur in it
  const { data: series } = await db.from("series").select("id, speaker_id").eq("id", input.seriesId).maybeSingle();
  if (!series?.speaker_id) return { ok: false, error: "This series has no speaker set" };
  const { data: sample } = await db.from("shiurim")
    .select("id, venue_id, language").eq("series_id", input.seriesId).order("id").limit(1).maybeSingle();
  const title = input.title.trim();
  const { data: row, error } = await db.from("shiurim").insert({
    ...media,
    slug: slugify(title),
    title,
    speaker_id: series.speaker_id,
    series_id: input.seriesId,
    venue_id: sample?.venue_id ?? null,
    language: sample?.language ?? "en",
    description: /simplified/i.test(title) ? "Simplified chazara of the shiur." : null,
    uploaded_by: user.id,
  }).select("id").single();
  if (error || !row) return { ok: false, error: error?.message ?? "Could not create entry" };

  if (sample) {
    const { data: cats } = await db.from("shiur_categories").select("category_id").eq("shiur_id", sample.id);
    if (cats?.length) await db.from("shiur_categories").insert(cats.map((c) => ({ shiur_id: row.id, category_id: c.category_id })));
  }
  revalidatePath("/");
  return { ok: true, id: row.id, created: true };
}

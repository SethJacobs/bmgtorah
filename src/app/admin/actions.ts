"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { deleteObject } from "@/lib/r2";
import { slugify } from "@/lib/format";

const str = (fd: FormData, k: string) => (fd.get(k) as string | null)?.trim() ?? "";
const num = (fd: FormData, k: string) => { const v = Number(fd.get(k)); return Number.isFinite(v) && v > 0 ? v : null; };
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

// ---------- review queue / shiurim ----------
export async function reviewShiur(fd: FormData) {
  const { user } = await requireRole("editor");
  const id = num(fd, "id");
  const decision = str(fd, "decision");
  if (!id) return;
  await createAdminClient().from("shiurim").update(
    decision === "approve"
      ? { status: "published", approved_by: user.id, review_note: null }
      : { status: "rejected", review_note: str(fd, "note") || null },
  ).eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function setFeatured(fd: FormData) {
  await requireRole("editor");
  const id = num(fd, "id");
  if (id) await createAdminClient().from("shiurim").update({ featured: bool(fd, "featured") }).eq("id", id);
  revalidatePath("/admin/shiurim");
}

export async function deleteShiur(fd: FormData) {
  await requireRole("editor");
  const id = num(fd, "id");
  if (!id) return;
  const db = createAdminClient();
  const [{ data: s }, { data: srcs }] = await Promise.all([
    db.from("shiurim").select("media_key").eq("id", id).maybeSingle(),
    db.from("shiur_sources").select("file_key").eq("shiur_id", id),
  ]);
  await db.from("shiurim").delete().eq("id", id);
  // remove the files from R2 too (ignore storage errors)
  const keys = [s?.media_key, ...(srcs ?? []).map((x) => x.file_key)].filter(Boolean) as string[];
  await Promise.allSettled(keys.map(deleteObject));
  revalidatePath("/admin/shiurim");
}

// ---------- speakers / series / venues ----------
const ENTITY_FIELDS = {
  speakers: ["name", "name_he", "sort_name", "bio", "photo_url"],
  series: ["name", "name_he", "description", "image_url"],
  venues: ["name", "name_he", "location"],
} as const;
export type Entity = keyof typeof ENTITY_FIELDS;

export async function saveEntity(fd: FormData) {
  await requireRole("editor");
  const entity = str(fd, "entity") as Entity;
  if (!(entity in ENTITY_FIELDS)) return;
  const row: Record<string, unknown> = {};
  for (const k of ENTITY_FIELDS[entity]) row[k] = str(fd, k) || null;
  if (!row.name) return;
  row.slug = str(fd, "slug") || slugify(row.name as string);
  if (entity === "series") { row.speaker_id = num(fd, "speaker_id"); row.featured = bool(fd, "featured"); row.is_active = !fd.has("archived"); }
  if (entity === "speakers") row.is_active = !fd.has("archived");
  const db = createAdminClient();
  const id = num(fd, "id");
  const { error } = id ? await db.from(entity).update(row).eq("id", id) : await db.from(entity).insert(row);
  if (error) redirect(`/admin/${entity}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/${entity}`);
}

export async function deleteEntity(fd: FormData) {
  await requireRole("admin");
  const entity = str(fd, "entity") as Entity;
  const id = num(fd, "id");
  if (!(entity in ENTITY_FIELDS) || !id) return;
  const { error } = await createAdminClient().from(entity).delete().eq("id", id);
  if (error) redirect(`/admin/${entity}?error=${encodeURIComponent("Still in use by shiurim — archive it instead.")}`);
  revalidatePath(`/admin/${entity}`);
}

// ---------- categories ----------
export async function saveCategory(fd: FormData) {
  await requireRole("editor");
  const name = str(fd, "name");
  if (!name) return;
  const row = {
    name,
    name_he: str(fd, "name_he") || null,
    slug: str(fd, "slug") || slugify(name),
    parent_id: num(fd, "parent_id"),
    aliases: str(fd, "aliases").split(",").map((s) => s.trim()).filter(Boolean),
    sort_order: Number(fd.get("sort_order")) || 0,
  };
  const db = createAdminClient();
  const id = num(fd, "id");
  const { error } = id ? await db.from("categories").update(row).eq("id", id) : await db.from("categories").insert(row);
  if (error) redirect(`/admin/categories?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/categories");
  revalidatePath("/categories");
}

export async function deleteCategory(fd: FormData) {
  await requireRole("admin");
  const id = num(fd, "id");
  if (id) await createAdminClient().from("categories").delete().eq("id", id);
  revalidatePath("/admin/categories");
}

// ---------- collections ----------
export async function saveCollection(fd: FormData) {
  await requireRole("editor");
  const name = str(fd, "name");
  if (!name) return;
  const row = {
    name, name_he: str(fd, "name_he") || null, description: str(fd, "description") || null,
    slug: str(fd, "slug") || slugify(name),
    speaker_id: num(fd, "speaker_id"), category_id: num(fd, "category_id"),
  };
  const db = createAdminClient();
  const id = num(fd, "id");
  const res = id ? await db.from("collections").update(row).eq("id", id).select("id").single()
                 : await db.from("collections").insert(row).select("id").single();
  if (res.error) redirect(`/admin/collections?error=${encodeURIComponent(res.error.message)}`);
  redirect(`/admin/collections?id=${res.data.id}`);
}

export async function collectionMember(fd: FormData) {
  await requireRole("editor");
  const collection_id = num(fd, "collection_id");
  const db = createAdminClient();
  if (!collection_id) return;
  if (str(fd, "op") === "remove") {
    await db.from("collection_shiurim").delete().eq("collection_id", collection_id).eq("shiur_id", num(fd, "shiur_id")!);
  } else {
    // accepts shiur ids or shiur URLs, separated by spaces/commas/new lines
    const ids = str(fd, "shiur_ids").split(/[\s,]+/).map((x) => Number(x.match(/(?:shiur\/)?(\d+)/)?.[1])).filter(Boolean);
    if (ids.length) await db.from("collection_shiurim").upsert(ids.map((shiur_id, i) => ({ collection_id, shiur_id, position: i })));
  }
  revalidatePath("/admin/collections");
}

export async function deleteCollection(fd: FormData) {
  await requireRole("editor");
  const id = num(fd, "id");
  if (id) await createAdminClient().from("collections").delete().eq("id", id);
  redirect("/admin/collections");
}

// ---------- users ----------
export async function saveUser(fd: FormData) {
  await requireRole("admin");
  const id = str(fd, "id");
  if (!id) return;
  const role = str(fd, "role");
  if (!["listener", "uploader", "editor", "admin"].includes(role)) return;
  const db = createAdminClient();
  await db.from("profiles").update({
    role,
    requires_review: bool(fd, "requires_review"),
    can_upload_any_speaker: bool(fd, "can_upload_any_speaker"),
  }).eq("id", id);
  const speakerIds = fd.getAll("speaker_ids").map(Number).filter(Boolean);
  await db.from("uploader_speakers").delete().eq("user_id", id);
  if (speakerIds.length) await db.from("uploader_speakers").insert(speakerIds.map((speaker_id) => ({ user_id: id, speaker_id })));
  revalidatePath("/admin/users");
}

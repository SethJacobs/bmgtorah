import type { Lang } from "./types";

export function mediaUrl(key: string | null | undefined) {
  if (!key) return "";
  if (/^https?:\/\//.test(key)) return key;
  return `${process.env.NEXT_PUBLIC_MEDIA_BASE_URL}/${key}`;
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function clock(seconds: number) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? h + ":" : ""}${mm}:${String(s).padStart(2, "0")}`;
}

const LOCALE_TAG: Record<string, string> = { en: "en-US", he: "he-IL", yi: "yi" };

export function formatDate(iso: string | null | undefined, locale: string = "en") {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  try {
    return d.toLocaleDateString(LOCALE_TAG[locale] ?? "en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
}

export function slugify(s: string) {
  const out = s.toLowerCase().replace(/['"]/g, "").replace(/&/g, "and")
    .replace(/[^a-z0-9֐-׿]+/g, "-").replace(/^-+|-+$/g, "");
  return out.slice(0, 80) || "shiur";
}

export function shiurHref(s: { id: number; slug: string }) {
  return `/shiur/${s.id}/${encodeURIComponent(s.slug)}`;
}

/** Show Hebrew name when the UI is Hebrew/Yiddish and one exists */
export function localName(item: { name: string; name_he?: string | null }, locale: string) {
  return (locale === "he" || locale === "yi") && item.name_he ? item.name_he : item.name;
}

export const LANG_LABEL: Record<Lang, string> = { en: "English", he: "עברית", yi: "אידיש" };

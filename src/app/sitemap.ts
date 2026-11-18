import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [shiurim, speakers, series] = await Promise.all([
    supabase.from("shiurim").select("id, slug, updated_at").eq("status", "published").order("id", { ascending: false }).limit(45000),
    supabase.from("speakers").select("slug"),
    supabase.from("series").select("slug"),
  ]);
  return [
    { url: site, changeFrequency: "daily", priority: 1 },
    ...(speakers.data ?? []).map((s) => ({ url: `${site}/speakers/${s.slug}` })),
    ...(series.data ?? []).map((s) => ({ url: `${site}/series/${s.slug}` })),
    ...(shiurim.data ?? []).map((s) => ({ url: `${site}/shiur/${s.id}/${encodeURIComponent(s.slug)}`, lastModified: s.updated_at })),
  ];
}

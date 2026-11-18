// Podcast / RSS feeds: /feed/speaker/<slug>, /feed/series/<slug>, /feed/category/<id>, /feed/all/latest
// Works in Apple Podcasts, Spotify (submit once), Pocket Casts, and any RSS reader.
import { createClient } from "@supabase/supabase-js";
import { mediaUrl } from "@/lib/format";
import type { ShiurRow } from "@/lib/types";

export const revalidate = 900; // cache feeds for 15 minutes

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function mimeFor(key: string) {
  const ext = key.split(".").pop()?.toLowerCase();
  return ({ mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", mp4: "video/mp4", webm: "video/webm", pdf: "application/pdf" } as Record<string, string>)[ext ?? ""] ?? "audio/mpeg";
}

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; key: string }> }) {
  const { kind, key } = await params;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  let title = "BMGTorah – Latest Shiurim";
  let description = "Shiurim from Beis Medrash Gevoha, Lakewood.";
  let link = site;
  let image = `${site}/podcast-cover.png`;
  const filter: Record<string, unknown> = {};

  if (kind === "speaker") {
    const { data } = await supabase.from("speakers").select("id, name, bio, photo_url, slug").eq("slug", decodeURIComponent(key)).maybeSingle();
    if (!data) return new Response("Not found", { status: 404 });
    filter.speaker = data.id; title = `${data.name} – BMGTorah`; description = data.bio || description;
    link = `${site}/speakers/${data.slug}`; if (data.photo_url) image = data.photo_url;
  } else if (kind === "series") {
    const { data } = await supabase.from("series").select("id, name, description, image_url, slug").eq("slug", decodeURIComponent(key)).maybeSingle();
    if (!data) return new Response("Not found", { status: 404 });
    filter.series = data.id; title = `${data.name} – BMGTorah`; description = data.description || description;
    link = `${site}/series/${data.slug}`; if (data.image_url) image = data.image_url;
  } else if (kind === "category") {
    const { data } = await supabase.from("categories").select("id, name").eq("id", Number(key)).maybeSingle();
    if (!data) return new Response("Not found", { status: 404 });
    filter.category = data.id; title = `${data.name} – BMGTorah`; link = `${site}/categories`;
  } else if (kind !== "all") {
    return new Response("Not found", { status: 404 });
  }

  const { data } = await supabase.rpc("search_shiurim", { f: filter, sort: "recent", lim: 100, off: 0 });
  const rows = ((data ?? []) as ShiurRow[]).filter((r) => r.media_key && r.media_type !== "text");

  const items = rows.map((r) => {
    const url = mediaUrl(r.media_key);
    const date = new Date(r.published_at ?? r.recorded_on ?? Date.now()).toUTCString();
    const page = `${site}/shiur/${r.id}/${encodeURIComponent(r.slug)}`;
    return `
    <item>
      <title>${esc(r.title)}</title>
      <itunes:author>${esc(r.speaker_name)}</itunes:author>
      <description>${esc([r.speaker_name, r.series_name, r.categories.map((c) => c.name).join(", ")].filter(Boolean).join(" · "))}</description>
      <link>${page}</link>
      <guid isPermaLink="false">bmgtorah-${r.id}</guid>
      <pubDate>${date}</pubDate>
      <enclosure url="${esc(url)}" length="0" type="${mimeFor(r.media_key!)}"/>
      ${r.duration_seconds ? `<itunes:duration>${r.duration_seconds}</itunes:duration>` : ""}
    </item>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(title)}</title>
    <link>${esc(link)}</link>
    <atom:link href="${esc(`${site}/feed/${kind}/${key}`)}" rel="self" type="application/rss+xml"/>
    <description>${esc(description)}</description>
    <language>en</language>
    <itunes:author>Beis Medrash Gevoha</itunes:author>
    <itunes:owner><itunes:name>BMGTorah</itunes:name><itunes:email>${esc(process.env.PODCAST_OWNER_EMAIL ?? "")}</itunes:email></itunes:owner>
    <itunes:image href="${esc(image)}"/>
    <itunes:category text="Religion &amp; Spirituality"><itunes:category text="Judaism"/></itunes:category>
    <itunes:explicit>false</itunes:explicit>${items}
  </channel>
</rss>`;

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}

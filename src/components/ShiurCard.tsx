import Link from "next/link";
import type { ShiurRow } from "@/lib/types";
import type { TFn } from "@/lib/i18n";
import { formatDate, formatDuration, LANG_LABEL, localName, mediaUrl, shiurHref } from "@/lib/format";
import { ShiurActions } from "./ShiurActions";

export function toPlayable(s: Pick<ShiurRow, "id" | "slug" | "title" | "speaker_name" | "media_type" | "media_key" | "external_url">) {
  return {
    id: s.id,
    title: s.title,
    speaker_name: s.speaker_name,
    media_type: s.media_type,
    // external links (YouTube etc.) open on the shiur page instead of the audio player
    src: s.media_key ? mediaUrl(s.media_key) : s.media_type === "text" ? s.external_url ?? "" : "",
    href: shiurHref(s),
  };
}

export function ShiurCard({ s, t, locale, inPlayLater }: { s: ShiurRow; t: TFn; locale: string; inPlayLater?: boolean }) {
  const title = (locale !== "en" && s.title_he) || s.title;
  return (
    <article className="shiur-card">
      <div className="spread">
        <h3><Link href={shiurHref(s)}>{title}</Link></h3>
        {s.media_type !== "audio" && <span className="badge">{t(s.media_type === "video" ? "filter.video" : "filter.text")}</span>}
      </div>
      <div className="meta">
        <span><Link href={`/speakers/${s.speaker_slug}`}><b>{s.speaker_name}</b></Link></span>
        {(s.recorded_on || s.published_at) && <span>{formatDate(s.recorded_on ?? s.published_at, locale)}</span>}
        {s.series_name && <span>{t("shiur.series")}: <Link href={`/series/${s.series_slug}`}>{s.series_name}</Link></span>}
        {s.venue_name && <span>{t("shiur.venue")}: <Link href={`/venues/${s.venue_slug}`}>{s.venue_name}</Link></span>}
        {s.duration_seconds ? <span>{formatDuration(s.duration_seconds)}</span> : null}
        {s.language !== "en" && <span>{LANG_LABEL[s.language]}</span>}
      </div>
      {s.categories.length > 0 && (
        <div className="tags">
          {s.categories.map((c) => (
            <Link key={c.id} className="tag" href={c.parent_slug ? `/categories/${c.parent_slug}/${c.slug}` : `/categories/${c.slug}`}>
              {c.parent_name ? `${c.parent_name}: ` : ""}{localName(c, locale)}
            </Link>
          ))}
        </div>
      )}
      <ShiurActions shiur={toPlayable(s)} downloadUrl={s.media_key ? mediaUrl(s.media_key) : undefined} inPlayLater={inPlayLater} compact />
    </article>
  );
}

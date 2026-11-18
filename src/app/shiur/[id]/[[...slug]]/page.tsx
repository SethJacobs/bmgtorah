import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { getSession, hasRole } from "@/lib/auth";
import { getMyLibraryState, searchShiurim } from "@/lib/data";
import { formatDate, formatDuration, LANG_LABEL, localName, mediaUrl, shiurHref } from "@/lib/format";
import { ShiurActions } from "@/components/ShiurActions";
import { toPlayable } from "@/components/ShiurCard";
import type { ShiurRow } from "@/lib/types";

type Props = { params: Promise<{ id: string; slug?: string[] }> };

async function load(idStr: string) {
  const id = Number(idStr);
  if (!Number.isInteger(id)) return null;
  const supabase = await createClient();
  // RLS: everyone sees published; uploaders see their own; editors see all
  const { data: row } = await supabase.from("shiurim").select("id, status, description, uploaded_by").eq("id", id).maybeSingle();
  if (!row) return null;
  const { rows } = await searchShiurim({ id, status: row.status }, "recent", 1);
  if (!rows[0]) return null;
  return { shiur: rows[0], status: row.status as string, description: row.description as string | null, uploadedBy: row.uploaded_by as string | null };
}

export async function generateMetadata({ params }: Props) {
  const data = await load((await params).id);
  if (!data) return { title: "Shiur" };
  const s = data.shiur;
  return {
    title: `${s.title} – ${s.speaker_name}`,
    description: data.description ?? `${s.title} by ${s.speaker_name}`,
    openGraph: { title: s.title, description: s.speaker_name, type: "music.song" as const },
  };
}

function youtubeEmbed(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  const v = url.match(/vimeo\.com\/(\d+)/);
  if (v) return `https://player.vimeo.com/video/${v[1]}`;
  return null;
}

export default async function ShiurPage({ params }: Props) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();
  const { shiur: s, status, description, uploadedBy } = data;
  const { t, locale } = await getT();
  const supabase = await createClient();
  const [{ profile, user }, lib, sources] = await Promise.all([
    getSession(),
    getMyLibraryState(),
    supabase.from("shiur_sources").select("id, label, file_key").eq("shiur_id", s.id).order("id"),
  ]);
  const canEdit = hasRole(profile, "editor") || (!!user && uploadedBy === user.id);

  const firstCat = s.categories[0];
  const [moreSpeaker, moreSeries, moreTopic] = await Promise.all([
    searchShiurim({ speaker: s.speaker_id, exclude: s.id }, "recent", 4),
    s.series_id ? searchShiurim({ series: s.series_id, exclude: s.id }, "recent", 4) : Promise.resolve({ rows: [] as ShiurRow[], total: 0 }),
    firstCat ? searchShiurim({ category: firstCat.id, exclude: s.id }, "top", 4) : Promise.resolve({ rows: [] as ShiurRow[], total: 0 }),
  ]);

  const embed = s.external_url ? youtubeEmbed(s.external_url) : null;
  const file = mediaUrl(s.media_key);
  const isPdf = !!s.media_key && /\.pdf$/i.test(s.media_key);

  return (
    <div className="shiur-page two-col">
      <article>
        {status !== "published" && <p className="notice"><span className={`badge status-${status}`}>{t(`status.${status}` as never)}</span></p>}
        <h1>{(locale !== "en" && s.title_he) || s.title}</h1>
        {s.title_he && locale === "en" && <p className="muted" lang="he" dir="rtl">{s.title_he}</p>}

        {embed && <div className="video-wrap"><iframe src={embed} allowFullScreen title={s.title} /></div>}
        {!embed && s.media_type === "video" && file && <div className="video-wrap"><video src={file} controls preload="metadata" /></div>}
        {isPdf && <div className="video-wrap" style={{ aspectRatio: "3 / 4" }}><iframe src={file} title={s.title} /></div>}

        <ShiurActions shiur={toPlayable(s)} downloadUrl={file || undefined} inPlayLater={lib.playLater.has(s.id)} />

        <dl className="detail-table">
          <dt>{t("shiur.speaker")}</dt><dd><Link href={`/speakers/${s.speaker_slug}`}>{s.speaker_name}</Link></dd>
          {(s.recorded_on || s.published_at) && <><dt>{t("shiur.date")}</dt><dd>{formatDate(s.recorded_on ?? s.published_at, locale)}</dd></>}
          {s.series_name && <><dt>{t("shiur.series")}</dt><dd><Link href={`/series/${s.series_slug}`}>{s.series_name}</Link></dd></>}
          {s.venue_name && <><dt>{t("shiur.venue")}</dt><dd><Link href={`/venues/${s.venue_slug}`}>{s.venue_name}</Link></dd></>}
          {s.duration_seconds ? <><dt>{t("shiur.duration")}</dt><dd>{formatDuration(s.duration_seconds)}</dd></> : null}
          <dt>{t("shiur.language")}</dt><dd>{LANG_LABEL[s.language]}</dd>
          {s.categories.length > 0 && (
            <><dt>{t("shiur.topics")}</dt><dd className="tags">
              {s.categories.map((c) => (
                <Link key={c.id} className="tag" href={c.parent_slug ? `/categories/${c.parent_slug}/${c.slug}` : `/categories/${c.slug}`}>
                  {c.parent_name ? `${c.parent_name}: ` : ""}{localName(c, locale)}
                </Link>
              ))}
            </dd></>
          )}
          {s.play_count > 0 && <><dt>&nbsp;</dt><dd className="muted small">{t("shiur.plays", { n: s.play_count.toLocaleString() })}</dd></>}
        </dl>

        {description && <p style={{ whiteSpace: "pre-line" }}>{description}</p>}

        {(sources.data?.length ?? 0) > 0 && (
          <section>
            <h2>{t("shiur.sources")}</h2>
            <ul>
              {sources.data!.map((src) => (
                <li key={src.id}><a href={mediaUrl(src.file_key)} target="_blank" rel="noreferrer">📄 {src.label}</a></li>
              ))}
            </ul>
          </section>
        )}

        {canEdit && <p><Link className="btn" href={`/upload?edit=${s.id}`}>✎ {t("shiur.edit")}</Link></p>}
      </article>

      <aside>
        {[
          { title: t("shiur.moreFromSpeaker"), rows: moreSpeaker.rows, href: `/speakers/${s.speaker_slug}` },
          { title: t("shiur.moreFromSeries"), rows: moreSeries.rows, href: s.series_slug ? `/series/${s.series_slug}` : "" },
          { title: t("shiur.moreInTopic"), rows: moreTopic.rows, href: firstCat ? (firstCat.parent_slug ? `/categories/${firstCat.parent_slug}/${firstCat.slug}` : `/categories/${firstCat.slug}`) : "" },
        ].filter((b) => b.rows.length).map((b) => (
          <section key={b.title}>
            <div className="section-head"><h2>{b.title}</h2>{b.href && <Link className="small" href={b.href}>{t("home.seeAll")}</Link>}</div>
            <ul className="small" style={{ paddingInlineStart: 18 }}>
              {b.rows.map((r) => (
                <li key={r.id} style={{ marginBottom: 6 }}>
                  <Link href={shiurHref(r)}>{r.title}</Link>
                  <div className="muted">{r.speaker_name}{r.duration_seconds ? ` · ${formatDuration(r.duration_seconds)}` : ""}</div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </aside>
    </div>
  );
}


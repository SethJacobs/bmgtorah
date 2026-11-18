import type { TFn } from "@/lib/i18n";

/** RSS + "open in podcast app" links for a speaker / series / topic feed */
export function Subscribe({ feedPath, t }: { feedPath: string; t: TFn }) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const abs = `${site}${feedPath}`;
  const podcast = abs.replace(/^https?:\/\//, "podcast://");
  return (
    <details className="subscribe">
      <summary className="btn">🔔 {t("follow.subscribe")}</summary>
      <div className="card small" style={{ marginTop: 6 }}>
        <div><a href={podcast}>🎧 {t("follow.podcast")}</a></div>
        <div><a href={feedPath}>📡 {t("follow.rss")}</a></div>
        <div className="muted ltr" style={{ wordBreak: "break-all" }}>{abs}</div>
      </div>
    </details>
  );
}

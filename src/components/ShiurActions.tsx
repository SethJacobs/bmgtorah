"use client";
import { useState } from "react";
import Link from "next/link";
import { usePlayer } from "./player/PlayerProvider";
import { useT } from "./I18nProvider";
import type { PlayableShiur } from "@/lib/types";

/** Play / Play later / Download buttons used on cards and the shiur page */
export function ShiurActions({
  shiur, downloadUrl, inPlayLater = false, compact = false,
}: {
  shiur: PlayableShiur;
  downloadUrl?: string;
  inPlayLater?: boolean;
  compact?: boolean;
}) {
  const { t } = useT();
  const player = usePlayer();
  const [saved, setSaved] = useState(inPlayLater);
  const isText = shiur.media_type === "text";

  async function togglePlayLater() {
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "play_later", id: shiur.id, on: !saved }),
    });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (res.ok) setSaved(!saved);
  }

  return (
    <div className={compact ? "actions compact" : "actions"}>
      {isText ? (
        <a className="btn primary" href={shiur.src || shiur.href} target="_blank" rel="noreferrer">{t("shiur.openText")}</a>
      ) : shiur.src ? (
        <button className="btn primary" onClick={() => player.play(shiur)}>
          ▶ {t("shiur.playNow")}
        </button>
      ) : (
        <Link className="btn primary" href={shiur.href}>{t("shiur.watch")}</Link>
      )}
      <button className={saved ? "btn on" : "btn"} onClick={togglePlayLater}>
        {saved ? "✓ " + t("shiur.inPlayLater") : "+ " + t("shiur.playLater")}
      </button>
      {downloadUrl && (
        <a className="btn" href={`/api/download/${shiur.id}`} download>
          ⤓ {t("shiur.download")}
        </a>
      )}
    </div>
  );
}

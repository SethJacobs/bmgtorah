"use client";
import Link from "next/link";
import { usePlayer } from "./PlayerProvider";
import { useT } from "../I18nProvider";
import { clock } from "@/lib/format";

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

export function PlayerBar() {
  const p = usePlayer();
  const { t } = useT();
  if (!p.current) return null;
  const nextRate = RATES[(RATES.indexOf(p.rate) + 1) % RATES.length] ?? 1;

  return (
    <div className="player" role="region" aria-label="Audio player">
      <div className="player-info">
        <Link href={p.current.href} className="player-title">{p.current.title}</Link>
        <span className="muted">{p.current.speaker_name}</span>
      </div>
      <div className="player-controls">
        <button onClick={() => p.skip(-15)} aria-label={t("player.back15")} title={t("player.back15")}>↺15</button>
        <button className="player-main" onClick={p.toggle} aria-label={p.playing ? t("player.pause") : t("player.play")}>
          {p.playing ? "❚❚" : "▶"}
        </button>
        <button onClick={() => p.skip(30)} aria-label={t("player.fwd30")} title={t("player.fwd30")}>30↻</button>
        <button onClick={() => p.setRate(nextRate)} title={t("player.speed")}>{p.rate}×</button>
      </div>
      <div className="player-seek" dir="ltr">
        <span>{clock(p.position)}</span>
        <input
          type="range" min={0} max={p.duration || 0} step={1} value={Math.min(p.position, p.duration || 0)}
          onChange={(e) => p.seek(Number(e.target.value))} aria-label="Seek"
        />
        <span>{clock(p.duration)}</span>
      </div>
      <button className="player-close" onClick={p.close} aria-label={t("player.close")}>✕</button>
    </div>
  );
}

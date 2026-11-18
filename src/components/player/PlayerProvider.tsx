"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { PlayableShiur } from "@/lib/types";

type PlayerState = {
  current: PlayableShiur | null;
  playing: boolean;
  position: number;
  duration: number;
  rate: number;
  play: (s: PlayableShiur) => void;
  toggle: () => void;
  seek: (t: number) => void;
  skip: (delta: number) => void;
  setRate: (r: number) => void;
  close: () => void;
};

const Ctx = createContext<PlayerState | null>(null);
const POS_KEY = (id: number) => `bmg_pos_${id}`;
const RATE_KEY = "bmg_rate";
const LAST_KEY = "bmg_last";

function safeGet(k: string) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function safeSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* private mode etc. */ }
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const counted = useRef<Set<number>>(new Set());
  const lastSync = useRef(0);
  const [current, setCurrent] = useState<PlayableShiur | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);

  // restore last shiur (paused) and speed after a page reload
  useEffect(() => {
    const r = Number(safeGet(RATE_KEY));
    if (r) setRateState(r);
    const last = safeGet(LAST_KEY);
    if (last) {
      try { setCurrent(JSON.parse(last)); } catch { /* ignore */ }
    }
  }, []);

  const syncProgress = useCallback((s: PlayableShiur, pos: number, completed = false) => {
    safeSet(POS_KEY(s.id), String(Math.floor(pos)));
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiurId: s.id, position: Math.floor(pos), completed }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  const play = useCallback((s: PlayableShiur) => {
    const a = audioRef.current;
    if (!a) return;
    if (current?.id !== s.id) {
      if (current) syncProgress(current, a.currentTime);
      setCurrent(s);
      safeSet(LAST_KEY, JSON.stringify(s));
      a.src = s.src;
      const saved = Number(safeGet(POS_KEY(s.id)) ?? 0);
      a.currentTime = saved > 5 ? saved - 3 : 0;
    }
    a.playbackRate = rate;
    a.play().catch(() => setPlaying(false));
    if (!counted.current.has(s.id)) {
      counted.current.add(s.id);
      fetch("/api/play", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shiurId: s.id }) }).catch(() => {});
    }
  }, [current, rate, syncProgress]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (!a.src) { play(current); return; }
    if (a.paused) a.play().catch(() => {}); else a.pause();
  }, [current, play]);

  const seek = useCallback((t: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = Math.max(0, Math.min(t, a.duration || t));
  }, []);

  const skip = useCallback((d: number) => {
    const a = audioRef.current;
    if (a) seek(a.currentTime + d);
  }, [seek]);

  const setRate = useCallback((r: number) => {
    setRateState(r);
    safeSet(RATE_KEY, String(r));
    if (audioRef.current) audioRef.current.playbackRate = r;
  }, []);

  const close = useCallback(() => {
    const a = audioRef.current;
    if (a && current) { syncProgress(current, a.currentTime); a.pause(); a.removeAttribute("src"); a.load(); }
    setCurrent(null);
    setPlaying(false);
    try { localStorage.removeItem(LAST_KEY); } catch { /* ignore */ }
  }, [current, syncProgress]);

  return (
    <Ctx.Provider value={{ current, playing, position, duration, rate, play, toggle, seek, skip, setRate, close }}>
      {children}
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); if (current && audioRef.current) syncProgress(current, audioRef.current.currentTime); }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setPosition(t);
          if (current && Date.now() - lastSync.current > 15000) {
            lastSync.current = Date.now();
            syncProgress(current, t);
          }
        }}
        onEnded={() => { if (current) syncProgress(current, 0, true); setPlaying(false); }}
      />
    </Ctx.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}

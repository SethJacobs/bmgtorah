"use client";
import { useEffect, useMemo, useState } from "react";
import { attachFile, listSeriesShiurim, type SeriesEntry } from "./actions";

type Item = {
  file: File;
  title: string;
  match: SeriesEntry | null;
  state: "ready" | "skip" | "uploading" | "saving" | "done" | "error";
  progress: number;
  note?: string;
  resultId?: number;
};

// Loose name match: ignores case, punctuation and spacing (file names can't hold ":" or quotes)
const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9֐-׿]+/g, "");
const titleOf = (f: File) => f.name.replace(/\.[^.]+$/, "").trim();
const typeOf = (f: File) => f.type || (/\.mp3$/i.test(f.name) ? "audio/mpeg" : /\.m4a$/i.test(f.name) ? "audio/mp4" : /\.mp4$/i.test(f.name) ? "video/mp4" : "");

function durationOf(file: File, video: boolean): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement(video ? "video" : "audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => { resolve(isFinite(el.duration) ? el.duration : null); URL.revokeObjectURL(el.src); };
    el.onerror = () => resolve(null);
    el.src = URL.createObjectURL(file);
  });
}

async function putFile(file: File, contentType: string, onProgress: (p: number) => void) {
  const res = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType, size: file.size, purpose: "shiur" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not start upload");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", data.url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Storage error ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
  return data.key as string;
}

export default function BulkUpload({ series }: { series: { id: number; label: string }[] }) {
  const [seriesId, setSeriesId] = useState<number>(series[0]?.id ?? 0);
  const [entries, setEntries] = useState<SeriesEntry[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (seriesId) listSeriesShiurim(seriesId).then(setEntries);
  }, [seriesId]);

  const byName = useMemo(() => new Map(entries.map((e) => [norm(e.title), e])), [entries]);

  // Re-match whenever the series' entries change
  useEffect(() => {
    setItems((prev) => prev.map((it) => it.state === "ready" || it.state === "skip" ? classify(it.file) : it));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byName]);

  function classify(file: File): Item {
    const title = titleOf(file);
    const match = byName.get(norm(title)) ?? null;
    if (!typeOf(file)) return { file, title, match, state: "skip", progress: 0, note: "Not an audio/video file" };
    if (match?.media_key && match.status === "published") return { file, title, match, state: "skip", progress: 0, note: "Already on the site" };
    return { file, title, match, state: "ready", progress: 0 };
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const fresh = Array.from(list).filter((f) => !/\.(part|ytdl)$/i.test(f.name));
    setItems((prev) => {
      const seen = new Set(prev.map((p) => p.file.name));
      const added = fresh.filter((f) => !seen.has(f.name)).map(classify);
      return [...prev, ...added].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
    });
  }

  const update = (name: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.file.name === name ? { ...it, ...patch } : it)));

  async function runAll() {
    setRunning(true);
    for (const it of items) {
      if (it.state !== "ready" && it.state !== "error") continue;
      const name = it.file.name;
      try {
        const ct = typeOf(it.file);
        const isVideo = ct.startsWith("video/");
        update(name, { state: "uploading", progress: 0, note: undefined });
        const [key, duration] = await Promise.all([
          putFile(it.file, ct, (p) => update(name, { progress: p })),
          durationOf(it.file, isVideo),
        ]);
        update(name, { state: "saving" });
        const r = await attachFile({
          seriesId, shiurId: it.match?.id ?? null, title: it.title, mediaKey: key,
          mediaType: isVideo ? "video" : "audio", size: it.file.size, duration,
        });
        if (!r.ok) throw new Error(r.error);
        update(name, { state: "done", resultId: r.id, note: r.created ? "New entry — set its date from ✎ Edit" : "Attached & published" });
      } catch (e) {
        update(name, { state: "error", note: (e as Error).message });
      }
    }
    setRunning(false);
    listSeriesShiurim(seriesId).then(setEntries);
  }

  const counts = items.reduce((c, it) => ({ ...c, [it.state]: (c[it.state] ?? 0) + 1 }), {} as Record<string, number>);
  const todo = (counts.ready ?? 0) + (counts.error ?? 0);

  return (
    <div>
      <p>
        <label>Series{" "}
          <select value={seriesId} onChange={(e) => setSeriesId(Number(e.target.value))} disabled={running}>
            {series.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>{" "}
        <span className="small muted">{entries.length} entries in this series</span>
      </p>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        style={{ display: "block", border: "2px dashed var(--border, #ccc)", borderRadius: 8, padding: 24, textAlign: "center",
          background: dragging ? "rgba(0,0,0,0.04)" : undefined, cursor: "pointer" }}
      >
        <strong>Drop files here</strong> or click to choose (you can select many at once)
        <input type="file" multiple accept="audio/*,video/*,.mp3,.m4a,.mp4" style={{ display: "none" }}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} disabled={running} />
      </label>

      {items.length > 0 && (
        <>
          <p style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={runAll} disabled={running || !todo}>
              {running ? "Uploading…" : `Upload ${todo} file${todo === 1 ? "" : "s"}`}
            </button>{" "}
            <button className="btn" onClick={() => setItems([])} disabled={running}>Clear list</button>{" "}
            <span className="small muted">
              {counts.done ?? 0} done · {counts.skip ?? 0} skipped · {counts.error ?? 0} failed
            </span>
          </p>
          <p className="small muted">Keep this page open until everything says done.</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th align="left">File</th><th align="left">Goes to</th><th align="left">Status</th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.file.name} style={{ borderTop: "1px solid var(--border, #eee)" }}>
                  <td>{it.file.name} <span className="small muted">({(it.file.size / 1048576).toFixed(1)} MB)</span></td>
                  <td>{it.match ? <>#{it.match.id} {it.match.title}{it.match.status !== "published" ? <span className="small muted"> ({it.match.status})</span> : null}</> : <em>new entry</em>}</td>
                  <td>
                    {it.state === "ready" && "Ready"}
                    {it.state === "skip" && <span className="muted">Skipped</span>}
                    {it.state === "uploading" && `Uploading ${it.progress}%`}
                    {it.state === "saving" && "Saving…"}
                    {it.state === "done" && <>✓ <a href={`/shiur/${it.resultId}`} target="_blank" rel="noreferrer">View</a></>}
                    {it.state === "error" && <span style={{ color: "#b00" }}>✗ Failed</span>}
                    {it.note && <div className="small muted">{it.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

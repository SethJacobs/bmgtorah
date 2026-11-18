"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18nProvider";
import { addSpeaker, saveShiur, type ShiurInput } from "./actions";
import type { Lang, MediaType, ShiurStatus } from "@/lib/types";

type Opt = { id: number; name: string };
type Topic = { id: number; name: string; name_he: string | null; children: { id: number; name: string; name_he: string | null }[] };
type Source = { id?: number; label: string; file_key: string };

export type Initial = {
  id: number; title: string; title_he: string; description: string;
  speaker_id: number; series_id: number | null; venue_id: number | null; recorded_on: string;
  language: Lang; media_type: MediaType; media_key: string | null; external_url: string;
  duration_seconds: number | null; file_size_bytes: number | null; featured: boolean; status: ShiurStatus;
  category_ids: number[]; sources: Source[];
};

/** PUT a file to R2 through a signed URL, reporting progress */
async function uploadFile(file: File, purpose: "media" | "source", onProgress: (p: number) => void): Promise<string> {
  const res = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream", size: file.size, purpose }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", data.url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Storage error ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error — check the R2 CORS settings (see README)"));
    xhr.send(file);
  });
  return data.key as string;
}

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (!/^(audio|video)\//.test(file.type)) return resolve(null);
    const el = document.createElement(file.type.startsWith("video") ? "video" : "audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => { resolve(isFinite(el.duration) ? el.duration : null); URL.revokeObjectURL(el.src); };
    el.onerror = () => resolve(null);
    el.src = URL.createObjectURL(file);
  });
}

export function UploadForm({
  speakers: initialSpeakers, series, venues, topics, initial, isEditor, needsReview, canAddSpeaker, mediaBase,
}: {
  speakers: Opt[]; series: (Opt & { speaker_id: number | null })[]; venues: Opt[]; topics: Topic[];
  initial?: Initial; isEditor: boolean; needsReview: boolean; canAddSpeaker: boolean; mediaBase: string;
}) {
  const { t, locale } = useT();
  const router = useRouter();
  const [speakers, setSpeakers] = useState(initialSpeakers);
  const [f, setF] = useState({
    title: initial?.title ?? "",
    title_he: initial?.title_he ?? "",
    description: initial?.description ?? "",
    speaker_id: initial?.speaker_id ?? (initialSpeakers.length === 1 ? initialSpeakers[0].id : 0),
    series_id: initial?.series_id ?? 0,
    venue_id: initial?.venue_id ?? 0,
    recorded_on: initial?.recorded_on ?? new Date().toISOString().slice(0, 10),
    language: (initial?.language ?? "en") as Lang,
    media_type: (initial?.media_type ?? "audio") as MediaType,
    media_key: initial?.media_key ?? null as string | null,
    external_url: initial?.external_url ?? "",
    duration_seconds: initial?.duration_seconds ?? null as number | null,
    file_size_bytes: initial?.file_size_bytes ?? null as number | null,
    featured: initial?.featured ?? false,
  });
  const [cats, setCats] = useState<Set<number>>(new Set(initial?.category_ids ?? []));
  const [sources, setSources] = useState<Source[]>(initial?.sources ?? []);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [newSpeaker, setNewSpeaker] = useState<string | null>(null);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const tn = (x: { name: string; name_he: string | null }) => (locale !== "en" && x.name_he ? x.name_he : x.name);

  const allTopics = useMemo(() => topics.flatMap((r) => [
    { id: r.id, label: tn(r), root: "" },
    ...r.children.map((c) => ({ id: c.id, label: tn(c), root: tn(r), en: c.name, he: c.name_he ?? "" })),
  ]), [topics, locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const labelOf = (id: number) => { const x = allTopics.find((a) => a.id === id); return x ? (x.root ? `${x.root}: ${x.label}` : x.label) : String(id); };

  async function onMainFile(file: File | undefined) {
    if (!file) return;
    setError("");
    const type: MediaType = file.type.startsWith("video") ? "video" : file.type === "application/pdf" ? "text" : "audio";
    try {
      setProgress(0);
      const [key, dur] = await Promise.all([uploadFile(file, "media", setProgress), readDuration(file)]);
      setF((p) => ({
        ...p, media_key: key, media_type: type, duration_seconds: dur ?? p.duration_seconds, file_size_bytes: file.size,
        title: p.title || file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  async function onSourceFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    try {
      for (const file of Array.from(files)) {
        setProgress(0);
        const key = await uploadFile(file, "source", setProgress);
        setSources((s) => [...s, { label: file.name.replace(/\.[^.]+$/, ""), file_key: key }]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  async function createSpeaker() {
    if (!newSpeaker?.trim()) return;
    const res = await addSpeaker(newSpeaker);
    if (!res.ok) { setError(res.error); return; }
    setSpeakers((s) => [...s, res.speaker]);
    set("speaker_id", res.speaker.id);
    setNewSpeaker(null);
  }

  async function submit(intent: "draft" | "submit") {
    setBusy(true);
    setError("");
    const input: ShiurInput = {
      id: initial?.id,
      ...f,
      series_id: f.series_id || null,
      venue_id: f.venue_id || null,
      category_ids: [...cats],
      sources,
      intent,
    };
    const res = await saveShiur(input);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    router.push(res.status === "published" ? `/shiur/${res.id}` : `/upload/mine?saved=${res.id}`);
    router.refresh();
  }

  const q = topicFilter.trim().toLowerCase();
  const filtered = q ? allTopics.filter((x) => x.root && ([x.label, (x as { en?: string }).en ?? "", (x as { he?: string }).he ?? ""].some((s) => s.toLowerCase().includes(q)))) : [];
  const fileLabel = f.media_key ? f.media_key.split("/").pop() : null;

  return (
    <div className="form-card">
      {/* ---- file ---- */}
      <label>{t("upload.file")}</label>
      <input type="file" accept="audio/*,video/*,application/pdf" onChange={(e) => onMainFile(e.target.files?.[0])} disabled={progress !== null} />
      {fileLabel && <p className="small">✓ <a href={`${mediaBase}/${f.media_key}`} target="_blank" rel="noreferrer">{fileLabel}</a>{f.duration_seconds ? ` · ${Math.round(f.duration_seconds / 60)} min` : ""}</p>}
      {progress !== null && (
        <div><div className="small">{t("upload.uploading", { p: progress })}</div><div className="progress"><div style={{ width: `${progress}%` }} /></div></div>
      )}
      <label>{t("upload.orLink")}</label>
      <input type="url" dir="ltr" value={f.external_url} onChange={(e) => set("external_url", e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />

      {/* ---- details ---- */}
      <div className="form-grid">
        <div>
          <label>{t("upload.titleField")} *</label>
          <input type="text" value={f.title} onChange={(e) => set("title", e.target.value)} required />
        </div>
        <div>
          <label>{t("upload.titleHe")}</label>
          <input type="text" dir="rtl" lang="he" value={f.title_he} onChange={(e) => set("title_he", e.target.value)} />
        </div>
        <div>
          <label>{t("upload.speaker")} *</label>
          <select value={f.speaker_id} onChange={(e) => set("speaker_id", Number(e.target.value))}>
            <option value={0}>—</option>
            {speakers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {canAddSpeaker && (newSpeaker === null ? (
            <button type="button" className="btn small" style={{ marginTop: 6 }} onClick={() => setNewSpeaker("")}>+ {t("upload.newSpeaker")}</button>
          ) : (
            <div className="row" style={{ marginTop: 6 }}>
              <input type="text" value={newSpeaker} onChange={(e) => setNewSpeaker(e.target.value)} placeholder="Rabbi …" style={{ flex: 1 }} />
              <button type="button" className="btn small" onClick={createSpeaker}>{t("admin.add")}</button>
            </div>
          ))}
        </div>
        <div>
          <label>{t("upload.date")}</label>
          <input type="date" value={f.recorded_on} onChange={(e) => set("recorded_on", e.target.value)} />
        </div>
        <div>
          <label>{t("upload.series")}</label>
          <select value={f.series_id} onChange={(e) => set("series_id", Number(e.target.value))}>
            <option value={0}>{t("upload.none")}</option>
            {series
              .slice()
              .sort((a, b) => Number(b.speaker_id === f.speaker_id) - Number(a.speaker_id === f.speaker_id))
              .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label>{t("upload.venue")}</label>
          <select value={f.venue_id} onChange={(e) => set("venue_id", Number(e.target.value))}>
            <option value={0}>{t("upload.none")}</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label>{t("upload.language")}</label>
          <select value={f.language} onChange={(e) => set("language", e.target.value as Lang)}>
            <option value="en">English</option>
            <option value="he">עברית</option>
            <option value="yi">אידיש</option>
          </select>
        </div>
        <div>
          <label>{t("upload.type")}</label>
          <select value={f.media_type} onChange={(e) => set("media_type", e.target.value as MediaType)}>
            <option value="audio">{t("filter.audio")}</option>
            <option value="video">{t("filter.video")}</option>
            <option value="text">{t("filter.text")}</option>
          </select>
        </div>
      </div>

      <label>{t("upload.description")}</label>
      <textarea value={f.description} onChange={(e) => set("description", e.target.value)} />

      {/* ---- topics ---- */}
      <label>{t("upload.topics")}</label>
      <input type="search" placeholder={t("upload.filterTopics")} value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} style={{ marginBottom: 6 }} />
      <div className="topic-picker">
        {q ? (
          <div className="opts">
            {filtered.map((x) => (
              <label key={x.id}><input type="checkbox" checked={cats.has(x.id)} onChange={() => toggle(x.id)} /> {x.root}: {x.label}</label>
            ))}
          </div>
        ) : topics.map((r) => (
          <details key={r.id} open={r.children.some((c) => cats.has(c.id))}>
            <summary>{tn(r)} {r.children.filter((c) => cats.has(c.id)).length > 0 && <span className="badge">{r.children.filter((c) => cats.has(c.id)).length}</span>}</summary>
            <div className="opts">
              {r.children.map((c) => (
                <label key={c.id}><input type="checkbox" checked={cats.has(c.id)} onChange={() => toggle(c.id)} /> {tn(c)}</label>
              ))}
            </div>
          </details>
        ))}
      </div>
      {cats.size > 0 && (
        <div className="chips">{[...cats].map((id) => <span key={id} className="chip" onClick={() => toggle(id)}>{labelOf(id)} ✕</span>)}</div>
      )}

      {/* ---- sources ---- */}
      <label>{t("upload.sources")}</label>
      <input type="file" accept="application/pdf,image/*" multiple onChange={(e) => onSourceFiles(e.target.files)} disabled={progress !== null} />
      {sources.map((s, i) => (
        <div key={s.file_key} className="row" style={{ marginTop: 6 }}>
          <input type="text" value={s.label} onChange={(e) => setSources((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} style={{ flex: 1 }} />
          <button type="button" className="btn small danger" onClick={() => setSources((all) => all.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}

      {isEditor && (
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} /> {t("upload.featured")}
        </label>
      )}

      {error && <p className="error">{error}</p>}
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn gold" disabled={busy || progress !== null} onClick={() => submit("submit")}>
          {needsReview ? t("upload.submit") : t("upload.publish")}
        </button>
        <button className="btn" disabled={busy || progress !== null} onClick={() => submit("draft")}>{t("upload.saveDraft")}</button>
      </div>
    </div>
  );

  function toggle(id: number) {
    setCats((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
}

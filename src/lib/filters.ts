// Turns URL query params into the JSON filter that search_shiurim()/shiur_facets() expect.

export type SearchParams = Record<string, string | string[] | undefined>;

export const FILTER_KEYS = ["q", "type", "dur", "uploaded", "lang", "speaker", "series", "venue", "category"] as const;
export const PAGE_SIZE = 20;

const VALID: Record<string, RegExp> = {
  type: /^(audio|video|text)$/,
  dur: /^(short|medium|long)$/,
  uploaded: /^(today|week|month)$/,
  lang: /^(en|he|yi)$/,
  speaker: /^\d+$/,
  series: /^\d+$/,
  venue: /^\d+$/,
  category: /^\d+$/,
};

export function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** URL params win over nothing; `base` (e.g. the speaker of a speaker page) always wins. */
export function buildFilter(sp: SearchParams, base: Record<string, unknown> = {}) {
  const f: Record<string, unknown> = {};
  for (const key of FILTER_KEYS) {
    const v = first(sp[key])?.trim();
    if (!v) continue;
    if (key === "q") f.q = v.slice(0, 200);
    else if (VALID[key].test(v)) f[key] = /^\d+$/.test(v) ? Number(v) : v;
  }
  return { ...f, ...base };
}

export function pageFrom(sp: SearchParams) {
  const p = Number(first(sp.page) ?? 1);
  return Number.isFinite(p) && p > 0 ? Math.floor(p) : 1;
}

/** Same URL with some params changed (null removes). Resets page unless it is being set. */
export function withParams(path: string, sp: SearchParams, changes: Record<string, string | number | null>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = first(v);
    if (val) params.set(k, val);
  }
  if (!("page" in changes)) params.delete("page");
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === "") params.delete(k);
    else params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

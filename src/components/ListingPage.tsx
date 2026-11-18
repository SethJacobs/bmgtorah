import Link from "next/link";
import type { ReactNode } from "react";
import { buildFilter, first, pageFrom, PAGE_SIZE, withParams, type SearchParams } from "@/lib/filters";
import { getFacets, getMyLibraryState, searchShiurim } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import { localName } from "@/lib/format";
import type { Facet } from "@/lib/types";
import type { DictKey } from "@/lib/i18n";
import { ShiurCard } from "./ShiurCard";

type TabKey = "recent" | "top" | "featured" | "speakers" | "series" | "venues" | "topics" | "collections";

export type CollectionLink = { slug: string; name: string; name_he: string | null; n: number };

/**
 * The one page template behind every speaker, series, venue, topic, collection and search page —
 * same idea as YUTorah: tabs, filter pills, "search within", results, and facet counts.
 */
export async function ListingPage({
  path, searchParams, base = {}, header, hide = [], collections, defaultTab = "recent",
}: {
  path: string;
  searchParams: SearchParams;
  base?: Record<string, unknown>;
  header: ReactNode;
  hide?: TabKey[];
  collections?: CollectionLink[];
  defaultTab?: TabKey;
}) {
  const { t, locale } = await getT();
  const tab = (first(searchParams.tab) as TabKey) || defaultTab;
  const page = pageFrom(searchParams);
  const filter = buildFilter(searchParams, base);
  const isResults = tab === "recent" || tab === "top" || tab === "featured";

  const hasQuery = typeof filter.q === "string" && filter.q.length > 0;
  const sort = tab === "top" ? "top" : hasQuery && !first(searchParams.tab) ? "relevance" : "recent";
  const listFilter = tab === "featured" ? { ...filter, featured: true } : filter;

  const [{ rows, total }, facets, lib] = await Promise.all([
    isResults ? searchShiurim(listFilter, sort, PAGE_SIZE, (page - 1) * PAGE_SIZE) : Promise.resolve({ rows: [], total: 0 }),
    getFacets(filter),
    getMyLibraryState(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const facetTotal = facets.speakers.reduce((a, f) => a + Number(f.n), 0);

  const tabs: { key: TabKey; label: DictKey; show: boolean }[] = [
    { key: "recent", label: "tab.recent", show: true },
    { key: "top", label: "tab.top", show: true },
    { key: "featured", label: "tab.featured", show: true },
    { key: "speakers", label: "tab.speakers", show: facets.speakers.length > 0 },
    { key: "series", label: "tab.series", show: facets.series.length > 0 },
    { key: "venues", label: "tab.venues", show: facets.venues.length > 0 },
    { key: "topics", label: "tab.topics", show: facets.categories.length > 0 },
    { key: "collections", label: "tab.collections", show: !!collections?.length },
  ];

  const pill = (key: string, value: string | null, label: DictKey) => {
    const active = (first(searchParams[key]) ?? null) === value;
    return (
      <Link key={key + value} className={active ? "pill active" : "pill"} href={withParams(path, searchParams, { [key]: value })}>
        {t(label)}
      </Link>
    );
  };

  const activeFilters = ["type", "dur", "uploaded", "lang", "speaker", "series", "venue", "category", "q"].some((k) => first(searchParams[k]));

  return (
    <div>
      {header}

      <form action={path} className="within" role="search">
        <input type="search" name="q" defaultValue={first(searchParams.q) ?? ""} placeholder={t("search.within")} />
        {["type", "dur", "uploaded", "lang", "speaker", "series", "venue", "category"].map((k) =>
          first(searchParams[k]) ? <input key={k} type="hidden" name={k} value={first(searchParams[k])} /> : null)}
        <button className="btn">{t("search.button")}</button>
      </form>

      <nav className="tabs">
        {tabs.filter((x) => x.show && !hide.includes(x.key)).map((x) => (
          <Link key={x.key} className={tab === x.key ? "active" : ""} href={withParams(path, searchParams, { tab: x.key === defaultTab ? null : x.key })}>
            {t(x.label)}
          </Link>
        ))}
      </nav>

      {isResults && (
        <div className="filters">
          <div className="group"><span>{t("filter.type")}:</span>
            {pill("type", null, "filter.all")}{pill("type", "audio", "filter.audio")}{pill("type", "video", "filter.video")}{pill("type", "text", "filter.text")}
          </div>
          <div className="group"><span>{t("filter.duration")}:</span>
            {pill("dur", null, "filter.all")}{pill("dur", "short", "filter.short")}{pill("dur", "medium", "filter.medium")}{pill("dur", "long", "filter.long")}
          </div>
          <div className="group"><span>{t("filter.uploaded")}:</span>
            {pill("uploaded", null, "filter.all")}{pill("uploaded", "today", "filter.today")}{pill("uploaded", "week", "filter.week")}{pill("uploaded", "month", "filter.month")}
          </div>
          <div className="group"><span>{t("filter.language")}:</span>
            {pill("lang", null, "filter.all")}
            <Link className={first(searchParams.lang) === "en" ? "pill active" : "pill"} href={withParams(path, searchParams, { lang: "en" })}>English</Link>
            <Link className={first(searchParams.lang) === "he" ? "pill active" : "pill"} href={withParams(path, searchParams, { lang: "he" })}>עברית</Link>
            <Link className={first(searchParams.lang) === "yi" ? "pill active" : "pill"} href={withParams(path, searchParams, { lang: "yi" })}>אידיש</Link>
          </div>
          {activeFilters && <Link href={tab === defaultTab ? path : `${path}?tab=${tab}`} className="small">✕ {t("filter.clear")}</Link>}
        </div>
      )}

      {isResults ? (
        <div className="two-col">
          <section>
            <p className="muted small">{t("listing.count", { n: total.toLocaleString() })}</p>
            {rows.length === 0 ? (
              <p className="card muted">{t("search.noResults")}</p>
            ) : (
              <div className="shiur-list">
                {rows.map((s) => <ShiurCard key={s.id} s={s} t={t} locale={locale} inPlayLater={lib.playLater.has(s.id)} />)}
              </div>
            )}
            {pages > 1 && (
              <div className="pager">
                {page > 1 && <Link className="btn" href={withParams(path, searchParams, { page: page - 1 })}>{t("common.prev")}</Link>}
                <span className="muted small">{t("common.page", { p: page, n: pages })}</span>
                {page < pages && <Link className="btn" href={withParams(path, searchParams, { page: page + 1 })}>{t("common.next")}</Link>}
              </div>
            )}
          </section>
          <aside className="facets" aria-label={t("filter.narrow")}>
            {!hide.includes("speakers") && <FacetList title={t("tab.speakers")} items={facets.speakers} param="speaker" {...{ path, searchParams, locale }} />}
            {!hide.includes("series") && <FacetList title={t("tab.series")} items={facets.series} param="series" {...{ path, searchParams, locale }} />}
            {!hide.includes("topics") && <FacetList title={t("tab.topics")} items={facets.categories} param="category" {...{ path, searchParams, locale }} />}
            {!hide.includes("venues") && <FacetList title={t("tab.venues")} items={facets.venues} param="venue" {...{ path, searchParams, locale }} />}
          </aside>
        </div>
      ) : (
        <div className="grid small-cards">
          {tab === "speakers" && facets.speakers.map((f) => <Tile key={f.id} href={`/speakers/${f.slug}`} f={f} locale={locale} />)}
          {tab === "series" && facets.series.map((f) => <Tile key={f.id} href={`/series/${f.slug}`} f={f} locale={locale} />)}
          {tab === "venues" && facets.venues.map((f) => <Tile key={f.id} href={`/venues/${f.slug}`} f={f} locale={locale} />)}
          {tab === "topics" && facets.categories.map((f) => (
            <Tile key={f.id} href={f.parent_slug ? `/categories/${f.parent_slug}/${f.slug}` : `/categories/${f.slug}`} f={f} locale={locale} />
          ))}
          {tab === "collections" && collections?.map((c) => (
            <Link key={c.slug} className="tile" href={`/collections/${c.slug}`}>
              <strong>{localName(c, locale)}</strong>
              <span className="count">{t("listing.count", { n: c.n })}</span>
            </Link>
          ))}
          {facetTotal === 0 && tab !== "collections" && <p className="muted">{t("search.noResults")}</p>}
        </div>
      )}
    </div>
  );
}

function Tile({ href, f, locale }: { href: string; f: Facet; locale: string }) {
  return (
    <Link className="tile" href={href}>
      {f.parent_name && <span className="count">{f.parent_name}</span>}
      <strong>{localName(f, locale)}</strong>
      <span className="count">{Number(f.n).toLocaleString()}</span>
    </Link>
  );
}

function FacetList({ title, items, param, path, searchParams, locale }: {
  title: string; items: Facet[]; param: string; path: string; searchParams: SearchParams; locale: string;
}) {
  if (items.length < 2 && !first(searchParams[param])) return null; // nothing to narrow
  const current = first(searchParams[param]);
  return (
    <div>
      <h4>{title}</h4>
      <ul>
        {items.slice(0, 60).map((f) => {
          const active = current === String(f.id);
          return (
            <li key={f.id} className={active ? "active" : ""}>
              <Link href={withParams(path, searchParams, { [param]: active ? null : f.id })}>
                {active ? "✕ " : ""}{f.parent_name ? `${f.parent_name}: ` : ""}{localName(f, locale)}
              </Link>
              <span className="n">{Number(f.n)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

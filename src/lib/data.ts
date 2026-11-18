import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Facet, ShiurRow } from "./types";

export async function searchShiurim(f: Record<string, unknown>, sort = "recent", limit = 20, offset = 0) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_shiurim", { f, sort, lim: limit, off: offset });
  if (error) console.error("search_shiurim", error.message);
  const rows = (data ?? []) as ShiurRow[];
  return { rows, total: rows[0]?.total_count ?? 0 };
}

export async function getFacets(f: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shiur_facets", { f });
  if (error) console.error("shiur_facets", error.message);
  const all = (data ?? []) as Facet[];
  return {
    speakers: all.filter((x) => x.kind === "speaker"),
    series: all.filter((x) => x.kind === "series"),
    venues: all.filter((x) => x.kind === "venue"),
    categories: all.filter((x) => x.kind === "category"),
  };
}

/** Which of these shiurim / targets the signed-in user has saved (for button states). */
export const getMyLibraryState = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { userId: null, playLater: new Set<number>(), follows: new Set<string>() };
  const [pl, fo] = await Promise.all([
    supabase.from("play_later").select("shiur_id"),
    supabase.from("follows").select("kind, target_id"),
  ]);
  return {
    userId: user.id,
    playLater: new Set((pl.data ?? []).map((r) => r.shiur_id as number)),
    follows: new Set((fo.data ?? []).map((r) => `${r.kind}:${r.target_id}`)),
  };
});

export type CategoryNode = {
  id: number; parent_id: number | null; slug: string; name: string; name_he: string | null; sort_order: number; n: number;
  children: CategoryNode[];
};

export const getCategoryTree = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("category_tree_counts");
  const rows = (data ?? []) as Omit<CategoryNode, "children">[];
  const byId = new Map<number, CategoryNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: CategoryNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id)!.children.push(node);
    else roots.push(node);
  });
  return { roots, byId };
});

export async function siteTotal() {
  const supabase = await createClient();
  const { count } = await supabase.from("shiurim").select("id", { count: "exact", head: true }).eq("status", "published");
  return count ?? 0;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryTree, getMyLibraryState, type CategoryNode } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { localName } from "@/lib/format";
import { ListingPage } from "@/components/ListingPage";
import { FollowButton } from "@/components/FollowButton";
import { Subscribe } from "@/components/Subscribe";
import type { SearchParams } from "@/lib/filters";

type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<SearchParams> };

/** Walk /categories/gemara/bava-basra down the tree */
async function resolve(path: string[]) {
  const { roots } = await getCategoryTree();
  let level: CategoryNode[] = roots;
  const trail: CategoryNode[] = [];
  for (const seg of path) {
    const node = level.find((c) => c.slug === decodeURIComponent(seg).toLowerCase());
    if (!node) return null;
    trail.push(node);
    level = node.children;
  }
  return trail.length ? trail : null;
}

export async function generateMetadata({ params }: Props) {
  const trail = await resolve((await params).slug);
  return { title: trail ? trail.map((c) => c.name).join(" – ") : "Topic" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const trail = await resolve(slug);
  if (!trail) notFound();
  const node = trail[trail.length - 1];
  const { t, locale } = await getT();
  const supabase = await createClient();
  const [{ data: cols }, lib] = await Promise.all([
    supabase.from("collections").select("slug, name, name_he, collection_shiurim(count)").eq("category_id", node.id).order("sort_order"),
    getMyLibraryState(),
  ]);
  const collections = (cols ?? []).map((c) => ({
    slug: c.slug, name: c.name, name_he: c.name_he,
    n: (c.collection_shiurim as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
  const path = `/categories/${trail.map((c) => c.slug).join("/")}`;

  return (
    <ListingPage
      path={path}
      searchParams={sp}
      base={{ category: node.id }}
      collections={collections}
      header={
        <div>
          <p className="small muted">
            <Link href="/categories">{t("nav.topics")}</Link>
            {trail.slice(0, -1).map((c, i) => (
              <span key={c.id}> › <Link href={`/categories/${trail.slice(0, i + 1).map((x) => x.slug).join("/")}`}>{localName(c, locale)}</Link></span>
            ))}
          </p>
          <h1>{localName(node, locale)} {node.name_he && locale === "en" && <span className="muted" lang="he"> · {node.name_he}</span>}</h1>
          <div className="row">
            <FollowButton kind="category" id={node.id} initial={lib.follows.has(`category:${node.id}`)} />
            <Subscribe feedPath={`/feed/category/${node.id}`} t={t} />
          </div>
          {node.children.some((c) => Number(c.n) > 0) && (
            <div className="row small" style={{ marginTop: 12 }}>
              {node.children.filter((c) => Number(c.n) > 0).map((c) => (
                <Link key={c.id} className="pill" href={`${path}/${c.slug}`}>
                  {localName(c, locale)} <span className="muted">({Number(c.n)})</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}

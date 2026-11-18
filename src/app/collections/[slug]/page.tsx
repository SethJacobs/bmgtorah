import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { ListingPage } from "@/components/ListingPage";
import type { SearchParams } from "@/lib/filters";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: col } = await supabase
    .from("collections").select("*, speakers(slug, name)").eq("slug", decodeURIComponent(slug)).maybeSingle();
  if (!col) notFound();
  const { locale } = await getT();
  const owner = col.speakers as { slug: string; name: string } | null;
  return (
    <ListingPage
      path={`/collections/${col.slug}`}
      searchParams={sp}
      base={{ collection: col.id }}
      header={
        <div>
          <h1>{locale !== "en" && col.name_he ? col.name_he : col.name}</h1>
          {owner && <p><Link href={`/speakers/${owner.slug}`}>{owner.name}</Link></p>}
          {col.description && <p className="muted">{col.description}</p>}
        </div>
      }
    />
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { getMyLibraryState } from "@/lib/data";
import { ListingPage } from "@/components/ListingPage";
import { FollowButton } from "@/components/FollowButton";
import { Subscribe } from "@/components/Subscribe";
import type { SearchParams } from "@/lib/filters";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("series").select("*, speakers(slug, name)").eq("slug", decodeURIComponent(slug)).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props) {
  const s = await load((await params).slug);
  return { title: s?.name ?? "Series" };
}

export default async function SeriesPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const series = await load(slug);
  if (!series) notFound();
  const { t, locale } = await getT();
  const lib = await getMyLibraryState();
  const owner = series.speakers as { slug: string; name: string } | null;

  return (
    <ListingPage
      path={`/series/${series.slug}`}
      searchParams={sp}
      base={{ series: series.id }}
      hide={["series"]}
      header={
        <div>
          <h1>{locale !== "en" && series.name_he ? series.name_he : series.name}</h1>
          {owner && <p><Link href={`/speakers/${owner.slug}`}>{owner.name}</Link></p>}
          {series.description && <p className="muted">{series.description}</p>}
          <div className="row">
            <FollowButton kind="series" id={series.id} initial={lib.follows.has(`series:${series.id}`)} />
            <Subscribe feedPath={`/feed/series/${series.slug}`} t={t} />
          </div>
        </div>
      }
    />
  );
}

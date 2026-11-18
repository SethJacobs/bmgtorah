import { notFound } from "next/navigation";
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
  const { data } = await supabase.from("speakers").select("*").eq("slug", decodeURIComponent(slug)).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props) {
  const s = await load((await params).slug);
  return { title: s?.name ?? "Speaker" };
}

export default async function SpeakerPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const speaker = await load(slug);
  if (!speaker) notFound();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const [{ data: cols }, lib] = await Promise.all([
    supabase.from("collections").select("slug, name, name_he, collection_shiurim(count)").eq("speaker_id", speaker.id).order("sort_order"),
    getMyLibraryState(),
  ]);
  const collections = (cols ?? []).map((c) => ({
    slug: c.slug, name: c.name, name_he: c.name_he,
    n: (c.collection_shiurim as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));

  return (
    <ListingPage
      path={`/speakers/${speaker.slug}`}
      searchParams={sp}
      base={{ speaker: speaker.id }}
      hide={["speakers"]}
      collections={collections}
      header={
        <div className="listing-head">
          {speaker.photo_url && <img className="photo" src={speaker.photo_url} alt="" />}
          <div style={{ flex: 1 }}>
            <h1>{locale !== "en" && speaker.name_he ? speaker.name_he : speaker.name}</h1>
            {speaker.bio && <p className="muted">{speaker.bio}</p>}
            <div className="row">
              <FollowButton kind="speaker" id={speaker.id} initial={lib.follows.has(`speaker:${speaker.id}`)} />
              <Subscribe feedPath={`/feed/speaker/${speaker.slug}`} t={t} />
            </div>
          </div>
        </div>
      }
    />
  );
}

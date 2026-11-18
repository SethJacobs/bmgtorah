import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { ListingPage } from "@/components/ListingPage";
import type { SearchParams } from "@/lib/filters";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export default async function VenuePage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: venue } = await supabase.from("venues").select("*").eq("slug", decodeURIComponent(slug)).maybeSingle();
  if (!venue) notFound();
  const { locale } = await getT();
  return (
    <ListingPage
      path={`/venues/${venue.slug}`}
      searchParams={sp}
      base={{ venue: venue.id }}
      hide={["venues"]}
      header={
        <div>
          <h1>{locale !== "en" && venue.name_he ? venue.name_he : venue.name}</h1>
          {venue.location && <p className="muted">{venue.location}</p>}
        </div>
      }
    />
  );
}

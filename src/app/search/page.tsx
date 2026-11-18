import { ListingPage } from "@/components/ListingPage";
import { getT } from "@/lib/i18n/server";
import { first, type SearchParams } from "@/lib/filters";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { t } = await getT();
  const q = first(sp.q);
  return (
    <ListingPage
      path="/search"
      searchParams={sp}
      header={<h1>{q ? t("search.resultsFor", { q }) : t("home.recent")}</h1>}
    />
  );
}

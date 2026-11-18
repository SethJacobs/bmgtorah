import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { dafYomi } from "@/lib/calendar";
import { ListingPage } from "@/components/ListingPage";
import type { SearchParams } from "@/lib/filters";

export const metadata = { title: "Daf Yomi" };

export default async function DafYomiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { t, locale } = await getT();
  const daf = dafYomi();
  const supabase = await createClient();

  let categoryId: number | null = null;
  if (daf) {
    const { data: gemara } = await supabase.from("categories").select("id").eq("slug", "gemara").is("parent_id", null).maybeSingle();
    if (gemara) {
      const { data: cat } = await supabase.from("categories").select("id").eq("parent_id", gemara.id).eq("slug", daf.masechta.slug).maybeSingle();
      categoryId = cat?.id ?? null;
    }
  }

  const header = (
    <div>
      <h1>{t("nav.dafYomi")}</h1>
      {daf && (
        <p style={{ fontSize: "1.3rem" }}>
          {t("home.dafYomi")}:{" "}
          <Link href={`/categories/gemara/${daf.masechta.slug}`}><strong>{locale === "en" ? daf.masechta.name : daf.masechta.he} {daf.daf}</strong></Link>
        </p>
      )}
    </div>
  );

  // Shows every shiur on today's masechta (newest first). Tag Daf Yomi shiurim with the masechta topic when uploading.
  return <ListingPage path="/daf-yomi" searchParams={sp} base={categoryId ? { category: categoryId } : {}} header={header} />;
}

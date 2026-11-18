import Link from "next/link";
import { getCategoryTree } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import { localName } from "@/lib/format";

export const metadata = { title: "Topics" };

export default async function CategoriesIndex() {
  const { t, locale } = await getT();
  const { roots } = await getCategoryTree();
  return (
    <div>
      <h1>{t("nav.topics")}</h1>
      {roots.map((root) => (
        <section key={root.id}>
          <div className="section-head">
            <h2><Link href={`/categories/${root.slug}`}>{localName(root, locale)}</Link></h2>
            <span className="muted small">{t("listing.count", { n: Number(root.n).toLocaleString() })}</span>
          </div>
          <div className="row small">
            {root.children.map((c) => (
              <Link key={c.id} href={`/categories/${root.slug}/${c.slug}`} className={Number(c.n) ? "pill" : "pill muted"}>
                {localName(c, locale)} {Number(c.n) > 0 && <span className="muted">({Number(c.n)})</span>}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

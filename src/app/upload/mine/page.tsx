import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/format";
import { first, type SearchParams } from "@/lib/filters";

export const metadata = { title: "My uploads" };

export default async function MyUploads({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { user } = await requireRole("uploader");
  const { t, locale } = await getT();
  const { data } = await createAdminClient()
    .from("shiurim").select("id, slug, title, status, review_note, created_at, speakers(name)")
    .eq("uploaded_by", user.id).order("created_at", { ascending: false }).limit(200);

  return (
    <div>
      <div className="spread">
        <h1>{t("upload.mine")}</h1>
        <Link className="btn gold" href="/upload">+ {t("upload.title")}</Link>
      </div>
      {first(sp.saved) && <p className="notice">{t("upload.saved")} {t("upload.pendingNote")}</p>}
      <table className="data">
        <thead><tr><th>{t("upload.titleField")}</th><th>{t("upload.speaker")}</th><th>{t("shiur.date")}</th><th></th><th></th></tr></thead>
        <tbody>
          {(data ?? []).map((s) => (
            <tr key={s.id}>
              <td><Link href={`/shiur/${s.id}/${s.slug}`}>{s.title}</Link>{s.review_note && <div className="small muted">↳ {s.review_note}</div>}</td>
              <td>{(s.speakers as unknown as { name: string } | null)?.name}</td>
              <td className="small">{formatDate(s.created_at, locale)}</td>
              <td><span className={`badge status-${s.status}`}>{t(`status.${s.status}` as never)}</span></td>
              <td><Link className="btn small" href={`/upload?edit=${s.id}`}>{t("shiur.edit")}</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

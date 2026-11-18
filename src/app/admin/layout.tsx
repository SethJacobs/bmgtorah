import Link from "next/link";
import { requireRole, hasRole } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole("editor");
  const { t } = await getT();
  return (
    <div>
      <h1>{t("admin.title")}</h1>
      <nav className="admin-nav">
        <Link className="btn" href="/admin">{t("admin.review")}</Link>
        <Link className="btn" href="/admin/shiurim">{t("admin.allShiurim")}</Link>
        <Link className="btn" href="/admin/speakers">{t("admin.speakers")}</Link>
        <Link className="btn" href="/admin/series">{t("admin.series")}</Link>
        <Link className="btn" href="/admin/venues">{t("admin.venues")}</Link>
        <Link className="btn" href="/admin/categories">{t("admin.categories")}</Link>
        <Link className="btn" href="/admin/collections">{t("admin.collections")}</Link>
        {hasRole(profile, "admin") && <Link className="btn" href="/admin/users">{t("admin.users")}</Link>}
      </nav>
      {children}
    </div>
  );
}

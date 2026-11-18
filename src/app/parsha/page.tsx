import { redirect } from "next/navigation";
import { parshaOfWeek } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export default function ParshaRedirect() {
  const [first] = parshaOfWeek();
  redirect(first ? `/categories/parsha/${first.slug}` : "/categories/parsha");
}

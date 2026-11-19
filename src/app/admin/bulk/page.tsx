import { createAdminClient } from "@/lib/supabase/server";
import BulkUpload from "./BulkUpload";

export const metadata = { title: "Bulk upload" };

export default async function BulkPage() {
  const { data } = await createAdminClient()
    .from("series").select("id, name, speakers(name)").order("name");
  const series = (data ?? []).map((s) => {
    const sp = s.speakers as unknown as { name: string } | { name: string }[] | null;
    const speaker = Array.isArray(sp) ? sp[0]?.name : sp?.name;
    return { id: s.id as number, label: speaker ? `${s.name} — ${speaker}` : (s.name as string) };
  });
  return (
    <section>
      <h2>Bulk upload</h2>
      <p className="muted">
        Pick a series, then drop in a batch of audio or video files. Each file is matched to an entry by its file name
        (e.g. <code>Shiur 5 Simplified.mp3</code> → “Shiur 5 Simplified”). Matched entries get the file and are published;
        files with no match become new published entries in the series (set their dates afterwards from ✎ Edit).
      </p>
      <BulkUpload series={series} />
    </section>
  );
}

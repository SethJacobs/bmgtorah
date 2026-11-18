import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/format";

// Counts the download, then sends the browser straight to the file on R2.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const supabase = await createClient();
  const { data } = await supabase.from("shiurim").select("media_key").eq("id", id).eq("status", "published").maybeSingle();
  if (!data?.media_key) return new NextResponse("Not found", { status: 404 });
  await supabase.rpc("increment_download", { p_shiur: id });
  return NextResponse.redirect(mediaUrl(data.media_key), 302);
}

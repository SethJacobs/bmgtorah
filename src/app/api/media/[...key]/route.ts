import { NextResponse } from "next/server";
import { presignDownload } from "@/lib/r2";

// Streams/downloads files from the private storage bucket by redirecting to a
// short-lived signed URL. Set NEXT_PUBLIC_MEDIA_BASE_URL=https://<site>/api/media
// so every player, download button and podcast feed goes through here.
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const path = key.map(decodeURIComponent).join("/");
  if (!/^(shiurim|sources|images)\/[\w./-]+$/.test(path) || path.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const download = new URL(request.url).searchParams.has("download");
  const url = await presignDownload(path, { download });
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "private, max-age=3000" },
  });
}

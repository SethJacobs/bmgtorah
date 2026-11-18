import { NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth";
import { isAllowedType, makeKey, MAX_UPLOAD_BYTES, presignUpload } from "@/lib/r2";

// Gives the browser a one-hour signed URL to PUT a file straight into R2.
export async function POST(req: Request) {
  const { profile } = await getSession();
  if (!hasRole(profile, "uploader")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const { filename, contentType, size, purpose } = await req.json().catch(() => ({}));
  if (typeof filename !== "string" || typeof contentType !== "string") {
    return NextResponse.json({ error: "Missing file info" }, { status: 400 });
  }
  if (!isAllowedType(contentType)) return NextResponse.json({ error: `File type ${contentType} not allowed` }, { status: 400 });
  if (typeof size === "number" && size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File too large (2 GB max)" }, { status: 400 });

  const folder = purpose === "source" ? "sources" : purpose === "image" ? "images" : "shiurim";
  const key = makeKey(folder, filename);
  const url = await presignUpload(key, contentType);
  return NextResponse.json({ url, key });
}

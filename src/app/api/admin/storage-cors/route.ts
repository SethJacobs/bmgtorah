import { NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth";
import { getCors, setUploadCors } from "@/lib/r2";

// Admin-only. GET shows the bucket's CORS rules; GET ?apply=1 sets the rule that lets
// the site's upload page send files straight to storage.
export async function GET(req: Request) {
  const { profile } = await getSession();
  if (!hasRole(profile, "admin")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const url = new URL(req.url);
  if (url.searchParams.get("apply") === "1") {
    const origins = Array.from(new Set([
      url.origin,
      "https://bmgtorah.vercel.app",
      "http://localhost:3000",
      ...(process.env.UPLOAD_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    ]));
    try {
      await setUploadCors(origins);
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).name + ": " + (e as Error).message }, { status: 500 });
    }
  }
  return NextResponse.json({ rules: await getCors() });
}

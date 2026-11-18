import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { shiurId } = await req.json().catch(() => ({}));
  if (!Number.isInteger(shiurId)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const supabase = await createClient();
  await supabase.rpc("increment_play", { p_shiur: shiurId });
  return NextResponse.json({ ok: true });
}

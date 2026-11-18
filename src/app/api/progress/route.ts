import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Saves where the listener stopped, so "Continue listening" works across devices.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { shiurId, position, completed } = await req.json().catch(() => ({}));
  if (!Number.isInteger(shiurId)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const { error } = await supabase.from("listening_progress").upsert({
    user_id: user.id,
    shiur_id: shiurId,
    position_seconds: Math.max(0, Math.floor(Number(position) || 0)),
    completed: !!completed,
    updated_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: !error });
}

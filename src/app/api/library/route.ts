import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Toggle "play later" or follow a speaker / series / category.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  const { kind, id, on } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  if (kind === "play_later") {
    const res = on
      ? await supabase.from("play_later").upsert({ user_id: user.id, shiur_id: id })
      : await supabase.from("play_later").delete().eq("user_id", user.id).eq("shiur_id", id);
    return NextResponse.json({ ok: !res.error });
  }
  if (kind === "speaker" || kind === "series" || kind === "category") {
    const res = on
      ? await supabase.from("follows").upsert({ user_id: user.id, kind, target_id: id })
      : await supabase.from("follows").delete().eq("user_id", user.id).eq("kind", kind).eq("target_id", id);
    return NextResponse.json({ ok: !res.error });
  }
  return NextResponse.json({ error: "bad kind" }, { status: 400 });
}

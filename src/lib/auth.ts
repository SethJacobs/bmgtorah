import "server-only";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "./supabase/server";
import type { Profile, Role } from "./types";

const RANK: Record<Role, number> = { listener: 0, uploader: 1, editor: 2, admin: 3 };

export function hasRole(profile: Profile | null, min: Role) {
  return !!profile && RANK[profile.role] >= RANK[min];
}

/** Current user + profile, or nulls when signed out. */
export async function getSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null as Profile | null };
  const { data: profile } = await createAdminClient()
    .from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>();
  return { user, profile: profile ?? null };
}

/** Redirects to /login (or home) unless the user has at least `min` role. */
export async function requireRole(min: Role) {
  const session = await getSession();
  if (!session.user) redirect("/login");
  if (!hasRole(session.profile, min)) redirect("/?denied=1");
  return session as { user: NonNullable<typeof session.user>; profile: Profile };
}

/** Speaker ids this user may upload for. null = any speaker. */
export async function allowedSpeakerIds(profile: Profile): Promise<number[] | null> {
  if (hasRole(profile, "editor") || profile.can_upload_any_speaker) return null;
  const { data } = await createAdminClient()
    .from("uploader_speakers").select("speaker_id").eq("user_id", profile.id);
  return (data ?? []).map((r) => r.speaker_id as number);
}

export async function canUploadFor(profile: Profile, speakerId: number) {
  if (!hasRole(profile, "uploader")) return false;
  const allowed = await allowedSpeakerIds(profile);
  return allowed === null || allowed.includes(speakerId);
}

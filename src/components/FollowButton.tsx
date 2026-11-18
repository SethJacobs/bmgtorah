"use client";
import { useState } from "react";
import { useT } from "./I18nProvider";

export function FollowButton({ kind, id, initial = false }: { kind: "speaker" | "series" | "category"; id: number; initial?: boolean }) {
  const { t } = useT();
  const [on, setOn] = useState(initial);
  async function toggle() {
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, on: !on }),
    });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (res.ok) setOn(!on);
  }
  return (
    <button className={on ? "btn on" : "btn"} onClick={toggle}>
      {on ? "✓ " + t("follow.following") : "+ " + t("follow.follow")}
    </button>
  );
}

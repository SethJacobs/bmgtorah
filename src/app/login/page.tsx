"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/I18nProvider";

export default function LoginPage() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) setError(error.message); else setSent(true);
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setError(error.message);
  }

  return (
    <div className="form-card" style={{ maxWidth: 440, margin: "30px auto" }}>
      <h1>{t("login.title")}</h1>
      {sent ? (
        <p className="notice">{t("login.sent")}</p>
      ) : (
        <form onSubmit={sendLink}>
          <label htmlFor="email">{t("login.email")}</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          <p><button className="btn primary" type="submit">{t("login.sendLink")}</button></p>
        </form>
      )}
      <p className="muted small">{t("login.or")}</p>
      <button className="btn" onClick={google}>{t("login.google")}</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

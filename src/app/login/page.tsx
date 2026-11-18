"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/I18nProvider";

// Email magic links are hidden until a custom SMTP sender is set up in Supabase.
// To bring them back, set NEXT_PUBLIC_EMAIL_LOGIN=1 in Vercel and redeploy.
const EMAIL_LOGIN = process.env.NEXT_PUBLIC_EMAIL_LOGIN === "1";

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
      <p><button className="btn primary" onClick={google} style={{ width: "100%", justifyContent: "center", padding: "10px 14px" }}>
        {t("login.google")}
      </button></p>
      {EMAIL_LOGIN && (
        <>
          <p className="muted small" style={{ textAlign: "center" }}>{t("login.or")}</p>
          {sent ? (
            <p className="notice">{t("login.sent")}</p>
          ) : (
            <form onSubmit={sendLink}>
              <label htmlFor="email">{t("login.email")}</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
              <p><button className="btn" type="submit">{t("login.sendLink")}</button></p>
            </form>
          )}
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

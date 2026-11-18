export const metadata = { title: "Privacy Policy" };

// Plain-language starter policy. Have the yeshiva review and adjust before launch.
export default function PrivacyPage() {
  return (
    <article className="form-card" style={{ maxWidth: 760 }}>
      <h1>Privacy Policy</h1>
      <p className="muted small">Last updated: November 2026</p>
      <p>BMGTorah (“we”) is a shiur library run for Beis Medrash Gevoha in Lakewood, NJ. This page explains what we collect and why.</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details</strong> — if you sign in (by email link or Google), we store your email address and name so you can use your library.</li>
        <li><strong>Your library</strong> — shiurim you save for later, rebbeim/series/topics you follow, and where you stopped listening.</li>
        <li><strong>Anonymous counts</strong> — how many times a shiur is played or downloaded (not linked to you).</li>
        <li><strong>Uploads</strong> — if you upload shiurim, we store the files and the details you enter.</li>
      </ul>
      <h2>What we don’t do</h2>
      <ul>
        <li>We don’t sell or rent your information.</li>
        <li>We don’t show ads or use advertising trackers.</li>
      </ul>
      <h2>Services we use</h2>
      <p>The site runs on Vercel (hosting), Supabase (database and sign-in) and cloud file storage. Google sign-in shares only your name and email with us.</p>
      <h2>Your choices</h2>
      <p>You can use the site without an account. To delete your account and saved data, contact us and we’ll remove it.</p>
      <h2>Contact</h2>
      <p>Questions: <a href="mailto:sethij621@gmail.com">sethij621@gmail.com</a></p>
    </article>
  );
}

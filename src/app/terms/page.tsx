export const metadata = { title: "Terms of Use" };

// Plain-language starter terms. Have the yeshiva review and adjust before launch.
export default function TermsPage() {
  return (
    <article className="form-card" style={{ maxWidth: 760 }}>
      <h1>Terms of Use</h1>
      <p className="muted small">Last updated: November 2026</p>
      <p>BMGTorah provides shiurim from Beis Medrash Gevoha and other rebbeim for personal learning, free of charge.</p>
      <h2>Using the shiurim</h2>
      <ul>
        <li>You may listen, watch and download shiurim for your own learning and share links to them.</li>
        <li>Please don’t re-upload, sell or republish shiurim elsewhere without permission from the rebbi or the yeshiva.</li>
      </ul>
      <h2>Uploading</h2>
      <ul>
        <li>Only upload shiurim you have permission to share. Uploads may be reviewed, edited or removed by the editors.</li>
        <li>Upload accounts are granted by the BMGTorah office and can be changed or removed at any time.</li>
      </ul>
      <h2>No warranty</h2>
      <p>The site is provided as-is. Shiurim express the views of the speaker; for halacha l’maaseh, ask your own rav.</p>
      <h2>Contact</h2>
      <p>Questions: <a href="mailto:sethij621@gmail.com">sethij621@gmail.com</a></p>
    </article>
  );
}

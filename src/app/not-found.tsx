import Link from "next/link";

export default function NotFound() {
  return (
    <div className="form-card" style={{ maxWidth: 520 }}>
      <h1>Not found</h1>
      <p className="muted">That page or shiur doesn’t exist (or isn’t published yet).</p>
      <Link className="btn primary" href="/">BMGTorah</Link>
    </div>
  );
}

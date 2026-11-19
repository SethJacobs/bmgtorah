#!/usr/bin/env node
// Uploads a folder of MP3s to BMGTorah (Backblaze B2 + Supabase), matching files to shiurim by name.
//
// Usage (from the bmgtorah folder, in your own Terminal):
//   node --env-file=.env.local scripts/import-shiurim.mjs ../bmgtorah-import/audio
//
// For each "<title>.mp3" in the folder:
//   - if a shiur with that title exists in the series (e.g. a draft), the file is attached and it's published;
//   - otherwise a new published shiur is created (date left blank; fix it later from ✎ Edit);
//   - once the upload is confirmed in storage, the local file is deleted (pass --keep to keep it).
// Files still downloading (.part) are ignored. Safe to re-run.
// Edit SPEAKER / SERIES / CATEGORY below for other imports.

import { readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join, resolve, extname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const SPEAKER = { slug: "rav-gershon-ribner", name: "Rav Gershon Ribner", sort_name: "Ribner, Gershon" };
const SERIES = { slug: "iyun-shiur-eiruvin-winter-2026", name: "Iyun Shiur Eiruvin – Winter 2026",
  description: "Rav Gershon Ribner's iyun shiur on Maseches Eiruvin, Winter 2026, with simplified chazara versions." };
const CATEGORY = { parent: "gemara", child: "eruvin" };
const VENUE_SLUG = "bmg-lakewood";
const LANGUAGE = "en";

const args = process.argv.slice(2);
const KEEP = args.includes("--keep");
const dir = resolve(args.find((a) => !a.startsWith("--")) ?? "../bmgtorah-import/audio");

const need = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "S3_ENDPOINT", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_BUCKET"];
const missing = need.filter((k) => !process.env[k] || process.env[k].includes("SENSITIVE"));
if (missing.length) { console.error("Missing in .env.local:", missing.join(", ")); process.exit(1); }

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  // This script never uses realtime; a stand-in avoids Node 20's missing WebSocket error
  realtime: { transport: class NoWebSocket {} },
});
const s3 = new S3Client({
  region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
  requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
});
const BUCKET = process.env.S3_BUCKET;

const slugify = (s) => s.toLowerCase().replace(/['"]/g, "").replace(/&/g, "and").replace(/[^a-z0-9֐-׿]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "shiur";
// Loose name match: ignores case, punctuation and spacing (file names can't hold ":" or quotes)
const norm = (s) => s.normalize("NFKC").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9֐-׿]+/g, "");

function durationOf(file) {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
    const n = Math.round(parseFloat(out));
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

async function remoteSize(key) {
  try { return (await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))).ContentLength ?? null; }
  catch { return null; }
}

async function upsertOne(table, match, row) {
  const { data } = await db.from(table).select("id").match(match).maybeSingle();
  if (data) return data.id;
  const { data: ins, error } = await db.from(table).insert(row).select("id").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return ins.id;
}

const speakerId = await upsertOne("speakers", { slug: SPEAKER.slug }, SPEAKER);
const seriesId = await upsertOne("series", { slug: SERIES.slug }, { ...SERIES, speaker_id: speakerId });
const { data: parent } = await db.from("categories").select("id").eq("slug", CATEGORY.parent).is("parent_id", null).single();
const { data: cat } = await db.from("categories").select("id").eq("parent_id", parent.id).eq("slug", CATEGORY.child).single();
const { data: venue } = await db.from("venues").select("id").eq("slug", VENUE_SLUG).maybeSingle();
const { data: existing, error: listErr } = await db.from("shiurim")
  .select("id,title,status,media_key").eq("series_id", seriesId);
if (listErr) { console.error(listErr.message); process.exit(1); }
const byName = new Map(existing.map((s) => [norm(s.title), s]));

const files = readdirSync(dir).filter((f) => extname(f).toLowerCase() === ".mp3").sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (!files.length) { console.log(`No .mp3 files in ${dir}`); process.exit(0); }

let attached = 0, created = 0, already = 0, failed = 0;
for (const f of files) {
  const file = join(dir, f);
  const title = basename(f, extname(f)).trim();
  const size = statSync(file).size;
  const match = byName.get(norm(title));
  try {
    // Already uploaded earlier: just tidy up the local copy if storage has it
    if (match?.media_key && match.status === "published") {
      const rs = await remoteSize(match.media_key);
      if (rs && !KEEP) unlinkSync(file);
      console.log(`= ${title}: already on the site${rs && !KEEP ? " (local copy deleted)" : ""}`);
      already++; continue;
    }

    const key = `shiurim/${SERIES.slug}/${slugify(title)}-${crypto.randomUUID().slice(0, 6)}.mp3`;
    process.stdout.write(`↑ ${title} (${(size / 1048576).toFixed(1)} MB)… `);
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: readFileSync(file), ContentType: "audio/mpeg" }));
    const rs = await remoteSize(key);
    if (rs !== size) throw new Error(`storage has ${rs} bytes, expected ${size}`);

    const media = { media_type: "audio", media_key: key, file_size_bytes: size, external_url: null, status: "published" };
    const dur = durationOf(file);
    if (match) {
      const { error } = await db.from("shiurim").update({ ...media, ...(dur ? { duration_seconds: dur } : {}) }).eq("id", match.id);
      if (error) throw new Error(error.message);
      console.log(`✓ attached to existing entry #${match.id}`); attached++;
    } else {
      const { data: shiur, error } = await db.from("shiurim").insert({
        ...media, slug: slugify(title), title, speaker_id: speakerId, series_id: seriesId, venue_id: venue?.id ?? null,
        language: LANGUAGE, duration_seconds: dur,
        description: /simplified/i.test(title) ? "Simplified chazara of the shiur." : null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      await db.from("shiur_categories").insert({ shiur_id: shiur.id, category_id: cat.id });
      byName.set(norm(title), { id: shiur.id, title, status: "published", media_key: key });
      console.log(`✓ new entry #${shiur.id} (no date — set it from ✎ Edit)`); created++;
    }
    if (!KEEP) unlinkSync(file);
  } catch (e) {
    console.log(`✗ ${title}: ${e.message}`); failed++;
  }
}
console.log(`\nDone. Attached ${attached}, new ${created}, already there ${already}, failed ${failed}.`);
if (failed) console.log("Failed files were kept — just run the command again.");

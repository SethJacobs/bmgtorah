#!/usr/bin/env node
// Bulk-imports a folder of MP3s into BMGTorah (Backblaze B2 + Supabase).
//
// Usage (from the bmgtorah folder):
//   node --env-file=.env.local scripts/import-shiurim.mjs ../bmgtorah-import
//
// The import folder needs:
//   shiurim.tsv   columns: title  date  duration  url   (tab-separated, header row)
//   audio/01.mp3, audio/02.mp3 ...   (same order as the rows)
// Edit SERIES / SPEAKER / CATEGORY below for other imports. Safe to re-run: rows already
// imported (same title in the same series) are skipped.

import { readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const SPEAKER = { slug: "rav-gershon-ribner", name: "Rav Gershon Ribner", sort_name: "Ribner, Gershon" };
const SERIES = { slug: "iyun-shiur-eiruvin-winter-2026", name: "Iyun Shiur Eiruvin – Winter 2026",
  description: "Rav Gershon Ribner's iyun shiur on Maseches Eiruvin, Winter 2026, with simplified chazara versions." };
const CATEGORY = { parent: "gemara", child: "eruvin" };
const LANGUAGE = "en";

const dir = resolve(process.argv[2] ?? "../bmgtorah-import");
const need = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "S3_ENDPOINT", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_BUCKET"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) { console.error("Missing in .env.local:", missing.join(", ")); process.exit(1); }

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const s3 = new S3Client({
  region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});

const slugify = (s) => s.toLowerCase().replace(/['"]/g, "").replace(/&/g, "and").replace(/[^a-z0-9֐-׿]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "shiur";
const toSeconds = (d) => d.split(":").map(Number).reduce((a, n) => a * 60 + n, 0);
const toDate = (s) => { const d = new Date(s + " 12:00"); return isNaN(d) ? null : d.toISOString().slice(0, 10); };

async function upsertOne(table, match, row) {
  const { data } = await db.from(table).select("id").match(match).maybeSingle();
  if (data) return data.id;
  const { data: ins, error } = await db.from(table).insert(row).select("id").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return ins.id;
}

const rows = readFileSync(join(dir, "shiurim.tsv"), "utf8").trim().split("\n").slice(1).map((l) => l.split("\t"));
const speakerId = await upsertOne("speakers", { slug: SPEAKER.slug }, SPEAKER);
const seriesId = await upsertOne("series", { slug: SERIES.slug }, { ...SERIES, speaker_id: speakerId });
const { data: parent } = await db.from("categories").select("id").eq("slug", CATEGORY.parent).is("parent_id", null).single();
const { data: cat } = await db.from("categories").select("id").eq("parent_id", parent.id).eq("slug", CATEGORY.child).single();
const { data: venue } = await db.from("venues").select("id").eq("slug", "bmg-lakewood").maybeSingle();

let added = 0, skipped = 0, failed = 0;
for (const [i, [title, date, dur]] of rows.entries()) {
  const id = String(i + 1).padStart(2, "0");
  const file = join(dir, "audio", `${id}.mp3`);
  if (!existsSync(file)) { console.log(`[${id}] no audio file yet — skipping: ${title}`); failed++; continue; }
  const { data: exists } = await db.from("shiurim").select("id").eq("series_id", seriesId).eq("title", title).maybeSingle();
  if (exists) { console.log(`[${id}] already imported: ${title}`); skipped++; continue; }

  const key = `shiurim/${SERIES.slug}/${id}-${slugify(title)}.mp3`;
  try {
    await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: readFileSync(file), ContentType: "audio/mpeg" }));
    const simplified = /simplified/i.test(title);
    const { data: shiur, error } = await db.from("shiurim").insert({
      slug: slugify(title), title, speaker_id: speakerId, series_id: seriesId, venue_id: venue?.id ?? null,
      recorded_on: toDate(date), language: LANGUAGE, media_type: "audio", media_key: key,
      duration_seconds: toSeconds(dur), file_size_bytes: statSync(file).size, status: "published",
      description: simplified ? "Simplified chazara of the shiur." : null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await db.from("shiur_categories").insert({ shiur_id: shiur.id, category_id: cat.id });
    console.log(`[${id}] ✓ ${title}`); added++;
  } catch (e) {
    console.log(`[${id}] ✗ ${title}: ${e.message}`); failed++;
  }
}
console.log(`\nDone. Added ${added}, already there ${skipped}, failed/missing ${failed}.`);

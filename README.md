# BMGTorah.org

A YUTorah-style shiur library for Beis Medrash Gevoha and the wider Yeshivish community.
Next.js + Supabase (database & logins) + Cloudflare R2 (audio/video files).

---

## What's included

| YUTorah feature | BMGTorah |
|---|---|
| Every shiur tagged with speaker, date, series, location, several topics, language, type, length | ✅ `shiurim` table + `shiur_categories` |
| Two-level topic tree (Gemara › Bava Basra, Halacha › Muktzeh…) | ✅ 9 top-level topics and ~180 sub-topics, seeded in **Yeshivish transliteration with Hebrew names** |
| Speaker / series / location / topic / collection pages — all the same template | ✅ `ListingPage`: tabs (Recent · Popular · Featured · Rebbeim · Series · Locations · Topics · Collections) |
| Filters: type, length, date uploaded, language | ✅ plus English / עברית / אידיש |
| Sidebar counts to narrow down by speaker/series/topic/location | ✅ `shiur_facets()` |
| Search (incl. "search within this speaker") | ✅ full-text + fuzzy + alternate spellings (searching *Shabbat* finds *Shabbos*, *muktze* finds *Muktzeh*) |
| Shiur page: player, download, mareh mekomos, "more from this speaker/series/topic" | ✅ plus YouTube/Vimeo embeds and PDF viewer |
| Bottom player with speed, ‑15/+30, resume where you left off | ✅ survives page navigation |
| My Library: play later, continue listening, recently played, following | ✅ |
| RSS / podcast feed for any speaker, series or topic | ✅ `/feed/speaker/<slug>`, `/feed/series/<slug>`, `/feed/category/<id>`, `/feed/all/latest` |
| Parsha of the week, Daf Yomi | ✅ calculated automatically (hebcal) and linked to the right topic |
| Editor's picks / featured | ✅ star any shiur or series |
| Upload panel with drafts & visibility | ✅ direct-to-R2 upload with progress bar, auto-detects length, source-sheet PDFs, add-speaker inline |
| Review before publishing | ✅ review queue with approve / reject-with-reason |
| Site in English, Hebrew, Yiddish | ✅ full UI in all three, right-to-left for Hebrew/Yiddish |

Not built yet (good next steps): email alerts when a followed rebbi posts, "sponsor a day of learning", comments, bulk import from an existing archive, mobile apps, a stats dashboard.

---

## Who can upload: start small, widen later without code changes

Every account has a **role**, set in **Admin › Users**:

| Role | Can do |
|---|---|
| `listener` | Save, follow, resume (everyone who signs in) |
| `uploader` | Upload for the speakers ticked on their account (e.g. a rebbi uploads only his own shiurim), or for any speaker if "May upload for any speaker" is on |
| `editor` | Upload/edit anything, approve the review queue, manage topics/series/collections |
| `admin` | Editor + manage users |

Two switches on each account: **Uploads need review** (on by default), and **May upload for any speaker**.

**Suggested path:**
1. **Launch:** 2–3 office staff or trusted bochurim as `editor`. They upload everything and nothing needs review.
2. **Phase 2:** give individual rebbeim `uploader` accounts tied to their own name, with review **on**.
3. **Once they're comfortable,** turn review off for each rebbi. Add more volunteers the same way.

---

## Costs on free tiers

| Service | Free tier | Notes |
|---|---|---|
| **Cloudflare R2** (files) | 10 GB storage, free downloads/streaming | Encoded at 48–64 kbps mono, an hour of shiur ≈ 22–29 MB → **~350–450 hours free**. After that, about $0.015 per GB a month (100 GB ≈ $1.50/month). |
| **Supabase** (database + logins) | 500 MB database, 50k monthly users | 500 MB holds hundreds of thousands of shiur records. **Free projects pause after 7 days with no activity.** That's fine during development, but a live site needs steady traffic or the $25/month Pro plan. |
| **Hosting** | see below | |

**Hosting the Next.js app:** Vercel's free Hobby plan is restricted to *personal, non-commercial* use. That's fine for building and testing. For the real yeshiva site, especially once there are donation or sponsorship links, plan on Vercel Pro ($20/month), or ask Vercel whether a non-profit volunteer project qualifies. Netlify and Cloudflare also run Next.js apps and have free tiers.

**Shrink audio before uploading** (cuts storage roughly 4×, and speech still sounds clear):

```bash
ffmpeg -i shiur.wav -ac 1 -b:a 48k shiur.mp3
```

---

## Setup (about 30 minutes)

### 1. Supabase
1. Create a free project at supabase.com.
2. **SQL Editor:** run these files in order:
   `supabase/migrations/0001_schema.sql` → `0002_functions.sql` → `0003_rls.sql` → `supabase/seed.sql`.
   *(Optional)* `supabase/demo_data.sql` adds placeholder shiurim so the pages aren't empty. Its header comment shows how to remove them.
3. **Authentication › URL Configuration:** set *Site URL* to your site, and add `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback` to *Redirect URLs*.
4. *(Optional)* **Authentication › Providers › Google** for "Continue with Google". Email magic links work with no setup.
5. **Project Settings › API:** copy the URL, the `anon` key and the `service_role` key.

### 2. Cloudflare R2
1. Cloudflare dashboard › R2 › **Create bucket** `bmgtorah-media`.
2. Bucket › Settings › **Public access**: enable the `r2.dev` URL for testing. Later, connect a custom domain like `media.bmgtorah.org`.
3. Bucket › Settings › **CORS policy**. This is required, because the browser uploads directly to R2:
   ```json
   [{
     "AllowedOrigins": ["http://localhost:3000", "https://bmgtorah.org"],
     "AllowedMethods": ["PUT", "GET", "HEAD"],
     "AllowedHeaders": ["*"],
     "ExposeHeaders": ["ETag"],
     "MaxAgeSeconds": 3600
   }]
   ```
4. R2 › **Manage API tokens** › create a token with *Object Read & Write* on that bucket. Copy the Access Key ID, the Secret and your Account ID.

### 3. Run it locally
```bash
cp .env.example .env.local     # fill in the values from steps 1–2
npm install
npm run dev                    # http://localhost:3000
```

### 4. Make yourself admin
Sign in once on the site, then in the Supabase SQL editor:
```sql
update profiles set role = 'admin', requires_review = false where email = 'you@example.com';
```
Now **Admin** and **Upload** appear in the header.

### 5. Deploy
Push to GitHub and import into Vercel (or Netlify/Cloudflare). Add the same environment variables there, and set `NEXT_PUBLIC_SITE_URL` to the real domain.

---

## Day-to-day

- **Add rebbeim, series, locations:** Admin › Speakers / Series / Locations, or "Add new speaker" right on the upload form.
- **Topics:** Admin › Topics. Each topic has an English (Yeshivish) name, a Hebrew name, and *other spellings* used by search (e.g. "Bava Batra, Baba Batra").
- **Collections** (e.g. "Hilchos Muktzeh shiurim", "Reb Aharon's shmuessen"): Admin › Collections. Attach a collection to a speaker or a topic page, then paste in shiur IDs or links.
- **Featured:** ★ in Admin › All shiurim, or tick "Featured" on the upload form.
- **Daf Yomi page:** shows every shiur tagged with today's masechta. Tag daf shiurim with *Gemara › (masechta)*.
- **Podcasts:** each speaker, series and topic page has a 🔔 Subscribe button. Submit a feed URL once to Apple Podcasts or Spotify to get listed.

To change the starting topic list, edit `scripts/gen_seed.py` and run `python3 scripts/gen_seed.py`. It regenerates `supabase/seed.sql` and the parsha/daf name mapping. After launch, edit topics in Admin instead.

---

## Project layout

```
supabase/
  migrations/0001_schema.sql     tables, enums, triggers
  migrations/0002_functions.sql  search_shiurim(), shiur_facets(), category tree, counters, new-user trigger
  migrations/0003_rls.sql        row-level security (who can read/write what)
  seed.sql                       Yeshivish topic tree + BMG location (generated)
  demo_data.sql                  optional placeholder content
scripts/gen_seed.py              source of truth for the starting topic list
src/
  app/                           pages (home, search, speakers, series, venues, categories, collections,
                                 shiur, parsha, daf-yomi, my, login, upload, admin, feed, api)
  components/ListingPage.tsx     the shared browse/filter/tabs template
  components/player/             persistent bottom audio player
  lib/i18n/                      en.ts, he.ts, yi.ts UI strings
  lib/calendar.ts                parsha of the week & daf yomi
  lib/r2.ts                      signed upload URLs
```

## Notes
- The database layer (schema, search, filters, sidebar counts, permissions) was tested against PostgreSQL 16. The app code was type-checked for internal consistency, but **`npm install && npm run build` hasn't been run yet**. Run that first, and fix any small library-version differences it reports (most likely the `@hebcal/*` calls in `src/lib/calendar.ts`).
- Have a native Yiddish speaker review `src/lib/i18n/yi.ts`. Hebrew UI strings are in `he.ts`.

-- BMGTorah core schema
-- Run in Supabase SQL editor (or `supabase db push`). Order: 0001 -> 0002 -> 0003, then seed.sql.

create extension if not exists pg_trgm;

-- ---------- enums ----------
do $$ begin
  create type media_type as enum ('audio', 'video', 'text');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shiur_language as enum ('en', 'he', 'yi');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shiur_status as enum ('draft', 'pending', 'published', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  -- listener: can save favorites / play later
  -- uploader: can upload for the speakers assigned to them (uploader_speakers),
  --           or any speaker if profiles.can_upload_any_speaker
  -- editor:   can upload/edit anything and approve the review queue
  -- admin:    editor + manage users and site structure
  create type user_role as enum ('listener', 'uploader', 'editor', 'admin');
exception when duplicate_object then null; end $$;

-- ---------- people & places ----------
create table if not exists speakers (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  name         text not null,              -- "Rabbi Yisroel Neuman"
  name_he      text,                       -- "הרב ..."
  sort_name    text,                       -- "Neuman, Yisroel" for A–Z index
  bio          text,
  photo_url    text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists venues (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  name         text not null,
  name_he      text,
  location     text,                       -- "Lakewood, NJ"
  created_at   timestamptz not null default now()
);

create table if not exists series (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  name         text not null,
  name_he      text,
  description  text,
  speaker_id   bigint references speakers(id) on delete set null,  -- optional "owner"
  image_url    text,
  featured     boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Two-level (or deeper) topic tree: Gemara > Bava Metzia, Halacha > Shabbos ...
create table if not exists categories (
  id           bigint generated always as identity primary key,
  parent_id    bigint references categories(id) on delete cascade,
  slug         text not null,
  name         text not null,              -- Yeshivish transliteration: "Bava Basra"
  name_he      text,                       -- "בבא בתרא"
  aliases      text[] not null default '{}', -- other spellings for search: {"Bava Batra"}
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  unique (parent_id, slug)
);
create unique index if not exists categories_root_slug on categories (slug) where parent_id is null;

-- ---------- shiurim ----------
create table if not exists shiurim (
  id               bigint generated always as identity primary key,
  slug             text not null,
  title            text not null,
  title_he         text,
  description      text,
  speaker_id       bigint not null references speakers(id),
  series_id        bigint references series(id) on delete set null,
  venue_id         bigint references venues(id) on delete set null,
  recorded_on      date,
  language         shiur_language not null default 'en',
  media_type       media_type not null default 'audio',
  media_key        text,          -- object key in R2 (audio/video/pdf)
  external_url     text,          -- e.g. YouTube/Vimeo link instead of a file
  duration_seconds int,
  file_size_bytes  bigint,
  status           shiur_status not null default 'draft',
  featured         boolean not null default false,
  review_note      text,          -- why it was rejected, etc.
  uploaded_by      uuid,          -- auth.users id
  approved_by      uuid,
  play_count       int not null default 0,
  download_count   int not null default 0,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  search_vector    tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(title_he, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored
);

create index if not exists shiurim_status_published on shiurim (status, published_at desc);
create index if not exists shiurim_speaker on shiurim (speaker_id);
create index if not exists shiurim_series on shiurim (series_id);
create index if not exists shiurim_venue on shiurim (venue_id);
create index if not exists shiurim_search on shiurim using gin (search_vector);
create index if not exists shiurim_title_trgm on shiurim using gin (title gin_trgm_ops);

create table if not exists shiur_categories (
  shiur_id     bigint not null references shiurim(id) on delete cascade,
  category_id  bigint not null references categories(id) on delete cascade,
  primary key (shiur_id, category_id)
);
create index if not exists shiur_categories_cat on shiur_categories (category_id);

-- Source sheets / mareh mekomos (PDFs, images)
create table if not exists shiur_sources (
  id          bigint generated always as identity primary key,
  shiur_id    bigint not null references shiurim(id) on delete cascade,
  label       text not null default 'Mareh Mekomos',
  file_key    text not null,
  created_at  timestamptz not null default now()
);

-- Editor-curated groupings ("Hilchos Muktzeh", "Rav Aharon's Shmuessen" ...)
create table if not exists collections (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  name         text not null,
  name_he      text,
  description  text,
  speaker_id   bigint references speakers(id) on delete cascade,     -- shows on that speaker's page
  category_id  bigint references categories(id) on delete cascade, -- shows on that category's page
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists collection_shiurim (
  collection_id bigint not null references collections(id) on delete cascade,
  shiur_id      bigint not null references shiurim(id) on delete cascade,
  position      int not null default 0,
  primary key (collection_id, shiur_id)
);

-- ---------- users ----------
create table if not exists profiles (
  id                      uuid primary key,   -- = auth.users.id
  email                   text,
  display_name            text,
  role                    user_role not null default 'listener',
  requires_review         boolean not null default true,  -- uploads go to the review queue
  can_upload_any_speaker  boolean not null default false,
  preferred_locale        text not null default 'en',
  created_at              timestamptz not null default now()
);

-- Which speakers an 'uploader' may upload for (e.g. a rebbi uploads only his own shiurim)
create table if not exists uploader_speakers (
  user_id    uuid not null references profiles(id) on delete cascade,
  speaker_id bigint not null references speakers(id) on delete cascade,
  primary key (user_id, speaker_id)
);

-- Follow a speaker / series / category
create table if not exists follows (
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        text not null check (kind in ('speaker', 'series', 'category')),
  target_id   bigint not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, kind, target_id)
);

-- "Play later" queue
create table if not exists play_later (
  user_id    uuid not null references profiles(id) on delete cascade,
  shiur_id   bigint not null references shiurim(id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (user_id, shiur_id)
);

-- Resume position, recently played, completed
create table if not exists listening_progress (
  user_id           uuid not null references profiles(id) on delete cascade,
  shiur_id          bigint not null references shiurim(id) on delete cascade,
  position_seconds  int not null default 0,
  completed         boolean not null default false,
  updated_at        timestamptz not null default now(),
  primary key (user_id, shiur_id)
);
create index if not exists listening_progress_recent on listening_progress (user_id, updated_at desc);

-- keep updated_at fresh
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists shiurim_touch on shiurim;
create trigger shiurim_touch before update on shiurim
  for each row execute function touch_updated_at();

-- stamp published_at the first time a shiur goes live
create or replace function stamp_published_at() returns trigger language plpgsql as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

drop trigger if exists shiurim_published on shiurim;
create trigger shiurim_published before insert or update on shiurim
  for each row execute function stamp_published_at();

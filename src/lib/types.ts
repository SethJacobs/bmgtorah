export type MediaType = "audio" | "video" | "text";
export type Lang = "en" | "he" | "yi";
export type ShiurStatus = "draft" | "pending" | "published" | "rejected";
export type Role = "listener" | "uploader" | "editor" | "admin";

export type CategoryTag = {
  id: number;
  name: string;
  name_he: string | null;
  slug: string;
  parent_name: string | null;
  parent_slug: string | null;
};

/** One row from the search_shiurim() database function */
export type ShiurRow = {
  id: number;
  slug: string;
  title: string;
  title_he: string | null;
  speaker_id: number;
  speaker_name: string;
  speaker_slug: string;
  series_id: number | null;
  series_name: string | null;
  series_slug: string | null;
  venue_id: number | null;
  venue_name: string | null;
  venue_slug: string | null;
  recorded_on: string | null;
  published_at: string | null;
  language: Lang;
  media_type: MediaType;
  media_key: string | null;
  external_url: string | null;
  duration_seconds: number | null;
  play_count: number;
  featured: boolean;
  categories: CategoryTag[];
  total_count: number;
};

/** One row from shiur_facets() */
export type Facet = {
  kind: "speaker" | "series" | "venue" | "category";
  id: number;
  slug: string;
  name: string;
  name_he: string | null;
  parent_name: string | null;
  parent_slug: string | null;
  n: number;
};

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  requires_review: boolean;
  can_upload_any_speaker: boolean;
  preferred_locale: string;
};

/** What the global player needs to play something */
export type PlayableShiur = {
  id: number;
  title: string;
  speaker_name: string;
  media_type: MediaType;
  src: string;
  href: string;
};

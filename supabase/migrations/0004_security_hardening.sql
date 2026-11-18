-- Fixes Supabase security-advisor warnings.
-- increment_play / increment_download stay callable by anyone (they power the public counters),
-- and is_editor() must stay executable because RLS policies call it.

create schema if not exists extensions;
alter extension pg_trgm set schema extensions;

alter function public.category_descendants(bigint) set search_path = public, extensions;
alter function public.filtered_shiur_ids(jsonb) set search_path = public, extensions;
alter function public.search_shiurim(jsonb, text, int, int) set search_path = public, extensions;
alter function public.shiur_facets(jsonb) set search_path = public, extensions;
alter function public.category_tree_counts() set search_path = public, extensions;
alter function public.touch_updated_at() set search_path = public;
alter function public.stamp_published_at() set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.current_role_name() from public, anon, authenticated;

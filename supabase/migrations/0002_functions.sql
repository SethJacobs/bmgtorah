-- Search, filters and facet counts. Every browse page (speaker, series, venue,
-- category, collection, search) calls these two functions with a JSON filter:
--
--   { "q": "muktzeh", "speaker": 12, "series": 3, "venue": 1, "category": 40,
--     "collection": 7, "type": "audio", "lang": "yi",
--     "dur": "short|medium|long", "uploaded": "today|week|month",
--     "featured": true, "status": "published" }
--
-- All keys are optional. "category" includes every sub-category under it.

create or replace function category_descendants(root bigint)
returns setof bigint language sql stable as $$
  with recursive tree as (
    select id from categories where id = root
    union all
    select c.id from categories c join tree t on c.parent_id = t.id
  )
  select id from tree;
$$;

create or replace function filtered_shiur_ids(f jsonb)
returns setof bigint language sql stable as $$
  select s.id
  from shiurim s
  join speakers sp on sp.id = s.speaker_id
  where s.status = coalesce((f->>'status')::shiur_status, 'published')
    and (f->>'id'         is null or s.id = (f->>'id')::bigint)
    and (f->>'exclude'    is null or s.id <> (f->>'exclude')::bigint)
    and (f->'ids'         is null or s.id in (select jsonb_array_elements_text(f->'ids')::bigint))
    and (f->>'speaker'    is null or s.speaker_id = (f->>'speaker')::bigint)
    and (f->>'series'     is null or s.series_id  = (f->>'series')::bigint)
    and (f->>'venue'      is null or s.venue_id   = (f->>'venue')::bigint)
    and (f->>'type'       is null or s.media_type = (f->>'type')::media_type)
    and (f->>'lang'       is null or s.language   = (f->>'lang')::shiur_language)
    and (f->>'featured'   is null or s.featured   = (f->>'featured')::boolean)
    and (f->>'category'   is null or exists (
          select 1 from shiur_categories sc
          where sc.shiur_id = s.id
            and sc.category_id in (select category_descendants((f->>'category')::bigint))))
    and (f->>'collection' is null or exists (
          select 1 from collection_shiurim cs
          where cs.shiur_id = s.id and cs.collection_id = (f->>'collection')::bigint))
    and (f->>'dur' is null
         or (f->>'dur' = 'short'  and s.duration_seconds <= 300)
         or (f->>'dur' = 'medium' and s.duration_seconds >  300 and s.duration_seconds <= 900)
         or (f->>'dur' = 'long'   and s.duration_seconds >  900))
    and (f->>'uploaded' is null or s.published_at >= case f->>'uploaded'
           when 'today' then date_trunc('day', now())
           when 'week'  then now() - interval '7 days'
           when 'month' then now() - interval '30 days'
           else '-infinity'::timestamptz end)
    and (coalesce(f->>'q', '') = ''
         or s.search_vector @@ websearch_to_tsquery('simple', f->>'q')
         or s.title % (f->>'q')
         or s.title ilike '%' || (f->>'q') || '%'
         or sp.name ilike '%' || (f->>'q') || '%'
         or coalesce(sp.name_he, '') ilike '%' || (f->>'q') || '%'
         -- match category names and their alternate spellings (Shabbos / Shabbat)
         or exists (
              select 1 from shiur_categories sc
              join categories c on c.id = sc.category_id
              where sc.shiur_id = s.id
                and (c.name ilike '%' || (f->>'q') || '%'
                     or coalesce(c.name_he, '') ilike '%' || (f->>'q') || '%'
                     or exists (select 1 from unnest(c.aliases) a where a ilike '%' || (f->>'q') || '%'))));
$$;

create or replace function search_shiurim(
  f jsonb default '{}'::jsonb,
  sort text default 'recent',      -- recent | top | oldest | title | relevance
  lim int default 20,
  off int default 0
)
returns table (
  id bigint, slug text, title text, title_he text,
  speaker_id bigint, speaker_name text, speaker_slug text,
  series_id bigint, series_name text, series_slug text,
  venue_id bigint, venue_name text, venue_slug text,
  recorded_on date, published_at timestamptz,
  language shiur_language, media_type media_type,
  media_key text, external_url text, duration_seconds int,
  play_count int, featured boolean,
  categories jsonb,
  total_count bigint
)
language sql stable as $$
  with ids as (select filtered_shiur_ids(f) as id),
  base as (
    select s.*, count(*) over () as total_count,
      case when coalesce(f->>'q','') = '' then 0
           else ts_rank(s.search_vector, websearch_to_tsquery('simple', f->>'q'))
                + similarity(s.title, f->>'q') end as rank
    from shiurim s join ids on ids.id = s.id
  )
  select b.id, b.slug, b.title, b.title_he,
         sp.id, sp.name, sp.slug,
         se.id, se.name, se.slug,
         v.id, v.name, v.slug,
         b.recorded_on, b.published_at,
         b.language, b.media_type, b.media_key, b.external_url, b.duration_seconds,
         b.play_count, b.featured,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', c.id, 'name', c.name, 'name_he', c.name_he, 'slug', c.slug,
                    'parent_name', p.name, 'parent_slug', p.slug)
                  order by p.sort_order, c.sort_order)
           from shiur_categories sc
           join categories c on c.id = sc.category_id
           left join categories p on p.id = c.parent_id
           where sc.shiur_id = b.id), '[]'::jsonb),
         b.total_count
  from base b
  join speakers sp on sp.id = b.speaker_id
  left join series se on se.id = b.series_id
  left join venues v on v.id = b.venue_id
  order by
    case when sort = 'top'       then b.play_count end desc nulls last,
    case when sort = 'relevance' then b.rank end desc nulls last,
    case when sort = 'oldest'    then coalesce(b.recorded_on::timestamptz, b.published_at) end asc,
    case when sort = 'title'     then b.title end asc,
    coalesce(b.recorded_on::timestamptz, b.published_at) desc nulls last,
    b.id desc
  limit least(greatest(lim, 1), 100) offset greatest(off, 0);
$$;

-- Counts for the sidebar lists: speakers, series, venues, categories within the filtered set.
create or replace function shiur_facets(f jsonb default '{}'::jsonb)
returns table (kind text, id bigint, slug text, name text, name_he text,
               parent_name text, parent_slug text, n bigint)
language sql stable as $$
  with ids as (select filtered_shiur_ids(f) as id),
  s as (select sh.* from shiurim sh join ids on ids.id = sh.id)
  select 'speaker', sp.id, sp.slug, sp.name, sp.name_he, null, null, count(*)
    from s join speakers sp on sp.id = s.speaker_id
    group by sp.id
  union all
  select 'series', se.id, se.slug, se.name, se.name_he, null, null, count(*)
    from s join series se on se.id = s.series_id
    group by se.id
  union all
  select 'venue', v.id, v.slug, v.name, v.name_he, null, null, count(*)
    from s join venues v on v.id = s.venue_id
    group by v.id
  union all
  select 'category', c.id, c.slug, c.name, c.name_he, p.name, p.slug, count(*)
    from s join shiur_categories sc on sc.shiur_id = s.id
    join categories c on c.id = sc.category_id
    left join categories p on p.id = c.parent_id
    group by c.id, p.name, p.slug
  order by 1, 8 desc, 4;
$$;

-- Category tree with total published shiurim per node (including sub-categories)
create or replace function category_tree_counts()
returns table (id bigint, parent_id bigint, slug text, name text, name_he text,
               sort_order int, n bigint)
language sql stable as $$
  select c.id, c.parent_id, c.slug, c.name, c.name_he, c.sort_order,
         (select count(distinct sc.shiur_id)
            from shiur_categories sc
            join shiurim s on s.id = sc.shiur_id and s.status = 'published'
            where sc.category_id in (select category_descendants(c.id))) as n
  from categories c
  order by c.parent_id nulls first, c.sort_order, c.name;
$$;

-- Counters that anonymous listeners may bump without write access to shiurim
create or replace function increment_play(p_shiur bigint)
returns void language sql security definer set search_path = public as $$
  update shiurim set play_count = play_count + 1
  where id = p_shiur and status = 'published';
$$;

create or replace function increment_download(p_shiur bigint)
returns void language sql security definer set search_path = public as $$
  update shiurim set download_count = download_count + 1
  where id = p_shiur and status = 'published';
$$;

-- Role helpers used by RLS
create or replace function current_role_name()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('editor', 'admin') from profiles where id = auth.uid()), false);
$$;

-- Create a profile row whenever someone signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

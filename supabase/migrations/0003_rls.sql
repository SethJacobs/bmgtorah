-- Row Level Security.
-- Public visitors read published content directly with the anon key.
-- All writes to shiurim / site structure go through the Next.js server
-- (service-role key) after the server checks the user's role, but editors
-- are also allowed direct writes so the Supabase dashboard stays usable.

alter table speakers           enable row level security;
alter table venues             enable row level security;
alter table series             enable row level security;
alter table categories         enable row level security;
alter table shiurim            enable row level security;
alter table shiur_categories   enable row level security;
alter table shiur_sources      enable row level security;
alter table collections        enable row level security;
alter table collection_shiurim enable row level security;
alter table profiles           enable row level security;
alter table uploader_speakers  enable row level security;
alter table follows            enable row level security;
alter table play_later         enable row level security;
alter table listening_progress enable row level security;

-- Site structure: everyone reads, editors write
do $$
declare t text;
begin
  foreach t in array array['speakers','venues','series','categories','collections','collection_shiurim'] loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('create policy %I on %I for select using (true)', t || '_read', t);
    execute format('drop policy if exists %I on %I', t || '_edit', t);
    execute format('create policy %I on %I for all using (is_editor()) with check (is_editor())', t || '_edit', t);
  end loop;
end $$;

-- Shiurim: published are public; uploaders see their own drafts; editors see all
drop policy if exists shiurim_read on shiurim;
create policy shiurim_read on shiurim for select
  using (status = 'published' or uploaded_by = auth.uid() or is_editor());
drop policy if exists shiurim_edit on shiurim;
create policy shiurim_edit on shiurim for all using (is_editor()) with check (is_editor());

drop policy if exists shiur_categories_read on shiur_categories;
create policy shiur_categories_read on shiur_categories for select
  using (exists (select 1 from shiurim s where s.id = shiur_id));  -- inherits shiurim visibility
drop policy if exists shiur_categories_edit on shiur_categories;
create policy shiur_categories_edit on shiur_categories for all using (is_editor()) with check (is_editor());

drop policy if exists shiur_sources_read on shiur_sources;
create policy shiur_sources_read on shiur_sources for select
  using (exists (select 1 from shiurim s where s.id = shiur_id));
drop policy if exists shiur_sources_edit on shiur_sources;
create policy shiur_sources_edit on shiur_sources for all using (is_editor()) with check (is_editor());

-- Profiles: you see yourself; editors see everyone. Role changes happen server-side only.
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (id = auth.uid() or is_editor());

drop policy if exists uploader_speakers_read on uploader_speakers;
create policy uploader_speakers_read on uploader_speakers for select
  using (user_id = auth.uid() or is_editor());

-- Personal library: each user manages only their own rows
do $$
declare t text;
begin
  foreach t in array array['follows','play_later','listening_progress'] loop
    execute format('drop policy if exists %I on %I', t || '_own', t);
    execute format('create policy %I on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_own', t);
  end loop;
end $$;

grant execute on function increment_play(bigint), increment_download(bigint) to anon, authenticated;

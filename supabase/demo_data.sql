-- OPTIONAL demo content so the site isn't empty while you build it.
-- Placeholder names only. Delete before launch:
--   delete from shiurim where slug like 'demo-%'; delete from speakers where slug like 'demo-%';
--   delete from series where slug like 'demo-%';

insert into speakers (slug, name, name_he, sort_name, bio) values
  ('demo-rabbi-a', 'Rabbi A. Sample', 'הרב א. דוגמא', 'Sample, A.', 'Demo speaker — replace with real rebbeim.'),
  ('demo-rabbi-b', 'Rabbi B. Example', 'הרב ב. משל', 'Example, B.', 'Demo speaker.'),
  ('demo-rabbi-c', 'Rabbi C. Placeholder', 'הרב ג. מקום', 'Placeholder, C.', 'Demo speaker (Yiddish shiurim).');

insert into series (slug, name, name_he, description, speaker_id, featured)
select 'demo-daf-yomi', 'Daf Yomi', 'דף יומי', 'Daily daf shiur.', id, true from speakers where slug = 'demo-rabbi-a';
insert into series (slug, name, name_he, description, featured) values
  ('demo-ten-minute-halacha', 'Ten Minute Halacha', 'עשר דקות הלכה', 'Short practical halacha.', true),
  ('demo-motzei-shabbos-shmuess', 'Motzei Shabbos Shmuess', 'שמועס מוצאי שבת', 'Weekly mussar shmuess.', false);

with v as (select id from venues where slug = 'bmg-lakewood'),
d as (
  select * from (values
    ('demo-bm-21a', 'Bava Metzia 21a – Yi''ush Shelo Mida''as', 'demo-rabbi-a', 'demo-daf-yomi', 'en', 'audio', 2700, 1, array['gemara/bava-metzia']),
    ('demo-bm-21b', 'Bava Metzia 21b – Simanim', 'demo-rabbi-a', 'demo-daf-yomi', 'en', 'audio', 2640, 2, array['gemara/bava-metzia']),
    ('demo-muktzeh-1', 'Muktzeh #1 – Kli Shemelachto L''issur', 'demo-rabbi-b', 'demo-ten-minute-halacha', 'en', 'audio', 600, 3, array['halacha/muktzeh','halacha/hilchos-shabbos']),
    ('demo-muktzeh-2', 'Muktzeh #2 – Bosis L''davar Ha''asur', 'demo-rabbi-b', 'demo-ten-minute-halacha', 'en', 'audio', 580, 4, array['halacha/muktzeh','halacha/hilchos-shabbos']),
    ('demo-vayeira-shmuess', 'Vayeira – Hachnosas Orchim', 'demo-rabbi-c', 'demo-motzei-shabbos-shmuess', 'yi', 'audio', 1800, 5, array['parsha/vayeira','mussar/chessed']),
    ('demo-elul-shmuess', 'Elul Shmuess – Hachana L''Yom Hadin', 'demo-rabbi-c', 'demo-motzei-shabbos-shmuess', 'yi', 'video', 2100, 6, array['moadim/elul','mussar/teshuvah']),
    ('demo-brachos-he', 'ברכות דף ב – זמן קריאת שמע', 'demo-rabbi-a', null, 'he', 'audio', 3300, 7, array['gemara/brachos']),
    ('demo-reb-aharon', 'Reb Aharon on Ameilus BaTorah', 'demo-rabbi-b', null, 'en', 'text', null, 8, array['gedolim/rav-aharon-kotler-ztl','mussar/limud-hatorah'])
  ) as t(slug, title, speaker, series, lang, mtype, dur, days_ago, cats)
),
ins as (
  insert into shiurim (slug, title, speaker_id, series_id, venue_id, language, media_type,
                       duration_seconds, status, recorded_on, published_at, play_count, featured)
  select d.slug, d.title, sp.id, se.id, (select id from v), d.lang::shiur_language, d.mtype::media_type,
         d.dur, 'published', current_date - d.days_ago, now() - (d.days_ago || ' days')::interval,
         (10 - d.days_ago) * 7, d.days_ago in (1, 5)
  from d join speakers sp on sp.slug = d.speaker
  left join series se on se.slug = d.series
  returning id, slug
)
insert into shiur_categories (shiur_id, category_id)
select ins.id, c.id
from ins join d on d.slug = ins.slug
cross join unnest(d.cats) as path
join categories p on p.slug = split_part(path, '/', 1) and p.parent_id is null
join categories c on c.parent_id = p.id and c.slug = split_part(path, '/', 2);

-- one pending upload to show the review queue
insert into shiurim (slug, title, speaker_id, language, media_type, status, duration_seconds)
select 'demo-pending', 'Pending: Hilchos Chanukah (awaiting review)', id, 'en', 'audio', 'pending', 900
from speakers where slug = 'demo-rabbi-b';

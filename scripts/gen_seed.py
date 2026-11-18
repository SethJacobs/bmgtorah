#!/usr/bin/env python3
"""Generates supabase/seed.sql and src/lib/calendar-names.ts from one table.

Edit the lists below, then run:  python3 scripts/gen_seed.py
Each child is (Yeshivish name, Hebrew name, [alternate spellings], hebcal_name or None).
hebcal_name lets the site link "this week's parsha" / "today's daf" to the right category.
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def slugify(s):
    s = s.lower().replace("'", "").replace('"', '').replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

GEMARA = [
    ("Brachos", "ברכות", ["Berachot", "Berakhot"], "Berachot"),
    ("Shabbos", "שבת", ["Shabbat"], "Shabbat"),
    ("Eruvin", "עירובין", [], "Eruvin"),
    ("Pesachim", "פסחים", [], "Pesachim"),
    ("Shekalim", "שקלים", [], "Shekalim"),
    ("Yoma", "יומא", [], "Yoma"),
    ("Succah", "סוכה", ["Sukkah", "Sukka"], "Sukkah"),
    ("Beitzah", "ביצה", ["Beitza", "Beitsah"], "Beitzah"),
    ("Rosh Hashanah", "ראש השנה", ["Rosh Hashana"], "Rosh Hashana"),
    ("Taanis", "תענית", ["Taanit", "Ta'anit"], "Taanit"),
    ("Megillah", "מגילה", [], "Megillah"),
    ("Moed Katan", "מועד קטן", [], "Moed Katan"),
    ("Chagigah", "חגיגה", [], "Chagigah"),
    ("Yevamos", "יבמות", ["Yevamot"], "Yevamot"),
    ("Kesubos", "כתובות", ["Ketubot", "Ketubos"], "Ketubot"),
    ("Nedarim", "נדרים", [], "Nedarim"),
    ("Nazir", "נזיר", [], "Nazir"),
    ("Sotah", "סוטה", [], "Sotah"),
    ("Gittin", "גיטין", ["Gitin"], "Gitin"),
    ("Kiddushin", "קידושין", [], "Kiddushin"),
    ("Bava Kamma", "בבא קמא", ["Baba Kamma", "Bava Kama"], "Baba Kamma"),
    ("Bava Metzia", "בבא מציעא", ["Baba Metzia"], "Baba Metzia"),
    ("Bava Basra", "בבא בתרא", ["Bava Batra", "Baba Batra"], "Baba Batra"),
    ("Sanhedrin", "סנהדרין", [], "Sanhedrin"),
    ("Makkos", "מכות", ["Makkot", "Makos"], "Makkot"),
    ("Shevuos", "שבועות", ["Shevuot"], "Shevuot"),
    ("Avodah Zarah", "עבודה זרה", ["Avoda Zara"], "Avodah Zarah"),
    ("Horayos", "הוריות", ["Horayot"], "Horayot"),
    ("Zevachim", "זבחים", [], "Zevachim"),
    ("Menachos", "מנחות", ["Menachot"], "Menachot"),
    ("Chullin", "חולין", ["Chulin"], "Chullin"),
    ("Bechoros", "בכורות", ["Bechorot"], "Bechorot"),
    ("Arachin", "ערכין", [], "Arachin"),
    ("Temurah", "תמורה", [], "Temurah"),
    ("Kerisus", "כריתות", ["Keritot", "Krisos"], "Keritot"),
    ("Meilah", "מעילה", [], "Meilah"),
    ("Kinnim", "קינים", [], "Kinnim"),
    ("Tamid", "תמיד", [], "Tamid"),
    ("Middos", "מדות", ["Midot", "Middot"], "Midot"),
    ("Niddah", "נדה", ["Nidah"], "Niddah"),
]

PARSHA = [
    ("Bereishis", "בראשית", ["Bereishit", "Bereshit"], "Bereshit"),
    ("Noach", "נח", [], "Noach"),
    ("Lech Lecha", "לך לך", ["Lech-Lecha"], "Lech-Lecha"),
    ("Vayeira", "וירא", ["Vayera"], "Vayera"),
    ("Chayei Sarah", "חיי שרה", ["Chayei Sara"], "Chayei Sara"),
    ("Toldos", "תולדות", ["Toldot"], "Toldot"),
    ("Vayeitzei", "ויצא", ["Vayetzei", "Vayetze"], "Vayetzei"),
    ("Vayishlach", "וישלח", [], "Vayishlach"),
    ("Vayeishev", "וישב", ["Vayeshev"], "Vayeshev"),
    ("Mikeitz", "מקץ", ["Miketz", "Mikietz"], "Miketz"),
    ("Vayigash", "ויגש", [], "Vayigash"),
    ("Vayechi", "ויחי", [], "Vayechi"),
    ("Shemos", "שמות", ["Shemot", "Shmot"], "Shemot"),
    ("Va'eira", "וארא", ["Vaera", "Va'era"], "Vaera"),
    ("Bo", "בא", [], "Bo"),
    ("Beshalach", "בשלח", [], "Beshalach"),
    ("Yisro", "יתרו", ["Yitro"], "Yitro"),
    ("Mishpatim", "משפטים", [], "Mishpatim"),
    ("Terumah", "תרומה", [], "Terumah"),
    ("Tetzaveh", "תצוה", [], "Tetzaveh"),
    ("Ki Sisa", "כי תשא", ["Ki Tisa", "Ki Tissa"], "Ki Tisa"),
    ("Vayakhel", "ויקהל", [], "Vayakhel"),
    ("Pekudei", "פקודי", [], "Pekudei"),
    ("Vayikra", "ויקרא", [], "Vayikra"),
    ("Tzav", "צו", [], "Tzav"),
    ("Shemini", "שמיני", ["Shmini"], "Shmini"),
    ("Tazria", "תזריע", [], "Tazria"),
    ("Metzora", "מצורע", [], "Metzora"),
    ("Acharei Mos", "אחרי מות", ["Achrei Mot", "Acharei Mot"], "Achrei Mot"),
    ("Kedoshim", "קדושים", [], "Kedoshim"),
    ("Emor", "אמור", [], "Emor"),
    ("Behar", "בהר", [], "Behar"),
    ("Bechukosai", "בחוקותי", ["Bechukotai"], "Bechukotai"),
    ("Bamidbar", "במדבר", [], "Bamidbar"),
    ("Nasso", "נשא", ["Naso"], "Nasso"),
    ("Beha'aloscha", "בהעלותך", ["Beha'alotcha", "Behaalotecha"], "Beha'alotcha"),
    ("Shelach", "שלח", ["Sh'lach", "Shlach"], "Sh'lach"),
    ("Korach", "קרח", [], "Korach"),
    ("Chukas", "חקת", ["Chukat"], "Chukat"),
    ("Balak", "בלק", [], "Balak"),
    ("Pinchas", "פינחס", [], "Pinchas"),
    ("Matos", "מטות", ["Matot"], "Matot"),
    ("Masei", "מסעי", [], "Masei"),
    ("Devarim", "דברים", [], "Devarim"),
    ("Va'eschanan", "ואתחנן", ["Vaetchanan", "Va'etchanan"], "Vaetchanan"),
    ("Eikev", "עקב", ["Ekev"], "Eikev"),
    ("Re'eh", "ראה", ["Reeh"], "Re'eh"),
    ("Shoftim", "שופטים", [], "Shoftim"),
    ("Ki Seitzei", "כי תצא", ["Ki Teitzei", "Ki Tetzei"], "Ki Teitzei"),
    ("Ki Savo", "כי תבוא", ["Ki Tavo"], "Ki Tavo"),
    ("Nitzavim", "נצבים", [], "Nitzavim"),
    ("Vayeilech", "וילך", ["Vayelech"], "Vayeilech"),
    ("Ha'azinu", "האזינו", ["Haazinu"], "Ha'azinu"),
    ("V'zos Habracha", "וזאת הברכה", ["Vezot Haberakhah", "Vezos Habracha"], "Vezot Haberakhah"),
]

NACH = [
    ("Yehoshua", "יהושע", ["Joshua"], None), ("Shoftim", "שופטים", ["Judges"], None),
    ("Shmuel", "שמואל", ["Samuel"], None), ("Melachim", "מלכים", ["Kings"], None),
    ("Yeshayahu", "ישעיהו", ["Isaiah", "Yeshaya"], None), ("Yirmiyahu", "ירמיהו", ["Jeremiah"], None),
    ("Yechezkel", "יחזקאל", ["Ezekiel"], None), ("Trei Asar", "תרי עשר", ["Twelve Prophets"], None),
    ("Tehillim", "תהלים", ["Psalms"], None), ("Mishlei", "משלי", ["Proverbs"], None),
    ("Iyov", "איוב", ["Job"], None), ("Shir HaShirim", "שיר השירים", ["Song of Songs"], None),
    ("Rus", "רות", ["Ruth"], None), ("Eichah", "איכה", ["Lamentations", "Eicha"], None),
    ("Koheles", "קהלת", ["Kohelet", "Ecclesiastes"], None), ("Esther", "אסתר", [], None),
    ("Daniel", "דניאל", [], None), ("Ezra-Nechemiah", "עזרא ונחמיה", ["Ezra", "Nehemiah"], None),
    ("Divrei HaYamim", "דברי הימים", ["Chronicles"], None),
]

MISHNAYOS = [
    ("Zeraim", "זרעים", [], None), ("Moed", "מועד", [], None), ("Nashim", "נשים", [], None),
    ("Nezikin", "נזיקין", [], None), ("Kodashim", "קדשים", [], None), ("Taharos", "טהרות", ["Taharot"], None),
    ("Pirkei Avos", "פרקי אבות", ["Pirkei Avot", "Avot", "Avos"], None),
]

HALACHA = [
    ("Orach Chaim", "אורח חיים", [], None), ("Yoreh Deah", "יורה דעה", [], None),
    ("Even HaEzer", "אבן העזר", [], None), ("Choshen Mishpat", "חושן משפט", [], None),
    ("Hilchos Shabbos", "הלכות שבת", ["Shabbat", "Shabbos"], None),
    ("Muktzeh", "מוקצה", ["Muktzah", "Muktza"], None),
    ("Hilchos Brachos", "הלכות ברכות", ["Berachot", "Brachos"], None),
    ("Tefillah", "תפילה", ["Tefila", "Davening"], None),
    ("Kashrus", "כשרות", ["Kashrut", "Basar Bechalav"], None),
    ("Hilchos Yom Tov", "הלכות יום טוב", [], None),
    ("Eruv", "עירוב", ["Eruvin"], None),
    ("Tzitzis & Tefillin", "ציצית ותפילין", ["Tzitzit", "Tefilin"], None),
    ("Mezuzah", "מזוזה", [], None),
    ("Aveilus", "אבילות", ["Aveilut", "Mourning"], None),
    ("Ribbis", "ריבית", ["Ribbit", "Interest"], None),
    ("Taharas HaMishpacha", "טהרת המשפחה", ["Taharat HaMishpacha"], None),
    ("Choshen Mishpat L'Maaseh", "ממונות", ["Business Halacha", "Monetary Law"], None),
    ("Bein Adam LaChaveiro", "בין אדם לחבירו", [], None),
    ("Shemiras HaLashon", "שמירת הלשון", ["Lashon Hara", "Shmiras Halashon"], None),
    ("Medical Halacha", "הלכה ורפואה", [], None),
]

MUSSAR = [
    ("Sichos Mussar", "שיחות מוסר", ["Shmuessen", "Shmuess", "Vaad"], None),
    ("Emunah & Bitachon", "אמונה ובטחון", ["Emuna", "Bitachon"], None),
    ("Middos", "מדות", ["Middot", "Character"], None),
    ("Yiras Shamayim", "יראת שמים", ["Yirat Shamayim"], None),
    ("Teshuvah", "תשובה", ["Teshuva"], None),
    ("Chessed", "חסד", ["Chesed"], None),
    ("Limud HaTorah", "לימוד התורה", ["Ameilus BaTorah", "Torah Study"], None),
    ("Shalom Bayis", "שלום בית", ["Shalom Bayit", "Marriage"], None),
    ("Chinuch", "חינוך", ["Chinuch Habanim", "Parenting"], None),
    ("Shidduchim", "שידוכים", [], None),
    ("Mesillas Yesharim", "מסילת ישרים", ["Mesilat Yesharim"], None),
    ("Chovos HaLevavos", "חובות הלבבות", ["Chovot HaLevavot"], None),
    ("Shaarei Teshuvah", "שערי תשובה", [], None),
    ("Michtav M'Eliyahu", "מכתב מאליהו", [], None),
    ("Nefesh HaChaim", "נפש החיים", [], None),
]

MOADIM = [
    ("Elul", "אלול", [], None), ("Rosh Hashanah", "ראש השנה", ["Rosh Hashana"], None),
    ("Yom Kippur", "יום כפור", ["Yom Kipur"], None), ("Succos", "סוכות", ["Sukkot", "Sukkos"], None),
    ("Shemini Atzeres & Simchas Torah", "שמיני עצרת ושמחת תורה", ["Simchat Torah", "Shemini Atzeret"], None),
    ("Chanukah", "חנוכה", ["Hanukkah", "Chanuka"], None), ("Asarah B'Teves", "עשרה בטבת", ["Asara B'Tevet"], None),
    ("Tu B'Shvat", "ט\"ו בשבט", [], None), ("Purim", "פורים", [], None), ("Pesach", "פסח", ["Passover"], None),
    ("Sefiras HaOmer", "ספירת העומר", ["Sefirat HaOmer", "Omer"], None), ("Lag BaOmer", "ל\"ג בעומר", [], None),
    ("Shavuos", "שבועות", ["Shavuot"], None), ("Bein HaMetzarim", "בין המצרים", ["Three Weeks", "Nine Days"], None),
    ("Tisha B'Av", "תשעה באב", [], None), ("Rosh Chodesh", "ראש חודש", [], None),
    ("Shabbos Kodesh", "שבת קודש", ["Shabbat"], None),
]

GEDOLIM = [
    ("Rav Aharon Kotler zt\"l", "הגאון רבי אהרן קוטלר זצ\"ל", ["Reb Aharon"], None),
    ("Rav Shneur Kotler zt\"l", "הגאון רבי שניאור קוטלר זצ\"ל", ["Reb Shneur"], None),
    ("Hespedim", "הספדים", ["Eulogies"], None),
    ("Yahrtzeit Shiurim", "שיעורי יארצייט", ["Yahrzeit"], None),
]

EVENTS = [
    ("Yarchei Kallah", "ירחי כלה", [], None), ("Siyumim", "סיומים", ["Siyum"], None),
    ("Kinusim", "כינוסים", ["Kinus"], None), ("Chaburos", "חבורות", ["Chabura"], None),
]

TREE = [
    ("Gemara", "גמרא", GEMARA),
    ("Parsha", "פרשת השבוע", PARSHA),
    ("Halacha", "הלכה", HALACHA),
    ("Mussar & Hashkafa", "מוסר והשקפה", MUSSAR),
    ("Moadim", "מועדים", MOADIM),
    ("Nach", "נ\"ך", NACH),
    ("Mishnayos", "משניות", MISHNAYOS),
    ("Gedolei Yisroel", "גדולי ישראל", GEDOLIM),
    ("Events", "אירועים", EVENTS),
]

def q(s):
    return "'" + s.replace("'", "''") + "'" if s is not None else "null"

def arr(xs):
    return "array[" + ",".join(q(x) for x in xs) + "]::text[]" if xs else "'{}'::text[]"

ROOT_SLUGS = {"Gemara": "gemara", "Parsha": "parsha", "Halacha": "halacha",
              "Mussar & Hashkafa": "mussar", "Moadim": "moadim", "Nach": "nach",
              "Mishnayos": "mishnayos", "Gedolei Yisroel": "gedolim", "Events": "events"}

out = ["-- Generated by scripts/gen_seed.py — edit that file, not this one.",
       "-- Safe to run once on a fresh database.", ""]
out.append("insert into categories (slug, name, name_he, sort_order) values")
out.append(",\n".join(f"  ({q(ROOT_SLUGS[n])}, {q(n)}, {q(he)}, {i})" for i, (n, he, _) in enumerate(TREE)) + ";")
out.append("")
for root, _, kids in TREE:
    rows = ",\n".join(
        f"    ({q(slugify(n))}, {q(n)}, {q(he)}, {arr(al)}, {i})" for i, (n, he, al, _) in enumerate(kids))
    out.append(
        "insert into categories (parent_id, slug, name, name_he, aliases, sort_order)\n"
        "select p.id, v.slug, v.name, v.name_he, v.aliases, v.ord\n"
        f"from categories p, (values\n{rows}\n) as v(slug, name, name_he, aliases, ord)\n"
        f"where p.slug = {q(ROOT_SLUGS[root])} and p.parent_id is null;\n")

out.append("insert into venues (slug, name, name_he, location) values\n"
           "  ('bmg-lakewood', 'Beis Medrash Gevoha', 'בית מדרש גבוה', 'Lakewood, NJ');")

with open(os.path.join(ROOT, "supabase", "seed.sql"), "w") as f:
    f.write("\n".join(out) + "\n")

parsha = {h: {"slug": slugify(n), "name": n, "he": he} for n, he, _, h in PARSHA if h}
masechta = {h: {"slug": slugify(n), "name": n, "he": he} for n, he, _, h in GEMARA if h}
ts = ("// Generated by scripts/gen_seed.py — maps hebcal names to BMGTorah category slugs.\n"
      "export type CalName = { slug: string; name: string; he: string };\n"
      f"export const PARSHA_BY_HEBCAL: Record<string, CalName> = {json.dumps(parsha, ensure_ascii=False, indent=2)};\n"
      f"export const MASECHTA_BY_HEBCAL: Record<string, CalName> = {json.dumps(masechta, ensure_ascii=False, indent=2)};\n")
os.makedirs(os.path.join(ROOT, "src", "lib"), exist_ok=True)
with open(os.path.join(ROOT, "src", "lib", "calendar-names.ts"), "w") as f:
    f.write(ts)
print("wrote seed.sql and calendar-names.ts")

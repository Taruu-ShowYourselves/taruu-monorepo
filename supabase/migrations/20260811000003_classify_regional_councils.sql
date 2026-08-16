-- Classify the regional councils, from a named source.
--
-- `municipalities.kind` shipped with a `'municipality'` default and nothing
-- ever set it: all 259 authorities carried the default, which meant the column
-- looked like data and was actually a placeholder. Anything rendered from it
-- was either dark (the desk's dial could never find a regional council to put
-- in its second tier) or an outright false claim, since a good number of those
-- rows are מועצה מקומית rather than עירייה.
--
-- Source: the Population and Immigration Authority's locality register on
-- data.gov.il, resource 5c78e9fa-c2e2-4771-93ff-7f400a12f7ba, which carries
-- `שם_מועצה` - the regional council each settlement belongs to. The distinct
-- values of that column are the regional councils of Israel: 54 in the source,
-- 52 of which exist as authorities here. (גן רווה and שדות דן are in the
-- source and not in this table; they are not created here, because inventing
-- authority rows is a different decision from classifying existing ones.)
--
-- What this migration deliberately does NOT do: split the remaining 207 into
-- עירייה and מועצה מקומית. No machine-readable government dataset carrying
-- מעמד מוניציפלי was found - not on data.gov.il, not in the Interior
-- Ministry's own published files - and the working rule people reach for
-- ("over 20,000 residents is a city") is a heuristic, not a source. This table
-- already refuses to publish a population without a named source, a URL and an
-- as-of date; the same standard applies to what kind of authority a place is.
-- Those rows keep the default and gain no provenance, and the reader-facing
-- code is written to say nothing about a row it cannot source.

ALTER TABLE municipalities
  ADD COLUMN IF NOT EXISTS kind_source_name text,
  ADD COLUMN IF NOT EXISTS kind_source_url  text,
  ADD COLUMN IF NOT EXISTS kind_as_of       date;

COMMENT ON COLUMN municipalities.kind_source_name IS
  'Where this row''s `kind` came from. NULL means kind is still the column default and must not be published as a fact.';

-- Provenance and classification move together or not at all.
ALTER TABLE municipalities
  DROP CONSTRAINT IF EXISTS municipalities_kind_provenance_check;
ALTER TABLE municipalities
  ADD CONSTRAINT municipalities_kind_provenance_check CHECK (
    (kind_source_name IS NULL AND kind_source_url IS NULL AND kind_as_of IS NULL)
    OR (kind_source_name IS NOT NULL AND kind_source_url IS NOT NULL AND kind_as_of IS NOT NULL)
  );

WITH sourced(code) AS (VALUES
  ('אל קסום'),
  ('אל-בטוף'),
  ('אלונה'),
  ('אשכול'),
  ('באר טוביה'),
  ('בוסתאן אל-מרג'),
  ('בני שמעון'),
  ('ברנר'),
  ('גדרות'),
  ('גולן'),
  ('גוש עציון'),
  ('גזר'),
  ('דרום השרון'),
  ('הגלבוע'),
  ('הגליל העליון'),
  ('הגליל התחתון'),
  ('הערבה התיכונה'),
  ('הר חברון'),
  ('זבולון'),
  ('חבל אילות'),
  ('חבל יבנה'),
  ('חבל מודיעין'),
  ('חוף אשקלון'),
  ('חוף הכרמל'),
  ('חוף השרון'),
  ('יואב'),
  ('לב השרון'),
  ('לכיש'),
  ('מבואות החרמון'),
  ('מגידו'),
  ('מגילות ים המלח'),
  ('מטה אשר'),
  ('מטה בנימין'),
  ('מטה יהודה'),
  ('מנשה'),
  ('מעלה יוסף'),
  ('מרום הגליל'),
  ('מרחבים'),
  ('משגב'),
  ('נווה מדבר'),
  ('נחל שורק'),
  ('עמק הירדן'),
  ('עמק המעיינות'),
  ('עמק חפר'),
  ('עמק יזרעאל'),
  ('ערבות הירדן'),
  ('רמת נגב'),
  ('שדות נגב'),
  ('שומרון'),
  ('שער הנגב'),
  ('שפיר'),
  ('תמר')
)
UPDATE municipalities m
   SET kind             = 'regional_council',
       kind_source_name = 'רשות האוכלוסין וההגירה - רשימת יישובים בישראל (data.gov.il)',
       kind_source_url  = 'https://data.gov.il/dataset/citiesandsettelments',
       kind_as_of       = DATE '2026-08-09'
  FROM sourced s
 WHERE m.code = s.code
   AND m.kind <> 'regional_council';

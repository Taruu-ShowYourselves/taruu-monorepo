-- The authority network: regional councils, who borders whom, who runs each
-- one, and what the residents make of them.
--
-- Four additions, in dependency order:
--
--   1. TAXONOMY   - `kind` grows past municipality/national to carry local
--                   councils, regional councils and the settlements that sit
--                   inside them. A regional council is an authority like any
--                   other, so it gets the same row, the same slug and
--                   therefore the same public page.
--   2. ADJACENCY  - an undirected graph over authorities. Stored one row per
--                   unordered pair so symmetry is structural: there is no way
--                   to record "A borders B" without also having recorded
--                   "B borders A", because they are the same row.
--   3. OFFICE     - who currently holds each authority's offices. These are
--                   named living people, so the source columns are NOT NULL
--                   here rather than nullable-with-a-check: an unsourced
--                   claim about a real person must be impossible to insert,
--                   not merely hidden at render time.
--   4. REVIEWS    - what verified residents say about those office holders.
--
-- Nothing is seeded. The 250-odd Israeli local authorities, their borders and
-- their current mayors are all external facts, and this file follows the rule
-- 20260730000001 set for population: the structure and its provenance
-- contract ship here, the sourced data arrives as its own import. An empty
-- table renders as "not published yet", which is true; invented rows would
-- render as fact, which would not be.

-- ============================================================
-- 1. TAXONOMY
-- ============================================================

ALTER TABLE public.municipalities
  DROP CONSTRAINT IF EXISTS municipalities_kind_check;

ALTER TABLE public.municipalities
  ADD CONSTRAINT municipalities_kind_check CHECK (
    kind IN (
      'municipality',      -- עירייה
      'local_council',     -- מועצה מקומית
      'regional_council',  -- מועצה אזורית
      'settlement',        -- יישוב בתוך מועצה אזורית
      'national'           -- כנסת ישראל
    )
  );

-- A settlement belongs to the regional council that administers it. Null for
-- every other kind: a municipality answers to nobody on this table.
ALTER TABLE public.municipalities
  ADD COLUMN IF NOT EXISTS parent_council_id UUID
    REFERENCES public.municipalities(council_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_municipalities_parent
  ON public.municipalities (parent_council_id)
  WHERE parent_council_id IS NOT NULL;

COMMENT ON COLUMN public.municipalities.parent_council_id IS
  'The regional council a settlement sits inside. NULL for every other kind.';

-- A CHECK cannot reach another row, so the shape of the hierarchy is a
-- trigger: only settlements have parents, and only regional councils may be
-- one. Without this the column would happily record a municipality nested
-- inside another municipality.
CREATE OR REPLACE FUNCTION public.municipality_parent_is_regional()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_kind TEXT;
BEGIN
  IF NEW.parent_council_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.kind <> 'settlement' THEN
    RAISE EXCEPTION
      'only a settlement may sit inside a regional council (kind was %)', NEW.kind;
  END IF;

  IF NEW.parent_council_id = NEW.council_id THEN
    RAISE EXCEPTION 'an authority cannot contain itself';
  END IF;

  SELECT m.kind INTO parent_kind
  FROM public.municipalities m
  WHERE m.council_id = NEW.parent_council_id;

  IF parent_kind IS DISTINCT FROM 'regional_council' THEN
    RAISE EXCEPTION
      'parent must be a regional_council (was %)', coalesce(parent_kind, 'missing');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS municipalities_parent_shape ON public.municipalities;
CREATE TRIGGER municipalities_parent_shape
  BEFORE INSERT OR UPDATE OF parent_council_id, kind ON public.municipalities
  FOR EACH ROW EXECUTE FUNCTION public.municipality_parent_is_regional();

-- ============================================================
-- 2. ADJACENCY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.council_adjacencies (
  -- Ordered pair, enforced below: (lesser, greater). One row per border.
  council_id   UUID NOT NULL
    REFERENCES public.municipalities(council_id) ON DELETE CASCADE,
  neighbour_id UUID NOT NULL
    REFERENCES public.municipalities(council_id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url  TEXT NOT NULL,
  as_of       DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (council_id, neighbour_id),
  -- Structural symmetry: the pair is stored in one canonical direction, so
  -- "A borders B" and "B borders A" cannot disagree - they are one row.
  CONSTRAINT council_adjacencies_canonical_order CHECK (council_id < neighbour_id)
);

COMMENT ON TABLE public.council_adjacencies IS
  'Undirected border graph over authorities. One row per unordered pair; read through council_neighbours, never directly.';

CREATE INDEX IF NOT EXISTS idx_council_adjacencies_neighbour
  ON public.council_adjacencies (neighbour_id);

-- Both directions, which is what every caller actually wants. Querying the
-- table directly finds only half a border and is always a bug.
CREATE OR REPLACE VIEW public.council_neighbours
WITH (security_invoker = true) AS
  SELECT council_id, neighbour_id, source_name, source_url, as_of
  FROM public.council_adjacencies
  UNION ALL
  SELECT neighbour_id, council_id, source_name, source_url, as_of
  FROM public.council_adjacencies;

COMMENT ON VIEW public.council_neighbours IS
  'Every border in both directions. The canonical read surface for adjacency.';

-- ============================================================
-- 3. OFFICE HOLDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.council_office_holders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id UUID NOT NULL
    REFERENCES public.municipalities(council_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (
    role IN (
      'mayor',              -- ראש עירייה
      'council_head',       -- ראש מועצה (מקומית/אזורית)
      'deputy',             -- סגן ראש הרשות
      'ceo',                -- מנכ"ל הרשות
      'treasurer',          -- גזבר
      'engineer',           -- מהנדס הרשות
      'legal_advisor',      -- יועץ משפטי
      'ombudsman'           -- מבקר / נציב תלונות הציבור
    )
  ),
  full_name TEXT NOT NULL CHECK (length(btrim(full_name)) > 1),
  term_start DATE,
  term_end   DATE,
  -- NOT NULL, unlike the population columns this file's sibling made
  -- nullable-with-a-check. Population absent is a gap in a statistic; a name
  -- absent a source is an unattributed public claim about a living person.
  source_name TEXT NOT NULL,
  source_url  TEXT NOT NULL,
  as_of       DATE NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT council_office_holders_term_order
    CHECK (term_end IS NULL OR term_start IS NULL OR term_end > term_start)
);

COMMENT ON TABLE public.council_office_holders IS
  'Named office holders per authority. Every row carries its source: an unsourced claim about a real person is not insertable.';

-- One sitting holder per office. Past holders keep their rows with a term_end,
-- so the history survives a change of mayor.
CREATE UNIQUE INDEX IF NOT EXISTS ux_office_holder_current
  ON public.council_office_holders (council_id, role)
  WHERE term_end IS NULL;

CREATE INDEX IF NOT EXISTS idx_office_holders_council
  ON public.council_office_holders (council_id, role);

DROP TRIGGER IF EXISTS update_council_office_holders_updated_at
  ON public.council_office_holders;
CREATE TRIGGER update_council_office_holders_updated_at
  BEFORE UPDATE ON public.council_office_holders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. CIVILIAN REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.council_official_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_holder_id UUID NOT NULL
    REFERENCES public.council_office_holders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT CHECK (
    body IS NULL OR length(btrim(body)) BETWEEN 10 AND 1200
  ),
  -- Reviews publish on write; `hidden` is the moderation lever and `removed`
  -- the resident's own retraction. Nothing is ever hard-deleted, so a
  -- moderation decision stays auditable.
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One resident, one review, per office holder. Amending means updating it.
  CONSTRAINT council_official_reviews_one_per_resident
    UNIQUE (office_holder_id, user_id)
);

COMMENT ON TABLE public.council_official_reviews IS
  'Residents'' reviews of their authority''s office holders. Reviewer identity is never exposed publicly; residency is enforced by trigger.';

CREATE INDEX IF NOT EXISTS idx_official_reviews_holder
  ON public.council_official_reviews (office_holder_id, status, created_at DESC);

DROP TRIGGER IF EXISTS update_council_official_reviews_updated_at
  ON public.council_official_reviews;
CREATE TRIGGER update_council_official_reviews_updated_at
  BEFORE UPDATE ON public.council_official_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Only the governed may review the governor. The reviewer's stored authority
-- must be the office holder's own, or - for a resident of a settlement - the
-- regional council that administers it.
--
-- This is the structural half of the rule. The API enforces it too, but an
-- application check is a read-then-write and this one is not: it runs inside
-- the same statement as the insert.
CREATE OR REPLACE FUNCTION public.official_review_requires_residency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  holder_council UUID;
  reviewer_council UUID;
  reviewer_parent UUID;
BEGIN
  SELECT h.council_id INTO holder_council
  FROM public.council_office_holders h
  WHERE h.id = NEW.office_holder_id;

  SELECT m.council_id, m.parent_council_id
    INTO reviewer_council, reviewer_parent
  FROM public.users u
  JOIN public.municipalities m ON m.code = u.municipality_id
  WHERE u.id = NEW.user_id;

  IF reviewer_council IS NULL THEN
    RAISE EXCEPTION
      'a review requires a resident with a verified authority';
  END IF;

  IF holder_council IS DISTINCT FROM reviewer_council
     AND holder_council IS DISTINCT FROM reviewer_parent THEN
    RAISE EXCEPTION
      'a resident may only review an office holder of their own authority';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS official_reviews_residency ON public.council_official_reviews;
CREATE TRIGGER official_reviews_residency
  BEFORE INSERT OR UPDATE OF office_holder_id, user_id
  ON public.council_official_reviews
  FOR EACH ROW EXECUTE FUNCTION public.official_review_requires_residency();

-- ============================================================
-- 5. RLS
-- ============================================================

ALTER TABLE public.council_adjacencies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_office_holders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_official_reviews ENABLE ROW LEVEL SECURITY;

-- Borders and office holders are public reference data.
DROP POLICY IF EXISTS "Anyone can view adjacencies" ON public.council_adjacencies;
CREATE POLICY "Anyone can view adjacencies"
  ON public.council_adjacencies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view office holders" ON public.council_office_holders;
CREATE POLICY "Anyone can view office holders"
  ON public.council_office_holders FOR SELECT USING (true);

-- A published review is public; hidden and removed ones are not. The row
-- still carries `user_id`, so no reader-facing query may select it - see the
-- aggregate RPCs below, which are the only intended read path.
DROP POLICY IF EXISTS "Anyone can view published reviews" ON public.council_official_reviews;
CREATE POLICY "Anyone can view published reviews"
  ON public.council_official_reviews FOR SELECT
  USING (status = 'published');

GRANT SELECT ON public.council_adjacencies      TO anon, authenticated;
GRANT SELECT ON public.council_office_holders   TO anon, authenticated;
GRANT SELECT ON public.council_neighbours       TO anon, authenticated;

-- ============================================================
-- 6. READ SURFACES
-- ============================================================

-- An authority's offices, each with its standing among residents. The
-- reviewer's identity never leaves the database: this returns counts and an
-- average, and the review bodies come back without an author.
CREATE OR REPLACE FUNCTION public.council_office_holders_public(council_identifier TEXT)
RETURNS TABLE (
  holder_id      UUID,
  council_code   TEXT,
  role           TEXT,
  full_name      TEXT,
  term_start     DATE,
  term_end       DATE,
  source_name    TEXT,
  source_url     TEXT,
  as_of          DATE,
  review_count   BIGINT,
  rating_average NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH resolved AS (
    SELECT m.council_id, m.code
    FROM public.municipalities m
    LEFT JOIN public.council_aliases a ON a.council_id = m.council_id
    WHERE m.slug_he = council_identifier
       OR m.code = council_identifier
       OR m.council_id::text = council_identifier
       OR a.alias = council_identifier
    ORDER BY
      CASE
        WHEN m.slug_he = council_identifier THEN 0
        WHEN m.council_id::text = council_identifier THEN 1
        ELSE 2
      END
    LIMIT 1
  )
  SELECT
    h.id,
    r.code,
    h.role,
    h.full_name,
    h.term_start,
    h.term_end,
    h.source_name,
    h.source_url,
    h.as_of,
    coalesce(rev.n, 0),
    rev.avg_rating
  FROM public.council_office_holders h
  JOIN resolved r ON r.council_id = h.council_id
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS n, round(avg(rating), 2) AS avg_rating
    FROM public.council_official_reviews cr
    WHERE cr.office_holder_id = h.id
      AND cr.status = 'published'
  ) rev ON true
  WHERE h.term_end IS NULL
  ORDER BY
    -- The person in charge leads; the rest follow in order of office.
    array_position(
      ARRAY['mayor','council_head','deputy','ceo','treasurer','engineer','legal_advisor','ombudsman'],
      h.role
    ),
    h.full_name;
$$;

COMMENT ON FUNCTION public.council_office_holders_public(TEXT) IS
  'Sitting office holders of one authority with their public review standing. Never returns reviewer identity.';

-- Who this authority borders, plus the regional council it sits inside and
-- the settlements it administers - the whole immediate neighbourhood in one
-- call, which is what a profile page needs.
CREATE OR REPLACE FUNCTION public.council_network_public(council_identifier TEXT)
RETURNS TABLE (
  relation      TEXT,
  council_code  TEXT,
  name_he       TEXT,
  slug_he       TEXT,
  kind          TEXT,
  source_name   TEXT,
  source_url    TEXT
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH resolved AS (
    SELECT m.council_id, m.parent_council_id
    FROM public.municipalities m
    LEFT JOIN public.council_aliases a ON a.council_id = m.council_id
    WHERE m.slug_he = council_identifier
       OR m.code = council_identifier
       OR m.council_id::text = council_identifier
       OR a.alias = council_identifier
    ORDER BY
      CASE
        WHEN m.slug_he = council_identifier THEN 0
        WHEN m.council_id::text = council_identifier THEN 1
        ELSE 2
      END
    LIMIT 1
  )
  SELECT 'neighbour', m.code, m.name_he, m.slug_he, m.kind, n.source_name, n.source_url
  FROM resolved r
  JOIN public.council_neighbours n ON n.council_id = r.council_id
  JOIN public.municipalities m ON m.council_id = n.neighbour_id

  UNION ALL

  SELECT 'parent', m.code, m.name_he, m.slug_he, m.kind, NULL, NULL
  FROM resolved r
  JOIN public.municipalities m ON m.council_id = r.parent_council_id

  UNION ALL

  SELECT 'settlement', m.code, m.name_he, m.slug_he, m.kind, NULL, NULL
  FROM resolved r
  JOIN public.municipalities m ON m.parent_council_id = r.council_id

  ORDER BY 1, 3;
$$;

COMMENT ON FUNCTION public.council_network_public(TEXT) IS
  'One authority''s immediate network: bordering authorities, its parent regional council, and the settlements it administers.';

-- ============================================================
-- 7. THE DIAL SEES THE WHOLE COUNTRY
-- ============================================================
--
-- municipality_civic_stats() filtered on kind = 'municipality', which was
-- correct when that was the only civic kind there was. A regional council is
-- an authority with residents, open topics and a standing, so it belongs on
-- the desk's dial beside the cities. Only the national scope stays out - the
-- Knesset has its own desk.
--
-- The kind itself now travels with the row. Once the dial carries four kinds,
-- "which of these is the regional council I sit inside" is a question about
-- the row rather than about its name, and a reader's dial is ordered by
-- exactly that: their own authority, then its parent council, then outward.
--
-- DROP before CREATE because the result columns change: CREATE OR REPLACE
-- refuses to alter an existing function's return type.

DROP FUNCTION IF EXISTS public.municipality_civic_stats();

CREATE FUNCTION public.municipality_civic_stats()
RETURNS TABLE (
  municipality_code TEXT,
  kind TEXT,
  residents BIGINT,
  platform_users BIGINT,
  active_participants BIGINT,
  open_topics BIGINT,
  engagement_score INTEGER,
  cooperation_score INTEGER,
  satisfaction_score INTEGER,
  overall_score INTEGER
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH registered AS (
    SELECT
      u.municipality_id            AS code,
      count(*)::bigint             AS users,
      avg(u.municipality_rating)   AS rating
    FROM public.users u
    WHERE u.municipality_id IS NOT NULL
    GROUP BY u.municipality_id
  ),
  participation AS (
    SELECT
      v.municipality_id                   AS code,
      count(DISTINCT uv.user_id)::bigint  AS participants
    FROM public.user_votes uv
    JOIN public.votes v ON v.id = uv.vote_id
    GROUP BY v.municipality_id
  ),
  topics_open AS (
    SELECT v.municipality_id AS code, count(*)::bigint AS topics
    FROM public.votes v
    WHERE v.status = 'active'
    GROUP BY v.municipality_id
  ),
  per_topic AS (
    SELECT
      v.municipality_id AS code,
      abs(
        sum(CASE WHEN o.text ~ '^(בעד|for)$'     THEN o.votes ELSE 0 END)
      - sum(CASE WHEN o.text ~ '^(נגד|against)$' THEN o.votes ELSE 0 END)
      )::numeric
      / NULLIF(
          sum(CASE WHEN o.text ~ '^(בעד|for|נגד|against)$' THEN o.votes ELSE 0 END),
          0
        ) AS agreement
    FROM public.votes v
    JOIN public.vote_options o ON o.vote_id = v.id
    WHERE v.status IN ('active', 'ended')
    GROUP BY v.id, v.municipality_id
  ),
  consensus AS (
    SELECT code, avg(agreement) AS agreement
    FROM per_topic
    WHERE agreement IS NOT NULL
    GROUP BY code
  )
  SELECT
    m.code,
    -- Qualified, like every other reference here: `kind` is also an output
    -- column of this function, and an unqualified one would be ambiguous.
    m.kind,
    m.official_population,
    coalesce(r.users, 0),
    coalesce(p.participants, 0),
    coalesce(t.topics, 0),
    CASE WHEN idx.engagement IS NULL THEN NULL
         ELSE round(idx.engagement * 200 - 100)::int END,
    CASE WHEN idx.cooperation IS NULL THEN NULL
         ELSE round(idx.cooperation * 200 - 100)::int END,
    CASE WHEN idx.satisfaction IS NULL THEN NULL
         ELSE round(idx.satisfaction * 200 - 100)::int END,
    CASE WHEN idx.weight = 0 THEN NULL
         ELSE round(
           (coalesce(idx.engagement   * 0.40, 0)
          + coalesce(idx.cooperation  * 0.35, 0)
          + coalesce(idx.satisfaction * 0.25, 0)) / idx.weight * 200 - 100
         )::int END
  FROM public.municipalities m
  LEFT JOIN registered    r ON r.code = m.code
  LEFT JOIN participation p ON p.code = m.code
  LEFT JOIN topics_open   t ON t.code = m.code
  LEFT JOIN consensus     c ON c.code = m.code
  CROSS JOIN LATERAL (
    SELECT
      CASE WHEN coalesce(m.official_population, 0) = 0 THEN NULL
           ELSE least(
             coalesce(r.users, 0)::numeric / m.official_population / 0.10,
             1
           )
      END AS reach,
      CASE WHEN coalesce(r.users, 0) = 0 THEN NULL
           ELSE least(coalesce(p.participants, 0)::numeric / r.users, 1)
      END AS activity
  ) parts
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN parts.reach IS NULL AND parts.activity IS NULL THEN NULL
        WHEN parts.reach IS NULL THEN parts.activity
        WHEN parts.activity IS NULL THEN parts.reach
        ELSE 0.5 * parts.reach + 0.5 * parts.activity
      END                  AS engagement,
      c.agreement          AS cooperation,
      (r.rating - 1) / 4.0 AS satisfaction
  ) idx0
  CROSS JOIN LATERAL (
    SELECT
      idx0.engagement,
      idx0.cooperation,
      idx0.satisfaction,
      (CASE WHEN idx0.engagement   IS NULL THEN 0 ELSE 0.40 END)
    + (CASE WHEN idx0.cooperation  IS NULL THEN 0 ELSE 0.35 END)
    + (CASE WHEN idx0.satisfaction IS NULL THEN 0 ELSE 0.25 END) AS weight
  ) idx
  WHERE m.kind <> 'national'
  ORDER BY coalesce(t.topics, 0) DESC, coalesce(r.users, 0) DESC, m.code;
$$;

-- Restated, not inherited: DROP FUNCTION took the previous comment with it.
COMMENT ON FUNCTION public.municipality_civic_stats() IS
  'One row per local authority of any kind - municipality, local council, '
  'regional council or settlement: its kind, sourced population, platform '
  'footprint, open topics, and the engagement / cooperation / satisfaction / '
  'overall scores on -100..+100. NULL score = not measured. The national '
  'scope is excluded; the Knesset has its own desk.';

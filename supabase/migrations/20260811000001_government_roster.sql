-- The government: who currently sits in the Knesset, what they were elected
-- and appointed to, how they actually voted, and what citizens make of them.
--
-- The municipal side of this platform already answers "who runs my town and
-- how is it doing". This is the same question one level up, with one axis a
-- town has no equivalent of: for every plenum item Taruu publishes as a
-- national ballot, the public reaches a majority AND the house holds a roll
-- call on the same item. `knesset_items.item_id` and the votes service's
-- `sess_item_id` are the same number, so the two records can be laid side by
-- side without guessing. That comparison - representation - is the reason
-- this file exists.
--
-- Five tables, in dependency order:
--
--   1. PERSONS    - the roster, mirrored from ParliamentInfo OData.
--   2. POSITIONS  - what each person currently holds: seat, ministry, chair.
--   3. ROLL CALLS - the house's own recorded votes, from the Votes service.
--   4. STANCES    - how each member voted in each roll call.
--   5. REVIEWS    - what verified citizens say about them.
--
-- Nothing is seeded, and nothing here is editorial. Every row about a living
-- person carries source_name / source_url / as_of as NOT NULL, exactly as
-- 20260810000002 requires of municipal office holders: an unsourced claim
-- about a named person must be impossible to insert, not merely hidden at
-- render time. The roster arrives from /api/cron/knesset-roster, the record
-- from /api/cron/knesset-rollcalls, and an empty table renders as "not
-- published yet" - which is true.

-- ============================================================
-- 1. PERSONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.knesset_persons (
  -- ParliamentInfo KNS_Person.PersonID. The upstream identity, so a re-run
  -- of the importer updates rather than duplicates.
  person_id   BIGINT PRIMARY KEY,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL CHECK (length(btrim(last_name)) > 0),
  full_name   TEXT NOT NULL CHECK (length(btrim(full_name)) > 1),
  -- Upstream GenderDesc, verbatim and unused for anything but the record.
  gender_desc TEXT,
  -- Sitting right now, per the upstream IsCurrent flag on their positions.
  is_current  BOOLEAN NOT NULL DEFAULT false,
  -- Canonical Hebrew URL slug for /[locale]/government/[slug].
  slug        TEXT NOT NULL UNIQUE CHECK (length(btrim(slug)) > 0),
  knesset_num INTEGER,
  -- Denormalized from the sitting seat position for cheap list rendering.
  faction_name TEXT,

  source_name TEXT NOT NULL,
  source_url  TEXT NOT NULL,
  as_of       DATE NOT NULL,
  source_updated_at TIMESTAMPTZ,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.knesset_persons IS
  'Knesset roster mirrored from the official ParliamentInfo OData service. One row per person; PersonID is the upstream identity.';
COMMENT ON COLUMN public.knesset_persons.slug IS
  'Hebrew URL slug. Collisions are resolved by the importer appending the PersonID, so the URL of a sitting member never silently moves to someone else.';

CREATE INDEX IF NOT EXISTS idx_knesset_persons_current
  ON public.knesset_persons (is_current, last_name)
  WHERE is_current;

DROP TRIGGER IF EXISTS update_knesset_persons_updated_at ON public.knesset_persons;
CREATE TRIGGER update_knesset_persons_updated_at
  BEFORE UPDATE ON public.knesset_persons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. POSITIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.knesset_positions (
  -- KNS_PersonToPosition.PersonToPositionID - one upstream row, one row here.
  position_row_id BIGINT PRIMARY KEY,
  person_id BIGINT NOT NULL
    REFERENCES public.knesset_persons(person_id) ON DELETE CASCADE,
  -- The upstream position list carries 'שר' and 'שרה' as separate positions,
  -- which is a fact about Hebrew grammar rather than about government, so the
  -- importer collapses each pair onto one office here. `title` keeps the
  -- upstream wording for the page to print.
  office TEXT NOT NULL CHECK (
    office IN (
      'pm',                -- ראש הממשלה
      'alternate_pm',      -- ראש הממשלה החילופי
      'deputy_pm',         -- סגן / משנה לראש הממשלה
      'minister',          -- שר/ה
      'deputy_minister',   -- סגן/ית שר
      'speaker',           -- יו"ר הכנסת
      'deputy_speaker',    -- סגן/ית יו"ר הכנסת
      'opposition_leader', -- ראש/ת האופוזיציה
      'coalition_chair',   -- יו"ר הקואליציה
      'faction_chair',     -- יו"ר סיעה
      'committee_chair',   -- יו"ר ועדה
      'committee_member',  -- חבר/ת ועדה
      'mk'                 -- חבר/ת הכנסת
    )
  ),
  title TEXT NOT NULL,
  -- Ministry for a minister, committee for a committee office, else null.
  portfolio TEXT,
  faction_name TEXT,
  knesset_num INTEGER,
  start_date DATE,
  end_date   DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,

  source_name TEXT NOT NULL,
  source_url  TEXT NOT NULL,
  as_of       DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knesset_positions_term_order
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

COMMENT ON TABLE public.knesset_positions IS
  'Offices held, mirrored from KNS_PersonToPosition. Past offices keep their rows with is_current false, so a reshuffle does not erase the record.';

CREATE INDEX IF NOT EXISTS idx_knesset_positions_person
  ON public.knesset_positions (person_id, is_current);

DROP TRIGGER IF EXISTS update_knesset_positions_updated_at ON public.knesset_positions;
CREATE TRIGGER update_knesset_positions_updated_at
  BEFORE UPDATE ON public.knesset_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. ROLL CALLS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.knesset_roll_calls (
  -- Votes service vote_id.
  roll_call_id BIGINT PRIMARY KEY,
  knesset_num  INTEGER,
  session_id   BIGINT,
  -- The plenum item this roll call belongs to. Equal to knesset_items.item_id
  -- for anything Taruu published as a national ballot - the join that makes
  -- representation measurable.
  sess_item_id BIGINT,
  item_description TEXT,
  -- What was actually put to the vote, e.g. 'להעביר את הצעת החוק לוועדה'.
  vote_subject TEXT,
  vote_date    TIMESTAMPTZ,
  total_for     INTEGER NOT NULL DEFAULT 0 CHECK (total_for >= 0),
  total_against INTEGER NOT NULL DEFAULT 0 CHECK (total_against >= 0),
  total_abstain INTEGER NOT NULL DEFAULT 0 CHECK (total_abstain >= 0),
  is_accepted  BOOLEAN NOT NULL DEFAULT false,

  source_name TEXT NOT NULL,
  source_url  TEXT NOT NULL,
  as_of       DATE NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.knesset_roll_calls IS
  'The house''s own recorded votes, mirrored from the Knesset Votes OData service.';

CREATE INDEX IF NOT EXISTS idx_knesset_roll_calls_item
  ON public.knesset_roll_calls (sess_item_id)
  WHERE sess_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knesset_roll_calls_term
  ON public.knesset_roll_calls (knesset_num, vote_date DESC);

DROP TRIGGER IF EXISTS update_knesset_roll_calls_updated_at ON public.knesset_roll_calls;
CREATE TRIGGER update_knesset_roll_calls_updated_at
  BEFORE UPDATE ON public.knesset_roll_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. STANCES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.knesset_roll_call_stances (
  roll_call_id BIGINT NOT NULL
    REFERENCES public.knesset_roll_calls(roll_call_id) ON DELETE CASCADE,
  -- The Votes service numbers members in its own id space (kmmbr_id), which
  -- is NOT the ParliamentInfo PersonID. Both are kept: the upstream key as
  -- the row's identity, and the resolved person as a nullable link.
  member_key  TEXT NOT NULL,
  person_id   BIGINT
    REFERENCES public.knesset_persons(person_id) ON DELETE SET NULL,
  member_name TEXT NOT NULL,
  faction_name TEXT,
  stance TEXT NOT NULL CHECK (stance IN ('for', 'against', 'abstain', 'absent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (roll_call_id, member_key)
);

COMMENT ON TABLE public.knesset_roll_call_stances IS
  'How each member voted in each roll call. person_id is null when the Votes service member could not be resolved to a roster person - the row is kept, and that member simply does not contribute to anyone''s score.';

CREATE INDEX IF NOT EXISTS idx_stances_person
  ON public.knesset_roll_call_stances (person_id)
  WHERE person_id IS NOT NULL;

-- ============================================================
-- 5. CITIZEN REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.knesset_member_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id BIGINT NOT NULL
    REFERENCES public.knesset_persons(person_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT CHECK (body IS NULL OR length(btrim(body)) BETWEEN 10 AND 1200),
  -- Same lever set as the municipal reviews: published on write, `hidden` for
  -- moderation, `removed` for the citizen's own retraction. Nothing is ever
  -- hard-deleted, so a moderation decision stays auditable.
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One citizen, one review per member. Amending means updating it.
  CONSTRAINT knesset_member_reviews_one_per_citizen UNIQUE (person_id, user_id)
);

COMMENT ON TABLE public.knesset_member_reviews IS
  'Citizens'' reviews of sitting Knesset members. Reviewer identity never leaves the database; the read surface returns counts, an average and anonymous bodies.';

CREATE INDEX IF NOT EXISTS idx_member_reviews_person
  ON public.knesset_member_reviews (person_id, status, created_at DESC);

DROP TRIGGER IF EXISTS update_knesset_member_reviews_updated_at
  ON public.knesset_member_reviews;
CREATE TRIGGER update_knesset_member_reviews_updated_at
  BEFORE UPDATE ON public.knesset_member_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- The municipal rule is "only the governed may review the governor", and the
-- Knesset governs every resident - so the residency test here is only that
-- the reviewer is a placed citizen, not that they share an authority with the
-- member. Structural, like its municipal sibling: it runs in the same
-- statement as the insert rather than as a read-then-write in the API.
CREATE OR REPLACE FUNCTION public.member_review_requires_citizen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  reviewer_authority TEXT;
BEGIN
  SELECT u.municipality_id INTO reviewer_authority
  FROM public.users u
  WHERE u.id = NEW.user_id;

  IF reviewer_authority IS NULL OR btrim(reviewer_authority) = '' THEN
    RAISE EXCEPTION
      'a review requires a citizen with a verified authority';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_reviews_citizen ON public.knesset_member_reviews;
CREATE TRIGGER member_reviews_citizen
  BEFORE INSERT OR UPDATE OF user_id ON public.knesset_member_reviews
  FOR EACH ROW EXECUTE FUNCTION public.member_review_requires_citizen();

-- ============================================================
-- 6. RLS
-- ============================================================

ALTER TABLE public.knesset_persons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knesset_positions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knesset_roll_calls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knesset_roll_call_stances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knesset_member_reviews     ENABLE ROW LEVEL SECURITY;

-- The roster and the voting record are public reference data. They are
-- published by the Knesset itself; mirroring them does not make them private.
DROP POLICY IF EXISTS "Anyone can view knesset persons" ON public.knesset_persons;
CREATE POLICY "Anyone can view knesset persons"
  ON public.knesset_persons FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view knesset positions" ON public.knesset_positions;
CREATE POLICY "Anyone can view knesset positions"
  ON public.knesset_positions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view roll calls" ON public.knesset_roll_calls;
CREATE POLICY "Anyone can view roll calls"
  ON public.knesset_roll_calls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view stances" ON public.knesset_roll_call_stances;
CREATE POLICY "Anyone can view stances"
  ON public.knesset_roll_call_stances FOR SELECT USING (true);

-- A published review is public; hidden and removed ones are not. The row
-- carries user_id, so no reader-facing query may select it directly - the
-- RPC below is the only intended read path.
DROP POLICY IF EXISTS "Anyone can view published member reviews"
  ON public.knesset_member_reviews;
CREATE POLICY "Anyone can view published member reviews"
  ON public.knesset_member_reviews FOR SELECT
  USING (status = 'published');

GRANT SELECT ON public.knesset_persons           TO anon, authenticated;
GRANT SELECT ON public.knesset_positions         TO anon, authenticated;
GRANT SELECT ON public.knesset_roll_calls        TO anon, authenticated;
GRANT SELECT ON public.knesset_roll_call_stances TO anon, authenticated;

-- ============================================================
-- 7. THE SHARED MEASUREMENT
--
-- One view, because the member scores and the national score must be two
-- readings of the same instrument. If the roster page said the house voted
-- with the public 40% of the time while the member pages averaged 60%, both
-- numbers would be worthless.
--
-- One row per plenum item that Taruu published AND the house voted on:
-- the public's tally, the house's tally, and the side each landed on. Where
-- an item was voted more than once - a bill returning from committee - the
-- house's latest roll call on it is the one that counts, because that is the
-- one that decided the question.
-- ============================================================

CREATE OR REPLACE VIEW public.knesset_matched_votes
WITH (security_invoker = true) AS
  WITH public_tally AS (
    SELECT
      ki.item_id,
      v.id    AS vote_id,
      v.title AS title,
      sum(CASE WHEN o.text ~ '^(בעד|for)$'     THEN o.votes ELSE 0 END) AS public_for,
      sum(CASE WHEN o.text ~ '^(נגד|against)$' THEN o.votes ELSE 0 END) AS public_against
    FROM public.knesset_items ki
    JOIN public.votes v        ON v.id = ki.vote_id
    JOIN public.vote_options o ON o.vote_id = v.id
    GROUP BY ki.item_id, v.id, v.title
  ),
  latest_call AS (
    SELECT DISTINCT ON (rc.sess_item_id) rc.*
    FROM public.knesset_roll_calls rc
    WHERE rc.sess_item_id IS NOT NULL
    ORDER BY rc.sess_item_id, rc.vote_date DESC NULLS LAST, rc.roll_call_id DESC
  )
  SELECT
    pt.vote_id,
    pt.title,
    pt.item_id,
    lc.roll_call_id,
    lc.vote_date,
    lc.knesset_num,
    pt.public_for,
    pt.public_against,
    lc.total_for     AS house_for,
    lc.total_against AS house_against,
    lc.total_abstain AS house_abstain,
    lc.is_accepted   AS house_accepted,
    -- A tie is not a side. Neither is an empty ballot: with nothing cast
    -- there is no public position to compare the house against.
    CASE
      WHEN pt.public_for > pt.public_against     THEN 'for'
      WHEN pt.public_against > pt.public_for     THEN 'against'
      ELSE NULL
    END AS public_side,
    CASE
      WHEN lc.total_for > lc.total_against       THEN 'for'
      WHEN lc.total_against > lc.total_for       THEN 'against'
      ELSE NULL
    END AS house_side
  FROM public_tally pt
  JOIN latest_call lc ON lc.sess_item_id = pt.item_id;

COMMENT ON VIEW public.knesset_matched_votes IS
  'Every plenum item where both a public tally and a house roll call exist, with the side each landed on. The single source of the representation figure.';

GRANT SELECT ON public.knesset_matched_votes TO anon, authenticated;

-- ============================================================
-- 8. READ SURFACES
-- ============================================================

-- The whole sitting roster with each member's scores, in one call. 120 rows
-- is nothing to transfer and the government page prints all of them, so the
-- alternative - a query per member - would be 120 round-trips for one screen.
CREATE OR REPLACE FUNCTION public.knesset_roster_public()
RETURNS TABLE (
  person_id      BIGINT,
  slug           TEXT,
  full_name      TEXT,
  first_name     TEXT,
  last_name      TEXT,
  faction_name   TEXT,
  knesset_num    INTEGER,
  source_name    TEXT,
  source_url     TEXT,
  as_of          DATE,
  positions      JSONB,
  matched_votes  BIGINT,
  agreed_votes   BIGINT,
  roll_calls     BIGINT,
  recorded_votes BIGINT,
  review_count   BIGINT,
  rating_average NUMERIC,
  alignment_score    INTEGER,
  participation_score INTEGER,
  trust_score    INTEGER,
  overall_score  INTEGER
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH term AS (
    -- The current term, taken from the roster rather than from a constant:
    -- an election changes this number and nothing here should need editing.
    SELECT max(p.knesset_num) AS knesset_num
    FROM public.knesset_persons p
    WHERE p.is_current
  ),
  term_calls AS (
    -- The participation denominator: roll calls of this term that the mirror
    -- actually holds. Documented as such on the page - a member is never
    -- marked absent from a sitting nobody imported.
    SELECT count(*)::bigint AS n
    FROM public.knesset_roll_calls rc, term t
    WHERE t.knesset_num IS NULL OR rc.knesset_num = t.knesset_num
  ),
  alignment AS (
    SELECT
      s.person_id,
      count(*)::bigint                                              AS matched,
      count(*) FILTER (WHERE s.stance = mv.public_side)::bigint     AS agreed
    FROM public.knesset_matched_votes mv
    JOIN public.knesset_roll_call_stances s ON s.roll_call_id = mv.roll_call_id
    WHERE mv.public_side IS NOT NULL
      AND s.person_id IS NOT NULL
      -- Only a side taken can agree or disagree with the public. An
      -- abstention is not a vote against them and an absence is a fact about
      -- attendance; both are measured elsewhere, and counting either here
      -- would print a member as opposing a public they never voted against.
      AND s.stance IN ('for', 'against')
    GROUP BY s.person_id
  ),
  presence AS (
    SELECT
      s.person_id,
      count(*) FILTER (WHERE s.stance IN ('for', 'against', 'abstain'))::bigint
        AS recorded
    FROM public.knesset_roll_call_stances s
    JOIN public.knesset_roll_calls rc ON rc.roll_call_id = s.roll_call_id
    CROSS JOIN term t
    WHERE s.person_id IS NOT NULL
      AND (t.knesset_num IS NULL OR rc.knesset_num = t.knesset_num)
    GROUP BY s.person_id
  ),
  reviews AS (
    SELECT r.person_id, count(*)::bigint AS n, round(avg(r.rating), 2) AS avg_rating
    FROM public.knesset_member_reviews r
    WHERE r.status = 'published'
    GROUP BY r.person_id
  ),
  offices AS (
    SELECT
      pos.person_id,
      jsonb_agg(
        jsonb_build_object(
          'office',      pos.office,
          'title',       pos.title,
          'portfolio',   pos.portfolio,
          'factionName', pos.faction_name,
          'knessetNum',  pos.knesset_num,
          'startDate',   pos.start_date,
          'endDate',     pos.end_date
        )
        ORDER BY array_position(
          ARRAY['pm','alternate_pm','deputy_pm','minister','deputy_minister',
                'speaker','deputy_speaker','opposition_leader','coalition_chair',
                'faction_chair','committee_chair','committee_member','mk'],
          pos.office
        ), pos.title
      ) AS positions
    FROM public.knesset_positions pos
    WHERE pos.is_current
    GROUP BY pos.person_id
  ),
  scored AS (
    SELECT
      p.person_id,
      p.slug,
      p.full_name,
      p.first_name,
      p.last_name,
      p.faction_name,
      p.knesset_num,
      p.source_name,
      p.source_url,
      p.as_of,
      coalesce(o.positions, '[]'::jsonb)      AS positions,
      coalesce(a.matched, 0)                  AS matched_votes,
      coalesce(a.agreed, 0)                   AS agreed_votes,
      tc.n                                    AS roll_calls,
      coalesce(pr.recorded, 0)                AS recorded_votes,
      coalesce(rv.n, 0)                       AS review_count,
      rv.avg_rating                           AS rating_average,
      -- Each 0..1 index maps onto the shared signed scale by x * 200 - 100.
      CASE WHEN coalesce(a.matched, 0) = 0 THEN NULL
           ELSE round((a.agreed::numeric / a.matched) * 200 - 100)::int END
        AS alignment_score,
      CASE WHEN tc.n = 0 THEN NULL
           ELSE round(
             (least(coalesce(pr.recorded, 0)::numeric / tc.n, 1)) * 200 - 100
           )::int END
        AS participation_score,
      CASE WHEN rv.avg_rating IS NULL THEN NULL
           ELSE round(((rv.avg_rating - 1) / 4) * 200 - 100)::int END
        AS trust_score
    FROM public.knesset_persons p
    CROSS JOIN term_calls tc
    LEFT JOIN offices   o  ON o.person_id  = p.person_id
    LEFT JOIN alignment a  ON a.person_id  = p.person_id
    LEFT JOIN presence  pr ON pr.person_id = p.person_id
    LEFT JOIN reviews   rv ON rv.person_id = p.person_id
    WHERE p.is_current
  ),
  -- The overall score gets its own CTE rather than being computed in the
  -- final select list, because the ordering below reads it: a select-list
  -- expression is not in scope for its own ORDER BY qualified by the source
  -- alias, and ordering the roster by score is the whole point of it.
  weighted AS (
    SELECT
      s.*,
      -- The weights renormalise over whichever axes exist, so an unmeasured
      -- axis costs a member nothing rather than dragging them toward zero.
      CASE
        WHEN (
               CASE WHEN s.alignment_score     IS NULL THEN 0 ELSE 0.45 END +
               CASE WHEN s.participation_score IS NULL THEN 0 ELSE 0.25 END +
               CASE WHEN s.trust_score         IS NULL THEN 0 ELSE 0.30 END
             ) = 0
          THEN NULL
        ELSE round(
          (coalesce(s.alignment_score     * 0.45, 0) +
           coalesce(s.participation_score * 0.25, 0) +
           coalesce(s.trust_score         * 0.30, 0))
          / (
            CASE WHEN s.alignment_score     IS NULL THEN 0 ELSE 0.45 END +
            CASE WHEN s.participation_score IS NULL THEN 0 ELSE 0.25 END +
            CASE WHEN s.trust_score         IS NULL THEN 0 ELSE 0.30 END
          )
        )::int
      END AS overall_score
    FROM scored s
  )
  SELECT
    w.person_id, w.slug, w.full_name, w.first_name, w.last_name,
    w.faction_name, w.knesset_num, w.source_name, w.source_url, w.as_of,
    w.positions, w.matched_votes, w.agreed_votes, w.roll_calls,
    w.recorded_votes, w.review_count, w.rating_average,
    w.alignment_score, w.participation_score, w.trust_score, w.overall_score
  FROM weighted w
  ORDER BY w.overall_score DESC NULLS LAST, w.last_name, w.first_name;
$$;

COMMENT ON FUNCTION public.knesset_roster_public() IS
  'The sitting Knesset with every member''s civic scores. Never returns reviewer identity.';

-- The house as one authority, shaped like municipality_civic_stats() so the
-- two can be printed side by side on the same scale.
CREATE OR REPLACE FUNCTION public.government_civic_stats()
RETURNS TABLE (
  knesset_num          INTEGER,
  members              BIGINT,
  factions             BIGINT,
  open_topics          BIGINT,
  decided_topics       BIGINT,
  ballots_counted      BIGINT,
  platform_users       BIGINT,
  active_participants  BIGINT,
  matched_items        BIGINT,
  agreed_items         BIGINT,
  representation_score INTEGER,
  engagement_score     INTEGER,
  cooperation_score    INTEGER,
  trust_score          INTEGER,
  overall_score        INTEGER
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH roster AS (
    SELECT
      max(p.knesset_num)                     AS knesset_num,
      -- Seats, not people. A minister appointed from outside the house holds
      -- a current office and gets a page like anyone else, but they do not
      -- occupy one of the 120 seats and must not inflate the count of them -
      -- the first sync mirrored 139 office holders against 120 members.
      count(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM public.knesset_positions x
          WHERE x.person_id = p.person_id AND x.is_current AND x.office = 'mk'
        )
      )::bigint                              AS members,
      count(DISTINCT p.faction_name)::bigint AS factions
    FROM public.knesset_persons p
    WHERE p.is_current
  ),
  national AS (
    SELECT
      count(*) FILTER (WHERE v.status = 'active')::bigint AS open_topics,
      count(*) FILTER (WHERE v.status = 'ended')::bigint  AS decided_topics
    FROM public.votes v
    WHERE v.municipality_id = 'כנסת ישראל'
  ),
  ballots AS (
    SELECT coalesce(sum(o.votes), 0)::bigint AS n
    FROM public.votes v
    JOIN public.vote_options o ON o.vote_id = v.id
    WHERE v.municipality_id = 'כנסת ישראל'
  ),
  citizens AS (
    SELECT count(*)::bigint AS n FROM public.users
  ),
  participants AS (
    SELECT count(DISTINCT uv.user_id)::bigint AS n
    FROM public.user_votes uv
    JOIN public.votes v ON v.id = uv.vote_id
    WHERE v.municipality_id = 'כנסת ישראל'
  ),
  representation AS (
    SELECT
      count(*)::bigint AS matched,
      count(*) FILTER (WHERE mv.house_side = mv.public_side)::bigint AS agreed
    FROM public.knesset_matched_votes mv
    WHERE mv.public_side IS NOT NULL AND mv.house_side IS NOT NULL
  ),
  consensus AS (
    -- Same formula as the municipal cooperation score, over national topics:
    -- how far from a dead split the country lands on its own questions.
    SELECT avg(t.agreement) AS agreement
    FROM (
      SELECT
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
      WHERE v.municipality_id = 'כנסת ישראל'
        AND v.status IN ('active', 'ended')
      GROUP BY v.id
    ) t
    WHERE t.agreement IS NOT NULL
  ),
  trust AS (
    SELECT round(avg(r.rating), 2) AS avg_rating
    FROM public.knesset_member_reviews r
    WHERE r.status = 'published'
  ),
  idx AS (
    SELECT
      CASE WHEN rep.matched = 0 THEN NULL
           ELSE (rep.agreed::numeric / rep.matched) END       AS representation,
      -- No sourced national population figure exists on this platform, so
      -- national engagement rests on activity alone - the share of registered
      -- citizens who have voted on a national question - rather than on a
      -- guessed denominator. Same choice the municipal function makes for a
      -- city with no published population.
      CASE WHEN c.n = 0 THEN NULL
           ELSE least(pa.n::numeric / c.n, 1) END             AS engagement,
      cons.agreement                                          AS cooperation,
      CASE WHEN tr.avg_rating IS NULL THEN NULL
           ELSE (tr.avg_rating - 1) / 4 END                   AS trust
    FROM representation rep, citizens c, participants pa, consensus cons, trust tr
  ),
  weights AS (
    SELECT
      idx.*,
      -- Only the two axes that are about the CHAMBER carry the overall score.
      -- Engagement and agreement measure the public - how many citizens turn
      -- out, and how split they are with each other - and folding those into
      -- a score of the government would let a quiet week on this platform
      -- print as a failure of the Knesset. They are published beside it as
      -- context, and they move nothing.
      CASE WHEN idx.representation IS NULL THEN 0 ELSE 0.65 END +
      CASE WHEN idx.trust          IS NULL THEN 0 ELSE 0.35 END AS weight
    FROM idx
  )
  SELECT
    r.knesset_num,
    r.members,
    r.factions,
    n.open_topics,
    n.decided_topics,
    b.n,
    c.n,
    pa.n,
    rep.matched,
    rep.agreed,
    CASE WHEN w.representation IS NULL THEN NULL
         ELSE round(w.representation * 200 - 100)::int END,
    CASE WHEN w.engagement IS NULL THEN NULL
         ELSE round(w.engagement * 200 - 100)::int END,
    CASE WHEN w.cooperation IS NULL THEN NULL
         ELSE round(w.cooperation * 200 - 100)::int END,
    CASE WHEN w.trust IS NULL THEN NULL
         ELSE round(w.trust * 200 - 100)::int END,
    CASE WHEN w.weight = 0 THEN NULL
         ELSE round(
           (coalesce(w.representation * 0.65, 0) +
            coalesce(w.trust          * 0.35, 0)) / w.weight * 200 - 100
         )::int END
  FROM roster r, national n, ballots b, citizens c, participants pa,
       representation rep, weights w;
$$;

COMMENT ON FUNCTION public.government_civic_stats() IS
  'The Knesset as one authority, on the same -100..+100 scale as municipality_civic_stats().';

-- One member's matched items, with how they personally voted on each. This is
-- the evidence behind their alignment score, and a score without its evidence
-- printed beside it is an accusation.
CREATE OR REPLACE FUNCTION public.knesset_member_votes_public(p_person_id BIGINT)
RETURNS TABLE (
  vote_id        UUID,
  title          TEXT,
  item_id        BIGINT,
  vote_date      TIMESTAMPTZ,
  public_for     BIGINT,
  public_against BIGINT,
  house_for      INTEGER,
  house_against  INTEGER,
  house_abstain  INTEGER,
  house_accepted BOOLEAN,
  public_side    TEXT,
  house_side     TEXT,
  member_stance  TEXT
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    mv.vote_id,
    mv.title,
    mv.item_id,
    mv.vote_date,
    mv.public_for,
    mv.public_against,
    mv.house_for,
    mv.house_against,
    mv.house_abstain,
    mv.house_accepted,
    mv.public_side,
    mv.house_side,
    s.stance
  FROM public.knesset_matched_votes mv
  LEFT JOIN public.knesset_roll_call_stances s
    ON s.roll_call_id = mv.roll_call_id AND s.person_id = p_person_id
  ORDER BY mv.vote_date DESC NULLS LAST
  LIMIT 40;
$$;

COMMENT ON FUNCTION public.knesset_member_votes_public(BIGINT) IS
  'The matched items behind one member''s alignment score, newest first.';

-- The house's own record: every matched item, newest first. Same shape as the
-- member function minus the stance column, so both pages print one component.
CREATE OR REPLACE FUNCTION public.knesset_matched_votes_public(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  vote_id        UUID,
  title          TEXT,
  item_id        BIGINT,
  vote_date      TIMESTAMPTZ,
  public_for     BIGINT,
  public_against BIGINT,
  house_for      INTEGER,
  house_against  INTEGER,
  house_abstain  INTEGER,
  house_accepted BOOLEAN,
  public_side    TEXT,
  house_side     TEXT
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    mv.vote_id,
    mv.title,
    mv.item_id,
    mv.vote_date,
    mv.public_for,
    mv.public_against,
    mv.house_for,
    mv.house_against,
    mv.house_abstain,
    mv.house_accepted,
    mv.public_side,
    mv.house_side
  FROM public.knesset_matched_votes mv
  ORDER BY mv.vote_date DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 20), 200));
$$;

COMMENT ON FUNCTION public.knesset_matched_votes_public(INTEGER) IS
  'Every item where the public and the chamber both voted, newest first.';

-- Published reviews of one member, without their authors. `viewer` lets the
-- signed-in citizen find their own review to amend it; it is compared inside
-- the database and never returned.
CREATE OR REPLACE FUNCTION public.knesset_member_reviews_public(
  p_person_id BIGINT,
  viewer UUID DEFAULT NULL
)
RETURNS TABLE (
  review_id  UUID,
  rating     SMALLINT,
  body       TEXT,
  status     TEXT,
  created_at TIMESTAMPTZ,
  is_mine    BOOLEAN
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    r.id,
    r.rating,
    r.body,
    r.status,
    r.created_at,
    (viewer IS NOT NULL AND r.user_id = viewer) AS is_mine
  FROM public.knesset_member_reviews r
  WHERE r.person_id = p_person_id
    AND (r.status = 'published' OR (viewer IS NOT NULL AND r.user_id = viewer))
  ORDER BY (viewer IS NOT NULL AND r.user_id = viewer) DESC, r.created_at DESC
  LIMIT 100;
$$;

COMMENT ON FUNCTION public.knesset_member_reviews_public(BIGINT, UUID) IS
  'Anonymous published reviews of one member, plus the viewer''s own row whatever its status.';

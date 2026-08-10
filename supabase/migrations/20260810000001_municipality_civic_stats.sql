-- Municipality civic stats — the numbers the desk's municipality dial reads.
--
-- The desk already knows how many topics a city has open; what it could not
-- say is how big the city is, how much of it is here, and whether the ballots
-- it does cast agree with each other. One function answers all three for
-- every municipality at once, because the dial prints the whole list and must
-- not pay a round-trip per city.
--
-- No new population column: `municipalities.official_population` already
-- exists (20260730000001_public_council_profiles) and carries a deliberate
-- provenance contract — a figure is only allowed alongside a named source, a
-- URL, an as-of date and an updated-at stamp, and is documented as
-- "never a Taruu registered-user count". Seeding remembered CBS numbers here
-- would defeat that check, so cities without a sourced figure report NULL
-- residents and the dial prints an em-dash for them.
--
-- Every score is on the same -100..+100 scale, because the dial prints them
-- side by side and a reader must not have to remember which bar runs 0..100
-- and which runs signed. NULL means "not measured yet" and prints as an
-- em-dash; it is never coerced to 0, which would read as a measured floor.
--
-- Scores, and why each is shaped the way it is:
--
--   engagement  — half reach (registered residents / population, full marks
--                 at a 10% sign-up rate), half activity (share of those
--                 residents who have actually cast a ballot). Registration
--                 alone is not engagement; neither is a handful of loyal
--                 voters in a city that never heard of the platform. With no
--                 sourced population, reach is unmeasurable and the score
--                 rests on activity alone rather than guessing.
--   cooperation — per topic, |for − against| / (for + against): 1.0 when a
--                 city agrees with itself, 0.0 at a dead 50/50 split.
--                 Averaged over the city's topics, so a perfectly polarised
--                 municipality lands at −100 and a unanimous one at +100.
--                 Abstentions count toward neither side: refusing to take a
--                 side is not evidence of a split.
--   satisfaction— the 1..5 municipality_rating residents give at onboarding.
--   overall     — the weighted mean of whichever of the three exist. Weights
--                 renormalise over the non-NULL ones rather than treating an
--                 unmeasured axis as a zero.

CREATE OR REPLACE FUNCTION public.municipality_civic_stats()
RETURNS TABLE (
  municipality_code TEXT,
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
  -- Named `topics_open`, not `open_topics`: the latter is also an output
  -- column of this function, and a CTE sharing that name is ambiguous.
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
    m.official_population,
    coalesce(r.users, 0),
    coalesce(p.participants, 0),
    coalesce(t.topics, 0),
    -- Each 0..1 index is mapped onto the signed scale by x * 200 - 100.
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
      -- Reach is unmeasurable without a sourced population; activity is
      -- unmeasurable with nobody registered.
      --
      -- The CASE guards are load-bearing: `least()` SKIPS nulls, so
      -- `least(NULL, 1)` is 1, and an unknown population would otherwise
      -- score as perfect reach.
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
      -- Engagement is whichever half can be read, or their mean when both can.
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
      -- Renormalising divisor: only the axes that exist carry weight.
      (CASE WHEN idx0.engagement   IS NULL THEN 0 ELSE 0.40 END)
    + (CASE WHEN idx0.cooperation  IS NULL THEN 0 ELSE 0.35 END)
    + (CASE WHEN idx0.satisfaction IS NULL THEN 0 ELSE 0.25 END) AS weight
  ) idx
  WHERE m.kind = 'municipality'
  ORDER BY coalesce(t.topics, 0) DESC, coalesce(r.users, 0) DESC, m.code;
$$;

COMMENT ON FUNCTION public.municipality_civic_stats() IS
  'One row per municipality: sourced population, platform footprint, open '
  'topics, and the engagement / cooperation / satisfaction / overall scores '
  'on -100..+100. NULL score = not measured.';

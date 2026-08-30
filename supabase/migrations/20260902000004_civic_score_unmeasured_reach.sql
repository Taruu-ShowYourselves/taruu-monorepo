-- A civic score of -100 must mean "measured, and bad", never "not measured".
--
-- Population arrived for 245 authorities in 20260902000003. That filled the
-- one input `reach` was missing, and every one of those rows immediately began
-- reporting overall_score = -100 - because 258 of 259 authorities have zero
-- registered users, and zero users over a known population is 0% reach, which
-- is the bottom of the -100..+100 track. A data backfill silently published a
-- damning civic verdict on nearly every local authority in the country.
--
-- Two guards, both restoring a rule the code already believed:
--
--   `reach` returns NULL when nobody is registered, the same way `activity`
--   always has. A share of a user base nobody belongs to is not a measurement.
--
--   `engagement` returns NULL until the authority has a counted ballot. The
--   desk's own copy states this rule to the reader - the score opens with the
--   first ballot counted in the authority - and the SQL now keeps it.
--
-- Today that means every authority reads "טרם נמדד", which is the honest
-- report: `user_votes` is empty platform-wide.

CREATE OR REPLACE FUNCTION public.municipality_civic_stats()
 RETURNS TABLE(municipality_code text, kind text, residents bigint, platform_users bigint, active_participants bigint, open_topics bigint, engagement_score integer, cooperation_score integer, satisfaction_score integer, overall_score integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
      -- Unmeasured, not zero. Reach is a ratio over an observed user base, so
      -- with nobody registered there is nothing measured - exactly the guard
      -- `activity` below already carried. Without the symmetry a known
      -- population and an empty platform read as 0% reach.
      CASE WHEN coalesce(m.official_population, 0) = 0
             OR coalesce(r.users, 0) = 0 THEN NULL
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
        -- The index opens with the authority's first counted ballot. That is
        -- not a threshold invented here - it is the sentence the municipality
        -- desk already prints under an unmeasured score, and both halves of
        -- engagement are claims about civic participation that nothing has
        -- observed until a ballot exists. Before then a lone signup in a city
        -- of half a million resolves to ~0% reach and publishes -100 against
        -- that city's name: a verdict on the platform's own absence, wearing
        -- the authority's name.
        WHEN coalesce(p.participants, 0) = 0 THEN NULL
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
$function$;

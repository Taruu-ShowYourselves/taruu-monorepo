-- Public council profiles: stable URLs, separately sourced official population,
-- durable manager assignments, and an aggregate-only RPC.
--
-- Private user/payment rows remain protected by RLS. The public API can call
-- only public_council_metrics(), whose fixed return type contains no identity
-- or payment-provider fields.

ALTER TABLE public.municipalities
  ADD COLUMN council_id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN slug_he TEXT,
  ADD COLUMN official_population BIGINT
    CHECK (official_population IS NULL OR official_population >= 0),
  ADD COLUMN population_source_name TEXT,
  ADD COLUMN population_source_url TEXT,
  ADD COLUMN population_as_of DATE,
  ADD COLUMN population_updated_at TIMESTAMPTZ,
  ADD COLUMN profile_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.municipalities
SET slug_he = lower(regexp_replace(trim(name_he), '[[:space:]]+', '-', 'g'))
WHERE slug_he IS NULL;

ALTER TABLE public.municipalities
  ALTER COLUMN council_id SET NOT NULL,
  ALTER COLUMN slug_he SET NOT NULL,
  ADD CONSTRAINT municipalities_council_id_key UNIQUE (council_id),
  ADD CONSTRAINT municipalities_slug_he_key UNIQUE (slug_he),
  ADD CONSTRAINT municipalities_population_source_complete CHECK (
    official_population IS NULL
    OR (
      population_source_name IS NOT NULL
      AND population_source_url IS NOT NULL
      AND population_as_of IS NOT NULL
      AND population_updated_at IS NOT NULL
    )
  );

COMMENT ON COLUMN public.municipalities.council_id IS
  'Opaque stable public identifier; unlike the legacy code, this never carries display meaning.';
COMMENT ON COLUMN public.municipalities.slug_he IS
  'Canonical Hebrew URL slug for /[locale]/councils/[slug].';
COMMENT ON COLUMN public.municipalities.official_population IS
  'Authoritative-source population, never a Taruu registered-user count.';

CREATE TABLE public.council_aliases (
  alias TEXT PRIMARY KEY,
  council_id UUID NOT NULL
    REFERENCES public.municipalities(council_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.council_aliases IS
  'Legacy route identifiers and spelling aliases that resolve to one canonical Hebrew slug.';

INSERT INTO public.council_aliases (alias, council_id)
SELECT code, council_id FROM public.municipalities
ON CONFLICT (alias) DO NOTHING;

-- Preserve the known spelling variant as an alias after the earlier data
-- normalization moved stored geographic assignments to קריית טבעון.
INSERT INTO public.council_aliases (alias, council_id)
SELECT 'קרית טבעון', council_id
FROM public.municipalities
WHERE code = 'קריית טבעון'
ON CONFLICT (alias) DO NOTHING;

CREATE TABLE public.council_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id UUID NOT NULL
    REFERENCES public.municipalities(council_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role = 'community_manager'),
  active_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_until TIMESTAMPTZ,
  qualifying_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (active_until IS NULL OR active_until > active_from)
);

CREATE UNIQUE INDEX council_role_assignments_one_active_role
  ON public.council_role_assignments (council_id, user_id, role)
  WHERE active_until IS NULL;
CREATE INDEX council_role_assignments_active
  ON public.council_role_assignments (council_id, active_from, active_until);

CREATE TRIGGER update_council_role_assignments_updated_at
  BEFORE UPDATE ON public.council_role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.council_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_role_assignments ENABLE ROW LEVEL SECURITY;

-- Aliases are harmless reference data. Role assignments are deliberately not
-- directly public; only their count is available through the RPC below.
CREATE POLICY "Anyone can resolve council aliases"
  ON public.council_aliases FOR SELECT USING (true);

GRANT SELECT ON public.council_aliases TO anon, authenticated;
REVOKE ALL ON public.council_role_assignments FROM anon, authenticated;

-- One reconciled sample from Israel CBS, Local Authorities 2023, council 2300.
-- The source says "population at end of year — total 18,697".
UPDATE public.municipalities
SET
  slug_he = 'קריית-טבעון',
  official_population = 18697,
  population_source_name = 'הלשכה המרכזית לסטטיסטיקה — הרשויות המקומיות בישראל 2023',
  population_source_url = 'https://www.cbs.gov.il/he/publications/DocLib/2026/local_authorities23/%D7%A7%D7%A8%D7%99%D7%99%D7%AA%20%D7%98%D7%91%D7%A2%D7%95%D7%9F.pdf',
  population_as_of = DATE '2023-12-31',
  population_updated_at = TIMESTAMPTZ '2026-03-01 00:00:00+00',
  profile_updated_at = now()
WHERE code = 'קריית טבעון';

CREATE OR REPLACE FUNCTION public.public_council_metrics(council_identifier TEXT)
RETURNS TABLE (
  council_id UUID,
  council_code TEXT,
  council_name_he TEXT,
  council_slug_he TEXT,
  official_population BIGINT,
  population_source_name TEXT,
  population_source_url TEXT,
  population_as_of DATE,
  population_updated_at TIMESTAMPTZ,
  registered_users BIGINT,
  community_managers BIGINT,
  paying_users BIGINT,
  relevant_votes BIGINT,
  active_votes BIGINT,
  aggregates_updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH resolved AS (
    SELECT m.*
    FROM public.municipalities m
    LEFT JOIN public.council_aliases a ON a.council_id = m.council_id
    WHERE
      m.council_id::text = council_identifier
      OR m.slug_he = council_identifier
      OR m.code = council_identifier
      OR a.alias = council_identifier
    ORDER BY
      CASE
        WHEN m.slug_he = council_identifier THEN 0
        WHEN m.council_id::text = council_identifier THEN 1
        ELSE 2
      END
    LIMIT 1
  ),
  active_managers AS (
    SELECT DISTINCT cra.user_id, cra.qualifying_payment_id
    FROM public.council_role_assignments cra
    JOIN resolved r ON r.council_id = cra.council_id
    WHERE cra.role = 'community_manager'
      AND cra.active_from <= now()
      AND (cra.active_until IS NULL OR cra.active_until > now())
  ),
  qualifying_payers AS (
    -- A vote_creation payment represents paying to submit a vote.
    SELECT DISTINCT p.user_id
    FROM public.payments p
    JOIN public.users u ON u.id = p.user_id
    JOIN resolved r ON r.code = u.municipality_id
    WHERE p.status = 'completed'
      AND p.type = 'vote_creation'
    UNION
    -- A manager is a payer only when the durable active assignment references
    -- a completed, non-refunded payment.
    SELECT DISTINCT p.user_id
    FROM active_managers am
    JOIN public.payments p ON p.id = am.qualifying_payment_id
    WHERE p.status = 'completed'
  )
  SELECT
    r.council_id,
    r.code,
    r.name_he,
    r.slug_he,
    r.official_population,
    r.population_source_name,
    r.population_source_url,
    r.population_as_of,
    r.population_updated_at,
    (SELECT count(*) FROM public.users u
      WHERE u.municipality_id = r.code),
    (SELECT count(*) FROM active_managers),
    (SELECT count(*) FROM qualifying_payers),
    (SELECT count(*) FROM public.votes v
      WHERE v.municipality_id = r.code
        AND v.status IN ('active', 'ended', 'resolved')),
    (SELECT count(*) FROM public.votes v
      WHERE v.municipality_id = r.code
        AND v.status = 'active'),
    GREATEST(
      r.profile_updated_at,
      COALESCE((SELECT max(u.updated_at) FROM public.users u
        WHERE u.municipality_id = r.code), r.profile_updated_at),
      COALESCE((SELECT max(cra.updated_at)
        FROM public.council_role_assignments cra
        WHERE cra.council_id = r.council_id), r.profile_updated_at),
      COALESCE((SELECT max(p.updated_at)
        FROM public.payments p
        JOIN public.users u ON u.id = p.user_id
        WHERE u.municipality_id = r.code
          AND p.status IN ('completed', 'refunded')), r.profile_updated_at),
      COALESCE((SELECT max(v.updated_at) FROM public.votes v
        WHERE v.municipality_id = r.code), r.profile_updated_at)
    )
  FROM resolved r;
$$;

REVOKE ALL ON FUNCTION public.public_council_metrics(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_council_metrics(TEXT)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.public_council_metrics(TEXT) IS
  'Public aggregate-only council profile. Never returns user, role-assignment, or payment rows.';

-- Municipalities become a real entity: canonical table, seeded from the
-- app's constant list, with NOT VALID foreign keys validated after a
-- normalization pass — zero table rewrites, zero downtime, and the API
-- keeps serving the same municipality strings.

CREATE TABLE IF NOT EXISTS municipalities (
  code TEXT PRIMARY KEY,
  name_he TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'municipality'
    CHECK (kind IN ('municipality', 'national')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE municipalities IS
  'Canonical municipal entities; code doubles as the display name (Hebrew).';

INSERT INTO municipalities (code, name_he, kind) VALUES
  ('תל אביב-יפו', 'תל אביב-יפו', 'municipality'),
  ('ירושלים', 'ירושלים', 'municipality'),
  ('חיפה', 'חיפה', 'municipality'),
  ('ראשון לציון', 'ראשון לציון', 'municipality'),
  ('פתח תקווה', 'פתח תקווה', 'municipality'),
  ('אשדוד', 'אשדוד', 'municipality'),
  ('נתניה', 'נתניה', 'municipality'),
  ('באר שבע', 'באר שבע', 'municipality'),
  ('חולון', 'חולון', 'municipality'),
  ('בני ברק', 'בני ברק', 'municipality'),
  ('רמת גן', 'רמת גן', 'municipality'),
  ('אשקלון', 'אשקלון', 'municipality'),
  ('רחובות', 'רחובות', 'municipality'),
  ('בת ים', 'בת ים', 'municipality'),
  ('הרצליה', 'הרצליה', 'municipality'),
  ('כפר סבא', 'כפר סבא', 'municipality'),
  ('חדרה', 'חדרה', 'municipality'),
  ('מודיעין-מכבים-רעות', 'מודיעין-מכבים-רעות', 'municipality'),
  ('לוד', 'לוד', 'municipality'),
  ('רעננה', 'רעננה', 'municipality'),
  ('קריית טבעון', 'קריית טבעון', 'municipality'),
  ('כנסת ישראל', 'כנסת ישראל', 'national')
ON CONFLICT (code) DO NOTHING;

-- Normalize the known legacy spelling variant before validating.
UPDATE users SET municipality_id = 'קריית טבעון'
  WHERE municipality_id = 'קרית טבעון';
UPDATE votes SET municipality_id = 'קריית טבעון'
  WHERE municipality_id = 'קרית טבעון';
UPDATE treasury SET municipality_id = 'קריית טבעון'
  WHERE municipality_id = 'קרית טבעון';

-- Users may carry arbitrary free text from before validation existed —
-- an unknown value is unusable, so clear it and let onboarding re-ask.
UPDATE users SET municipality_id = NULL
  WHERE municipality_id IS NOT NULL
    AND municipality_id NOT IN (SELECT code FROM municipalities);

-- Votes/treasury rows are history and must keep their scope: absorb any
-- unknown codes into the entity table rather than rewriting history.
INSERT INTO municipalities (code, name_he, kind)
  SELECT DISTINCT municipality_id, municipality_id, 'municipality'
  FROM votes
  WHERE municipality_id IS NOT NULL
    AND municipality_id NOT IN (SELECT code FROM municipalities)
ON CONFLICT (code) DO NOTHING;

INSERT INTO municipalities (code, name_he, kind)
  SELECT DISTINCT municipality_id, municipality_id, 'municipality'
  FROM treasury
  WHERE municipality_id IS NOT NULL
    AND municipality_id NOT IN (SELECT code FROM municipalities)
ON CONFLICT (code) DO NOTHING;

-- NOT VALID: constrains new writes immediately, skips the existing-row
-- scan; VALIDATE then proves the (now normalized) history without locking.
ALTER TABLE users
  ADD CONSTRAINT users_municipality_fk
  FOREIGN KEY (municipality_id) REFERENCES municipalities(code) NOT VALID;
ALTER TABLE votes
  ADD CONSTRAINT votes_municipality_fk
  FOREIGN KEY (municipality_id) REFERENCES municipalities(code) NOT VALID;
ALTER TABLE treasury
  ADD CONSTRAINT treasury_municipality_fk
  FOREIGN KEY (municipality_id) REFERENCES municipalities(code) NOT VALID;

ALTER TABLE users VALIDATE CONSTRAINT users_municipality_fk;
ALTER TABLE votes VALIDATE CONSTRAINT votes_municipality_fk;
ALTER TABLE treasury VALIDATE CONSTRAINT treasury_municipality_fk;

-- Public, read-only reference data.
ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view municipalities"
  ON municipalities FOR SELECT USING (true);

-- Municipality satisfaction rating, collected during onboarding.
-- One rating per user (their current municipality); 1 = very dissatisfied,
-- 5 = very satisfied. Aggregated per municipality on the profile page.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS municipality_rating SMALLINT
    CHECK (municipality_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS municipality_rated_at TIMESTAMPTZ;

COMMENT ON COLUMN users.municipality_rating IS
  'Resident satisfaction with their municipality (1-5), asked at onboarding';
COMMENT ON COLUMN users.municipality_rated_at IS
  'When the municipality_rating was last given';

-- Profile aggregation filters on municipality + rating presence.
CREATE INDEX IF NOT EXISTS idx_users_municipality_rating
  ON users (municipality_id)
  WHERE municipality_rating IS NOT NULL;

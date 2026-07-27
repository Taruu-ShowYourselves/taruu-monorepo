-- Municipality civic metrics in SQL — replaces the application-side
-- aggregation that fetched up to 10k rating rows to average in JS.

CREATE OR REPLACE FUNCTION municipality_profile_metrics(m TEXT)
RETURNS TABLE (
  residents BIGINT,
  participants BIGINT,
  avg_time_hours NUMERIC,
  satisfaction_avg NUMERIC,
  satisfaction_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (SELECT count(*) FROM users u
      WHERE u.municipality_id = m)                          AS residents,
    (SELECT count(DISTINCT uv.user_id)
      FROM user_votes uv
      JOIN votes v ON v.id = uv.vote_id
      WHERE v.municipality_id = m)                          AS participants,
    (SELECT avg(EXTRACT(EPOCH FROM (uv.created_at - v.start_date)) / 3600.0)
      FROM user_votes uv
      JOIN votes v ON v.id = uv.vote_id
      WHERE v.municipality_id = m
        AND uv.created_at >= v.start_date)                  AS avg_time_hours,
    (SELECT avg(u.municipality_rating)
      FROM users u
      WHERE u.municipality_id = m
        AND u.municipality_rating IS NOT NULL)              AS satisfaction_avg,
    (SELECT count(*)
      FROM users u
      WHERE u.municipality_id = m
        AND u.municipality_rating IS NOT NULL)              AS satisfaction_count;
$$;

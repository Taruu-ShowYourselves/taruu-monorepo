-- Manual evidence probe: users.identity_score is database-owned and every
-- trigger path recomputes it (PR-A, migration 20260807000001, issue #71
-- final model: google 40 / document 40 / GPS 20 / phone 10 / fb 10 / ig 10 /
-- dormant x 10, capped at 140).
--
-- HOW TO RUN
--   supabase db reset                      # or apply migrations to a scratch DB
--   psql "$SCRATCH_DATABASE_URL" -f supabase/tests/identity_score_triggers.sql
--
-- THIS IS NOT PART OF `pnpm test`. apps/web/vitest.config.ts runs with
-- environment: 'node' and Supabase fully mocked, so there is no live-database
-- harness in CI. The transcript this script prints is captured by hand and
-- pasted into the PR as trigger-path evidence.
--
-- Every case prints exactly one PASS or FAIL line. A clean run prints sixteen
-- PASS lines and no FAIL lines. Runs in a rolled-back transaction: it leaves
-- no rows behind and is safe to re-run.

BEGIN;

DO $$
DECLARE
  a UUID; b UUID; c UUID;
  proof_id UUID;
  score_a INT; score_b INT; score_c INT;
  caught BOOLEAN;
BEGIN
  INSERT INTO users (email) VALUES ('a@score-test') RETURNING id INTO a;
  INSERT INTO users (email) VALUES ('b@score-test') RETURNING id INTO b;

  -- Case 1: social INSERT recomputes (google = 40)
  INSERT INTO social_proofs (user_id, provider, provider_id)
  VALUES (a, 'google', 'g-a') RETURNING id INTO proof_id;
  SELECT identity_score INTO score_a FROM users WHERE id = a;
  RAISE NOTICE '%', CASE WHEN score_a = 40
    THEN 'PASS 1: INSERT google -> 40'
    ELSE 'FAIL 1: INSERT google expected 40, got ' || score_a END;

  -- Case 2: same-user UPDATE with score-affecting provider change
  UPDATE social_proofs SET provider = 'facebook' WHERE id = proof_id;
  SELECT identity_score INTO score_a FROM users WHERE id = a;
  RAISE NOTICE '%', CASE WHEN score_a = 10
    THEN 'PASS 2: UPDATE provider google->facebook -> 10'
    ELSE 'FAIL 2: expected 10, got ' || score_a END;
  UPDATE social_proofs SET provider = 'google' WHERE id = proof_id;

  -- Case 3: UPDATE moving the proof from user A to user B recomputes BOTH
  UPDATE social_proofs SET user_id = b WHERE id = proof_id;
  SELECT identity_score INTO score_a FROM users WHERE id = a;
  SELECT identity_score INTO score_b FROM users WHERE id = b;
  RAISE NOTICE '%', CASE WHEN score_a = 0 AND score_b = 40
    THEN 'PASS 3: move proof A->B -> A=0, B=40'
    ELSE 'FAIL 3: expected A=0/B=40, got A=' || score_a || '/B=' || score_b END;
  UPDATE social_proofs SET user_id = a WHERE id = proof_id;

  -- Case 4: social DELETE recomputes
  INSERT INTO social_proofs (user_id, provider, provider_id) VALUES (a, 'instagram', 'i-a');
  DELETE FROM social_proofs WHERE user_id = a AND provider = 'instagram';
  SELECT identity_score INTO score_a FROM users WHERE id = a;
  RAISE NOTICE '%', CASE WHEN score_a = 40
    THEN 'PASS 4: DELETE instagram -> back to 40'
    ELSE 'FAIL 4: expected 40, got ' || score_a END;

  -- Case 5: verification_status -> verified adds GPS 20
  UPDATE users SET verification_status = 'verified' WHERE id = a;
  SELECT identity_score INTO score_a FROM users WHERE id = a;
  RAISE NOTICE '%', CASE WHEN score_a = 60
    THEN 'PASS 5: GPS verified -> 60'
    ELSE 'FAIL 5: expected 60, got ' || score_a END;

  -- Case 6: verification revoked removes GPS 20
  UPDATE users SET verification_status = 'failed' WHERE id = a;
  SELECT identity_score INTO score_a FROM users WHERE id = a;
  RAISE NOTICE '%', CASE WHEN score_a = 40
    THEN 'PASS 6: GPS revoked -> 40'
    ELSE 'FAIL 6: expected 40, got ' || score_a END;

  -- Case 7: phone_verified adds 10
  UPDATE users SET phone_verified = true WHERE id = a;
  SELECT identity_score INTO score_a FROM users WHERE id = a;
  RAISE NOTICE '%', CASE WHEN score_a = 50
    THEN 'PASS 7: phone verified -> 50'
    ELSE 'FAIL 7: expected 50, got ' || score_a END;

  -- Case 8: phone_verified NULL scores as unverified (NULL handling)
  UPDATE users SET phone_verified = NULL WHERE id = a;
  SELECT identity_score INTO score_a FROM users WHERE id = a;
  RAISE NOTICE '%', CASE WHEN score_a = 40
    THEN 'PASS 8: phone NULL -> 40'
    ELSE 'FAIL 8: expected 40, got ' || score_a END;

  -- Case 9: identity_verified_at (operator-approved document) adds 40
  UPDATE users SET identity_verified_at = NOW() WHERE id = a;
  SELECT identity_score INTO score_a FROM users WHERE id = a;
  RAISE NOTICE '%', CASE WHEN score_a = 80
    THEN 'PASS 9: identity document -> 80'
    ELSE 'FAIL 9: expected 80, got ' || score_a END;

  -- Case 10: identity_verified_at back to NULL removes the 40
  UPDATE users SET identity_verified_at = NULL WHERE id = a;
  SELECT identity_score INTO score_a FROM users WHERE id = a;
  RAISE NOTICE '%', CASE WHEN score_a = 40
    THEN 'PASS 10: document revoked -> 40'
    ELSE 'FAIL 10: expected 40, got ' || score_a END;

  -- Case 11: verification_status NULL scores as unverified (NULL handling)
  UPDATE users SET verification_status = NULL WHERE id = a;
  SELECT identity_score INTO score_a FROM users WHERE id = a;
  RAISE NOTICE '%', CASE WHEN score_a = 40
    THEN 'PASS 11: verification_status NULL -> 40'
    ELSE 'FAIL 11: expected 40, got ' || score_a END;
  UPDATE users SET verification_status = 'none' WHERE id = a;

  -- Case 12 (O-1): a user INSERTED with evidence already present is scored at
  -- creation - no later event needed
  INSERT INTO users (email, verification_status, phone_verified, identity_verified_at)
  VALUES ('c@score-test', 'verified', true, NOW()) RETURNING id INTO c;
  SELECT identity_score INTO score_c FROM users WHERE id = c;
  RAISE NOTICE '%', CASE WHEN score_c = 70
    THEN 'PASS 12: INSERT with GPS+phone+document evidence -> 70'
    ELSE 'FAIL 12: expected 70, got ' || score_c END;

  -- Case 13: an INSERT cannot smuggle an arbitrary identity_score
  DELETE FROM users WHERE id = c;
  INSERT INTO users (email, identity_score) VALUES ('c@score-test', 999) RETURNING id INTO c;
  SELECT identity_score INTO score_c FROM users WHERE id = c;
  RAISE NOTICE '%', CASE WHEN score_c = 0
    THEN 'PASS 13: INSERT with identity_score=999 stored as computed 0'
    ELSE 'FAIL 13: expected 0, got ' || score_c END;

  -- Case 14: full house without the dormant X provider = 130 (the 140 cap is
  -- only reachable once PR-X adds the enum value)
  UPDATE users SET verification_status = 'verified', phone_verified = true,
                   identity_verified_at = NOW() WHERE id = a;
  INSERT INTO social_proofs (user_id, provider, provider_id) VALUES
    (a, 'facebook', 'f-a'), (a, 'instagram', 'i-a2');
  SELECT identity_score INTO score_a FROM users WHERE id = a;
  RAISE NOTICE '%', CASE WHEN score_a = 130
    THEN 'PASS 14: google+facebook+instagram+GPS+phone+document -> 130'
    ELSE 'FAIL 14: expected 130, got ' || score_a END;

  -- Case 15: the dormant ''x'' arm is inert - the enum has no such value, so a
  -- proof row for provider x cannot even be inserted before PR-X
  caught := false;
  BEGIN
    INSERT INTO social_proofs (user_id, provider, provider_id)
    VALUES (a, 'x'::social_provider, 'x-a');
  EXCEPTION WHEN invalid_text_representation THEN
    caught := true;
  END;
  SELECT identity_score INTO score_a FROM users WHERE id = a;
  RAISE NOTICE '%', CASE WHEN caught AND score_a = 130
    THEN 'PASS 15: provider x rejected pre-enum, score unchanged (dormant arm inert)'
    ELSE 'FAIL 15: caught=' || caught || ', score=' || score_a END;

  -- Case 16: direct recompute equals the stored trigger-maintained value
  RAISE NOTICE '%', CASE WHEN calculate_identity_score(a) = score_a
    THEN 'PASS 16: calculate_identity_score(id) matches stored score'
    ELSE 'FAIL 16: function disagrees with stored score' END;
END $$;

ROLLBACK;

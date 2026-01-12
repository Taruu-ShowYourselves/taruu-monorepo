-- Seed data for development and testing
-- Run with: supabase db seed

-- ============================================
-- TEST USER
-- ============================================

INSERT INTO users (
  id,
  email,
  first_name,
  last_name,
  phone,
  municipality_id,
  did,
  google_id,
  identity_score,
  verification_status
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'test@sync.co.il',
  'Test',
  'User',
  '+972501234567',
  'tel-aviv',
  'did:sync:test-user-did-hash',
  'google_test_123',
  40,
  'verified'
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SOCIAL PROOFS FOR TEST USER
-- ============================================

INSERT INTO social_proofs (
  user_id,
  provider,
  provider_id,
  provider_email,
  provider_name
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'google',
  'google_test_123',
  'test@gmail.com',
  'Test User'
) ON CONFLICT (user_id, provider) DO NOTHING;

-- ============================================
-- SAMPLE VOTES
-- ============================================

-- Active vote in Tel Aviv
INSERT INTO votes (
  id,
  creator_id,
  title,
  description,
  municipality_id,
  status,
  start_date,
  end_date,
  participant_count
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'הקמת גן שעשועים חדש ברובע הצפוני',
  'הצעה להקמת גן שעשועים חדש ומודרני ברובע הצפוני של העיר. הגן יכלול מתקני משחק לגילאי 3-12, אזור ישיבה מוצל להורים, מזרקת מים לקיץ, משטחי בטיחות מגומי, ונגישות מלאה לבעלי מוגבלויות. התקציב המשוער: 2.5 מיליון ש"ח מתקציב הפיתוח העירוני.',
  'tel-aviv',
  'active',
  NOW() - INTERVAL '7 days',
  NOW() + INTERVAL '7 days',
  1237
) ON CONFLICT (id) DO NOTHING;

-- Vote options
INSERT INTO vote_options (id, vote_id, text, votes) VALUES
  ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 'בעד - יש צורך בגן שעשועים נוסף', 847),
  ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'נגד - יש מספיק גנים באזור', 234),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'בעד עם שינויים - רוצה לראות תכנון מפורט', 156)
ON CONFLICT (id) DO NOTHING;

-- Another active vote in Jerusalem
INSERT INTO votes (
  id,
  creator_id,
  title,
  description,
  municipality_id,
  status,
  start_date,
  end_date,
  participant_count
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  'הרחבת שירות האוטובוסים בשכונת הגבעה הצרפתית',
  'הצעה להרחבת קווי האוטובוס בשכונה כדי לשפר את הנגישות לתושבים הוותיקים ולמשפחות ללא רכב.',
  'jerusalem',
  'active',
  NOW() - INTERVAL '3 days',
  NOW() + INTERVAL '11 days',
  892
) ON CONFLICT (id) DO NOTHING;

INSERT INTO vote_options (id, vote_id, text, votes) VALUES
  ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444444', 'בעד - נחוץ מאוד לתושבים', 612),
  ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444444', 'נגד - יש מספיק תחבורה', 189),
  ('55555555-5555-5555-5555-555555555553', '44444444-4444-4444-4444-444444444444', 'לא משנה לי', 91)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- COMPLETED VERIFICATION FOR TEST USER
-- ============================================

INSERT INTO verification_runs (
  id,
  user_id,
  municipality_id,
  status,
  started_at,
  completed_at,
  total_check_ins,
  completed_check_ins,
  failed_check_ins
) VALUES (
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  'tel-aviv',
  'verified',
  NOW() - INTERVAL '21 days',
  NOW(),
  6,
  5,
  1
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SAMPLE PAYMENT
-- ============================================

INSERT INTO payments (
  id,
  user_id,
  type,
  amount,
  currency,
  status,
  provider,
  provider_id,
  idempotency_key
) VALUES (
  '77777777-7777-7777-7777-777777777777',
  '11111111-1111-1111-1111-111111111111',
  'vote_participation',
  300,
  'ILS',
  'completed',
  'green_invoice',
  'gi_test_123',
  'idempotent_test_key_001'
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SAMPLE ENTITLEMENT
-- ============================================

INSERT INTO entitlements (
  id,
  user_id,
  type,
  payment_id,
  vote_id,
  granted_at
) VALUES (
  '88888888-8888-8888-8888-888888888888',
  '11111111-1111-1111-1111-111111111111',
  'vote',
  '77777777-7777-7777-7777-777777777777',
  '22222222-2222-2222-2222-222222222222',
  NOW() - INTERVAL '5 days'
) ON CONFLICT (id) DO NOTHING;

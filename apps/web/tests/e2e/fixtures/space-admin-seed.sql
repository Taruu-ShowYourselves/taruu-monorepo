-- =============================================================================
-- space-admin-seed.sql — LOCAL-ONLY evidence fixture for issue #75 / plan 05-16
-- =============================================================================
--
-- Apply it with:
--
--   docker exec -i supabase_db_<project> psql -U postgres -d postgres \
--     < apps/web/tests/e2e/fixtures/space-admin-seed.sql
--
-- or, if psql is on the host:
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -f apps/web/tests/e2e/fixtures/space-admin-seed.sql
--
-- THIS IS A LOCAL FIXTURE. It writes real rows into `users`, `votes`,
-- `spaces` and the whole governance chain, and it is never to be applied to a
-- shared or production database. Every id it creates sits in the reserved
-- namespace 00000000-0000-4000-8000-0516........ so a stray row is greppable.
--
-- It is idempotent: every insert carries a fixed id and ON CONFLICT DO NOTHING,
-- so re-running it changes nothing. It CANNOT clean up after itself —
-- `space_audit_log` is append-only by trigger, so a "reset" means dropping the
-- database, not deleting rows.
--
-- KNOWN PRE-EXISTING DEFECT, not this fixture's to fix: `supabase/seed.sql`
-- inserts users whose `municipality_id` values are absent from
-- `municipalities`, violating `users_municipality_fk` from
-- 20260728000001_municipalities.sql. Local bootstrap has therefore been broken
-- since that migration, independently of issue #75. Bring the stack up with
-- seeding disabled and apply this file instead.
--
-- -----------------------------------------------------------------------------
-- What it builds, and which evidence frame each part exists for
-- -----------------------------------------------------------------------------
--
--   SPACE A  קריית טבעון   the administered space. Frames 1-14, 16a, 16b.
--   SPACE B  רעננה          the test admin holds NO grant here. Frame 15's
--                           zero-grant assertion and the object-level denial
--                           transcript.
--   SPACE C  כפר סבא        notification_monthly_quota = 1 with one campaign
--                           already sent this month. Frame 14 only.
--
--   ADMIN A  holds TEN of the eleven capabilities in space A. `grant.revoke`
--            is deliberately withheld so the capability manifest renders at
--            least one `✕ לא מוענק` row (frames 1-2).
--   ADMIN M  holds `metrics.read` and nothing else, in space A. Frame 15.
--
-- Space A has exactly FOUR residents. That is deliberate and load-bearing in
-- two directions at once: the members table needs at least three rows (frames
-- 5-6), and `space_admin_metrics` suppresses any bucket of 1-4, so four
-- residents is what makes the statistics surface render a real `<5` cell
-- (frames 7-8). Adding a fifth resident silently destroys frame 7.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Local role privileges
-- -----------------------------------------------------------------------------
-- A local stack brought up with `[auth] enabled = false` mints no keys and the
-- bootstrap does not grant table privileges to `service_role`, which is the
-- role the application's admin client authenticates as. Pre-existing tables
-- (`users`, `votes`) show the same profile, so this is a local-bootstrap
-- artifact rather than a finding about the migrations.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- ...and then put back what 20260802000001 revoked. The blanket grant above
-- would otherwise hand `service_role` the UPDATE and DELETE the migration
-- deliberately took away. Immutability does not depend on this — it is
-- trigger-enforced and holds against the postgres superuser — but a fixture
-- that quietly widened a privilege the schema narrowed would be misleading.
REVOKE UPDATE, DELETE, TRUNCATE ON public.space_audit_log FROM service_role;

-- -----------------------------------------------------------------------------
-- 1. Space C's exhausted quota (frame 14)
-- -----------------------------------------------------------------------------
UPDATE public.spaces
   SET notification_monthly_quota = 1
 WHERE id = '3ea6ab9a-8fd0-4249-98d4-70646e1cfdc7';

-- -----------------------------------------------------------------------------
-- 2. People
-- -----------------------------------------------------------------------------
-- All four are residents of קריית טבעון, which is what makes them members of
-- space A: membership is `users.municipality_id = spaces.municipality_code`.
INSERT INTO public.users
  (id, email, first_name, last_name, municipality_id, google_id, did,
   verification_status, identity_verified_at, notification_settings, created_at)
VALUES
  -- ADMIN A — ten capabilities. Also the submitter of the self-submitted
  -- proposal, which is what frames 3-4 need.
  ('00000000-0000-4000-8000-051600000001', 'space-admin-a@example.test',
   'נועה', 'ברק', 'קריית טבעון', 'gid-0516-a1', 'did:taruu:0516a1',
   'verified', now() - interval '90 days', NULL, now() - interval '400 days'),

  -- ADMIN M — metrics.read only. Frame 15 signs in as this account.
  ('00000000-0000-4000-8000-051600000002', 'space-admin-m@example.test',
   'יונתן', 'אלמוג', 'קריית טבעון', 'gid-0516-a2', 'did:taruu:0516a2',
   'verified', now() - interval '80 days', NULL, now() - interval '300 days'),

  -- A plain resident who submits two proposals.
  ('00000000-0000-4000-8000-051600000003', 'resident-1@example.test',
   'דנה', 'שקד', 'קריית טבעון', 'gid-0516-r1', 'did:taruu:0516r1',
   'none', NULL, NULL, now() - interval '200 days'),

  -- The suspended member (frames 5-6) and the submitter of the
  -- hidden-and-flagged proposal (frame 16b).
  ('00000000-0000-4000-8000-051600000004', 'resident-2@example.test',
   'איתי', 'כהן', 'קריית טבעון', 'gid-0516-r2', 'did:taruu:0516r2',
   'pending', NULL, NULL, now() - interval '120 days')
ON CONFLICT DO NOTHING;

-- Two of the four residents have a live push channel. The other two stay in
-- the audience and are counted under `הוחרגו — ללא ערוץ פעיל`, so the Receipt
-- in frames 9-10 shows a non-trivial number rather than four zeros.
INSERT INTO public.push_tokens (id, user_id, token, device_type, is_active)
VALUES
  ('00000000-0000-4000-8000-051600000011', '00000000-0000-4000-8000-051600000001',
   'ExponentPushToken[0516-seed-a1]', 'ios', true),
  ('00000000-0000-4000-8000-051600000012', '00000000-0000-4000-8000-051600000003',
   'ExponentPushToken[0516-seed-r1]', 'android', true)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Capability grants
-- -----------------------------------------------------------------------------
-- TEN of eleven for admin A in space A. `grant.revoke` is absent on purpose —
-- see the header. Every grant is stamped `granted_by` admin A itself, which is
-- how a bootstrap grant looks before a platform admin exists.
INSERT INTO public.space_capability_grants
  (id, space_id, user_id, capability, granted_via_role, granted_by, granted_at)
VALUES
  ('00000000-0000-4000-8000-051600000101', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8', '00000000-0000-4000-8000-051600000001', 'proposal.read',     'space_admin', '00000000-0000-4000-8000-051600000001', now() - interval '380 days'),
  ('00000000-0000-4000-8000-051600000102', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8', '00000000-0000-4000-8000-051600000001', 'proposal.approve',  'space_admin', '00000000-0000-4000-8000-051600000001', now() - interval '380 days'),
  ('00000000-0000-4000-8000-051600000103', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8', '00000000-0000-4000-8000-051600000001', 'proposal.reject',   'space_admin', '00000000-0000-4000-8000-051600000001', now() - interval '380 days'),
  ('00000000-0000-4000-8000-051600000104', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8', '00000000-0000-4000-8000-051600000001', 'member.read',       'space_admin', '00000000-0000-4000-8000-051600000001', now() - interval '380 days'),
  ('00000000-0000-4000-8000-051600000105', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8', '00000000-0000-4000-8000-051600000001', 'member.suspend',    'space_admin', '00000000-0000-4000-8000-051600000001', now() - interval '380 days'),
  ('00000000-0000-4000-8000-051600000106', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8', '00000000-0000-4000-8000-051600000001', 'grant.create',      'space_admin', '00000000-0000-4000-8000-051600000001', now() - interval '380 days'),
  ('00000000-0000-4000-8000-051600000107', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8', '00000000-0000-4000-8000-051600000001', 'content.moderate',  'space_admin', '00000000-0000-4000-8000-051600000001', now() - interval '380 days'),
  ('00000000-0000-4000-8000-051600000108', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8', '00000000-0000-4000-8000-051600000001', 'metrics.read',      'space_admin', '00000000-0000-4000-8000-051600000001', now() - interval '380 days'),
  ('00000000-0000-4000-8000-051600000109', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8', '00000000-0000-4000-8000-051600000001', 'notification.send', 'space_admin', '00000000-0000-4000-8000-051600000001', now() - interval '380 days'),
  ('00000000-0000-4000-8000-05160000010a', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8', '00000000-0000-4000-8000-051600000001', 'audit.read',        'space_admin', '00000000-0000-4000-8000-051600000001', now() - interval '380 days'),

  -- ADMIN M — one capability, and it is not `proposal.read`. Navigating this
  -- account to /proposals is frame 15.
  ('00000000-0000-4000-8000-051600000111', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8', '00000000-0000-4000-8000-051600000002', 'metrics.read', 'observer', '00000000-0000-4000-8000-051600000001', now() - interval '200 days'),

  -- ADMIN A in SPACE C, for the exhausted-quota composer only.
  ('00000000-0000-4000-8000-051600000121', '3ea6ab9a-8fd0-4249-98d4-70646e1cfdc7', '00000000-0000-4000-8000-051600000001', 'notification.send', 'space_admin', '00000000-0000-4000-8000-051600000001', now() - interval '100 days'),
  ('00000000-0000-4000-8000-051600000122', '3ea6ab9a-8fd0-4249-98d4-70646e1cfdc7', '00000000-0000-4000-8000-051600000001', 'metrics.read',      'space_admin', '00000000-0000-4000-8000-051600000001', now() - interval '100 days')
ON CONFLICT DO NOTHING;

-- The suspended member's grant, suspended with the SAME timestamp as the
-- suspension record below. 05-06's `liftMemberSuspension` matches on that exact
-- value, so a fixture whose two timestamps disagreed would make reinstatement
-- silently restore nothing.
INSERT INTO public.space_capability_grants
  (id, space_id, user_id, capability, granted_via_role, granted_by, granted_at,
   suspended_at, suspended_by)
VALUES
  ('00000000-0000-4000-8000-051600000131', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8',
   '00000000-0000-4000-8000-051600000004', 'proposal.read', 'reviewer',
   '00000000-0000-4000-8000-051600000001', now() - interval '150 days',
   TIMESTAMPTZ '2026-08-01 09:00:00+00', '00000000-0000-4000-8000-051600000001')
ON CONFLICT DO NOTHING;

INSERT INTO public.space_member_suspensions
  (id, space_id, user_id, suspended_at, suspended_by, reason)
VALUES
  ('00000000-0000-4000-8000-051600000141', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8',
   '00000000-0000-4000-8000-051600000004', TIMESTAMPTZ '2026-08-01 09:00:00+00',
   '00000000-0000-4000-8000-051600000001',
   'הפרה חוזרת של כללי השיח במרחב אחרי שתי אזהרות בכתב.')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Proposals
-- -----------------------------------------------------------------------------
INSERT INTO public.votes
  (id, creator_id, title, description, municipality_id, status,
   start_date, end_date, participant_count, created_at,
   hidden_at, hidden_by, flagged_at, flagged_by)
VALUES
  -- P1 — under review, submitted by someone else, unmoderated. Frame 16a.
  ('00000000-0000-4000-8000-051600000201', '00000000-0000-4000-8000-051600000003',
   'הרחבת שביל האופניים ברחוב הראשי',
   'ההצעה היא להרחיב את שביל האופניים לאורך רחוב הראשי משני מטרים לשלושה, ולהוסיף הפרדה פיזית מנתיב הרכבים. השביל הנוכחי צר מדי לשני רוכבים זה לצד זה, ובשעות הבוקר נוצרת עדיפות בפועל להולכי הרגל על המדרכה הסמוכה. ההצעה כוללת גם שישה מתקני קשירה בקצה הצפוני.',
   'קריית טבעון', 'in_review', now(), now() + interval '30 days', 0,
   now() - interval '2 days', NULL, NULL, NULL, NULL),

  -- P2 — under review, submitted by ADMIN A. Its actions cell must hold the
  -- lock text and contain no buttons at all. Frames 3-4.
  ('00000000-0000-4000-8000-051600000202', '00000000-0000-4000-8000-051600000001',
   'הצבת ספסלים מוצלים בגן הוותיקים',
   'ההצעה היא להציב ארבעה ספסלים עם הצללה קבועה בגן הוותיקים, בקטע שבין הכניסה המזרחית למגרש המשחקים. כיום אין באזור הזה ולו ספסל מוצל אחד, והוא הקטע שבו יושבים רוב המבקרים בשעות אחר הצהריים.',
   'קריית טבעון', 'in_review', now(), now() + interval '30 days', 0,
   now() - interval '3 days', NULL, NULL, NULL, NULL),

  -- P3 — under review, HIDDEN and FLAGGED. Frame 16b: both notices render
  -- above the body, hidden first, with the two inverse controls in place.
  ('00000000-0000-4000-8000-051600000203', '00000000-0000-4000-8000-051600000004',
   'שינוי שעות הפעילות של מגרש הכדורסל',
   'ההצעה היא להאריך את שעות הפעילות של מגרש הכדורסל העירוני עד 23:00 בימי חול. הדיירים בבניין הסמוך התלוננו בעבר על רעש, ולכן ההצעה כוללת גם בדיקת מפלס רעש לפני ואחרי.',
   'קריית טבעון', 'in_review', now(), now() + interval '30 days', 0,
   now() - interval '4 days',
   now() - interval '1 day', '00000000-0000-4000-8000-051600000001',
   now() - interval '1 day', '00000000-0000-4000-8000-051600000001'),

  -- P4 — already approved and published. This is what an audit-log deep link
  -- points at, and it is the space's one `active` vote.
  ('00000000-0000-4000-8000-051600000204', '00000000-0000-4000-8000-051600000003',
   'תוספת תאורה בשביל הכניסה לבית הספר',
   'ההצעה היא להוסיף שישה עמודי תאורה נמוכים לאורך שביל הכניסה לבית הספר היסודי, בקטע שאינו מואר כיום כלל בשעות החורף.',
   'קריית טבעון', 'active', now() - interval '5 days', now() + interval '20 days', 3,
   now() - interval '20 days', NULL, NULL, NULL, NULL),

  -- P5 — a fourth row under review, so the default queue is not thin.
  ('00000000-0000-4000-8000-051600000205', '00000000-0000-4000-8000-051600000002',
   'מיחזור בקבוקים בכיכר המרכזית',
   'ההצעה היא להציב שלוש עמדות מיחזור בקבוקים בכיכר המרכזית ובשתי תחנות האוטובוס הסמוכות לה.',
   'קריית טבעון', 'in_review', now(), now() + interval '30 days', 0,
   now() - interval '6 days', NULL, NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Options and cast votes on the published proposal. Three participants is
-- itself a bucket of 1-4, so `active_participants_30d` suppresses too and the
-- statistics surface shows the suppression rule holding on more than one card.
INSERT INTO public.vote_options (id, vote_id, text, votes)
VALUES
  ('00000000-0000-4000-8000-051600000211', '00000000-0000-4000-8000-051600000204', 'בעד', 2),
  ('00000000-0000-4000-8000-051600000212', '00000000-0000-4000-8000-051600000204', 'נגד', 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_votes (id, user_id, vote_id, option_id, created_at)
VALUES
  ('00000000-0000-4000-8000-051600000221', '00000000-0000-4000-8000-051600000001', '00000000-0000-4000-8000-051600000204', '00000000-0000-4000-8000-051600000211', now() - interval '3 days'),
  ('00000000-0000-4000-8000-051600000222', '00000000-0000-4000-8000-051600000002', '00000000-0000-4000-8000-051600000204', '00000000-0000-4000-8000-051600000211', now() - interval '3 days'),
  ('00000000-0000-4000-8000-051600000223', '00000000-0000-4000-8000-051600000003', '00000000-0000-4000-8000-051600000204', '00000000-0000-4000-8000-051600000212', now() - interval '2 days')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Notification campaigns
-- -----------------------------------------------------------------------------
-- Space A: one campaign sent this month against a quota of eight, so the
-- overview's `התראות שנשלחו החודש` figure is populated and the composer is
-- still sendable (frames 1-2 and 9-10).
--
-- Space C: one campaign sent this month against a quota of one, which is the
-- exhausted state (frame 14).
--
-- The two hashes are fixture literals, not real fingerprints. Nothing reads
-- them for a campaign that is already `sent` — the send verifies them only
-- while claiming a `previewed` row — so a placeholder here cannot make a
-- verification pass that should have failed.
INSERT INTO public.space_notification_campaigns
  (id, space_id, created_by, title, body, audience_filter,
   audience_hash, content_hash, audience_size, excluded_opted_out,
   excluded_no_channel, status, reason, previewed_at, sent_at)
VALUES
  ('00000000-0000-4000-8000-051600000301', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8',
   '00000000-0000-4000-8000-051600000001',
   'הצבעה חדשה נפתחה במרחב',
   'ההצבעה על תוספת התאורה בשביל הכניסה לבית הספר נפתחה ותהיה פתוחה עשרים יום.',
   'all_members', 'seed-audience-hash-a', 'seed-content-hash-a', 4, 0, 2,
   'sent', 'עדכון התושבים על פתיחת הצבעה שאושרה בוועדה.',
   date_trunc('month', now()) + interval '2 days',
   date_trunc('month', now()) + interval '2 days'),

  ('00000000-0000-4000-8000-051600000302', '3ea6ab9a-8fd0-4249-98d4-70646e1cfdc7',
   '00000000-0000-4000-8000-051600000001',
   'סיכום ההצבעה על תקציב הרובע',
   'ההצבעה על תקציב הרובע הסתיימה. תודה לכל מי שהשתתף — התוצאות פורסמו בעמוד ההצבעה.',
   'all_members', 'seed-audience-hash-c', 'seed-content-hash-c', 0, 0, 0,
   'sent', 'סיכום תוצאות ההצבעה לתושבים שהשתתפו בה.',
   date_trunc('month', now()) + interval '1 day',
   date_trunc('month', now()) + interval '1 day')
ON CONFLICT DO NOTHING;

COMMIT;

-- =============================================================================
-- 6. Audit history
-- =============================================================================
-- `space_audit_log` is append-only by trigger, so this section is separated
-- from the transaction above: a re-run must be able to no-op on the ids it
-- already wrote without the whole fixture failing.
--
-- 105 rows. That number is not arbitrary — `listSpaceAudit` is called by the
-- surface with no limit, so the repository serves its own ceiling of 100, and
-- a fixture of fewer than 101 rows produces a `nextCursor` of null and a page
-- control that can only ever render disabled. At 105 the `← רשומות ישנות יותר`
-- control is genuinely live and the reviewer can page.
--
-- The seven narrative rows carry the newest timestamps so they land on page
-- one, including the over-long reason that frames 11-12 need for the clamp and
-- its disclosure.

INSERT INTO public.space_audit_log
  (id, space_id, actor_user_id, action, object_type, object_id,
   prior_state, new_state, reason, created_at)
VALUES
  ('00000000-0000-4000-8000-051600000401', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8',
   '00000000-0000-4000-8000-051600000001', 'proposal.approved', 'vote',
   '00000000-0000-4000-8000-051600000204',
   '{"status":"in_review"}', '{"status":"active"}',
   'ההצעה עומדת בכל תנאי הפרסום ואושרה בישיבת הוועדה מיום 12 ביולי.',
   now() - interval '1 hour'),

  -- The long reason. Frames 11-12 need one row whose reason overflows the
  -- two-line clamp, so that `הצג נימוק מלא ▾` has something to disclose.
  ('00000000-0000-4000-8000-051600000402', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8',
   '00000000-0000-4000-8000-051600000001', 'member.suspended', 'member',
   '00000000-0000-4000-8000-051600000004',
   '{"suspended":false}', '{"suspended":true}',
   'השעיה בעקבות הפרה חוזרת של כללי השיח במרחב. החבר קיבל שתי אזהרות בכתב, בתאריכים 14 ביוני ו־2 ביולי, ובשתיהן צוין במפורש שהמשך התנהלות מאותו סוג יוביל להשעיה. ההודעות שהובילו להחלטה תועדו בצילומי מסך ונשמרו בתיק הפנייה. ההשעיה אינה מוחקת דבר מהיומן, וכל הכרעה קודמת של החבר במרחב נשארת גלויה ובת־קריאה. אפשר לבטל אותה בכל שלב דרך מסך החברים.',
   now() - interval '2 hours'),

  ('00000000-0000-4000-8000-051600000403', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8',
   '00000000-0000-4000-8000-051600000001', 'content.hidden', 'content',
   '00000000-0000-4000-8000-051600000203',
   '{"hidden":false,"flagged":true}', '{"hidden":true,"flagged":true}',
   'ההצעה כוללת פרטים מזהים של דייר פרטי ולכן הוסתרה עד לתיקון הנוסח.',
   now() - interval '3 hours'),

  ('00000000-0000-4000-8000-051600000404', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8',
   '00000000-0000-4000-8000-051600000001', 'content.flagged', 'content',
   '00000000-0000-4000-8000-051600000203',
   '{"hidden":false,"flagged":false}', '{"hidden":false,"flagged":true}',
   'סומן לבדיקה אחרי שתי פניות מתושבים על נוסח ההצעה.',
   now() - interval '4 hours'),

  ('00000000-0000-4000-8000-051600000405', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8',
   '00000000-0000-4000-8000-051600000001', 'grant.created', 'grant',
   '00000000-0000-4000-8000-051600000111',
   NULL, '{"capability":"metrics.read"}',
   'הענקת הרשאת צפייה בנתונים מצטברים לחבר הוועדה החדש.',
   now() - interval '5 hours'),

  ('00000000-0000-4000-8000-051600000406', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8',
   '00000000-0000-4000-8000-051600000001', 'notification.sent', 'notification_campaign',
   '00000000-0000-4000-8000-051600000301',
   '{"status":"previewed"}', '{"status":"sent","recipients":4}',
   'עדכון התושבים על פתיחת ההצבעה שאושרה בוועדה.',
   now() - interval '6 hours'),

  ('00000000-0000-4000-8000-051600000407', 'adbbf57e-ea77-439b-bc56-e616c2b0bbb8',
   '00000000-0000-4000-8000-051600000001', 'grant.revoked', 'grant',
   '00000000-0000-4000-8000-051600000131',
   '{"capability":"proposal.read"}', NULL,
   'שלילת הרשאה אחרי סיום התפקיד בוועדת התכנון.',
   now() - interval '7 hours')
ON CONFLICT DO NOTHING;

-- 98 filler rows, so page one is full and page two exists.
INSERT INTO public.space_audit_log
  (id, space_id, actor_user_id, action, object_type, object_id,
   prior_state, new_state, reason, created_at)
SELECT
  ('00000000-0000-4000-8000-05169' || lpad(n::text, 7, '0'))::uuid,
  'adbbf57e-ea77-439b-bc56-e616c2b0bbb8',
  CASE WHEN n % 3 = 0
       THEN '00000000-0000-4000-8000-051600000002'::uuid
       ELSE '00000000-0000-4000-8000-051600000001'::uuid END,
  (ARRAY['proposal.changes_requested','grant.created','notification.sent'])[1 + (n % 3)],
  (ARRAY['vote','grant','notification_campaign'])[1 + (n % 3)],
  (ARRAY['00000000-0000-4000-8000-051600000201',
         '00000000-0000-4000-8000-051600000101',
         '00000000-0000-4000-8000-051600000301'])[1 + (n % 3)]::uuid,
  NULL,
  NULL,
  'רשומה היסטורית מספר ' || n || ' — נשמרה כדי שהיומן יכיל יותר מעמוד אחד ושאפשר יהיה לדפדף אחורה.',
  now() - interval '1 day' - (n * interval '1 hour')
FROM generate_series(1, 98) AS n
ON CONFLICT DO NOTHING;

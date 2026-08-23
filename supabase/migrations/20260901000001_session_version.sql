-- session_version: the global revocation counter behind Issue #71's Model B
-- immediate-revocation guarantee (see specs/mfa-architecture.md §4.4).
--
-- Every session and refresh token minted by apps/web/src/services/auth is
-- stamped with the `session_version` value current at mint time (claim `sv`).
-- The check happens in the CENTRAL authenticated-request path
-- (getSessionFromRequest / getSessionFromCookies in services/auth/session.ts),
-- not per-route, so a bump takes effect on the very next request that
-- presents a stale token - revocation is effectively immediate, bounded only
-- by requests already in flight at commit time. There is deliberately no
-- cache anywhere in that path; a cache would relax the guarantee from
-- "immediate" to "up to cache TTL".
--
-- This migration is inert: nothing in M1 (WS-A, the auth kernel) bumps this
-- column. Bumping it is reserved for later Issue #71 milestones - MFA disable,
-- operator reset, and sign-out-everywhere - none of which exist yet.

ALTER TABLE public.users
  ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.users.session_version IS
  'Global revocation counter (Issue #71 Model B, specs/mfa-architecture.md §4.4). '
  'Every session/refresh token is stamped with this value (claim `sv`) at mint. '
  'services/auth/session.ts re-reads it by primary key on every authenticated '
  'request and rejects a token whose `sv` no longer matches, clearing cookies. '
  'This migration only adds the column - nothing bumps it yet.';

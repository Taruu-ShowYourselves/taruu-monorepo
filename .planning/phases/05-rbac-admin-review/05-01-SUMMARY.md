# 05-01 — RLS transport — SUMMARY

**Completed:** 2026-08-03
**Commit:** `96448b3` on branch `feat/rls-transport`
**Requirements:** RLS-01, RLS-02, RLS-03

## What exists now

### `apps/web/src/lib/supabase/user-token.ts` (RLS-01)

Plans 05-02 and 05-04 build against these signatures verbatim:

```ts
export const SUPABASE_TOKEN_TTL_SECONDS = 300;

export function getSupabaseJwtSecret(): Uint8Array;

export interface MintOptions {
  ttlSeconds?: number;
  now?: () => Date;
}

export async function mintSupabaseAccessToken(
  userId: string,
  options?: MintOptions
): Promise<string>;
```

**TTL chosen: 300 seconds (5 minutes).** Long enough for one request, worthless
almost immediately if it leaks. `ttlSeconds` exists for tests; production should
not pass it.

Claim set is exactly `sub`, `role`, `aud`, `iat`, `exp` — asserted positively in
the test (`Object.keys(payload).sort()`), not just as absence of `email` /
`googleId` / `did`. A non-UUID `userId` throws rather than minting a token that
would make `public.user_id()` return NULL and every policy silently match zero
rows.

### `apps/web/src/lib/supabase/user-client.ts` (RLS-02)

```ts
export function createUserScopedClient(userId: string): SupabaseClient<Database>;
```

Anon key + `accessToken` callback. Token memoized per client instance for
`TTL - 30s`. One client per request — it closes over a single user's identity.

### `supabase/migrations/20260802000001_rls_transport.sql` (RLS-03)

`public.user_id()` is now JWT-only (`STABLE`, `SECURITY DEFINER`,
`SET search_path = public`); `set_claim` is dropped. **NOT APPLIED to any
database** — application is plan 05-09 Task 1.

### Deleted

`withUserContext()` from `server.ts` (replaced by a tombstone comment), the
`set_claim` entry from the generated `Database` type, and the
`app.current_user_id` fallback from the SQL. `supabaseAdmin` is unchanged in
behaviour but its header now states `EXPLICITLY PRIVILEGED`.

## SDK verification

The whole RLS-02 approach depends on one SDK option. Verified before writing
code against it, not trusted from the plan note:

```
apps/web/node_modules/@supabase/supabase-js/package.json   "version": "2.90.1"
apps/web/node_modules/@supabase/supabase-js/dist/index.d.mts:157
    accessToken?: () => Promise<string | null>;
```

`package.json` still declares `^2.39.0`, far behind the resolved version. If
that range is ever honoured by a fresh install, `accessToken` may not exist and
this transport breaks. **Worth pinning `@supabase/supabase-js` to `^2.90.0`;
not done here — out of this plan's file scope.**

## Gates

- `npx vitest run src/lib/supabase src/__tests__/lib/supabase-server.test.ts` — 19 passed
- `pnpm --filter @sync/web test` — 827 passed (67 files)
- `pnpm --filter @sync/web typecheck` — clean
- `pnpm --filter @sync/web lint` — 2 pre-existing warnings, unchanged
- `grep -rn "set_claim\|withUserContext" apps/web/src` — only the tombstone
  comment and the negative assertion remain

## Deviations from the plan

1. **The plan's Task 3 verify command contradicts its own prescribed content.**
   It requires the migration to contain a `COMMENT ON FUNCTION` whose text reads
   "Never use auth.uid() here", then asserts `grep -c "auth.uid()"` returns 0
   over the whole file. Both cannot hold. Kept the comment — it is the SEC-01
   trap warning and is the reason the next person does not reintroduce the bug —
   and scoped the check to the function body instead. No `auth.uid()` is called
   anywhere.

2. **Acceptance criterion `grep -cE "JWT_SECRET[^_]" user-token.ts` returns 0 is
   unsatisfiable as written** — `SUPABASE_JWT_SECRET` contains `JWT_SECRET` as a
   substring followed by a non-underscore. The intent (never reference the
   *session* secret) is met: the module reads only `SUPABASE_JWT_SECRET`.

## Blockers for anything downstream

**`SUPABASE_JWT_SECRET` is not set anywhere.** It can only be read from the
Supabase dashboard (Project Settings → API → JWT Settings → JWT Secret). Until
it is set, `createUserScopedClient()` throws on first use and no route can be
migrated onto it.

**The HS256 assumption is unverified against the live project.** Supabase
projects migrated to asymmetric signing keys have the legacy HS256 secret
disabled. If this project is one of them, RLS-01 as built does not apply and the
approach needs revisiting (JWKS / RS256). The plan itself flags this as a
stop-and-report condition. It has not been checked — it cannot be, from here.

**Nothing has been proven against a real database.** This plan builds and
unit-tests the transport. That a policy actually matches a row when the token is
present is plan 05-04's job (the repo's first automated RLS test) and requires
both the secret above and the migration applied.

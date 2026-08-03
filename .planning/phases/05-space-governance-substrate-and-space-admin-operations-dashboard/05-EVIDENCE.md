# Phase 5 — verification record

**Run:** 2026-08-03, plan 05-16, on branch `feat/75-space-admin-dashboard`.
**Target:** the throwaway local Supabase stack `dbverify` (db 54422, REST 54421,
ports shifted +100 so it could not touch the running `discovery` stack) plus
`next dev` on 127.0.0.1:3999 against it. **Not** production; no production DDL
and no production request at any point.

This document exists because fifteen plans shipped a dashboard nothing had ever
rendered and a governance substrate no query had ever executed. `apps/web` runs
`vitest` with `environment: 'node'` and Supabase fully mocked, and has no React
testing harness at all — so the shape of a PostgREST query, the server/client
module boundary, and the appearance of a disabled button were all outside what
CI could see. Everything below was gathered outside the unit suite.

**It found three defects, two of which broke whole surfaces.** They are recorded
in full in §2 rather than buried, because the pattern they share is the standing
limitation this phase should carry forward.

---

## 1. Requirement evidence map

The **Kind** column is the honest one. "Automated" means a check that runs in CI
on every PR. "Manual" means it was executed by hand during this run and will not
re-run unless someone repeats it. "Live" means it was executed against a running
app and a real database in this run, and is reproducible with the committed
Playwright spec plus the seed fixture.

| # | Requirement (abbreviated) | Evidence | Kind |
|---|---|---|---|
| **SPACE-01** | typed `spaces`, nullable `municipality_code` FK, no rewrite of `users`/`votes`/`treasury` | `20260802000001_space_governance.sql` applied cleanly from empty, one space seeded per municipality; the three legacy `municipality_id` columns are untouched in the diff. Migration-apply transcript: `05-DB-EVIDENCE.md` §1. Every surface in this run reads through `spaces.municipality_code`. | **Manual** (migration apply) + **Automated** (`space-admin-*` suites compile against the row types) |
| **SPACE-02** | per-action grants, default deny, no roles claim in the JWT, resolved server-side per request | **Holds by construction, and the evidence is the absence of a change.** No plan in this phase touches `jose`, `apps/web/src/services/auth/session.ts`, or the session payload shape; every capability resolves from `space_capability_grants` on every request through `authorize()`. Two standing checks, both run below in §5: `git diff main --stat -- apps/web/src/services/auth/session.ts` returns nothing, and `grep -rn "roles\|capabilities" apps/web/src/services/auth/session.ts` returns nothing. Positive coverage: `space-admin-capability-matrix.test.ts` drives 22 rows over all eleven capabilities against both shipped endpoints; the live run in §3 confirms a ten-capability admin and a one-capability admin get different surfaces from the same code path. | **Automated** |
| **SPACE-03** | object-level authorization; swapping `spaceId` yields `FORBIDDEN` with nothing disclosed | **Proven twice, and neither alone is the whole claim.** Against mocks: `space-admin-object-authz.test.ts` (automated, CI). Against a running app: the 45-probe transcript in §3, every endpoint × unauthorized / nonexistent / malformed, all byte-identical `403 {"error":"Forbidden","code":"FORBIDDEN"}`, SHA-256 confirmed equal. The mock test proves the code path; only the live transcript proves the deployed routes. | **Automated** + **Live** |
| **SPACE-04** | every decision and role change writes an immutable audit row with actor, time, prior state, new state, reason, object; no application path can update or delete one | **Immutability is manual, and saying otherwise would misrepresent this phase's coverage.** The append-only proof (§4) runs `supabase/tests/audit_append_only.sql` by hand: 7 PASS / 0 FAIL, `42501` three times (UPDATE, DELETE, TRUNCATE), `23514` on a blank reason, `23503` on deleting an actor with history. Newly added in this run: the same refusals against the role the application actually authenticates as, and against `anon`/`authenticated` (§4.2). Row *content* is automated — `space-admin-audit.test.ts` asserts the shape, and §3's live decision shows a real row carrying `prior_state`, `new_state`, the payment id and the reason. | **Manual** (immutability) + **Automated** (row content) + **Live** (a real row written end to end) |
| **SPACE-05** | approve / reject / request-changes over the review states, gated ahead of publication; deterministic under conflict; no self-review | Automated: `space-admin-decide.test.ts` (29 cases), `review.test.ts` (28). Live (§3.3): an approval published a proposal `in_review → active` and wrote exactly one `proposal.approved` row; the *same* decision repeated answered `409` with `ההצעה כבר הוכרעה על ידי מנהל אחר…` and published nothing; a reviewer deciding their own submission got `403` with the lock sentence. `uq_space_proposal_single_approval` confirmed to hold at one row. | **Automated** + **Live** |
| **SPACE-06** | member/role management and permitted-content controls, inside the administered space only, each mutation audited | Automated: `space-admin-members.test.ts`, `space-admin-content.test.ts` (39 cases). Live (§3.3): suspend → `200`, suspend again → `409 החבר/ה כבר מושעה/ית במרחב הזה.`, reinstate → `200`, reinstate again → `409 החבר/ה אינו מושעה/ית במרחב הזה.` — the conditional-write conflict detection working against a real database. Frames 05/06 show a suspended row offering only reinstatement; frames 16a/16b show the four content controls in their two mutually-exclusive states. | **Automated** + **Live** |
| **SPACE-07** | aggregates only; privacy-safe member fields; never raw identity-document data | Automated: `space-admin-metrics.test.ts` (14 cases incl. a hostile row), the serialization guard in `space-admin-members.test.ts`. Live: `space_admin_metrics` executed against a four-resident space returned `registered_residents = NULL / suppressed` and `active_participants_30d = NULL / suppressed` — the true small numbers never left Postgres. Frames 07/08 render `<5` and the aggregate-only footer, and the frame asserts **zero** `a, button, [role=button], input, select` inside any stat card. | **Automated** + **Live** |
| **SPACE-08** | preview the audience; delivered set equals previewed authorized audience; opt-outs honored; server-side quota; delivery log | **The equality had never been executed until this run.** §3.2 is a full preview → send round trip: preview returned `approvedRecipients 4 / excludedOptedOut 0 / excludedNoChannel 2`; the send returned `deliveredRecipients 4`; the database then showed `audience_size 4`, four `in_app`/`delivered` delivery rows, four inbox rows, and `delivered_equals_previewed = t` computed in SQL. Quota moved 1→2 of 8 and is counted from campaign rows. A second send of the same campaign answered `409 ההתראה כבר נשלחה.` The composer's client-side staleness rule — an edit invalidates the preview on change, across zero blur events — is asserted in §6.2 rather than argued. | **Automated** (`space-admin-audience.test.ts` 29, `space-admin-notifications.test.ts` 33) + **Live** |
| **SPACE-09** | super admin can suspend access with immediate effect, deleting no audit history; admins have an escalation path | Automated: `space-admin-suspension.test.ts` shows 200 → 403 on the next request with the same cookie and the suspended admin's history still readable. Structural: `ON DELETE RESTRICT` on both audit FKs, proven by the `23503` case in §4. Live: the seed's suspended member holds a suspended grant and an unlifted suspension row, and frames 05/06 show the surface; the escalation CTA is present on the refused surface in frame 15 and on the overview in frame 01. | **Automated** + **Manual** (the `23503` refusal) |
| **SPACE-10** | the dashboard ships at `/he/space-admin/[spaceId]` — Hebrew/RTL, tokens only, six surfaces, desktop and mobile | 22 assertion-guarded frames at 1440×900 and 390×844, plus the screenshot-less staleness test (§6, §6.2) — 24 tests in all. Token-hygiene scan in §5: no hardcoded colour, no pixel literal in any declaration, no banned import. **A human has not yet confirmed the appearance** — that is the blocking checkpoint this document is handed to, and §8 says exactly what is being asked. | **Live** (capture + assertions) · **verdict pending** |

**Not claimed anywhere above:** that any of this ran against production, that the
Expo push endpoint was reached, or that a real payment was captured. See §7.

---

## 2. What this run found

Three defects. All three were invisible to `tsc` and to the 987-test unit suite,
and all three are fixed on this branch.

### 2.1 The proposal queue and detail panel answered 500 — ambiguous PostgREST embed

`fix(05-16): name the submitter foreign key in both proposal reads` — commit `f28b8b1`.

`space.repo.ts:listProposals` and `space-decision.repo.ts:findProposalInScope`
both embedded the submitter as `users(first_name, last_name)`. That was correct
when 05-04 and 05-05 wrote it, and **this phase's own migration broke it**:
`20260802000003_vote_review_gating.sql` added `hidden_by` and `flagged_by`, so
`votes` now carries three foreign keys into `users` and PostgREST refuses to
guess:

```
{"code":"PGRST201",
 "message":"Could not embed because more than one relationship was found for 'votes' and 'users'",
 "hint":"Try changing 'users' to one of the following: 'users!votes_creator_id_fkey',
         'users!votes_flagged_by_fkey', 'users!votes_hidden_by_fkey'"}
```

Every request to `GET /api/space-admin/{id}` and `GET …/proposals` returned
`500 {"error":"Internal server error"}`. Naming the constraint keeps the response
key `users`, so both mappers are unchanged.

Swept for the same class rather than fixed one instance — the only tables with
more than one foreign key into `users` are:

```
 space_capability_grants  | 3        (never embedded to users)
 space_member_suspensions | 3        (never embedded to users)
 votes                    | 3        (the two sites above)
```

`space-audit.repo.ts`'s actor embed resolves through a single foreign key and is
correct as written; `space-member.repo.ts` uses no embeds at all.

### 2.2 The proposals and audit surfaces were broken in every state but one — server components reading client modules

`fix(05-16): move the two surfaces' filter vocabularies out of their client modules` — commit `5591507`.

Both Server Component pages imported non-component values from a `'use client'`
module. React replaces such a module with client references, so the server does
not get the value.

The **audit surface failed hard** and rendered nothing:

```
⨯ Error: Attempted to call isAuditFilter() from the server but isAuditFilter is on
  the client. It's not possible to invoke a client function from the server, it can
  only be rendered as a Component or passed to props of a Client Component.
    at SpaceAuditPage (src/app/[locale]/space-admin/[spaceId]/audit/page.tsx:62:49)
```

The **proposals surface failed quietly**, which is worse. `isFilter()` threw on
any explicit `?status=`, and with no query string `DEFAULT_PROPOSAL_FILTER`
arrived as a reference rather than `'in_review'`, became a malformed predicate,
and rendered the generic `ErrorPanel` on the surface's own default view. Observed
before the fix:

```
/proposals                        200  ErrorPanel
/proposals?status=in_review       200  (thrown, error boundary)
/proposals?status=all             200  (thrown, error boundary)
/proposals?proposal={id}          200  TABLE      <- the only state that worked
/audit                            200  (thrown)
```

The deep link was the only working path because it is the one branch that uses
only literals. That is why 05-13's own reasoning about `?proposal=` held while
everything around it did not.

The fix is a `filters.ts` beside each surface with no directive, holding the
vocabulary, the default, the guard and the audit trail codec. Types stayed where
they were — they are erased before either side runs.

### 2.3 The standing limitation both of these share

**The unit suite structurally cannot catch either class.** `apps/web/vitest.config.ts`
sets `environment: 'node'` and every space-admin test mocks `@/lib/supabase/server`,
so a query's PostgREST shape is never evaluated; and there is no React harness at
all, so no test renders a Server Component and no test can observe the
server/client module boundary. `tsc` sees both files as ordinary TypeScript and is
satisfied.

This is not a criticism of the earlier plans — every one of them said plainly
that its queries were reviewed rather than executed, and 05-04, 05-05, 05-06,
05-07, 05-08 and 05-09 each left an explicit checklist for this plan. The
conclusion to carry forward is that **a phase which adds PostgREST queries or
Server Components needs one live pass before it can claim to work**, and the
committed spec plus fixture is now that pass, runnable on demand.

### 2.4 Pre-existing, not fixed, recorded so it is not rediscovered

`supabase/seed.sql` inserts users whose `municipality_id` values are absent from
`municipalities`, violating `users_municipality_fk` from
`20260728000001_municipalities.sql`:

```
insert or update on table "users" violates foreign key constraint
"users_municipality_fk" (SQLSTATE 23503)
```

Local developer bootstrap has therefore been broken since that migration landed,
independently of issue #75. This run proceeded with seeding disabled and applied
`apps/web/tests/e2e/fixtures/space-admin-seed.sql` instead. It belongs in its own
change.

---

## 3. Live transcripts

### 3.1 Object-level denial — SPACE-03

Executed with the seeded ten-capability admin's session cookie against the
running app. `{SPACE_B}` is a real space they hold no grant in; `{NO_SUCH_SPACE}`
is a well-formed uuid matching nothing; `not-a-uuid` is malformed. Fifteen
endpoints × three cases.

```
### unauthorized — a real space the admin holds no grant in (d1d11bb8-…)
GET    /api/space-admin/{SPACE_B}                              -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
GET    /api/space-admin/{SPACE_B}/proposals                    -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
GET    /api/space-admin/{SPACE_B}/proposals/{VOTE}             -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
POST   /api/space-admin/{SPACE_B}/proposals/{VOTE}/decide      -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
POST   /api/space-admin/{SPACE_B}/proposals/{VOTE}/content     -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
GET    /api/space-admin/{SPACE_B}/members                      -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
POST   /api/space-admin/{SPACE_B}/grants                       -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
DELETE /api/space-admin/{SPACE_B}/grants                       -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
POST   /api/space-admin/{SPACE_B}/members/suspension           -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
DELETE /api/space-admin/{SPACE_B}/members/suspension           -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
GET    /api/space-admin/{SPACE_B}/metrics                      -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
GET    /api/space-admin/{SPACE_B}/audit                        -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
GET    /api/space-admin/{SPACE_B}/notifications                -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
POST   /api/space-admin/{SPACE_B}/notifications/preview        -> 403  {"error":"Forbidden","code":"FORBIDDEN"}
POST   /api/space-admin/{SPACE_B}/notifications/send           -> 403  {"error":"Forbidden","code":"FORBIDDEN"}

### nonexistent — a well-formed uuid matching no space (11111111-2222-4333-8444-555555555555)
   … the same fifteen lines, all -> 403  {"error":"Forbidden","code":"FORBIDDEN"}

### malformed — not a uuid at all (not-a-uuid)
   … the same fifteen lines, all -> 403  {"error":"Forbidden","code":"FORBIDDEN"}

### control — the SAME admin against the space they DO administer
GET    /api/space-admin/{SPACE_A}                              -> 200  {"space":{…},"figures":{…},"recentQueue":[…]}
```

**Byte-identity, not merely shape.** Across all 45 probes there is exactly one
distinct response line, and the three cases hash identically:

```
$ for S in {SPACE_B} {NO_SUCH_SPACE} not-a-uuid; do curl -s …/$S/members | shasum -a 256; done
6b481727fb9a3af3f9c636bbb4546ff22227756dcc3757a1b72019f208e13297   {SPACE_B}
6b481727fb9a3af3f9c636bbb4546ff22227756dcc3757a1b72019f208e13297   {NO_SUCH_SPACE}
6b481727fb9a3af3f9c636bbb4546ff22227756dcc3757a1b72019f208e13297   not-a-uuid

$ curl -s …/not-a-uuid/members | wc -c
40
```

That is the anti-enumeration property: existence is data, and a 404/403 split
would be a space-enumeration oracle. There is none.

**One ordering note, recorded because it is a real property rather than a
defect.** `POST …/notifications/send` parses its body before it authorizes, so a
*malformed* body answers `400 VALIDATION_ERROR` on every space id — including
one the caller does administer. The 400 is therefore uniform across all four
cases and discloses nothing about the space. With a well-formed body, as above,
the ordering is invisible and every case is the identical 403.

### 3.2 The notification equality — SPACE-08, executed end to end for the first time

```
### 1. preview
HTTP 200
{"campaignId":"f069b8c0-7710-4ac6-8ca5-4d609f90942a",
 "previewToken":"0098c627743b93d8032cbad5ccf25f53afe96e204227b031b5d0bed80490cae7",
 "approvedRecipients":4,"excludedOptedOut":0,"excludedNoChannel":2,
 "quotaUsed":1,"quotaLimit":8,"computedAt":"2026-08-03T11:52:36.955072+00:00"}

### 2. send, echoing the token the preview returned
HTTP 200
{"campaignId":"f069b8c0-…","deliveredRecipients":4,
 "sentAt":"2026-08-03T11:52:38.676+00:00","quotaRemaining":6}
```

and in the database afterwards:

```
 audience_size | excluded_opted_out | excluded_no_channel | status | sent
             4 |                  0 |                   2 | sent   | t

 channel |   state    |      reason       | count
 in_app  | delivered  | -                 |     4
 push    | failed     | -                 |     2
 push    | suppressed | no_active_channel |     2

 inbox_rows = 4

 delivered_equals_previewed
 t

 action            | object_type           | reason
 notification.sent | notification_campaign | עדכון התושבים על פתיחת ההצבעה שאושרה בוועדה.
```

Read this carefully, because it is stronger and weaker than it looks.

- **Four `in_app`/`delivered` rows against `audience_size 4`** is the equality
  SPACE-08 promises, computed in SQL rather than asserted.
- **Two `push`/`suppressed`/`no_active_channel`** are the two seeded residents
  with no push token — they still received the in-app notification, which is the
  delivery of record.
- **Two `push`/`failed`** are the two residents who *do* have a token. The Expo
  fan-out failed because the seeded tokens are fixtures and no real Expo endpoint
  was reached. That is expected here and it is exactly why the design makes
  in-app the delivery of record: a push failure did not lose a notification, did
  not fail the request, and is visible in the log rather than silent.
- **The quota is a database count.** It moved 1 → 2 of 8, and the second send of
  the same campaign lost:

```
POST …/notifications/send  (same campaign, second time)
-> 409  {"error":"ההתראה כבר נשלחה.","code":"CONFLICT"}
```

### 3.3 Decisions, self-review and the conditional writes — SPACE-05, SPACE-06

```
### a reviewer deciding their OWN submission
-> 403  {"error":"הצעה שהגשתם — ההכרעה שמורה למנהל אחר.","code":"FORBIDDEN"}

### approving a proposal submitted by someone else
-> 200  {"id":"…0205","status":"active","title":"מיחזור בקבוקים בכיכר המרכזית"}

### the same decision again
-> 409  {"error":"ההצעה כבר הוכרעה על ידי מנהל אחר. רעננו את הרשימה כדי לראות את המצב העדכני.","code":"CONFLICT"}

### suspending a member, then suspending them again
-> 200  {"userId":"…0003","suspended":true}
-> 409  {"error":"החבר/ה כבר מושעה/ית במרחב הזה.","code":"CONFLICT"}

### reinstating, then reinstating again
-> 200  {"userId":"…0003","suspended":false}
-> 409  {"error":"החבר/ה אינו מושעה/ית במרחב הזה.","code":"CONFLICT"}
```

**This closes the risk 05-06 and 05-09 both flagged as first priority.** Every
409 above is produced by a conditional `UPDATE` matching zero rows. Had
`.select()` after an `UPDATE` returned anything other than the affected rows,
each of these would have been a silent 200. They are not.

The approval's side effects, read back from the database:

```
 status | visible
 active | t

 action            | prior_state             | new_state
 proposal.approved | {"status": "in_review"} | {"status": "active",
                                               "paymentId": "111ceb98-…",
                                               "amountAgorot": 5000}

 type          | amount | currency | status  | idempotency_key
 vote_creation |   5000 | ILS      | pending | …0002:vote_creation:…0205

 approval_rows_for_this_vote = 1
```

Three things worth stating. The obligation is recorded against the **submitter**
(`…0002`), not the approver. Its `idempotency_key` follows SEC-04's documented
component order and `payments_idempotency_key_key` is a real UNIQUE constraint.
And `uq_space_proposal_single_approval` holds at exactly one row, which is the
structural backstop under the conditional update.

**`status: 'pending'` is the honest word.** Nothing captured money — see §7.

---

## 4. Append-only audit log — SPACE-04

### 4.1 The `psql` probe

`supabase/tests/audit_append_only.sql`, written in 05-01 and executed by the
phase coordinator before this plan. Reproduced verbatim from `05-DB-EVIDENCE.md`
§2 rather than re-run:

```
PASS: valid audit row appended (da5042ec-7911-411c-b4aa-e0cef37c358a)
PASS: UPDATE refused with SQLSTATE 42501 (space_audit_log is append-only (attempted UPDATE))
PASS: DELETE refused with SQLSTATE 42501 (space_audit_log is append-only (attempted DELETE))
PASS: TRUNCATE refused with SQLSTATE 42501 (space_audit_log is append-only (attempted TRUNCATE))
PASS: blank reason refused with SQLSTATE 23514
PASS: actor deletion refused with SQLSTATE 23503 (audit history preserved)
PASS: baseline audit row survived every mutation attempt
```

7 PASS, 0 FAIL. `42501` three times; `23503` once.

**That run was as the `postgres` superuser, which is stronger than the criterion
asked for.** A superuser bypasses RLS and table-level REVOKEs, so if immutability
had been grant-enforced, cases 2–4 would have *succeeded* and reported FAIL. They
refused, which means enforcement is by trigger and holds against every role.

### 4.2 …and against the roles the application actually uses

New in this run, because §4.1 could not answer it: `service_role` is the role
every server query in this codebase authenticates as.

```
### service_role, through PostgREST — the application's own credential
PATCH  /rest/v1/space_audit_log?id=eq.{row}   {"reason":"tampered by service_role"}
-> HTTP 403  {"code":"42501","message":"permission denied for table space_audit_log"}
DELETE /rest/v1/space_audit_log?id=eq.{row}
-> HTTP 403  {"code":"42501","message":"permission denied for table space_audit_log"}
### the row afterwards
[{"id":"…0401","reason":"ההצעה עומדת בכל תנאי הפרסום ואושרה בישיבת הוועדה מיום 12 ביולי."}]

### anon, through PostgREST — RLS is enabled with no policies
GET    /rest/v1/space_audit_log?select=id&limit=1   -> 200  []        (no row is visible)
PATCH  /rest/v1/space_audit_log?id=eq.{row}         -> 200  []        (matched nothing)
DELETE /rest/v1/space_audit_log?id=eq.{row}         -> 204            (matched nothing)

### `authenticated`, directly in psql
set local role authenticated; update public.space_audit_log set reason='tampered' …;
-> UPDATE 0
```

So immutability holds in three independent layers, and they fail in this order:

1. **RLS**, enabled with no policies, hides every row from `anon` and
   `authenticated`, so their writes match nothing.
2. **The REVOKE** takes UPDATE and DELETE from `service_role`, which is refused
   at the grant layer with `42501` before any trigger runs.
3. **The trigger** refuses regardless of role, including superuser — §4.1.

**One local observation, and it is a question rather than a finding.** In this
stack `anon` and `authenticated` currently hold `DELETE,INSERT,SELECT,UPDATE` on
`space_audit_log` even though `20260802000001` revokes exactly those:

```
 anon          | DELETE,INSERT,SELECT,UPDATE
 authenticated | DELETE,INSERT,SELECT,UPDATE
 service_role  | INSERT,REFERENCES,SELECT,TRIGGER
```

The likely cause is the local bootstrap re-applying default privileges after the
migrations, and it changes nothing here because layers 1 and 3 both hold. But
**someone should check the same grant profile on the hosted project**, because
the migration's own second mechanism is not currently in effect locally. Logged
rather than fixed: repairing a local bootstrap artifact from inside this plan
would risk hiding a real production question behind a local patch.

### 4.3 What §4 does not establish

The log is **tamper-resistant, not WORM**. A database superuser can `ALTER TABLE
… DISABLE TRIGGER` and then do anything. The migration's own comment says so, and
so does this document: nothing here defends against a compromised superuser
credential, and no application-layer design can.

---

## 5. Token hygiene, standing checks, suites

### 5.1 The three scans the plan prescribes

```bash
$ grep -rnE '#[0-9a-fA-F]{3,8}\b' apps/web/src/app/\[locale\]/space-admin apps/web/src/components/space-admin
(no output)

$ grep -rn 'header-height\|np-block-red\|components/layout/Header' apps/web/src/app/\[locale\]/space-admin apps/web/src/components/space-admin
(no output)

$ grep -rnE '[^-a-z(]([0-9]+)px' apps/web/src/app/\[locale\]/space-admin apps/web/src/components/space-admin | grep -v '@media'
apps/web/src/app/[locale]/space-admin/[spaceId]/dispatch/DispatchClient.tsx:558:   this dashboard. `lg` is not hierarchy: 19.2px at weight 800
apps/web/src/app/[locale]/space-admin/[spaceId]/audit/AuditClient.tsx:450:      * sideways; below 768px it additionally carries the three columns that are
apps/web/src/components/space-admin/PressTable.tsx:37:                            * Hidden below 768px by a paired `display: none` on both
apps/web/src/components/space-admin/StatusChip.tsx:11:                            *   red-filled chip with paper text is 4.03:1 at 13.3px.
```

**The third scan does not return nothing, and the criterion as literally written
is not met.** All four hits are prose inside `.tsx` comments — none is a
declaration, and none is mine; all four were written by 05-11 and 05-15 to
explain the very rules the grep enforces. This is the phase's recurring
comment-versus-grep collision, hit for the seventh time.

The property the criterion protects **does** hold, and here is the scan that
measures it:

```bash
$ grep -rnE '[^-a-z(]([0-9]+)px' --include='*.css' \
    apps/web/src/app/\[locale\]/space-admin apps/web/src/components/space-admin | grep -v '@media'
(no output)

$ # every px in the phase's stylesheets, with its context
  3 @media (max-width: 767px)
  2 @media (min-width: 1024px)
 12 @media (min-width: 768px)
```

Seventeen pixel literals exist in the phase's CSS and every one of them is a
media-query breakpoint, which is the single permitted case — media queries cannot
read custom properties.

I chose **not** to reword the four comments. Doing so would mean editing four
completed plans' files for a cosmetic reason, and an accurate "not literally met,
and here is why it does not matter" is worth more here than a satisfied grep.

### 5.2 SPACE-02's standing checks

```bash
$ git diff main --stat -- apps/web/src/services/auth/session.ts
(no output — the session module is unchanged by this phase)

$ grep -rn "roles\|capabilities" apps/web/src/services/auth/session.ts
(no output — no roles claim, no capabilities claim)
```

### 5.3 Suites, typecheck, lint

All run from the repo root after the last commit.

```
$ pnpm typecheck                                  # turbo, all 8 workspace packages
 Tasks:    8 successful, 8 total

$ pnpm --filter @sync/web test
 Test Files  74 passed (74)
      Tests  987 passed (987)

$ pnpm --filter @sync/web lint
 ✖ 2 problems (0 errors, 2 warnings)
   (both pre-existing: postcss.config.mjs, worker.ts — import/no-anonymous-default-export)

$ pnpm --filter @sync/api-client exec vitest run
 Test Files  10 passed (10)
      Tests  125 passed (125)

$ SPACE_ADMIN_E2E_JWT_SECRET=… PLAYWRIGHT_BASE_URL=http://127.0.0.1:3999 \
  pnpm --filter @sync/web exec playwright test tests/e2e/space-admin.spec.ts
 24 passed (20.8s)
```

Root `pnpm typecheck` is the command CI runs on every PR to `main`, and it covers
`@sync/web`, `@sync/mobile` and every package — a `--filter @sync/web` gate could
not see a cross-package break. The 987 figure is unchanged from the baseline
before this plan, so neither repository fix regressed a test.

---

## 6. Screenshot index

Captured by `apps/web/tests/e2e/space-admin.spec.ts` at **1440×900**
(`desktop-1440x900`) and **390×844** (`mobile-390x844`), full-page, unmodified.
All under `apps/web/tests/e2e/__screenshots__/space-admin/`.

The spec runs **24 tests** — 22 frames plus one screenshot-less behavioural test
per viewport, §6.2.

Every frame is guarded — the assertion runs before the capture, so a frame can
only exist if it depicts the state it claims.

| # | File | The assertion that guards it |
|---|---|---|
| 01 | `01-overview-desktop.png` | `לא מוענק` visible at least once; `הצעות ממתינות להכרעה` and `חברים במרחב` present |
| 02 | `02-overview-mobile.png` | same, at 390px |
| 03 | `03-proposals-desktop.png` | ≥3 `tbody tr`; a `בבדיקה` chip; the self-submitted row's `td[data-col="actions"]` contains `הצעה שהגשתם — ההכרעה שמורה למנהל אחר.` **and holds zero `button` elements** |
| 04 | `04-proposals-mobile.png` | same, at 390px |
| 05 | `05-members-desktop.png` | ≥3 rows; the suspended member's row contains `מושעה/ית`, shows `ביטול השעיה`, and contains **zero** `ניהול הרשאות` |
| 06 | `06-members-mobile.png` | same, at 390px |
| 07 | `07-stats-desktop.png` | `<5` visible; `מוסתר — קבוצה קטנה מדי` visible; the aggregate-only footer note verbatim; **zero** `a, button, [role=button], input, select` inside any element whose class matches `statCard` |
| 08 | `08-stats-mobile.png` | same, at 390px |
| 09 | `09-dispatch-desktop.png` | after computing an audience: all four Receipt labels visible (`נמענים מאושרים`, `הוחרגו — ביטלו הסכמה`, `הוחרגו — ללא ערוץ פעיל`, `מכסה חודשית`) and the send control **enabled** |
| 10 | `10-dispatch-mobile.png` | same, at 390px |
| 11 | `11-audit-desktop.png` | ≥5 rows; the long-reason row's disclosure expands and the expansion's own `fullReason` paragraph shows the disclosed text; `רשומות ישנות יותר` visible **and enabled** |
| 12 | `12-audit-mobile.png` | same, at 390px |
| 13 | `13-irreversible-dialog-desktop.png` | dialog contains `פעולה בלתי הפיכה · IRREVERSIBLE`; the reason textarea is **focused**; confirm is `disabled`; its computed `background-color` is **unchanged under hover**; the same button once enabled has a **different** background; clearing the reason restores the disabled background |
| 13 | `13-irreversible-dialog-mobile.png` | same, at 390px |
| 14 | `14-quota-exhausted-desktop.png` | `מכסה מוצתה · QUOTA` visible; **zero** elements named `שלחו התראה`; the kicker's computed `color` equals the `--np-paper` token |
| 14 | `14-quota-exhausted-mobile.png` | same, at 390px |
| 15 | `15-no-permission-desktop.png` | for the `metrics.read`-only admin at `/proposals`: `אין הרשאה · NO ACCESS` and a working `פנייה למנהל־על`; then, for an admin with **no** grant in another space, the space name is **absent** from the refusal |
| 15 | `15-no-permission-mobile.png` | same, at 390px |
| 16a | `16a-detail-unmoderated-desktop.png` | reached at `?proposal={id}`; the expansion `td[colspan]` is visible, its `h3` is the proposal title, `הסתרת תוכן` and `סימון לבדיקה` present, `ביטול הסתרה` **absent** |
| 16a | `16a-detail-unmoderated-mobile.png` | same, at 390px |
| 16b | `16b-detail-hidden-flagged-desktop.png` | both notices render, **hidden first** (`התוכן מוסתר…` then `התוכן מסומן לבדיקה…`); `ביטול הסתרה` and `ביטול סימון` present; `הסתרת תוכן` and `סימון לבדיקה` **absent** |
| 16b | `16b-detail-hidden-flagged-mobile.png` | same, at 390px |

Frames 01–12 show populated state: four figures (3 · 4 · 2 · 2), three proposals
under review, four members, two suppressed statistics cards, a costed audience of
four, and 100 audit rows with a live second page.

### 6.1 The disabled confirm, measured

Frame 13's contract is the one most likely to have lost silently on CSS
specificity, so it was measured in all four states rather than eyeballed:

```
state           background            color                 cursor
disabled        rgb(236, 231, 216)    rgb(110, 103, 90)     not-allowed     (--np-paper-2 / --np-ink-faint)
disabled+hover  rgb(236, 231, 216)    rgb(110, 103, 90)     not-allowed     ← unchanged: no inversion
enabled         rgb( 20,  17,  14)    rgb(244, 241, 232)    pointer         (--np-ink / --np-paper)
enabled+hover   rgb(176,  34,  15)    rgb(244, 241, 232)    pointer         (--np-red-dark, D23)
```

D17, D27 and D23 all landed. No `opacity` is involved, as the contract requires.

### 6.2 The one behaviour no frame can show, asserted instead

The frames capture the composer's **fresh** state. The rule 05-15 shipped is
about a **transition** — "staleness fires on change, not on blur" — so a picture
cannot prove it, and 05-15 said plainly that it was argued from the code and
never observed. It is observed now, at both widths, by a test that carries no
screenshot:

```
✓ [desktop-1440x900] dispatch staleness fires on change, with no blur — the behaviour no frame can show
✓ [mobile-390x844]   dispatch staleness fires on change, with no blur — the behaviour no frame can show
```

**The load-bearing part is not that the send ends up disabled.** An
implementation that invalidated on *blur* would also be disabled by the time an
assertion ran, and would pass a weaker version of this test. So the sequence is:

1. resolve an audience; assert the send is **enabled** and no stale banner exists
   — the precondition, so the test cannot pass vacuously;
2. click into the body, assert it is focused, and *then* install a `blur`
   listener on the element itself that counts events;
3. type **one character** with `page.keyboard.type('.')` — not `fill()`, which
   sets the value programmatically and would not reproduce a person typing;
4. assert the send is **disabled**, the body is **still focused**, the stale
   banner `ההודעה שונתה אחרי חישוב הקהל — חשבו שוב לפני שליחה.` is visible, and
   Rule B's unblock line `חשבו קהל יעד כדי לאפשר שליחה.` is present;
5. read the blur counter back: **`0`**.

**Negative control, run once to prove the test can fail.** With the single
keystroke commented out and nothing else changed:

```
Error: expect(locator).toBeDisabled() failed
  Locator:  getByRole('button', { name: 'שלחו התראה', exact: true })
  Expected: disabled
  Received: enabled
```

So the send is disabled *by the edit*, not by elapsed time and not by the focus
change that preceded it — and it happens across zero blur events. That is the
rule, measured.

### 6.3 Two things a reviewer will see in the frames that are not space-admin

Recorded so they are not read as dashboard defects:

- **The floating WhatsApp button** (`וואטסאפ הפיילוט`) and a scroll-to-top control
  are rendered by the site layout and overlap the console — in frame 01 the
  WhatsApp pill sits over the first queue row's date. Whether a marketing CTA
  belongs on an admin console is a product question, not a phase-5 one.
- **The `GeoGate` locality modal** opens over the dashboard for a visitor with no
  stored town. The spec sets `taruu.municipality` before each navigation, which is
  the ordinary state of a returning reader. Worth knowing why it was needed: the
  gate's escape hatch is `isAuthenticated` from the **client** auth store, which
  the sign-in flow populates — not the httpOnly session cookie. A session that is
  authenticated to the server and anonymous to that store still sees the gate.

---

## 7. Limitations — what is still not proven

Stated plainly, because this document is what the phase's completion claim rests on.

1. **The audit log is tamper-*resistant*, not WORM.** A database superuser can
   disable the trigger. §4.3.
2. **`CreationFeePort` records an obligation; it does not capture money.** An
   approval writes a `payments` row with `status: 'pending'`, `type:
   'vote_creation'`, `amount: 5000` and a deterministic idempotency key — and
   contacts no provider. `outcome: 'captured'` is unreachable from anything phase
   5 writes. **PAY-06 must also sweep stranded obligations**: the charge fires
   before the state transition, so an approve that loses a race to a *reject*
   leaves a `pending` row against the submitter for a proposal that will never
   publish. Inert today because nothing captures; it must be reconciled before
   anything does.
3. **The Expo push endpoint was never reached.** §3.2's two `push`/`failed` rows
   are the fan-out failing against fixture tokens. In-app is the delivery of
   record by design, and a `push`/`delivered` row would only ever mean "the batch
   was accepted for someone who had a channel" — never that a device buzzed.
4. **A 500 between the campaign claim and the audit write leaves a `sent`
   campaign with no recipients.** 05-09 flagged this as structural: the claim must
   precede the writes or two concurrent sends both write, and PostgREST offers no
   cross-statement transaction. It costs one unit of quota, the response is a 500,
   and the delivery log is empty — so it reads as a failed send rather than a
   silent partial one. **This run did not exercise it**, and whether it warrants
   an RPC is still an open decision.
5. **No RLS policy was exercised under a real end-user JWT.** Every server read
   and write goes through the service role, which has `BYPASSRLS`, so RLS is
   defence in depth here and the enforcing boundary is `authorize()` /
   `SpaceScope`. The one exception probed is `anon` against the audit log (§4.2).
6. **Nothing ran against production**, and the local `anon`/`authenticated` grant
   profile on `space_audit_log` (§4.2) is an open question for the hosted project.
7. **`apps/mobile` was typechecked, not exercised.** Root `pnpm typecheck` is
   green across all eight packages, which closes the duplicate-`@types/react`
   break `deferred-items.md` item 5 recorded. No mobile screen was rendered.
8. **The seed is not production-shaped.** Four residents, five proposals, 105
   audit rows. Nothing here says anything about behaviour at 5,000 members —
   notably the members surface has no cursor pagination (05-14), and the audit
   actor filter is built from the rows on screen (05-15, deferred item 16).
9. **The human verdict is outstanding.** §8.

---

## 8. Human verification — REQUESTED, NOT YET GIVEN

**Nothing in this document should be read as a sign-off.** The phase's blocking
checkpoint asks a person to confirm the surface looks and behaves as the contract
says, and that cannot be self-certified. Everything automatable has been
automated; what remains needs eyes.

### How to reach it

The stack used for this run is still up:

| | |
|---|---|
| App | `http://127.0.0.1:3999/he/space-admin/adbbf57e-ea77-439b-bc56-e616c2b0bbb8` |
| Database | `postgresql://postgres:postgres@127.0.0.1:54422/postgres` (project `dbverify`) |
| Ten-capability admin | `space-admin-a@example.test` — user `00000000-0000-4000-8000-051600000001` |
| `metrics.read`-only admin | `space-admin-m@example.test` — user `00000000-0000-4000-8000-051600000002` |
| Quota-exhausted space | `/he/space-admin/3ea6ab9a-8fd0-4249-98d4-70646e1cfdc7/dispatch` |
| A space with no grant | `/he/space-admin/d1d11bb8-de95-4b00-8f41-1178d9c69c9d` |

There is no password. Local sign-in is a `sync-session` cookie holding an HS256
JWT signed with the app's `JWT_SECRET`; the spec's `mintSession` helper is the
one-line recipe, and `apps/web/.env.local` (gitignored) holds the secret used
here.

### Nine steps, not ten — and the one that matters most

The plan's checkpoint listed ten. **Step 6 is now automated and is not on this
list.** "Compute an audience, change one character, the send must disable before
you click away" is a behavioural claim rather than an aesthetic judgement, so it
was expressible as a test once a seeded database existed — §6.2 has the method,
the assertions and the negative control that proves the test can fail. It runs at
both widths on every invocation of the spec.

**Step 4 stays a human judgement, deliberately.** Its colours are measured in
four states (§6.1) and they pass; what a measurement cannot answer is whether the
control *reads* as disabled and *feels* inert. That is the one thing on this list
that genuinely needs eyes.

1. Open the overview. Masthead at the top with no gap or overlap; the six-link
   nav reads right to left; the capability manifest shows at least one
   `✕ לא מוענק`.
2. Narrow below 768px. The nav scrolls horizontally rather than wrapping; tables
   drop their secondary columns while the row disclosure still reveals those
   values.
3. `/proposals` → click a proposal title. The panel expands in place as a table
   row; only one can be open at a time; `Escape` closes it and returns focus to
   the title.
4. **⚠ THE ONE THAT NEEDS EYES. Click `אישור ופרסום` on a proposal you did not
   submit.** Plate rule red; kicker reads `פעולה בלתי הפיכה · IRREVERSIBLE`;
   focus lands in the reason textarea rather than on the confirm; the confirm
   looks **visibly** disabled — greyed fill, faint text — and does **not** turn
   red when you hover it. §6.1 proves the computed colours are the right ones and
   that hover changes nothing; what it cannot tell you is whether the result
   reads as disabled to a person.
5. Find the self-submitted proposal (`הצבת ספסלים מוצלים בגן הוותיקים`, submitted
   by נועה ברק, who is the signed-in admin). Its actions cell holds the lock text
   and contains no buttons at all.
6. `/stats`. Try to click a figure — nothing responds, no cursor change — and the
   aggregate-only footer note is present.
7. `/audit`. Expand a long reason; the table must not reflow sideways. Page with
   `← רשומות ישנות יותר` (the fixture makes it live: 105 rows, 100 per page) and
   confirm no row repeats.
8. Sign in as the `metrics.read`-only admin and go straight to `/proposals`. The
   page must stay coherent — masthead, nav, footer intact — showing
   `NoPermissionPanel` with a working `פנייה למנהל־על`.
9. Review the 22 frames in `apps/web/tests/e2e/__screenshots__/space-admin/`.
   Frames 01–12 populated; nothing reads as an English placeholder.

*(The former step 6 — dispatch staleness — is now automated. If you want to see
it anyway: `/dispatch`, compute an audience, then change one character in the
body. The send must disable before you click away. §6.2 asserts exactly this,
including that it happens across zero blur events.)*

### The verdict

To be appended here before the phase closes — approval, or each defect with the
surface and the contract clause it violates.

> **Status: awaiting review.** No verdict has been recorded.

---

*Plan: 05-16 · Phase: 05-space-governance-substrate-and-space-admin-operations-dashboard*
*Written: 2026-08-03*

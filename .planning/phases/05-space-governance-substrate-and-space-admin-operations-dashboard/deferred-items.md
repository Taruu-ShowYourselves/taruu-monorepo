# Deferred items — Phase 05

Out-of-scope findings logged during execution. Not fixed by the plan that found them.

## From 05-02

**1. `SPACE-04` traceability row and its checkbox disagree in REQUIREMENTS.md**

- **Found during:** 05-02 state updates
- **Observed:** the checklist entry at `.planning/REQUIREMENTS.md:49` is unchecked `[ ]`, but the traceability table at `:117` still reads `| SPACE-04 | Phase 5 | Complete |`. The "Note on tick timing" at `:56-61` says SPACE-04 was auto-ticked after 05-01 alone and "has been reset" — it looks like the reset updated the checkbox but not the table row.
- **Why not fixed here:** `REQUIREMENTS.md` is not in 05-02's `files_modified`, and the discrepancy predates this plan. Silently flipping a requirement row to `Pending` is a project-status edit, not a code fix.
- **Owner:** whoever next runs a requirements pass, or 05-16 when it assembles the evidence document.

**2. `requirements mark-complete` deliberately NOT run for 05-02**

- 05-02 declares `requirements: [SPACE-02, SPACE-04, SPACE-05]`, and the standard executor step would tick all three.
- The tick was withheld. All three are multi-plan requirements (the note names SPACE-04 as plans 01, 02, 05, 07, 15, 16), and the note records that exactly these premature auto-ticks were reset once already after 05-01. Re-ticking would reintroduce them.
- 05-02 delivers the *pure domain core* of SPACE-02 and SPACE-05 (the capability vocabulary; the review transitions and the self-review rule) and the *typed reason contract* for SPACE-04. None of the three is enforced end-to-end until the use-case and route plans land.
- **Authoritative check remains:** `05-VERIFICATION.md` plus 05-16's evidence document.

**3. Two gsd-tools state commands do not match this project's STATE.md/ROADMAP.md format**

- `state advance-plan` fails with `Cannot parse Current Plan or Total Plans in Phase from STATE.md`. The tool reads fields named `Current Plan:` and `Total Plans in Phase:` (`bin/lib/state.cjs:215-216`); this project's STATE.md writes a single line, `Plan: 3 of 16`.
- `roadmap update-plan-progress 05` returns `{"updated": true, "summary_count": 2}` but leaves the progress row untouched — a false success, which is worse than the honest failure above.
- Both were worked around by editing the two files directly (as 05-01 also did). Worth fixing in the tooling or in the document format, because a silently-wrong roadmap is easy to trust.

**4. `pnpm --filter @sync/web lint` not run**

## From 05-03

**5. `apps/mobile` typecheck broke mid-wave-2 on a duplicate `@types/react` — BLOCKS CI**

- **Found during:** 05-03 final verification.
- **Observed:** `pnpm --filter @sync/mobile typecheck` now emits **130 errors, every single one `TS2786`** ("X cannot be used as a JSX component … Type 'bigint' is not assignable to type 'ReactNode'"), spread across ~19 files that no phase-5 plan has touched (`app/vote/[id].tsx`, `app/settings/*`, `app/payment/*`, `app/verification/*`, `app/_layout.tsx`, …).
- **Cause:** two copies of the React types are now installed — `node_modules/.pnpm/@types+react@18.3.27` (what `apps/mobile/node_modules/@types/react` symlinks to) and `node_modules/.pnpm/@types+react@19.2.7` (hoisted into `node_modules/.pnpm/node_modules/@types/react`). React 19's `ReactNode` admits `bigint`; React 18's does not, so the two `ReactNode` identities are mutually unassignable and every JSX element from a library typed against the other copy fails.
- **When:** `apps/mobile` typechecked **clean at 2026-08-02T16:15Z**, immediately before 05-03's first edit, and again **clean at the 05-03 Task 1 gate with this plan's mobile change already applied** (`MOBILE_EXIT=0`). It went red later in the wave, after `apps/web/package.json` + `pnpm-lock.yaml` were modified and re-installed. Those two files are **05-04's** declared territory.
- **Why not fixed here:** out of scope on two counts. It is not caused by 05-03's changes (see the proof below), and remedying it means editing `apps/web/package.json` / `pnpm-lock.yaml` or re-running `pnpm install` against a working tree with two other plans' uncommitted work in it — a much larger blast radius than the bug.
- **Proof 05-03 is not the cause:** this plan widened the shared `VoteStatus` union from 4 members to 10 and rewrote the one exhaustive consumer, `apps/mobile/app/(tabs)/votes.tsx:24`. A union-widening break would surface as `TS2353` (excess property) or `TS2739`/`TS2741` (missing keys) on that map. **Zero errors of those kinds exist anywhere in the app**, and the seven errors reported on `votes.tsx` are all `TS2786` on `SafeAreaView`, `Animated.View` and `Ionicons` at lines 108–182 — nothing on lines 20–37 where `statusColors` is declared and read.
- **Suggested fix (for whoever owns it):** pin a single `@types/react` across the workspace, e.g. a `pnpm.overrides` entry in the root `package.json`, then reinstall on a quiet tree.
- **Owner:** 05-04 (whose install introduced it) or 05-16 (which owns the phase's one full-suite, whole-repo verification run).

- The plan specifies targeted verifies only, because 05-01 shared the working tree during wave 1. `tsc --noEmit` is green for both `@sync/web` and `@sync/shared`.
- Separately, `npx prettier --check` fails repo-wide including on files no plan touched — there is no prettier config in the repo, so the default profile does not match the committed style. Adopting (or not) a prettier config is a repo-level decision, not a phase-5 one.

## From 05-06

**6. The overview's `membersInSpace` and `activeVotes` figures are still `null`, and the `// wired in 05-06` comments on them are now stale**

- **Found during:** 05-06 Task 2.
- **Observed:** `apps/web/src/server/app/space-admin/get-space-overview.ts:115-116` marks both figures `// wired in 05-06`. 05-06 ships the member count (`countSpaceMembers`) that the first of them needs, but the plan's `files_modified` does not list `get-space-overview.ts` and no task asks for the wiring.
- **Why not fixed here:** three siblings (05-05, 05-07, 05-08) were live in this working tree, and `get-space-overview.ts` is 05-04's file. Editing a file outside the plan's declared territory during a shared-index wave is how the phase's earlier mixed-authorship commits happened. The figures render as absent rather than wrong in the meantime, which is the design's intended `null` (an unavailable figure, never a fabricated zero).
- **What it needs:** `getSpaceOverview` should call `authorize(…, 'member.read')` → `countSpaceMembers(scope)` folded through `optional()`, exactly as `proposalWidgets` already does for `proposal.read`. `activeVotes` needs a count that no plan has written yet.
- **Owner:** 05-12 (the overview surface, which is the first plan that will notice the empty figures) or 05-16.
- **CLOSED by 05-12** (commit `55d0f99`, `feat(05-12): wire the overview's member, active-vote and notification figures`). `membersInSpace` now folds `countSpaceMembers` behind `member.read`; `notificationsSentThisMonth` folds 05-08's `countCampaignsSentThisMonth` behind `notification.send` — its `// wired in 05-08` comment was stale in the same way and is gone with the others. `activeVotes` needed the count this item says nobody had written: `countActiveVotes` is new in `space.repo.ts`, gated on `proposal.read` alongside the queue because it reads the same table under the same predicate. The three capability-matrix tests were updated: they now assert one figure per capability instead of asserting the nulls.

**7. `optional()` was NOT extracted to a shared module by 05-06, and that is deliberate**

- 05-04's summary asks the first plan that *reuses* the `FORBIDDEN`-folding helper to move it out of `get-space-overview.ts` rather than copy it.
- 05-06 does not reuse it and did not copy it. Every surface in this plan is gated on a single capability, so a missing capability is a 403 for the whole endpoint rather than an absent widget — `GET /members` without `member.read` must be refused, not served with an empty list, and Task 2's behaviour bullet requires exactly that.
- Extracting a helper for callers that do not exist yet is the speculation 05-04 explicitly declined. **05-07 (metrics) is the real first reuse** — it renders a multi-widget surface under Rule A — and should do the extraction.

## From 05-14

**8. The post-decision row flash needs a keyframe per surface, because `PressTable` ships the hook but not the animation**

- **Found during:** 05-14 Task 1.
- **Observed:** 05-13 added `rowClassName?: (row) => string | undefined` to `PressTable` for exactly this purpose, but no flash keyframe lives in `PressTable.module.css`. Each surface therefore writes its own — and has to know two non-obvious things to get it right: the flash must target `> th, > td` because the table paints cell backgrounds rather than row backgrounds, and the `prefers-reduced-motion` opt-out needs matching specificity or a `.surface *` wildcard silently loses to it.
- **Status:** 05-14's members surface implements it correctly (`memberRowFlash` in `members/page.module.css`). This is logged so the proposals and audit surfaces copy the working version rather than rediscovering both traps.
- **What it would take to close:** move the keyframe and the reduced-motion rule into `PressTable.module.css` and export the class name, the way `confirmButtonClass` is exported for the disabled-state contract.
- **Owner:** 05-15.
- **CLOSED by 05-15** (commit `35d7cca`) exactly as described. `PressTable` now exports `rowFlashClass` and `ROW_FLASH_MS`; `.rowFlash > th, > td` and its `prefers-reduced-motion` opt-out live in `PressTable.module.css`, the opt-out authored at matching (0,1,1) specificity and later in the same file so it wins on source order. Both keyframes — `memberRowFlash` and `proposalRowFlash` — are gone, and both surfaces pass the shared class through `rowClassName`. The duplicated `ROW_FLASH_MS = 1200` constants are gone too, so the timer that clears the class and the animation that runs under it can no longer drift.

**9. Four small things are now duplicated across the space-admin surfaces, pending a dedupe pass**

- **Found during:** 05-14, both tasks.
- **Observed, in `members/page.tsx` and `stats/page.tsx`:** the surface→capability map that drives `SpaceAdminNav`'s `visibleHrefs`, and the Hebrew label map for the five `spaces.type` values. Both are byte-identical copies. **In `members/MembersClient.tsx` and `stats/StatsFallback.tsx`:** the escalation `ConfirmDialog` (same copy deck, same endpoint, same acknowledgement) — and 05-12 has since landed `components/space-admin/EscalationDialog.tsx`, which is a third copy of the same idea.
- **Why not fixed here:** 05-12 was running concurrently and is the plan authorized to create shared modules this wave; importing a component that had not yet been committed would have broken on a rename, and adding a competing shared module would have collided.
- **What it needs:** fold both maps into one module beside `SpaceAdminNav` (they are nav concerns), and replace both inline escalation dialogs with `EscalationDialog` once its API is settled.
- **Owner:** 05-15.
- **CLOSED by 05-15** (commit `35d7cca`). Both maps are now `components/space-admin/chrome.ts`, and there were FOUR copies of each rather than the two named here — the proposals surface and the overview carried them too. The escalation dialog had four copies, not three: `MembersClient`, `StatsFallback`, `ProposalsAccessDenied` (exported from `ProposalsClient` and used at two call sites on the proposals page), and `EscalationDialog` itself. All three inline copies are deleted and every call site is now `<EscalationDialog trigger="no-permission" />`. See item 11 for the label discrepancy the fold-in surfaced.

## From 05-12

**10. `optional()` still has zero duplicates, so 05-12 did not extract it either**

- **Found during:** 05-12's wiring of the three remaining overview figures.
- **Observed:** item 7 nominates 05-07 as "the genuine first reuse", but 05-07 (`get-metrics.ts`) is a single-capability surface and did not reuse the helper. 05-12 added three new uses — `memberCount`, `notificationCount` and the widened `proposalWidgets` — and **all three live in `get-space-overview.ts`, the file that already owns the helper.**
- **Why not extracted:** the count of copies is still one. A shared module whose only consumer is the file it was cut from is the speculation 05-04 declined, and it would add an import cycle risk for nothing. The first plan that needs `optional()` in a *second* file should move it, and now has three call sites to model on.

**11. The nav-visibility map and the `spaces.type` Hebrew labels are duplicated three times, and 05-12 chose not to be the one to dedupe them**

- **Found during:** 05-12, reading 05-14's item 9 after both siblings had committed.
- **Observed:** `NAV_CAPABILITY` (surface → capability, driving `SpaceAdminNav`'s `visibleHrefs`) and `SPACE_TYPE_LABELS_HE` now exist in three surface pages: 05-14's `members/page.tsx` and `stats/page.tsx`, and 05-12's overview `page.tsx`. 05-15's two surfaces will make five.
- **Why not fixed here:** 05-12 is the plan authorized to add a shared UI module this wave, but by the time the third copy existed the other two were already committed by a finished sibling. Extracting would have meant editing two completed plans' files to import a module none of them had reviewed, in a shared index, while 05-15 may be live. Creating the module and migrating only the overview would leave a fourth file and two stale copies — strictly worse.
- **What it needs:** one module beside `SpaceAdminNav` exporting both maps (they are both nav/edition-line concerns), then five one-line imports. **Owner:** 05-15, as item 9 already assigns, or 05-16's hygiene pass.
- **Related and ready:** `components/space-admin/EscalationDialog.tsx` now exists and covers both shapes item 9 names — `trigger="cta"` for a panel CTA and `trigger="no-permission"` for the refused surface, which renders `NoPermissionPanel` itself. Whoever does the dedupe can delete the two inline escalation dialogs in `MembersClient.tsx` and `StatsFallback.tsx` and import it by direct path. It is **not** in the barrel, by 05-11's rule.
- **CLOSED by 05-15** (commit `35d7cca`), together with item 9. Two things the extraction surfaced, both resolved once in `chrome.ts` rather than left as a silent split:
  1. **The four `SPACE_TYPE_LABELS_HE` copies were not identical.** The overview and proposals surfaces wrote `urban_area` as `מרחב עירוני`; members and statistics wrote `אזור עירוני`. The shared map uses `אזור עירוני` — `מרחב` is the copy deck's word for "space" itself, so `מרחב עירוני` makes the edition line read "space: urban space", and `אזור` is also the literal reading of "area".
  2. **Their fallbacks disagreed.** The overview fell back to `'מרחב'`; the other three fell back to `space.type`, which would print the raw machine value (`urban_area`) on the edition line the first time #74 adds a type. `spaceTypeLabel()` uses the Hebrew generic everywhere.

**12. `councils/[identifier]/page.tsx` prints the site name twice in its title**

- **Found during:** 05-12's manual render, which caught the same bug in its own metadata.
- **Observed:** `[locale]/layout.tsx:49` sets a `%s | תַּרְאוּ` title template, so a page whose own `metadata.title` already ends in `| תַּרְאוּ` renders `… | תַּרְאוּ | תַּרְאוּ`. `apps/web/src/app/[locale]/councils/[identifier]/page.tsx:8` does exactly that.
- **Why not fixed here:** unrelated surface, predates this phase, and a title change is a visible product edit rather than a compile fix.
- **Owner:** whoever next touches that page. Still open after 05-15.

## From 05-15

**13. The members surface now renders the server's 409 sentence; the whole dashboard should agree on when a response body is showable**

- **Found during:** 05-15's dedupe pass, on the inconsistency the orchestrator asked for judgement on.
- **Observed and FIXED:** `MembersClient` flattened every failure to `הפעולה לא בוצעה ולא נרשמה ביומן` — which for a 409 is not merely vaguer than the server's answer, it contradicts it. `space-member.repo.ts` maps a unique-index collision and a zero-row conditional update to `CONFLICT` with real Hebrew: `החבר/ה כבר מושעה/ית במרחב הזה.`, `החבר/ה אינו מושעה/ית במרחב הזה.`, `ההרשאה כבר אינה פעילה.` — all of which mean the state already exists, while the generic line says nothing happened and nothing was recorded.
- **How, and why not simply "render `payload.error`":** 05-13's unconditional form has a small defect of its own. `toHttp` guarantees a Hebrew sentence only for `CONFLICT` and `PAYMENT_REQUIRED` (both constructors require a reason); `forbidden(reason?)` is optional, so an unreasoned 403 answers the English literal `Forbidden`, and `Unauthorized` / `Invalid request` / `Quota exceeded` / `Internal server error` are English too. `components/space-admin/serverSentence.ts` encodes the rule once; members, proposals and dispatch all use it. Nearly unreachable on proposals (Rule A means the button is absent when the capability is missing), but it costs one import to be right.
- **What is still open:** the notification `send` endpoint's 403 is deliberately opaque and its 429 deliberately carries no figures, so the composer's fallbacks are surface-written rather than transported. That is by design, not an inconsistency — but 05-16's evidence pass should confirm no surface prints an English body anywhere.

**14. The state-0 copy promises a draft the state-0 fields do not allow**

- **Found during:** 05-15 Task 2.
- **Observed:** Interaction Contract 3 renders the composer fields **read-only** at an exhausted quota, and screenshot #14 requires it. The `QuotaBlock` body it renders beside them ends `עד אז אפשר להכין טיוטה, אבל לא לשלוח` — "until then you can prepare a draft, but not send". A read-only composer cannot be drafted in.
- **Resolution taken:** the binding contract wins. The fields are read-only, the send is absent, and the preview CTA is absent too (costing an audience from read-only empty fields could only answer 400).
- **What it needs:** a copy-deck decision, not a code one. Either the sentence drops its drafting clause, or state 0 keeps the fields editable and drops only the send — which would also make the preview CTA meaningful again, since a preview writes no notification and consumes no quota. **Owner:** 05-16 or a spec amendment.

**15. `הרשאות` on the audit filter selects grant rows only, so a suspension does not appear under it**

- **Found during:** 05-15 Task 3.
- **Observed:** the copy deck's four audit chips are `הכול · הצעות · הרשאות · התראות`, and `space_audit_log.object_type` admits seven values. The chips cover `vote`, `grant` and `notification_campaign`; `member`, `content`, `space` and `escalation` rows are reachable only under `הכול`. A member suspension is a `member` row, so an admin filtering to `הרשאות` to review authority changes will not see it — even though suspension is the most consequential authority change on the dashboard.
- **Why not fixed here:** the chip list is the copy deck's, and adding a fifth chip or widening `הרשאות` to two object types is a spec change. Documented in `AuditClient.tsx` at the filter map so the next reader is not surprised.
- **Owner:** 05-16 or a spec amendment.

**16. The audit actor filter is built from the page on screen**

- **Found during:** 05-15 Task 3.
- **Observed:** the surface needs a list of actors for the `מבצע/ת הפעולה` select, and no endpoint provides one. `getSpaceMembers` is gated on `member.read` — a different capability from `audit.read` — so an audit reader without it would get a refusal instead of a filter, and every member of a space is not the same set as everyone who has acted in it.
- **Resolution taken:** derive the options from the rows currently displayed, and always render `ניקוי סינון` once any filter is applied so a narrowed list cannot trap anyone.
- **What it would take to close:** a `distinct actor_user_id` read on `space_audit_log` behind `audit.read`, returned alongside the page. One query, one repository function, one field on `AuditPage`.
- **Owner:** 05-16, or whoever picks up the audit surface next.

**13-RESIDUAL — CLOSED by 05-16.** 05-15 left one question open: "05-16's evidence pass should confirm no surface prints an English body anywhere." Confirmed, live, and `serverSentence.ts` is correct in both directions. The 45-probe denial transcript (`05-EVIDENCE.md` §3.1) shows every opaque 403 answering the English literal `{"error":"Forbidden","code":"FORBIDDEN"}` — and `serverSentence` returns `null` for exactly that body, so the surface renders its own Hebrew fallback. The self-review refusal in §3.3 answers `403` with a real Hebrew sentence (`הצעה שהגשתם — ההכרעה שמורה למנהל אחר.`), and `serverSentence` passes it through because it is not the default literal. Both branches of the rule are exercised by real responses.

**17. `'צריך למלא את השדה הזה כדי להמשיך.'` is now in five files**

- **Found during:** 05-15 Task 2.
- **Observed:** the house required-field microcopy already existed as four independent local constants — `votes/create/page.tsx`, `verification/page.tsx`, `verification/components/DocumentScanStep.tsx`, `store/cart/components/CartView.tsx` — before this phase started. The composer needed it too, because Rule B's list of permitted `disabled` controls is exhaustive and does not include "preview CTA disabled until the form is valid", so an empty field has to be answered by a field error rather than by an inert button.
- **Why not fixed here:** a repo-wide press-microcopy module is a sensible thing to own, and four of the five files are unrelated to phase 5. Starting that from inside a phase-5 plan would put unrelated surfaces in this phase's commits.
- **Owner:** unassigned. Worth doing next time anything touches press microcopy.

## From 05-16

**18. `anon` and `authenticated` hold UPDATE and DELETE on `space_audit_log` locally, although the migration revokes them — check the hosted project**

- **Found during:** 05-16's append-only pass, extending 05-DB-EVIDENCE's superuser run to the roles the application actually uses.
- **Observed:** `20260802000010` ends with `REVOKE UPDATE, DELETE, TRUNCATE ON public.space_audit_log FROM anon, authenticated, service_role`. In the local stack after all migrations, `information_schema.role_table_grants` reads:

  ```
   anon          | DELETE,INSERT,SELECT,UPDATE
   authenticated | DELETE,INSERT,SELECT,UPDATE
   service_role  | INSERT,REFERENCES,SELECT,TRIGGER
  ```

  `service_role` is correct (the seed fixture re-applies the REVOKE after its own blanket local grant). The other two are not.
- **Why it does not weaken anything here:** immutability holds in three independent layers, and this is the second of them. RLS is enabled on the table with **no policies**, so `anon` and `authenticated` cannot see a row to write to — a PATCH from them matches zero rows and a `set local role authenticated; update …` reports `UPDATE 0`. And the trigger refuses regardless of role, proven against the superuser. See `05-EVIDENCE.md` §4.2.
- **Why it is still worth checking:** the most likely cause is the local bootstrap re-applying default privileges after migrations, which would be purely local. But if the same profile exists on the hosted project, the migration's second mechanism is not in effect there either, and the phase would be relying on RLS plus a trigger where it believes it has three defences.
- **Why not fixed here:** re-granting or re-revoking locally would mask the question rather than answer it. The answer needs a look at the production role grants.
- **Owner:** whoever next touches the hosted database.

**19. `supabase/seed.sql` violates `users_municipality_fk` — local bootstrap has been broken since 20260728000001**

- **Observed:** `supabase db reset` / `supabase start` fails at the seeding step with `insert or update on table "users" violates foreign key constraint "users_municipality_fk" (SQLSTATE 23503)`. The seed inserts users carrying `municipality_id` values absent from `municipalities`; the constraint predates this phase and no phase-5 migration references it.
- **Why not fixed here:** entirely outside issue #75, and repairing a seed file is a change with its own review. Recorded first in `05-DB-EVIDENCE.md` §6 and again in `05-EVIDENCE.md` §2.4 so it is not rediscovered as a phase-5 regression.
- **Workaround, and it is committed:** bring the stack up with seeding disabled and apply `apps/web/tests/e2e/fixtures/space-admin-seed.sql`, which is idempotent and namespaced.
- **Owner:** unassigned.

**20. The site's floating chrome overlays the admin console**

- **Found during:** the screenshot pass — visible in frame 01, where the `וואטסאפ הפיילוט` pill covers the first review-queue row's date.
- **Observed:** `[locale]/layout.tsx` renders `WhatsAppButton` and the `GeoGate` locality modal on every route, space-admin included. The gate opens for any visitor with no stored town, sits over the console, and intercepts clicks.
- **A second-order note worth keeping:** the gate's escape hatch is `isAuthenticated` from the **client** auth store, which the sign-in flow populates — not the httpOnly `sync-session` cookie. A session authenticated to the server and anonymous to that store still sees the gate. That is not wrong today, because a real sign-in populates both, but it means server-side and client-side "signed in" can disagree.
- **Why not fixed here:** whether a marketing CTA and a locality prompt belong on an admin console is a product decision, not a phase-5 one. The evidence spec sets `taruu.municipality` before each navigation, which is the ordinary state of a returning reader.
- **Owner:** unassigned. **Related:** `05-EVIDENCE.md` §6.2.

**21. Items 14, 15 and 16 name 05-16 as a possible owner; 05-16 declined all three, on purpose**

- **Item 14** (state-0 copy promises a draft the read-only fields do not allow) and **item 15** (the `הרשאות` audit chip selects grant rows only, so a member suspension is invisible under it) are **copy-deck decisions**, not code. A verification plan is the wrong place to invent user-facing Hebrew or to add a fifth filter chip the deck does not have. Item 14 in particular is now visible in a committed frame — `14-quota-exhausted-{desktop,mobile}.png` shows the read-only composer beside the sentence inviting the admin to draft in it — so a copy pass has evidence to work from.
- **Item 16** (the audit actor filter is built from the rows on screen) needs a `distinct actor_user_id` read behind `audit.read`, which is one query, one repository function and one field on `AuditPage`. That is a feature, and this plan's mandate was evidence rather than features.
- **Owner:** a copy pass for 14 and 15; whoever next picks up the audit surface for 16.

**22. The 22 evidence frames are 26 MB, committed unmodified**

- **Observed:** `apps/web/tests/e2e/__screenshots__/space-admin/` is 26 MB. Desktop full-page frames run 1.7–3.2 MB each.
- **What was tried:** lossless recompression through ImageMagick at maximum compression, with and without dropping the alpha channel — both produced **larger** files than Playwright's own output. Quantizing would alter evidence whose colour is part of what it proves (frame 13's whole point is which fill a button carries).
- **The alternative, if the weight matters more than the completeness:** capture clipped to `<main>` rather than full-page. That drops roughly half the pixels. It also drops the site footer, which checkpoint step 9 asks the reviewer to confirm is intact on the refused surface, and the statistics footer note and the audit pagination, both of which sit below the fold at 900px.
- **Owner:** the repo owner, if 26 MB of permanent history is not an acceptable price for issue #75's acceptance evidence.

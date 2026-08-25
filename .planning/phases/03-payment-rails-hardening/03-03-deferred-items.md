# Deferred items — plan 03-03

Out-of-scope discoveries made while retiring the participation payment rail from the clients.
Recorded, deliberately **not** fixed.

> Plan-scoped filename on purpose: six executors share this worktree, and a single
> `deferred-items.md` written with a whole-file write would clobber their entries.

| # | Location | Finding | Why deferred |
|---|----------|---------|--------------|
| 1 | `apps/mobile/app/(tabs)/create.tsx:89` | Pushes `type: 'create_vote'` — a string `POST /api/payments/create` has never accepted. Now inert: `checkout.tsx` posts a `vote_creation` literal and never reads `params.type`. | Plan 03-03 T3 explicitly forbids editing this file, and its acceptance criteria assert `git diff --stat` on it is empty. |
| 2 | `apps/mobile/app/(tabs)/create.tsx:90-96` | Sends `title`, `description`, `options`, `duration` to a checkout screen that reads none of them, and the comment says "Navigate to Stripe payment screen" on a Green Invoice flow. | Same file, same prohibition. The mobile creation funnel needs its own plan — nothing carries the draft to `POST /api/votes` after payment the way the web funnel does. |
| 3 | `apps/mobile/app/payment/failed.tsx:19` | Retry falls back to `params.type \|\| 'vote_participation'`. Inert now, but it still names the retired rail. | Plan 03-03 T3: "Do not change … `payment/failed.tsx`". |
| 4 | `apps/mobile/src/__tests__/hooks/usePayment.test.ts` (`describe('Payment amounts')`) | Asserts "vote participation amount (₪3 = 300 agorot)". A money-model claim in a test fixture. | PAY-08's copy sweep covers `apps/web/src` and `apps/mobile/app`; this is `apps/mobile/src`. Candidate for plan 03-09's repo-wide sweep. |
| 5 | `apps/mobile/app/payment/checkout.tsx` (token block) | "עם התשלום תקבלו {amount} טוקני SYNC (1 ש\"ח = 1 טוקן)" — an unbacked token-grant claim. | Not a per-vote price, so outside PAY-08's money-model scope. Belongs with the COIN track (03-10's claim inventory). |
| 6 | `packages/shared` | Has a `test` script and a vitest devDependency but zero test files, so `pnpm --filter @sync/shared test` exits 1 with "No test files found". Its tsconfig also excludes `**/__tests__/**`. | No plan owns wiring a runner there. Task 1's Zod behaviours are asserted from the api-client suite instead. Future plans must not gate on the shared `test` script. |
| 7 | `packages/shared/src/contracts/payment.ts` | `CreatePaymentRequestSchema` still carries `idempotencyKey`. | Plan 03-08 removes the server's honouring of it and should drop the field in the same change. Called out by 03-03's own action notes. |

---
*Recorded by plan 03-03 on 2026-08-04.*

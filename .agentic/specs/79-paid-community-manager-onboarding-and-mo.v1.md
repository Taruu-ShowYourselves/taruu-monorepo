# Spec — issue #79 manager-access-policy-foundation v1

## Current state

The issue is too large for one half-day PR and must be split into application UI, billing persistence, provider integration, renewals/reconciliation, notifications, and operator UI slices. This first slice defines and tests the provider-independent access/state policy only. It plugs into the existing pure authorization policy at `apps/web/src/server/domain/authz/policy.ts`; a later slice will replace the unconditional billing adapter in `apps/web/src/server/app/authz/require-role.ts`. It preserves the existing application and grant vocabularies from `packages/shared/src/contracts/role.ts` and the guarded/audited repository patterns in `apps/web/src/server/infra/supabase/role.repo.ts`. It does not infer recurring-payment behavior from either Green Invoice adapter because `apps/web/docs/SPIKE-RESULT.md` has not verified token charging, webhooks, or settlement.

## Goal

Add a pure, exhaustively tested community-manager access policy that treats application approval, subscription standing, and administrative grant status as independent prerequisites. The policy will define the required state vocabulary and deterministic access outcomes without changing production authorization, persistence, payment handling, routes, or UI. This creates a reviewable contract for later schema and integration PRs while keeping ambiguous provider states fail-closed.

## In scope

- claim: packages/shared/src/types/manager-billing.ts
- claim: apps/web/src/server/domain/authz/manager-access-policy.ts
- claim: apps/web/src/server/domain/authz/manager-access-policy.test.ts

## Out of scope

This PR does not implement a complete issue #79 workflow. It excludes database migrations, generated database types, application/review endpoints and screens, checkout or tokenization, provider calls, webhooks, invoice or receipt creation, renewal scheduling, retries, cancellation endpoints, reconciliation, notifications, and changes to `requireRole()`.

It does not decide retry timing, grace duration, cancellation timing, renewal triggers, notification channels, provider settlement semantics, or whether approval revocation should cancel future billing. Those require explicit product decisions or verified Morning sandbox behavior.

Follow-up split:

1. Application submission/review routes and UI over the existing role repository.
2. Subscription schema, append-only billing ledger, repository, and generated types.
3. `requireRole()` billing lookup integration.
4. Verified Morning tokenization, initial charge, documents, and webhook correlation.
5. Renewal/retry/cancellation/reconciliation orchestration.
6. Notifications and billing/operator UI with visual evidence.

## Contracts

Add shared provider-independent types:

```ts
type ManagerApplicationState =
  | "submitted"
  | "approved"
  | "rejected"
  | "withdrawn";

type ManagerSubscriptionState =
  | "inactive"
  | "active"
  | "past_due"
  | "grace"
  | "cancelled"
  | "expired";

type ManagerGrantState =
  | "active"
  | "suspended"
  | "revoked";

type ManagerAccessDecision =
  | { allowed: true; reason: "active" }
  | {
      allowed: false;
      reason:
        | "approval_required"
        | "application_rejected"
        | "billing_inactive"
        | "billing_past_due"
        | "billing_cancelled"
        | "billing_expired"
        | "grant_suspended"
        | "grant_revoked";
    };
```

`rejected` remains an application state; it is not duplicated as a subscription state. Administrative `suspended` remains a grant state independent of billing.

The pure policy accepts application, subscription, and grant states and returns one deterministic decision. It must enforce these invariants:

- Payment or an `active` subscription never grants access unless the application is `approved`.
- Approval never grants access unless the subscription is `active` or `grace`.
- `past_due` denies access; entry into `grace` must be an explicit later lifecycle transition.
- `cancelled` and `expired` deny access.
- `suspended` and `revoked` deny access regardless of approval or billing.
- Only `approved + (active | grace) + active grant` permits access.
- Unknown runtime values fail closed as `billing_inactive`; the policy must not throw or permit access.
- The policy performs no I/O and has no dependency on Morning, Supabase, clocks, or notification delivery.
- No database migration is introduced in this slice.

## Acceptance gates

- G-1: The shared contract contains distinct application, subscription, and grant state unions, with `rejected` only in the application vocabulary and `suspended` only in the grant vocabulary. → evidence: `pnpm typecheck`
- G-2: A table-driven test covers every Cartesian combination of 4 application states × 6 subscription states × 3 grant states, and only `approved + active/grace + active grant` is allowed. → evidence: `pnpm --filter web test -- manager-access-policy.test.ts`
- G-3: Tests prove `active` billing with `submitted`, `rejected`, or `withdrawn` application state is denied. → evidence: `pnpm --filter web test -- manager-access-policy.test.ts`
- G-4: Tests prove an approved application with `inactive`, `past_due`, `cancelled`, or `expired` billing is denied. → evidence: `pnpm --filter web test -- manager-access-policy.test.ts`
- G-5: Tests prove `suspended` and `revoked` grants override both approval and acceptable billing. → evidence: `pnpm --filter web test -- manager-access-policy.test.ts`
- G-6: Tests pass malformed subscription input through the runtime boundary and prove it fails closed without throwing. → evidence: `pnpm --filter web test -- manager-access-policy.test.ts`
- G-7: The repository remains type-safe and lint-clean after adding the policy. → evidence: `pnpm typecheck && pnpm lint`
- G-8: No files outside the three declared claims change. → evidence: `git diff --name-only --diff-filter=ACMRTUXB`

## Protected paths

- `supabase/migrations/` — protected; subscription persistence and RLS require a separate reviewed schema slice.
- `.github/workflows/` — protected; this policy slice requires no CI or deployment changes.
- `apps/web/src/app/api/payments/` — protected; existing endpoints implement legacy one-time payments and must not be extended before provider behavior is verified.

## Risk & rollback

The main risk is prematurely encoding product policy, especially whether `past_due` retains access. This slice avoids selecting a grace duration or transition schedule: only an explicitly persisted future `grace` state permits temporary access. It also leaves production authorization unchanged, so merging it cannot accidentally grant or revoke live access.

Rollback is deletion of the three claimed files. No database, provider, API, scheduled job, role grant, or user-visible state is changed.
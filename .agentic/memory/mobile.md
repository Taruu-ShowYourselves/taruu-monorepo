# mobile — verified facts (merged PRs only)
- pnpm --filter @sync/mobile typecheck: 130 TS2786 errors from duplicate @types/react (18.3.27 vs 19.2.7); fix = root pnpm.overrides pin (deferred-items.md)
- app/(tabs)/create.tsx still shows pre-#75 payment CTA and pushes /payment/checkout — stale, strip under issue #73 step 0
- Identity score displays must use 0–140 scale after PR #110 (IDENTITY_SCORE_MAX), not /100

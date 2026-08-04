# Phase 03 — Deferred Items

Out-of-scope discoveries logged during execution. Recorded, not fixed.

## From plan 03-08 (SEC-04, idempotency)

**`packages/shared/src/contracts/payment.ts:35` still declares `idempotencyKey: z.string().optional()`.**

The server no longer reads it: `POST /api/payments/create` dropped the field from
`CreatePaymentRequest` and derives the key itself, so a client that sends one is ignored
rather than trusted (SEC-04 is satisfied at the enforcement point). What remains is a wire
contract that still *advertises* a field the server discards — cosmetic, not a security hole.

Not fixed here because `packages/shared` is plan **03-03**'s file and is outside 03-08's
`files_modified`. Removing the field is a one-line change plus whatever `packages/api-client`
passes through; it belongs to whoever next owns the shared payment contract.

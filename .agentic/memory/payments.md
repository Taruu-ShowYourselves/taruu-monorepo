# payments — verified facts (merged PRs only)
- NEXT_PUBLIC_PAYMENTS_ENABLED: only exact string "true" enables; default OFF in wrangler.jsonc (PR #100 line)
- creation-fee.ts records obligation only (pending payments row); real capture is PAY-06; guard assertCreationFeeCaptureAllowed fails closed (PR #104)
- Merch webhook: header-only x-greeninvoice-token (constant-time) + provider document confirmation binding doc→order+amount; query-string token ignored (PR #103)
- Creation flow on main = submit free → review → ₪50 charged at approval; any pay-first checkout UI is a regression (PR #107/#108 line)
- Payments webhook header-less path must bind document→payment (custom/amount match), not mere existence — HIGH finding on PR #100, unfixed there

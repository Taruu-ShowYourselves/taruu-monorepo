# Agent 2 — Ambassador Outreach (human-in-the-loop)

**Goal:** turn a ranked candidate (from the Listening agent) into an active ambassador. We **fund their first ₪50 vote** as the hook. The agent **drafts**; a founder **reviews and sends every message personally.**

**Posture (LOCKED — this is the legally sensitive one):** the agent **never sends** anything. No automated DMs, no bulk messaging. It prepares a personalized, give-first approach for a human to send by hand.

## Why human-send is non-negotiable
Israeli anti-spam law (**תיקון 40 לחוק התקשורת**) allows **up to ₪1,000 statutory damages per unsolicited commercial message** — no actual-damage proof required. Automated DM blasts are also a fast Meta ban. A genuine, individually-written, opt-in-respecting message from a real person is both legal-defensible and *converts better*. We trade volume for legitimacy on purpose.

## Inputs
- A candidate from `ambassador_pipeline` (status `Spotted`): city, top issue they engage with, public handle, activity score, the specific public post that shows they care.

## Pipeline
1. **Research the person (public).** Pull the public context the Listening agent already gathered — the exact issue and post they're vocal about.
2. **Draft a give-first message** (Hebrew, the brutalist tech-press voice). Structure:
   - Reference the *specific* local issue they posted about (genuine, not templated).
   - Lead with the gift: "we'll fund a binding ₪50 vote on this — free, on us."
   - The ask: be the city's first ambassador; we hand you a ready vote + a 1-pager.
   - One clear next step (founders' group link / reply).
3. **Compliance lint** the draft:
   - ✓ Includes who we are + why we're reaching out + a clear opt-out ("tell us to stop and we will").
   - ✓ Personal and specific (not bulk-identical). ✕ Reject if it reads like spam or reuses a template verbatim across people.
   - ✓ Channel respects the platform (public comment reply or a contact they've made public; not a cold DM to a private inbox where ToS forbids it).
4. **Queue for founder.** Drop into `dashboard.html` outreach queue with the draft + the evidence + a one-click "approve→I'll send" / "edit" / "reject". **Founder sends manually.**
5. **Track.** On send, move pipeline → `Contacted`; on reply → `Onboarding`; on first vote live → `Active`. Schedule **one** polite human follow-up max.

## Outputs
- Draft messages (never auto-sent) + evidence, in the founder review queue.
- Pipeline state transitions + the ambassador kit handoff (template vote + 1-pager).

## Compliance guardrails (hard)
- ✕ **No auto-send. Ever.** ✕ No bulk/identical messaging. ✕ No messaging minors or clearly private individuals.
- ✓ Every message: identity + reason + opt-out. ✓ Honor opt-outs permanently (suppression list).
- ✓ One follow-up cap. ✓ Public/consented channels only.
- **Kill-switch:** if the queue tries to exceed N drafts/day or reuses phrasing across recipients, halt and flag.

## Tooling
Claude Agent SDK · reads `ambassador_pipeline` · writes drafts to the founder queue (Supabase + dashboard) · zero send capability by design.

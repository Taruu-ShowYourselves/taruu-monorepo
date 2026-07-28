# Taruu Growth Agents

Three agents that run the growth loop. All are **human-in-the-loop** where it touches real people. Build them in the `taruu-agents` repo (Claude Agent SDK + cron); these specs are the contract.

| Agent | Autonomy | Job | Spec |
|---|---|---|---|
| Listening | assisted (reads public, never sends) | rank local topics/complaints + active citizens per city | [`listening-agent.md`](./listening-agent.md) |
| Outreach | drafts only, founder sends every message | invite top citizens as ambassadors, fund first ₪50 vote | [`outreach-agent.md`](./outreach-agent.md) |
| Marketing | posts own brand content; founder approves calendar + grey-hat | one-to-many distribution via Postiz playbook → drive creates | [`marketing-agent.md`](./marketing-agent.md) |

**The loop:** Listening surfaces candidates → Outreach (human-sent) converts them to ambassadors → ambassadors run funded votes → Marketing turns each executed vote into one-to-many outcome stories → inbound creates → repeat.

**Why human-in-the-loop:** Israeli anti-spam (תיקון 40) = up to ₪1,000/unsolicited commercial message; Meta bans account automation. Agents draft and rank; humans decide and send. This is a deliberate legitimacy-over-volume trade — see each spec's guardrails + kill-switches.

Pipeline state and run logs surface in [`../dashboard.html`](../dashboard.html).

/**
 * Resend notify — email is the cycle feed, never a control surface.
 * Idempotent by event key: a crashed/resumed lane never double-mails.
 * RESEND_API_KEY comes from the environment (direnv / .agentic/.env),
 * never from config or the repo.
 */
import { config } from "./config.ts";
import type { LaneState } from "./state.ts";

export type EmailKind = "action" | "progress";

export async function notify(
  lane: LaneState,
  eventKey: string,
  kind: EmailKind,
  subject: string,
  html: string,
): Promise<void> {
  if (lane.emailsSent.includes(eventKey)) return;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error(`[mailer] RESEND_API_KEY unset — skipping email ${eventKey}`);
    return;
  }
  const c = config().email;
  const prefix = kind === "action" ? `${c.subjectPrefix} ⏸ ACTION` : c.subjectPrefix;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: c.from,
      to: [c.to],
      subject: `${prefix} · lane #${lane.issue} · ${subject}`,
      html,
    }),
  });
  if (!res.ok) {
    console.error(`[mailer] resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return; // notify failures never fail the lane
  }
  lane.emailsSent.push(eventKey);
}

export function prLink(lane: LaneState): string {
  return lane.prNumber
    ? `https://github.com/${config().repo}/pull/${lane.prNumber}`
    : `https://github.com/${config().repo}/issues/${lane.issue}`;
}

/**
 * SPACE-08, second half: the send.
 *
 * SPACE-08 requires that the recipients actually delivered to are exactly the
 * previewed authorized audience — opt-outs honoured, per-space quota enforced
 * server-side, every delivery logged — and this file proves each half against
 * the *writes*, not against the response body, because a response can be
 * correct while the rows are wrong and it is the rows that are the guarantee.
 *
 * Which test proves which half:
 * - equality of the two sets → "hands insertUserNotifications exactly the
 *   previewed id set, sorted"
 * - opt-outs honoured → "writes five delivered rows and one suppressed row for
 *   the member who opted out"
 * - quota enforced before any send → "refuses at the quota before a single row
 *   is written"
 * - the equality cannot drift between preview and send → the two 409 cases,
 *   "refuses an edited message" and "refuses a changed audience"
 * - in-app is the delivery of record → "writes the in-app rows before the push
 *   is attempted"
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { okAsync, errAsync } from 'neverthrow';
import { conflict, dbError } from '@/server/http/errors';
import { MUNICIPALITY_A, SESSION, SPACE_A, SPACE_B, scopeFor } from '../fixtures/space';

const SENT_AT = '2026-08-03T12:00:00.000Z';
const NEXT_MONTH = '2026-09-01T00:00:00.000Z';
const CONFLICT_HE = vi.hoisted(() => ({ alreadySent: 'ההתראה כבר נשלחה.' }));

vi.mock('@/server/infra/supabase/space-notify.repo', () => ({
  listAudienceCandidates: vi.fn(),
  countCampaignsSentThisMonth: vi.fn(),
  readSpaceQuota: vi.fn(),
  findCampaignInScope: vi.fn(),
  claimCampaignForSend: vi.fn(),
  insertUserNotifications: vi.fn(),
  insertDeliveries: vi.fn(),
  listCampaignsForSpace: vi.fn(),
  nextMonthStartIso: vi.fn(() => '2026-09-01T00:00:00.000Z'),
  SEND_CONFLICT_HE: CONFLICT_HE.alreadySent,
}));

vi.mock('@/server/infra/supabase/push.repo', () => ({
  activeTokensForUsers: vi.fn(),
  usersWithActiveChannel: vi.fn(),
}));

vi.mock('@/server/infra/supabase/space-audit.repo', () => ({
  insertAuditRow: vi.fn(),
}));

vi.mock('@/server/infra/supabase/space.repo', () => ({
  findActiveGrant: vi.fn(),
  findGrantsForUser: vi.fn(),
}));

vi.mock('@/services/notifications/expo', () => ({
  sendBatchNotifications: vi.fn(),
}));

import {
  activeTokensForUsers,
  usersWithActiveChannel,
} from '@/server/infra/supabase/push.repo';
import {
  claimCampaignForSend,
  countCampaignsSentThisMonth,
  findCampaignInScope,
  insertDeliveries,
  insertUserNotifications,
  listAudienceCandidates,
  readSpaceQuota,
} from '@/server/infra/supabase/space-notify.repo';
import { insertAuditRow } from '@/server/infra/supabase/space-audit.repo';
import { findActiveGrant } from '@/server/infra/supabase/space.repo';
import { sendBatchNotifications } from '@/services/notifications/expo';
import { contentHash, resolveAudience } from '@/server/app/space-admin/audience';
import { sendNotification } from '@/server/app/space-admin/send-notification';

const CAMPAIGN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const REASON = 'עדכון לתושבים על שינוי במועד ההצבעה השבועית';

const uid = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A `users` projection as `listAudienceCandidates` returns it. */
const candidate = (n: number, settings: Record<string, boolean> | null = null) => ({
  id: uid(n),
  notification_settings: settings,
});

const candidatesAre = (rows: ReturnType<typeof candidate>[]) =>
  (listAudienceCandidates as Mock).mockReturnValue(okAsync(rows));

const everyoneHasAChannel = () =>
  (usersWithActiveChannel as Mock).mockImplementation((ids: string[]) =>
    okAsync(new Set(ids))
  );

const campaignRow = (overrides: Record<string, unknown> = {}) => ({
  id: CAMPAIGN_ID,
  space_id: SPACE_A,
  created_by: SESSION.userId,
  title: 'עדכון',
  body: 'גוף ההודעה',
  audience_filter: 'all_members',
  audience_hash: 'unset',
  content_hash: 'unset',
  audience_size: 0,
  excluded_opted_out: 0,
  excluded_no_channel: 0,
  status: 'previewed',
  reason: null,
  previewed_at: '2026-08-03T09:00:00.000Z',
  sent_at: null,
  ...overrides,
});

function grantOnlyInSpaceA(capabilities: string[] = ['notification.send']) {
  (findActiveGrant as Mock).mockImplementation((_userId, spaceId, capability) =>
    okAsync(
      spaceId === SPACE_A && capabilities.includes(capability)
        ? { space_id: SPACE_A, municipality_code: MUNICIPALITY_A }
        : null
    )
  );
}

const MESSAGE = {
  title: 'עדכון',
  body: 'גוף ההודעה',
  audienceFilter: 'all_members' as const,
};

/**
 * Arrange the exact campaign row the preview would have persisted for this
 * message and this membership.
 *
 * The fingerprints come from the real `resolveAudience` / `contentHash` — the
 * same two functions the send re-runs — because a test that re-derived them
 * with its own join string would pass while the production comparison failed.
 */
async function previewed(
  candidates: ReturnType<typeof candidate>[] = [candidate(1), candidate(2)],
  message: typeof MESSAGE = MESSAGE
) {
  candidatesAre(candidates);
  const audience = (
    await resolveAudience(scopeFor('notification.send'), message.audienceFilter)
  )._unsafeUnwrap();
  const content = await contentHash(message);

  const row = campaignRow({
    ...message,
    audience_filter: message.audienceFilter,
    audience_hash: audience.hash,
    content_hash: content,
    audience_size: audience.userIds.length,
    excluded_opted_out: audience.excludedOptedOut,
    excluded_no_channel: audience.excludedNoChannel,
  });

  (findCampaignInScope as Mock).mockReturnValue(okAsync(row));
  (claimCampaignForSend as Mock).mockReturnValue(
    okAsync({ ...row, status: 'sent', sent_at: SENT_AT })
  );

  // The arrange step above ran the resolver once; forget those calls so the
  // assertions below see only what the send itself did.
  (listAudienceCandidates as Mock).mockClear();
  (usersWithActiveChannel as Mock).mockClear();

  return {
    row,
    audience,
    command: { ...message, campaignId: CAMPAIGN_ID, previewToken: content, reason: REASON },
  };
}

/**
 * A `defer` that runs the task immediately and hands back its promise. The real
 * route hands `after()` the same closure; running it inline is what makes the
 * fan-out observable and its ordering assertable.
 */
function inlineDefer() {
  const tasks: Promise<void>[] = [];
  return {
    defer: (task: () => Promise<void>) => {
      tasks.push(task());
    },
    settled: () => Promise.all(tasks),
  };
}

const send = (
  command: Record<string, unknown>,
  spaceId: string = SPACE_A,
  deferred = inlineDefer()
) =>
  sendNotification(
    { defer: deferred.defer },
    SESSION,
    spaceId,
    command as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SPACE_ADMIN_ENABLED;
  everyoneHasAChannel();
  (activeTokensForUsers as Mock).mockReturnValue(
    okAsync(['ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'])
  );
  candidatesAre([candidate(1), candidate(2)]);
  grantOnlyInSpaceA();
  (countCampaignsSentThisMonth as Mock).mockReturnValue(okAsync(2));
  (readSpaceQuota as Mock).mockReturnValue(okAsync(8));
  (insertUserNotifications as Mock).mockReturnValue(okAsync(undefined));
  (insertDeliveries as Mock).mockReturnValue(okAsync(undefined));
  (insertAuditRow as Mock).mockReturnValue(okAsync({ id: 'audit-1' }));
  (sendBatchNotifications as Mock).mockResolvedValue({
    sent: 2,
    failed: 0,
    tickets: [],
    errors: [],
  });
});

describe('sendNotification — the verification that makes SPACE-08 true', () => {
  it('hands insertUserNotifications exactly the previewed id set, sorted', async () => {
    const { command, audience } = await previewed([
      candidate(5),
      candidate(1),
      candidate(4),
      candidate(2),
      candidate(3),
    ]);

    const result = await send(command);

    expect(result.isOk()).toBe(true);
    const [rows] = (insertUserNotifications as Mock).mock.calls[0];
    // The set, not the count: a count matches while the members differ.
    expect((rows as { user_id: string }[]).map((r) => r.user_id).sort()).toEqual(
      [...audience.userIds].sort()
    );
    expect(audience.userIds).toHaveLength(5);
  });

  it('writes one in_app delivery row per recipient, all delivered', async () => {
    const { command } = await previewed([candidate(1), candidate(2), candidate(3)]);

    await send(command);

    const [rows] = (insertDeliveries as Mock).mock.calls[0];
    const inApp = (rows as { channel: string; state: string }[]).filter(
      (r) => r.channel === 'in_app'
    );
    expect(inApp).toHaveLength(3);
    expect(inApp.every((r) => r.state === 'delivered')).toBe(true);
  });

  it('writes five delivered rows and one suppressed row for the member who opted out', async () => {
    const { command, audience } = await previewed([
      candidate(1),
      candidate(2),
      candidate(3),
      candidate(4),
      candidate(5),
      candidate(6, { spaceAnnouncements: false }),
    ]);

    expect(audience.userIds).toHaveLength(5);
    expect(audience.excludedOptedOut).toBe(1);

    await send(command);

    const [rows] = (insertDeliveries as Mock).mock.calls[0];
    const inApp = (
      rows as { channel: string; state: string; user_id: string; suppression_reason: string | null }[]
    ).filter((r) => r.channel === 'in_app');

    expect(inApp.filter((r) => r.state === 'delivered')).toHaveLength(5);
    const suppressed = inApp.filter((r) => r.state === 'suppressed');
    expect(suppressed).toHaveLength(1);
    expect(suppressed[0].user_id).toBe(uid(6));
    expect(suppressed[0].suppression_reason).toBe('opted_out');

    // And the opted-out member is not in anyone's inbox.
    const [inbox] = (insertUserNotifications as Mock).mock.calls[0];
    expect((inbox as { user_id: string }[]).map((r) => r.user_id)).not.toContain(uid(6));
  });

  it('refuses at the quota before a single row is written', async () => {
    const { command } = await previewed();
    (countCampaignsSentThisMonth as Mock).mockReturnValue(okAsync(8));
    (readSpaceQuota as Mock).mockReturnValue(okAsync(8));

    const result = await send(command);

    expect(result._unsafeUnwrapErr().kind).toBe('QUOTA_EXCEEDED');
    expect(insertUserNotifications).not.toHaveBeenCalled();
    expect(insertDeliveries).not.toHaveBeenCalled();
    expect(sendBatchNotifications).not.toHaveBeenCalled();
    expect(claimCampaignForSend).not.toHaveBeenCalled();
  });

  it('allows the eighth send of a quota of eight — the check is at-or-over, not past', async () => {
    const { command } = await previewed();
    (countCampaignsSentThisMonth as Mock).mockReturnValue(okAsync(7));

    const result = await send(command);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().quotaRemaining).toBe(0);
  });

  it('refuses an edited message with the content 409 and writes nothing', async () => {
    const { command } = await previewed();

    const result = await send({ ...command, body: 'גוף אחר לגמרי' });

    const error = result._unsafeUnwrapErr();
    expect(error.kind).toBe('CONFLICT');
    expect(error).toEqual(
      conflict('ההודעה שונתה אחרי חישוב הקהל — חשבו שוב לפני שליחה.')
    );
    expect(claimCampaignForSend).not.toHaveBeenCalled();
    expect(insertUserNotifications).not.toHaveBeenCalled();
  });

  it('refuses a replayed previewToken even when the message itself still matches', async () => {
    const { command } = await previewed();

    const result = await send({ ...command, previewToken: 'a'.repeat(64) });

    expect(result._unsafeUnwrapErr()).toEqual(
      conflict('ההודעה שונתה אחרי חישוב הקהל — חשבו שוב לפני שליחה.')
    );
    expect(claimCampaignForSend).not.toHaveBeenCalled();
  });

  it('refuses a changed audience with the audience 409 and writes nothing', async () => {
    const { command } = await previewed([candidate(1), candidate(2)]);
    // One member joins between the preview and the send.
    candidatesAre([candidate(1), candidate(2), candidate(3)]);

    const result = await send(command);

    expect(result._unsafeUnwrapErr()).toEqual(
      conflict('הקהל השתנה — הציגו תצוגה מקדימה מחדש.')
    );
    expect(claimCampaignForSend).not.toHaveBeenCalled();
    expect(insertUserNotifications).not.toHaveBeenCalled();
  });

  it('re-runs the resolver rather than trusting anything the caller sent', async () => {
    const { command } = await previewed();

    await send(command);

    expect(listAudienceCandidates).toHaveBeenCalledTimes(1);
    expect(listAudienceCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ spaceId: SPACE_A, municipalityCode: MUNICIPALITY_A }),
      'all_members'
    );
  });

  it('refuses a second send of an already-sent campaign', async () => {
    const { command } = await previewed();
    (claimCampaignForSend as Mock).mockReturnValue(
      errAsync(conflict(CONFLICT_HE.alreadySent))
    );

    const result = await send(command);

    expect(result._unsafeUnwrapErr()).toEqual(conflict(CONFLICT_HE.alreadySent));
    expect(insertUserNotifications).not.toHaveBeenCalled();
    expect(sendBatchNotifications).not.toHaveBeenCalled();
  });

  it('refuses a campaign in another space opaquely, never as a 404', async () => {
    await previewed();
    const { command } = await previewed();
    (findCampaignInScope as Mock).mockReturnValue(okAsync(null));

    const result = await send(command);

    // No reason attached: a campaign that exists elsewhere and one that does
    // not exist at all must be indistinguishable.
    expect(result._unsafeUnwrapErr()).toEqual({ kind: 'FORBIDDEN', reason: undefined });
  });

  it('refuses a caller without notification.send before reading the campaign', async () => {
    const { command } = await previewed();
    grantOnlyInSpaceA(['proposal.read']);

    const result = await send(command);

    expect(result._unsafeUnwrapErr().kind).toBe('FORBIDDEN');
    expect(findCampaignInScope).not.toHaveBeenCalled();
  });

  it('refuses a swapped spaceId', async () => {
    const { command } = await previewed();

    const result = await send(command, SPACE_B);

    expect(result._unsafeUnwrapErr().kind).toBe('FORBIDDEN');
    expect(findCampaignInScope).not.toHaveBeenCalled();
  });

  it('audits the send with the campaign as the object and the caller-supplied reason', async () => {
    const { command } = await previewed([candidate(1), candidate(2), candidate(3)]);

    await send(command);

    expect(insertAuditRow).toHaveBeenCalledTimes(1);
    const [row] = (insertAuditRow as Mock).mock.calls[0];
    expect(row).toMatchObject({
      space_id: SPACE_A,
      actor_user_id: SESSION.userId,
      action: 'notification.sent',
      object_type: 'notification_campaign',
      object_id: CAMPAIGN_ID,
      reason: REASON,
    });
    expect(row.new_state).toEqual({
      recipients: 3,
      excludedOptedOut: 0,
      excludedNoChannel: 0,
    });
  });

  it('writes the in-app rows before the push is attempted', async () => {
    const { command } = await previewed();
    const deferred = inlineDefer();

    await send(command, SPACE_A, deferred);
    await deferred.settled();

    const inbox = (insertUserNotifications as Mock).mock.invocationCallOrder[0];
    const log = (insertDeliveries as Mock).mock.invocationCallOrder[0];
    const push = (sendBatchNotifications as Mock).mock.invocationCallOrder[0];
    expect(inbox).toBeLessThan(log);
    expect(log).toBeLessThan(push);
  });

  it('does not await the push — a hanging fan-out cannot hold the response', async () => {
    const { command } = await previewed();
    let release: (() => void) | undefined;
    (sendBatchNotifications as Mock).mockImplementation(
      () => new Promise((resolve) => { release = () => resolve({ sent: 0, failed: 0, tickets: [], errors: [] }); })
    );

    const result = await send(command);

    expect(result.isOk()).toBe(true);
    release?.();
  });

  it('returns the sent receipt the composer renders', async () => {
    const { command } = await previewed([candidate(1), candidate(2), candidate(3)]);

    const receipt = (await send(command))._unsafeUnwrap();

    expect(receipt).toEqual({
      campaignId: CAMPAIGN_ID,
      deliveredRecipients: 3,
      sentAt: SENT_AT,
      quotaRemaining: 5,
    });
  });

  it('fails the send when the audit row cannot be written', async () => {
    const { command } = await previewed();
    (insertAuditRow as Mock).mockReturnValue(errAsync(dbError('space_audit_log.insert')));

    const result = await send(command);

    // An unaudited dispatch would break SPACE-04, so the audit write is part of
    // the send rather than a best-effort side effect.
    expect(result.isErr()).toBe(true);
  });
});

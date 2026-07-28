/**
 * Vote-creation notifications — runs OFF the request path (callers hand this
 * to `after()` so the response never waits on email/push fan-out).
 */

import { emailService, sendInBatches } from '@/services/email';
import { sendBatchNotifications } from '@/services/notifications/expo';
import { getUsersByMunicipality } from '@/lib/supabase/db';
import { logger } from '@/lib/logger';
import type { Vote, User } from '@/lib/supabase/types';

export async function notifyVoteCreated(vote: Vote, creator: User): Promise<void> {
  try {
    if (creator.email) {
      await emailService.sendVoteCreatedEmail({
        to: creator.email,
        firstName: creator.first_name || 'יוצר ההצבעה',
        voteTitle: vote.title,
        voteId: vote.id,
        municipality: vote.municipality_id,
        endDate: new Date(vote.end_date),
      });
    }

    // Broadcast only for votes that are already open.
    if (vote.status !== 'active') return;

    const residents = await getUsersByMunicipality(vote.municipality_id);
    const recipients = residents.filter((r) => r.id !== creator.id);

    await sendInBatches(recipients, (r) =>
      emailService.sendVoteNotification({
        to: r.email,
        firstName: r.first_name || 'תושב/ת',
        voteTitle: vote.title,
        voteId: vote.id,
        municipality: vote.municipality_id,
        endDate: new Date(vote.end_date),
      })
    );

    // One batched token query for the whole recipient list (was N+1).
    // Lazy import: keeps supabaseAdmin out of the route-module import graph
    // (unit tests import the route without Supabase env configured).
    const { activeTokensForUsers } = await import(
      '@/server/infra/supabase/push.repo'
    );
    const tokens = await activeTokensForUsers(recipients.map((r) => r.id)).match(
      (t) => t,
      (error) => {
        logger.warn('push token lookup failed', { error });
        return [] as string[];
      }
    );

    if (tokens.length > 0) {
      await sendBatchNotifications(tokens, {
        title: '🗳️ הצבעה חדשה בעיר שלכם',
        body: `${vote.municipality_id}: "${vote.title}". הקול שלכם נספר.`,
        data: { type: 'new_vote', voteId: vote.id, screen: `/votes/${vote.id}` },
        channelId: 'votes',
        priority: 'default',
      });
    }
  } catch (error) {
    logger.warn('vote-created notifications failed (non-fatal)', { error });
  }
}

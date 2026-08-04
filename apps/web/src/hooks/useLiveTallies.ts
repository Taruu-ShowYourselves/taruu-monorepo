'use client';

/**
 * Live vote tallies over Supabase Realtime.
 *
 * Subscribes to vote_options row changes (the tables are in the
 * supabase_realtime publication; RLS limits events to active votes) and
 * merges them over the server-rendered snapshot - so tallies tick live
 * without polling and without the Cloudflare worker holding sockets.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface LiveTally {
  optionId: string;
  votes: number;
}

/** optionId → latest ballot count, starting from the given snapshot. */
export function useLiveTallies(
  voteIds: string[],
  initial: LiveTally[] = []
): Map<string, number> {
  const [tallies, setTallies] = useState<Map<string, number>>(
    () => new Map(initial.map((t) => [t.optionId, t.votes]))
  );

  // Stable key so the effect re-subscribes only when the vote set changes.
  const votesKey = [...voteIds].sort().join(',');

  useEffect(() => {
    if (!votesKey) return;
    const ids = votesKey.split(',');

    const channel = supabase
      .channel(`tallies:${votesKey.slice(0, 60)}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vote_options',
          filter: `vote_id=in.(${ids.join(',')})`,
        },
        (payload) => {
          const row = payload.new as { id?: string; votes?: number };
          if (!row.id || typeof row.votes !== 'number') return;
          setTallies((prev) => {
            const next = new Map(prev);
            next.set(row.id as string, row.votes as number);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [votesKey]);

  return tallies;
}

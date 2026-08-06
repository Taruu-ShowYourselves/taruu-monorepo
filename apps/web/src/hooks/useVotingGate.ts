'use client';

import { useEffect, useState } from 'react';
import type { VotingGate } from '@sync/shared';

/** The gate plus the residency facts behind it (`GET /api/user/voting-gate`). */
export interface VoterGateStatus extends VotingGate {
  readonly residencyVerified: boolean;
  readonly checkInsCompleted: number;
}

/**
 * The signed-in reader's voting gate, as the server scores it.
 *
 * `null` while it loads and for guests — never a guessed verdict. Callers must
 * treat null as "say nothing yet": a screen that assumes "not eligible" until
 * the fetch lands would flash a warning at residents who are perfectly
 * eligible, which is the failure this hook exists to avoid.
 */
export function useVotingGate(enabled: boolean): VoterGateStatus | null {
  const [gate, setGate] = useState<VoterGateStatus | null>(null);

  useEffect(() => {
    if (!enabled) {
      setGate(null);
      return;
    }

    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/user/voting-gate', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as VoterGateStatus;
        if (live) setGate(data);
      } catch {
        /* The gate is advisory copy; a failed read simply prints nothing. */
      }
    })();

    return () => {
      live = false;
    };
  }, [enabled]);

  return gate;
}

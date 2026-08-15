'use client';

/**
 * The two non-happy paths of Surface 4, and the only client code on it.
 *
 * The statistics surface itself is entirely server-rendered - that is how it
 * ends up with no click handler anywhere near a figure. These two panels need
 * a client boundary for a different reason: the refused branch's escalation
 * CTA has to open a dialog, and `ErrorPanel`'s retry has to refresh the route.
 *
 * The refused branch is `EscalationDialog` rather than a hand-wired
 * `NoPermissionPanel` + `ConfirmDialog` pair. That component renders the panel
 * itself under `trigger="no-permission"` and owns the whole escalation path -
 * endpoint, the two distinct failure sentences, and the acknowledgement. This
 * file used to hold one of three copies of that dialog; deferred items 9 and
 * 11 assign the fold-in to 05-15.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { ErrorPanel } from '@/components/space-admin';
import { EscalationDialog } from '@/components/space-admin/EscalationDialog';

export interface StatsFallbackProps {
  kind: 'denied' | 'error';
  spaceId: string;
}

export function StatsFallback({ kind, spaceId }: StatsFallbackProps) {
  const router = useRouter();

  if (kind === 'denied') {
    return <EscalationDialog spaceId={spaceId} trigger="no-permission" />;
  }

  return <ErrorPanel onRetry={() => router.refresh()} />;
}

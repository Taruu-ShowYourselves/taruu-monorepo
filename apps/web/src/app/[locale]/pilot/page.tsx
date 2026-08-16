import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PilotArrivalClient } from '@/components/pilot/PilotArrivalClient';

export const metadata: Metadata = {
  title: 'פיילוט הרשויות',
  robots: { index: false, follow: false },
};

export default function PilotPage() {
  // The arrival page reads ?muni= to preselect the municipality a tracked link
  // pointed at, and useSearchParams() opts the subtree out of prerendering.
  // Without a boundary here that bail-out reaches the page itself and the
  // production build fails outright rather than degrading.
  return (
    <Suspense fallback={null}>
      <PilotArrivalClient />
    </Suspense>
  );
}

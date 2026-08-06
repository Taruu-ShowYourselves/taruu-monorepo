import type { Metadata } from 'next';
import { PilotArrivalClient } from '@/components/pilot/PilotArrivalClient';

export const metadata: Metadata = {
  title: 'פיילוט הרשויות',
  robots: { index: false, follow: false },
};

export default function PilotPage() {
  return <PilotArrivalClient />;
}

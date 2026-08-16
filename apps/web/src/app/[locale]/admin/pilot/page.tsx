import type { Metadata } from 'next'; import { PilotControlDesk } from '@/components/pilot/PilotControlDesk';
export const metadata: Metadata={title:'ניהול פיילוט',robots:{index:false,follow:false}}; export default function PilotAdminPage(){return <PilotControlDesk/>;}

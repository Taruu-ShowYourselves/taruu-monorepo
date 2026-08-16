export { useReducedMotion, getMotionProps } from './useReducedMotion';
export { useLockPageScroll } from './useLockPageScroll';
export { useParallaxBackdrop } from './useParallaxBackdrop';
export type { ParallaxDepths } from './useParallaxBackdrop';
// useLiveTallies is deliberately NOT re-exported here. Its module pulls in
// @/lib/supabase/client, whose module-scope side effects drag all of
// @supabase/supabase-js (~61KB gz) into every consumer of this barrel - which
// includes the homepage components. Import it directly from
// '@/hooks/useLiveTallies' instead.
export type { LiveTally } from './useLiveTallies';
export { useVotingGate } from './useVotingGate';
export type { VoterGateStatus } from './useVotingGate';

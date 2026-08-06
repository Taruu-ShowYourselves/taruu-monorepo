export interface PilotGateDecision {
  allowed: boolean;
  code?: 'PILOT_MUNICIPALITY_ONLY';
}

/** Pure gate: only an active pilot municipality receives the extra rule. */
export function decidePilotGate(
  voteMunicipality: string,
  activePilotMunicipalities: ReadonlySet<string>,
  viewerMunicipality: string | null | undefined
): PilotGateDecision {
  if (!activePilotMunicipalities.has(voteMunicipality)) return { allowed: true };
  if (viewerMunicipality === voteMunicipality) return { allowed: true };
  return { allowed: false, code: 'PILOT_MUNICIPALITY_ONLY' };
}

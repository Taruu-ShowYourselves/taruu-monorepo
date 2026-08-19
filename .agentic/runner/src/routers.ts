/**
 * Pure routers (§5.2): every branch decision is a function of
 * (state, visit counts) — unit-testable without running an agent.
 */
import { config } from "./config.ts";
import { plateaued, type LaneState } from "./state.ts";
import type { RouterFn } from "./graph.ts";

const b = () => config().budgets;

export const afterResearch: RouterFn<LaneState> = (s) =>
  s.phase === "parked" ? null : "spec";

export const afterSpec: RouterFn<LaneState> = () => "spec-gate";

/**
 * Gate nodes are non-blocking: undecided → walk ends, autopilot re-ticks later.
 * Approval also ENDS the walk (phase is already "implement"): waiting lanes
 * don't hold working slots, so several may be approved at once — the next
 * tick schedules them under the working-lane cap instead of bursting here.
 */
export const afterSpecGate: RouterFn<LaneState> = (s) => {
  if (s.specApproved && s.phase === "implement") return null;
  if (s.phase === "parked") return null;
  const wrongState = s.defects.some((d) => d.source === "spec-gate" && d.status === "open" && /wrong-state/.test(d.summary));
  if (s.defects.some((d) => d.source === "spec-gate" && d.status === "open")) {
    return s.specLaps >= b().specLapsMax ? null : wrongState ? "research" : "spec";
  }
  return null; // still waiting on the human
};

export const afterImplement: RouterFn<LaneState> = () => "verify";

export const afterVerify: RouterFn<LaneState> = () => "review";

export const afterReview: RouterFn<LaneState> = (s) => {
  const open = s.defects.filter((d) => d.status === "open").length;
  if (open === 0) return "pr"; // clean (§4.2: only named defects may trigger a lap)
  if (s.implLaps >= b().implLapsMax) return "pr"; // budget → publish best lap (§4.4)
  if (plateaued(s.laps)) return "pr"; // plateau stop (§4.3)
  return "implement";
};

export const afterPr: RouterFn<LaneState> = () => "pr-gate";

export const afterPrGate: RouterFn<LaneState> = (s) => {
  if (s.phase === "merge-learn") return "merge-learn";
  // Change-request → implement happens NEXT tick under the working-lane cap
  // (the node already set phase = "implement"); ending here prevents a burst
  // of simultaneous coding lanes when several reviews land together.
  return null;
};

export const routers = {
  research: afterResearch,
  spec: afterSpec,
  "spec-gate": afterSpecGate,
  implement: afterImplement,
  verify: afterVerify,
  review: afterReview,
  pr: afterPr,
  "pr-gate": afterPrGate,
  // merge-learn has no router: the walk ends, the lane frees.
} as const;

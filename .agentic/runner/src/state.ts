/**
 * Durable lane state — the ONLY memory between graph steps, laps, and
 * process restarts (§2.1: context is assembled fresh from durable state;
 * the transcript is never the memory).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type Phase =
  | "research"
  | "spec"
  | "spec-gate"
  | "implement"
  | "verify"
  | "review"
  | "pr"
  | "pr-gate"
  | "merge-learn"
  | "parked"
  | "done";

export type ExitReason =
  | "clean"
  | "plateau"
  | "budget_spent"
  | "human_changes"
  | "scope_too_big"
  | "gate_timeout"
  | "parked"
  | null;

export interface Defect {
  readonly id: string; // D-1, D-2 … structural identity across laps (§4.5)
  readonly source: "review" | "verify" | "human" | "spec-gate";
  readonly file: string | null;
  readonly summary: string;
  readonly status: "open" | "fixed" | "rejected";
}

export interface GateResult {
  readonly id: string; // G-1 …
  readonly description: string;
  readonly status: "pending" | "pass" | "fail";
  readonly evidence: string | null; // committed screenshot / log path
}

export interface LapSnapshot {
  readonly lap: number;
  readonly defectCount: number;
  readonly gatesFailed: number;
  readonly commit: string | null;
  readonly compactions: number;
}

export interface UsageEvent {
  readonly seat: string;
  readonly model: string;
  readonly node: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number | null;
  readonly at: string;
}

export interface LaneState {
  readonly issue: number;
  readonly repo: string;
  readonly slug: string;
  readonly branch: string;
  readonly worktree: string;
  phase: Phase;
  prNumber: number | null;
  specVersion: number;
  specApproved: boolean;
  specLaps: number;
  implLaps: number;
  changeRequestResets: number;
  lastSeenCommentId: number;
  gateWaitingSince: string | null;
  pathClaims: string[];
  defects: Defect[];
  gates: GateResult[];
  laps: LapSnapshot[];
  usage: UsageEvent[];
  emailsSent: string[]; // event keys → idempotent notify
  exitReason: ExitReason;
}

const LANES_DIR = join(process.cwd(), ".agentic", "lanes");

export function lanePath(issue: number): string {
  return join(LANES_DIR, `${issue}.json`);
}

export function loadLane(issue: number): LaneState | null {
  const p = lanePath(issue);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as LaneState;
}

export function saveLane(state: LaneState): void {
  mkdirSync(LANES_DIR, { recursive: true });
  writeFileSync(lanePath(state.issue), JSON.stringify(state, null, 2));
}

export function listLanes(): LaneState[] {
  if (!existsSync(LANES_DIR)) return [];
  return readdirSync(LANES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(LANES_DIR, f), "utf8")) as LaneState);
}

export function activeLanes(): LaneState[] {
  return listLanes().filter((l) => l.phase !== "done" && l.phase !== "parked");
}

export function newLane(issue: number, repo: string, slug: string, worktree: string): LaneState {
  return {
    issue,
    repo,
    slug,
    branch: `agent/${issue}-${slug}`,
    worktree,
    phase: "research",
    prNumber: null,
    specVersion: 0,
    specApproved: false,
    specLaps: 0,
    implLaps: 0,
    changeRequestResets: 0,
    lastSeenCommentId: 0,
    gateWaitingSince: null,
    pathClaims: [],
    defects: [],
    gates: [],
    laps: [],
    usage: [],
    emailsSent: [],
    exitReason: null,
  };
}

/** Best-lap selection (§4.4): min defects, tie-break fewer failed gates. */
export function bestLap(laps: readonly LapSnapshot[]): LapSnapshot | null {
  if (laps.length === 0) return null;
  return (
    [...laps].sort(
      (a, b) => a.defectCount - b.defectCount || a.gatesFailed - b.gatesFailed,
    )[0] ?? null
  );
}

/** Plateau rule (§4.3): a lap that didn't improve forfeits the budget. */
export function plateaued(laps: readonly LapSnapshot[]): boolean {
  if (laps.length < 2) return false;
  const prev = laps[laps.length - 2];
  const last = laps[laps.length - 1];
  if (!prev || !last) return false;
  return last.defectCount >= prev.defectCount;
}

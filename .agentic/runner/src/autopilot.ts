/**
 * Outer loop (§4.7): admit board items into free lanes, tick each active
 * lane one graph-walk. Gates are non-blocking, so a tick is cheap when
 * everything is waiting on a human.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.ts";
import { runGraph, type NodeFn } from "./graph.ts";
import { nodes } from "./nodes.ts";
import { routers } from "./routers.ts";
import { syncBoard, humansOnlyIssues, resetItem } from "./board.ts";
import { activeLanes, loadLane, newLane, saveLane, type LaneState } from "./state.ts";

const exec = promisify(execFile);
const PRIORITY_ORDER = ["M0", "P0", "P1", "P2", "P3", "M4"];

interface BoardItem {
  readonly issue: number;
  readonly title: string;
  readonly priority: string;
  readonly status: string;
  readonly assignees: readonly string[];
}

export async function boardCandidates(): Promise<BoardItem[]> {
  const c = config();
  const query = `query{ organization(login:"${c.board.owner}"){ projectV2(number:${c.board.projectNumber}){ items(first:100){ nodes{ content{...on Issue{number title state repository{nameWithOwner} assignees(first:5){nodes{login}}}} status:fieldValueByName(name:"Status"){...on ProjectV2ItemFieldSingleSelectValue{name}} prio:fieldValueByName(name:"Priority"){...on ProjectV2ItemFieldSingleSelectValue{name}} humansOnly:fieldValueByName(name:"Humans Only"){...on ProjectV2ItemFieldSingleSelectValue{name}} } } } } }`;
  const { stdout } = await exec("gh", ["api", "graphql", "-f", `query=${query}`], { maxBuffer: 16e6 });
  const parsed = JSON.parse(stdout) as {
    data: { organization: { projectV2: { items: { nodes: {
      content: {
        number?: number; title?: string; state?: string;
        repository?: { nameWithOwner: string };
        assignees?: { nodes: { login: string }[] };
      } | null;
      status: { name?: string } | null;
      prio: { name?: string } | null;
      humansOnly: { name?: string } | null;
    }[] } } } };
  };
  return parsed.data.organization.projectV2.items.nodes
    .filter((n) =>
      n.content?.state === "OPEN" &&
      n.content.repository?.nameWithOwner === c.repo &&
      n.status?.name !== "Done" &&
      // "Humans Only" set to ANY value = agents keep their hands off entirely.
      !n.humansOnly?.name)
    .map((n) => ({
      issue: n.content!.number!,
      title: n.content!.title ?? "",
      priority: n.prio?.name ?? "P3",
      status: n.status?.name ?? "Todo",
      assignees: (n.content!.assignees?.nodes ?? []).map((a) => a.login),
    }))
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
}

/** ASCII slug from an issue title; Hebrew-only titles fall back to issue-<n>. */
export function slugify(title: string, issue: number): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return s.length >= 3 ? s : `issue-${issue}`;
}

/**
 * Keep the fleet fed (§4.7): whenever a lane frees, admit the highest-priority
 * eligible board item. Eligible = configured status + assignee, no existing
 * lane file (parked/done lanes are a human's decision to resume, never
 * auto-reopened — the conservative contract).
 */
export async function autoAdmit(): Promise<LaneState[]> {
  const aa = config().autoAdmit;
  if (!aa?.enabled) return [];
  const admitted: LaneState[] = [];
  // Gate-waiting lanes hold no working slot — the fleet keeps starting new
  // work while specs/PRs sit on a human. maxTotal bounds the pile of open
  // gate-waiting lanes so approvals can't queue up without limit.
  const maxTotal = config().lanes.maxTotal ?? config().lanes.max * 3;
  let free = Math.min(
    config().lanes.max - workingLanes().length,
    maxTotal - activeLanes().length,
  );
  if (free <= 0) return admitted;
  const candidates = await boardCandidates();
  for (const item of candidates) {
    if (free <= 0) break;
    if (aa.onlyStatus && !aa.onlyStatus.includes(item.status)) continue;
    if (aa.onlyAssignee && !item.assignees.includes(aa.onlyAssignee)) continue;
    if (loadLane(item.issue) !== null) continue; // includes parked + done — human's call
    const lane = await admit(item.issue, slugify(item.title, item.issue));
    console.log(`[auto-admit] lane #${lane.issue} ${lane.slug} (${item.priority})`);
    admitted.push(lane);
    free -= 1;
  }
  return admitted;
}

function claimsOverlap(a: readonly string[], b: readonly string[]): boolean {
  return a.some((x) => b.some((y) => x.startsWith(y) || y.startsWith(x)));
}

export async function admit(issue: number, slug: string): Promise<LaneState> {
  const existing = loadLane(issue);
  if (existing) {
    if (existing.phase === "parked") {
      existing.phase = existing.specApproved ? "implement" : (existing.prNumber ? "spec-gate" : "research");
      existing.exitReason = null;
      existing.gateWaitingSince = new Date().toISOString();
      saveLane(existing);
      return existing;
    }
    return existing;
  }
  const lanes = activeLanes();
  const maxTotal = config().lanes.maxTotal ?? config().lanes.max * 3;
  if (lanes.length >= maxTotal) {
    throw new Error(`total lane limit ${maxTotal} reached (${lanes.map((l) => `#${l.issue}`).join(", ")})`);
  }
  const wtBase = join(process.cwd(), ".agentic", "worktrees");
  mkdirSync(wtBase, { recursive: true });
  const worktree = join(wtBase, String(issue));
  const branch = `agent/${issue}-${slug}`;
  if (!existsSync(worktree)) {
    await exec("git", ["fetch", "origin", "main"]);
    await exec("git", ["worktree", "add", worktree, "-b", branch, "origin/main"]);
  }
  const lane = newLane(issue, config().repo, slug, worktree);
  saveLane(lane);
  return lane;
}

/**
 * Nodes wrapped with a board sync at entry: lane.phase equals the node name
 * when the router lands on it, so the project board shows the live stage
 * (Research / Coding / Verification …) while the node runs, not after.
 */
const boardNodes = Object.fromEntries(
  Object.entries(nodes).map(([name, fn]) => [
    name,
    (async (lane, visit) => {
      await syncBoard(lane);
      return fn(lane, visit);
    }) satisfies NodeFn<LaneState>,
  ]),
) as typeof nodes;

/**
 * One lane's full walk until a gate/park/end, then persist + mirror.
 * Never throws: a seat failure in one lane must not reject the tick's
 * Promise.all and leave the sibling lane running detached (which the next
 * tick would then double-start). The lane just retries next tick.
 */
async function walkLane(lane: LaneState): Promise<void> {
  try {
    const result = await runGraph(
      { nodes: boardNodes, routers },
      lane,
      { start: lane.phase === "done" ? "merge-learn" : lane.phase, recursionLimit: 25 },
    );
    saveLane(result.state);
    // Terminal phases (done/parked/gate-waits) are set INSIDE nodes, after the
    // entry sync — mirror the walk's final state so the board never lags.
    await syncBoard(result.state);
    logMetrics(result.state);
    if (!result.ok) console.error(`[lane #${lane.issue}] ${result.error}`);
  } catch (e) {
    saveLane(lane);
    console.error(`[lane #${lane.issue}] walk failed: ${(e as Error).message}`);
  }
}

/**
 * One pass over all active lanes — lanes walk CONCURRENTLY (the whole point
 * of two lanes: two PRs in flight at once). Safe because every lane owns its
 * worktree, branch, lane file, and metrics file; the only shared surface is
 * the board/gh API, which is per-item. Path-claim exclusion runs first and
 * is what makes the concurrency conservative: colliding lanes never run
 * together — the later one parks for human re-ordering.
 */
/** Phases where a lane sits on a human, holding no working slot. */
const WAITING_PHASES = new Set<string>(["spec-gate", "pr-gate"]);

export function workingLanes(): LaneState[] {
  return activeLanes().filter((l) => !WAITING_PHASES.has(l.phase));
}

export async function tick(): Promise<void> {
  // Humans Only is re-checked EVERY tick, not only at admission: marking an
  // item mid-flight stops its lane at the next tick boundary — the lane
  // parks, and the board hands back to the human (Status → Todo, agent
  // fields cleared).
  const handsOff = await humansOnlyIssues();
  const runnable: LaneState[] = [];
  for (const lane of activeLanes()) {
    if (handsOff.has(lane.issue)) {
      lane.phase = "parked";
      lane.exitReason = "parked";
      saveLane(lane);
      await resetItem(lane.issue);
      console.log(`[lane #${lane.issue}] stopped — item marked Humans Only`);
      continue;
    }
    if (lane.pathClaims.length > 0 &&
        runnable.some((o) => claimsOverlap(lane.pathClaims, o.pathClaims))) {
      lane.phase = "parked";
      lane.exitReason = "parked";
      saveLane(lane);
      await syncBoard(lane);
      continue;
    }
    runnable.push(lane);
  }
  // Gate-waiting lanes always walk (a walk there is a cheap comment poll and
  // never runs a seat). Working lanes are capped at lanes.max — approvals
  // landing together queue for a slot instead of bursting the coder seat.
  const waiters = runnable.filter((l) => WAITING_PHASES.has(l.phase));
  const workers = runnable.filter((l) => !WAITING_PHASES.has(l.phase));
  const scheduled = workers.slice(0, config().lanes.max);
  for (const lane of workers.slice(config().lanes.max)) {
    console.log(`[lane #${lane.issue}] deferred — working-lane cap ${config().lanes.max}`);
  }
  await Promise.all([...waiters, ...scheduled].map(walkLane));
  // Keep the fleet fed: newly admitted lanes start their walk on this same tick.
  const admitted = await autoAdmit();
  await Promise.all(admitted.map(walkLane));
}

function logMetrics(lane: LaneState): void {
  const dir = join(process.cwd(), ".agentic", "metrics");
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, `${lane.issue}.jsonl`), JSON.stringify({
    at: new Date().toISOString(),
    phase: lane.phase,
    specVersion: lane.specVersion,
    implLaps: lane.implLaps,
    defectsOpen: lane.defects.filter((d) => d.status === "open").length,
    defectTrajectory: lane.laps.map((l) => l.defectCount),
    compactions: lane.laps.reduce((n, l) => n + l.compactions, 0),
    exitReason: lane.exitReason,
    usdSpent: lane.usage.reduce((n, u) => n + (u.costUsd ?? 0), 0),
    tokens: lane.usage.reduce((n, u) => n + u.inputTokens + u.outputTokens, 0),
  }) + "\n");
}

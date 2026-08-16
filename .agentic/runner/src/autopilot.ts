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
import { syncBoard } from "./board.ts";
import { activeLanes, loadLane, newLane, saveLane, type LaneState } from "./state.ts";

const exec = promisify(execFile);
const PRIORITY_ORDER = ["M0", "P0", "P1", "P2", "P3", "M4"];

interface BoardItem {
  readonly issue: number;
  readonly title: string;
  readonly priority: string;
  readonly status: string;
}

export async function boardCandidates(): Promise<BoardItem[]> {
  const c = config();
  const query = `query{ organization(login:"${c.board.owner}"){ projectV2(number:${c.board.projectNumber}){ items(first:100){ nodes{ content{...on Issue{number title state repository{nameWithOwner}}} status:fieldValueByName(name:"Status"){...on ProjectV2ItemFieldSingleSelectValue{name}} prio:fieldValueByName(name:"Priority"){...on ProjectV2ItemFieldSingleSelectValue{name}} } } } } }`;
  const { stdout } = await exec("gh", ["api", "graphql", "-f", `query=${query}`], { maxBuffer: 16e6 });
  const parsed = JSON.parse(stdout) as {
    data: { organization: { projectV2: { items: { nodes: {
      content: { number?: number; title?: string; state?: string; repository?: { nameWithOwner: string } } | null;
      status: { name?: string } | null;
      prio: { name?: string } | null;
    }[] } } } };
  };
  return parsed.data.organization.projectV2.items.nodes
    .filter((n) =>
      n.content?.state === "OPEN" &&
      n.content.repository?.nameWithOwner === c.repo &&
      n.status?.name !== "Done")
    .map((n) => ({
      issue: n.content!.number!,
      title: n.content!.title ?? "",
      priority: n.prio?.name ?? "P3",
      status: n.status?.name ?? "Todo",
    }))
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
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
  if (lanes.length >= config().lanes.max) {
    throw new Error(`WIP limit ${config().lanes.max} reached (${lanes.map((l) => `#${l.issue}`).join(", ")})`);
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

/** One pass over all active lanes; each walks until a gate/park/end. */
export async function tick(): Promise<void> {
  for (const lane of activeLanes()) {
    // Path-claim exclusion is validated post-spec: a lane whose claims collide
    // with another active lane parks for human re-ordering.
    const others = activeLanes().filter((l) => l.issue !== lane.issue);
    if (lane.pathClaims.length > 0 &&
        others.some((o) => claimsOverlap(lane.pathClaims, o.pathClaims))) {
      lane.phase = "parked";
      lane.exitReason = "parked";
      saveLane(lane);
      await syncBoard(lane);
      continue;
    }
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
  }
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

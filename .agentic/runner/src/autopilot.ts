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
import { runGraph } from "./graph.ts";
import { nodes } from "./nodes.ts";
import { routers } from "./routers.ts";
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
  const query = `query{ organization(login:"${c.board.owner}"){ projectV2(number:${c.board.projectNumber}){ items(first:100){ nodes{ content{...on Issue{number title state repository{nameWithOwner} assignees(first:5){nodes{login}}}} status:fieldValueByName(name:"Status"){...on ProjectV2ItemFieldSingleSelectValue{name}} prio:fieldValueByName(name:"Priority"){...on ProjectV2ItemFieldSingleSelectValue{name}} } } } } }`;
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
  let free = config().lanes.max - activeLanes().length;
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
      continue;
    }
    const result = await runGraph(
      { nodes, routers },
      lane,
      { start: lane.phase === "done" ? "merge-learn" : lane.phase, recursionLimit: 25 },
    );
    saveLane(result.state);
    logMetrics(result.state);
    if (!result.ok) console.error(`[lane #${lane.issue}] ${result.error}`);
  }
  // Keep the fleet fed: newly admitted lanes start their walk on this same tick.
  for (const lane of await autoAdmit()) {
    const result = await runGraph({ nodes, routers }, lane, {
      start: lane.phase,
      recursionLimit: 25,
    });
    saveLane(result.state);
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

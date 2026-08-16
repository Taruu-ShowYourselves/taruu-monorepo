/**
 * Memory write path (§2.2): facts enter memory ONLY from merged PRs — the
 * merge is the verification event. Extraction runs the parser seat over the
 * merged diff; candidate facts land on a rolling `agent/memory-updates`
 * branch as a draft PR, so a HUMAN merge is what makes a fact readable
 * (memoryFor reads the daemon's main checkout, which only advances on merge).
 *
 * Bounded by config.memoryLimits.factsPerArea: files keep the most recent
 * facts; the oldest fall off. Agents never push main.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.ts";
import { runSeat } from "./seats.ts";
import { readPrompt, readIfExists } from "./context.ts";
import * as gh from "./github.ts";
import type { LaneState } from "./state.ts";

const exec = promisify(execFile);
const MAX_BUF = 32 * 1024 * 1024;
const MEMORY_BRANCH = "agent/memory-updates";
const DIFF_CHAR_CAP = 60_000;

const memWorktree = () => join(process.cwd(), ".agentic", "worktrees", "_memory");

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd, maxBuffer: MAX_BUF });
  return stdout;
}

/**
 * Ensure the rolling memory worktree exists and is current: reuse the remote
 * branch when a memory PR is still open (unmerged facts pile up there),
 * otherwise restart from origin/main.
 */
async function ensureMemoryWorktree(): Promise<string> {
  const cwd = process.cwd();
  const wt = memWorktree();
  await git(cwd, ["fetch", "origin", "main", MEMORY_BRANCH]).catch(() =>
    git(cwd, ["fetch", "origin", "main"]),
  );
  const remoteExists = await git(cwd, ["ls-remote", "--heads", "origin", MEMORY_BRANCH])
    .then((o) => o.trim().length > 0)
    .catch(() => false);
  if (!existsSync(wt)) {
    if (remoteExists) {
      await git(cwd, ["worktree", "add", wt, "-B", MEMORY_BRANCH, `origin/${MEMORY_BRANCH}`]);
    } else {
      await git(cwd, ["worktree", "add", wt, "-B", MEMORY_BRANCH, "origin/main"]);
    }
  } else if (remoteExists) {
    await git(wt, ["pull", "--ff-only", "origin", MEMORY_BRANCH]).catch(() => {});
  }
  // Fold in facts merged to main since the branch forked (append-only files —
  // conflicts are rare; on conflict we keep going with the branch state).
  await git(wt, ["merge", "--no-edit", "origin/main"]).catch(() =>
    git(wt, ["merge", "--abort"]).catch(() => {}),
  );
  return wt;
}

/** Append facts to an area file, enforcing the most-recent-N bound. */
function appendFacts(wt: string, area: string, facts: readonly string[]): number {
  const cap = config().memoryLimits.factsPerArea;
  const p = join(wt, ".agentic", "memory", `${area}.md`);
  const existing = existsSync(p) ? readFileSync(p, "utf8") : `# ${area} — verified facts (merged PRs only)\n`;
  const head = existing.split("\n").filter((l) => !l.startsWith("- "));
  let bullets = existing.split("\n").filter((l) => l.startsWith("- "));
  const fresh = facts
    .map((f) => `- ${f}`)
    .filter((b) => !bullets.some((e) => e.trim() === b.trim()));
  bullets = [...bullets, ...fresh].slice(-cap);
  writeFileSync(p, [...head.filter((l) => l.trim()), ...bullets, ""].join("\n"));
  return fresh.length;
}

/**
 * Extract verified facts from a lane's MERGED PR and stage them on the
 * memory branch + draft PR. Returns the number of new facts staged.
 * Throws if the PR is not merged — merge is the only verification event.
 */
export async function learnFromMergedPr(lane: LaneState): Promise<number> {
  if (lane.prNumber === null) throw new Error(`lane #${lane.issue} has no PR`);
  if (!(await gh.isMerged(lane.prNumber))) {
    throw new Error(`PR #${lane.prNumber} is not merged — facts only enter memory from merged PRs`);
  }
  const areas = config().memoryAreas;
  const diff = (await gh.prDiff(lane.prNumber)).slice(0, DIFF_CHAR_CAP);
  const existingFacts = areas
    .map((a) => `## ${a}\n${readIfExists(join(process.cwd(), ".agentic", "memory", `${a}.md`))}`)
    .join("\n");
  const prompt = [
    readPrompt("parser"),
    `Task: extract DURABLE, VERIFIED facts from this merged PR that future agents working in this repo must know: invariants, gotchas, security constraints, "never do X" rules. NOT a changelog — only facts that change how future work must be done.`,
    `Areas (use EXACTLY one of): ${areas.join(", ")}`,
    `Contract: one fact per line, \`<area> | <one-sentence fact>\`. At most 3 lines. Reply \`NONE\` if nothing durable was learned. Do not repeat existing facts.`,
    `## Existing facts (do not repeat)\n${existingFacts.slice(0, 8_000)}`,
    `## Merged diff (PR #${lane.prNumber}, issue #${lane.issue})\n\`\`\`diff\n${diff}\n\`\`\``,
  ].join("\n\n---\n\n");
  const r = await runSeat(config().models.parser, "learn", prompt, {
    cwd: process.cwd(),
    write: false,
  });
  lane.usage.push(r.usage);

  const byArea = new Map<string, string[]>();
  for (const m of r.text.matchAll(/^([a-z-]+)\s*\|\s*(.+)$/gm)) {
    const area = (m[1] ?? "").trim();
    const fact = (m[2] ?? "").trim();
    if (!areas.includes(area) || !fact) continue;
    const tagged = fact.includes(`PR #${lane.prNumber}`) ? fact : `${fact} (PR #${lane.prNumber})`;
    byArea.set(area, [...(byArea.get(area) ?? []), tagged]);
  }
  if (byArea.size === 0) return 0;

  const wt = await ensureMemoryWorktree();
  let staged = 0;
  for (const [area, facts] of byArea) staged += appendFacts(wt, area, facts);
  if (staged === 0) return 0;

  await git(wt, ["add", ".agentic/memory"]);
  await git(wt, ["commit", "-m", `memory(#${lane.issue}): ${staged} fact(s) from merged PR #${lane.prNumber}`]);
  await git(wt, ["push", "-u", "origin", MEMORY_BRANCH]);
  try {
    await gh.createDraftPr(
      MEMORY_BRANCH,
      "[autopilot] memory: verified facts from merged PRs",
      "Rolling memory-update PR. Each commit stages facts extracted from one merged PR; merging this makes them readable to every lane on every host (§2.2 — merge is the verification event).",
    );
  } catch {
    /* PR already open for this branch — the push updated it */
  }
  return staged;
}

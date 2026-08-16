/** gh CLI wrappers — the runner's only GitHub surface. Session auth (§3). */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.ts";

const exec = promisify(execFile);
const MAX_BUF = 16 * 1024 * 1024;

async function gh(args: string[]): Promise<string> {
  const { stdout } = await exec("gh", args, { maxBuffer: MAX_BUF });
  return stdout;
}

export interface AgentComment {
  readonly id: number;
  readonly body: string;
  readonly author: string;
  readonly createdAt: string;
}

export async function createDraftPr(
  branch: string,
  title: string,
  body: string,
): Promise<number> {
  const out = await gh([
    "pr", "create", "-R", config().repo,
    "--head", branch, "--draft",
    "--title", title, "--body", body,
  ]);
  const m = out.match(/\/pull\/(\d+)/);
  if (!m) throw new Error(`could not parse PR number from: ${out}`);
  return Number(m[1]);
}

export async function comment(pr: number, body: string): Promise<void> {
  await gh(["pr", "comment", String(pr), "-R", config().repo, "--body", body]);
}

export async function markReady(pr: number): Promise<void> {
  await gh(["pr", "ready", String(pr), "-R", config().repo]);
}

export async function updateBody(pr: number, body: string): Promise<void> {
  await gh(["pr", "edit", String(pr), "-R", config().repo, "--body", body]);
}

/** Comments authored by a human starting with `agent:`, newer than sinceId. */
export async function agentComments(pr: number, sinceId: number): Promise<AgentComment[]> {
  const out = await gh([
    "pr", "view", String(pr), "-R", config().repo,
    "--json", "comments",
  ]);
  const parsed = JSON.parse(out) as {
    comments: { id?: number; databaseId?: number; body: string; author: { login: string }; createdAt: string }[];
  };
  return parsed.comments
    .map((c) => ({
      id: c.databaseId ?? c.id ?? 0,
      body: c.body.trim(),
      author: c.author.login,
      createdAt: c.createdAt,
    }))
    .filter((c) => c.id > sinceId && /^agent:/i.test(c.body));
}

export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | "";

export async function reviewDecision(pr: number): Promise<ReviewDecision> {
  const out = await gh(["pr", "view", String(pr), "-R", config().repo, "--json", "reviewDecision"]);
  return (JSON.parse(out) as { reviewDecision: ReviewDecision }).reviewDecision;
}

export async function isMerged(pr: number): Promise<boolean> {
  const out = await gh(["pr", "view", String(pr), "-R", config().repo, "--json", "state"]);
  return (JSON.parse(out) as { state: string }).state === "MERGED";
}

export async function prDiff(pr: number): Promise<string> {
  return gh(["pr", "diff", String(pr), "-R", config().repo]);
}

export async function issueView(issue: number): Promise<{ title: string; body: string }> {
  const out = await gh([
    "issue", "view", String(issue), "-R", config().repo,
    "--json", "title,body",
  ]);
  return JSON.parse(out) as { title: string; body: string };
}

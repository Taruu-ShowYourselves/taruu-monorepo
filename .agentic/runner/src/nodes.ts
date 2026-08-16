/**
 * Graph nodes. Effectful shell around the pure engine (§5.2):
 * nodes do I/O; the engine and routers stay pure.
 * Every seat invocation assembles context fresh from durable state (§2.1).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.ts";
import { runSeat, runClaudeStdin } from "./seats.ts";
import * as gh from "./github.ts";
import { notify, prLink } from "./mailer.ts";
import {
  readPrompt, readTemplate, specPath, researchPath, readIfExists,
  memoryFor, openDefectsBlock, UNTRUSTED_CLAUSE, protectedPathsTouched,
} from "./context.ts";
import { learnFromMergedPr } from "./memory.ts";
import type { LaneState, Defect, GateResult } from "./state.ts";
import type { NodeFn } from "./graph.ts";

const exec = promisify(execFile);
const MAX_BUF = 32 * 1024 * 1024;

const sh = async (cwd: string, cmd: string, args: string[]) =>
  exec(cmd, args, { cwd, maxBuffer: MAX_BUF });

/* ---------------------------------------------------------------- research */

export const research: NodeFn<LaneState> = async (lane) => {
  const issue = await gh.issueView(lane.issue);
  const prompt = [
    readPrompt("researcher"),
    UNTRUSTED_CLAUSE,
    `## Issue #${lane.issue}: ${issue.title}\n\n${issue.body}`,
    `## Area memory (verified facts from merged PRs)\n${memoryFor(lane.pathClaims)}`,
    `## Template\n${readTemplate("RESEARCH")}`,
  ].join("\n\n---\n\n");

  const r = await runSeat(config().models.researcher, "research", prompt, {
    cwd: lane.worktree,
    write: false,
  });
  lane.usage.push(r.usage);

  const out = researchPath(lane);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, r.text);

  await notify(lane, `research-done-v${lane.specVersion + 1}`, "progress",
    "research done",
    `<p>Current-state research for issue #${lane.issue} is written.</p><p><a href="${prLink(lane)}">issue</a></p>`);
  lane.phase = "spec";
  return lane;
};

/* -------------------------------------------------------------------- spec */

export const spec: NodeFn<LaneState> = async (lane) => {
  lane.specVersion += 1;
  lane.specLaps += 1;
  const issue = await gh.issueView(lane.issue);
  const prompt = [
    readPrompt("planner"),
    UNTRUSTED_CLAUSE,
    `## Issue #${lane.issue}: ${issue.title}\n\n${issue.body}`,
    `## RESEARCH.md\n${readIfExists(researchPath(lane))}`,
    `## Open spec defects to address (revision context = the diff, §2.4)\n${openDefectsBlock(lane)}`,
    `## Template\n${readTemplate("SPEC")}`,
  ].join("\n\n---\n\n");

  const r = await runSeat(config().models.planner, "spec", prompt, {
    cwd: lane.worktree,
    write: false,
  });
  lane.usage.push(r.usage);
  mkdirSync(dirname(specPath(lane)), { recursive: true });
  writeFileSync(specPath(lane), r.text);

  // Path claims parse from the spec's `- claim:` lines (In scope section).
  const claims = [...r.text.matchAll(/^- claim: (.+)$/gm)].map((m) => (m[1] ?? "").trim()).filter(Boolean);
  if (claims.length > 0) lane.pathClaims = claims;
  lane.defects = lane.defects.map((d) =>
    d.source === "spec-gate" && d.status === "open" ? { ...d, status: "fixed" as const } : d,
  );

  // Spec commit is the draft PR's first content.
  await sh(lane.worktree, "git", ["add", ".agentic/specs"]);
  await sh(lane.worktree, "git", ["commit", "-m", `spec(v${lane.specVersion}): issue #${lane.issue} ${lane.slug}`]);
  await sh(lane.worktree, "git", ["push", "-u", "origin", lane.branch]);

  const prot = protectedPathsTouched(lane.pathClaims);
  const gateComment = [
    `**Spec v${lane.specVersion} awaiting approval** — issue #${lane.issue}`,
    prot.length ? `**⚠ PROTECTED PATHS: ${prot.join(", ")}** — approval must quote these files.` : "",
    `Spec: \`.agentic/specs/${lane.issue}-${lane.slug}.v${lane.specVersion}.md\` · Research: \`.agentic/specs/${lane.issue}-RESEARCH.md\``,
    "Reply `agent: approve spec` / `agent: changes — <what>` / `agent: park`.",
  ].filter(Boolean).join("\n\n");

  if (lane.prNumber === null) {
    lane.prNumber = await gh.createDraftPr(
      lane.branch,
      `[autopilot] #${lane.issue} ${lane.slug}`,
      `Lane for #${lane.issue}. Spec-gated; no implementation until the spec comment is approved.\n\nCloses #${lane.issue}.`,
    );
  }
  await gh.comment(lane.prNumber, gateComment);
  lane.gateWaitingSince = new Date().toISOString();
  lane.phase = "spec-gate";

  await notify(lane, `spec-await-v${lane.specVersion}`, "action",
    "spec awaiting your approval",
    `<p>Spec v${lane.specVersion} for issue #${lane.issue} is on the draft PR.</p>${prot.length ? `<p><b>Protected paths: ${prot.join(", ")}</b></p>` : ""}<p><a href="${prLink(lane)}">review + reply on the PR</a></p>`);
  return lane;
};

/* --------------------------------------------------------------- spec-gate */

export const specGate: NodeFn<LaneState> = async (lane) => {
  if (lane.prNumber === null) throw new Error("spec-gate without PR");
  const comments = await gh.agentComments(lane.prNumber, lane.lastSeenCommentId);
  for (const c of comments) {
    lane.lastSeenCommentId = Math.max(lane.lastSeenCommentId, c.id);
    const body = c.body.replace(/^agent:\s*/i, "");
    if (/^park/i.test(body)) { lane.phase = "parked"; lane.exitReason = "parked"; break; }
    if (/^approve spec/i.test(body)) {
      const prot = protectedPathsTouched(lane.pathClaims);
      const quotesAll = prot.every((p) => body.includes(p.replace(/\/$/, "")));
      if (prot.length > 0 && !quotesAll) {
        await gh.comment(lane.prNumber,
          `Approval rejected by the runner: spec touches protected paths (${prot.join(", ")}) — the approve comment must quote them explicitly.`);
        continue;
      }
      lane.specApproved = true;
      lane.gateWaitingSince = null;
      lane.phase = "implement";
      break;
    }
    if (/^changes/i.test(body)) {
      lane.defects.push(...await parseHumanFeedback(lane, body, "spec-gate"));
    }
  }
  if (!lane.specApproved && lane.phase === "spec-gate" && lane.gateWaitingSince) {
    const hours = (Date.now() - Date.parse(lane.gateWaitingSince)) / 3.6e6;
    if (hours > config().budgets.gateTimeoutHours) {
      lane.phase = "parked";
      lane.exitReason = "gate_timeout";
      await notify(lane, `spec-timeout-v${lane.specVersion}`, "action",
        "spec gate timed out — lane parked",
        `<p>No reply in ${config().budgets.gateTimeoutHours}h. Lane parked; reply on the PR to resume.</p><p><a href="${prLink(lane)}">PR</a></p>`);
    }
  }
  return lane;
};

/* --------------------------------------------------------------- implement */

export const implement: NodeFn<LaneState> = async (lane) => {
  lane.implLaps += 1;
  let compactions = 0;
  const b = config().budgets;

  // Compaction loop: each iteration is a fresh session hydrated from durable
  // state; the 40% ceiling forces checkpoint + respawn (§2.1 mechanically).
  for (;;) {
    const checkpoint = readIfExists(`${lane.worktree}/.agentic/lanes/${lane.issue}.checkpoint.md`);
    const prompt = [
      readPrompt("coder"),
      UNTRUSTED_CLAUSE,
      `## Approved spec (v${lane.specVersion})\n${readIfExists(specPath(lane))}`,
      `## Open defects (fix exactly these; lap ${lane.implLaps})\n${openDefectsBlock(lane)}`,
      `## Area memory\n${memoryFor(lane.pathClaims)}`,
      checkpoint ? `## Checkpoint from previous session\n${checkpoint}` : "",
      `## Session contract\nIf you approach your limits, commit compiling progress and write .agentic/lanes/${lane.issue}.checkpoint.md (files touched, gates status, next step) — it seeds your respawn.`,
    ].filter(Boolean).join("\n\n---\n\n");

    const r = await runClaudeStdin(config().models.coder, "implement", prompt, {
      cwd: lane.worktree,
      write: true,
      maxTurns: 60,
    });
    lane.usage.push(r.usage);
    if (!r.hitCompactionCeiling) break;
    compactions += 1;
    if (compactions > b.compactionsPerLapMax) {
      lane.phase = "parked";
      lane.exitReason = "scope_too_big";
      await notify(lane, `scope-park-lap${lane.implLaps}`, "action",
        "scope too big — lane parked for re-slicing",
        `<p>Lap ${lane.implLaps} compacted >${b.compactionsPerLapMax}×. The spec slice is too large — needs re-slicing.</p><p><a href="${prLink(lane)}">PR</a></p>`);
      return lane;
    }
  }

  await sh(lane.worktree, "git", ["add", "-A"]);
  await sh(lane.worktree, "git", ["commit", "-m", `feat(#${lane.issue}): lap ${lane.implLaps}`, "--allow-empty"]);
  await sh(lane.worktree, "git", ["push", "-u", "origin", lane.branch]);
  lane.laps.push({
    lap: lane.implLaps,
    defectCount: -1, // filled by review
    gatesFailed: -1, // filled by verify
    commit: (await sh(lane.worktree, "git", ["rev-parse", "HEAD"])).stdout.trim() || null,
    compactions,
  });
  lane.phase = "verify";
  return lane;
};

/* ------------------------------------------------------------------ verify */

export const verify: NodeFn<LaneState> = async (lane) => {
  const results: GateResult[] = [];
  for (const cmd of config().verify.commands) {
    const [bin = "", ...args] = cmd.run.split(" ");
    try {
      await sh(lane.worktree, bin, args);
      results.push({ id: cmd.id, description: cmd.run, status: "pass", evidence: null });
    } catch (e) {
      const out = (e as { stdout?: string; stderr?: string });
      results.push({ id: cmd.id, description: cmd.run, status: "fail",
        evidence: `${out.stdout ?? ""}\n${out.stderr ?? ""}`.slice(-2000) });
    }
  }
  lane.gates = results;
  const failed = results.filter((g) => g.status === "fail");
  for (const f of failed) {
    if (!lane.defects.some((d) => d.id === `V-${f.id}` && d.status === "open")) {
      lane.defects.push({ id: `V-${f.id}`, source: "verify", file: null,
        summary: `gate ${f.id} failed: ${f.evidence?.slice(-300) ?? ""}`, status: "open" });
    }
  }
  const lastIdx = lane.laps.length - 1;
  const last = lane.laps[lastIdx];
  if (last) lane.laps[lastIdx] = { ...last, gatesFailed: failed.length };
  lane.phase = "review";
  await notify(lane, `verify-lap${lane.implLaps}`, "progress",
    `lap ${lane.implLaps} verified — ${failed.length} gate(s) failing`,
    `<p>${results.map((g) => `${g.status === "pass" ? "✅" : "❌"} ${g.id}`).join(" · ")}</p><p><a href="${prLink(lane)}">PR</a></p>`);
  return lane;
};

/* ------------------------------------------------------------------ review */

export const review: NodeFn<LaneState> = async (lane) => {
  const diff = (await sh(lane.worktree, "git",
    ["diff", "origin/main...HEAD", "--", ".", ":!.agentic"])).stdout;
  const prompt = [
    readPrompt("reviewer"),
    UNTRUSTED_CLAUSE,
    `## Approved spec\n${readIfExists(specPath(lane))}`,
    `## Diff vs main\n\`\`\`diff\n${diff.slice(0, 120_000)}\n\`\`\``,
    `## Previously known defects (carry verdicts by ID, §4.5)\n${openDefectsBlock(lane)}`,
  ].join("\n\n---\n\n");

  const r = await runSeat(config().models.reviewer, "review", prompt, {
    cwd: lane.worktree,
    write: false,
  });
  lane.usage.push(r.usage);

  // Reviewer contract: one defect per line — `D-<n> | <file|-> | <summary>`; `CLEAN` if none.
  const found: Defect[] = [...r.text.matchAll(/^(D-\d+)\s*\|\s*([^|]*)\|\s*(.+)$/gm)].map((m) => ({
    id: m[1] ?? "D-0", source: "review" as const,
    file: (m[2] ?? "").trim() === "-" ? null : (m[2] ?? "").trim() || null,
    summary: (m[3] ?? "").trim(), status: "open" as const,
  }));
  const foundIds = new Set(found.map((d) => d.id));
  lane.defects = [
    // non-review defects pass through untouched
    ...lane.defects.filter((d) => d.source !== "review"),
    // review defects not re-reported are fixed (identity by structural ID)
    ...lane.defects
      .filter((d) => d.source === "review" && !foundIds.has(d.id))
      .map((d) => ({ ...d, status: "fixed" as const })),
    ...found,
  ];
  const openCount = lane.defects.filter((d) => d.status === "open").length;
  const lastIdx = lane.laps.length - 1;
  const last = lane.laps[lastIdx];
  if (last) lane.laps[lastIdx] = { ...last, defectCount: openCount };
  lane.phase = "pr";
  return lane;
};

/* ---------------------------------------------------------------------- pr */

export const pr: NodeFn<LaneState> = async (lane) => {
  if (lane.prNumber === null) throw new Error("pr node without draft PR");
  const gateTable = lane.gates
    .map((g) => `| ${g.id} | ${g.status === "pass" ? "✅ PASS" : "❌ FAIL"} | ${g.evidence ? "see logs" : "—"} |`)
    .join("\n");
  const open = lane.defects.filter((d) => d.status === "open");
  const body = [
    `Lane for #${lane.issue} — spec v${lane.specVersion} (approved), lap ${lane.implLaps}.`,
    `\n| Gate | Result | Evidence |\n|---|---|---|\n${gateTable}`,
    open.length ? `\n**Known open defects (published best lap, §4.4):**\n${open.map((d) => `- ${d.id}: ${d.summary}`).join("\n")}` : "",
    `\nScreenshots: \`${config().verify.screenshotDir}/${lane.issue}-${lane.slug}/\``,
    `\nCloses #${lane.issue}.`,
  ].join("\n");
  await gh.updateBody(lane.prNumber, body);
  await gh.markReady(lane.prNumber);
  lane.gateWaitingSince = new Date().toISOString();
  lane.phase = "pr-gate";
  await notify(lane, `pr-ready-lap${lane.implLaps}`, "action",
    "PR ready for your review",
    `<p>Gates: ${lane.gates.map((g) => `${g.status === "pass" ? "✅" : "❌"} ${g.id}`).join(" · ")}</p><p><a href="${prLink(lane)}">review on GitHub</a></p>`);
  return lane;
};

/* ----------------------------------------------------------------- pr-gate */

export const prGate: NodeFn<LaneState> = async (lane) => {
  if (lane.prNumber === null) throw new Error("pr-gate without PR");
  const decision = await gh.reviewDecision(lane.prNumber);
  if (decision === "APPROVED") { lane.phase = "merge-learn"; return lane; }

  const comments = await gh.agentComments(lane.prNumber, lane.lastSeenCommentId);
  let humanDefects: Defect[] = [];
  for (const c of comments) {
    lane.lastSeenCommentId = Math.max(lane.lastSeenCommentId, c.id);
    const body = c.body.replace(/^agent:\s*/i, "");
    if (/^park/i.test(body)) { lane.phase = "parked"; lane.exitReason = "parked"; return lane; }
    humanDefects = humanDefects.concat(await parseHumanFeedback(lane, body, "human"));
  }
  if (decision === "CHANGES_REQUESTED" || humanDefects.length > 0) {
    lane.changeRequestResets += 1;
    if (lane.changeRequestResets > config().budgets.changeRequestResetsMax) {
      lane.phase = "parked";
      lane.exitReason = "human_changes";
      await notify(lane, "parked-2nd-reject", "action",
        "second rejection — lane parked",
        `<p>No third autonomous lap. Reply on the PR with direction, or take over manually.</p><p><a href="${prLink(lane)}">PR</a></p>`);
      return lane;
    }
    lane.defects.push(...humanDefects);
    lane.implLaps = 0; // human change-request loop: budget resets once
    lane.laps = [];
    lane.phase = "implement";
  }
  return lane;
};

/* ------------------------------------------------------------- merge-learn */

export const mergeLearn: NodeFn<LaneState> = async (lane) => {
  // Merge is the human's click; the runner only learns. Facts enter memory
  // ONLY from the merged diff — merge is the verification event (§2.2).
  if (lane.prNumber === null) throw new Error("merge-learn without PR");
  if (!(await gh.isMerged(lane.prNumber))) {
    // Approved but not merged yet: wait here (a waiting phase — cheap poll,
    // holds no working slot) until the merge lands.
    await notify(lane, "approved-await-merge", "progress",
      "approved — waiting for merge",
      `<p>PR approved. Once merged, verified facts are extracted into the memory PR automatically and the lane frees.</p><p><a href="${prLink(lane)}">PR</a></p>`);
    return lane;
  }
  let learned = 0;
  try {
    learned = await learnFromMergedPr(lane);
  } catch (e) {
    console.error(`[lane #${lane.issue}] learn failed: ${(e as Error).message}`);
  }
  lane.phase = "done";
  lane.exitReason = lane.exitReason ?? "clean";
  await notify(lane, "merged-learned", "progress",
    `merged — ${learned} fact(s) staged for memory`,
    `<p>PR #${lane.prNumber} merged. ${learned > 0 ? `${learned} fact(s) staged on the <code>agent/memory-updates</code> PR — merge it to make them readable to all lanes.` : "Nothing durable to learn from this diff."} Lane freed.</p><p><a href="${prLink(lane)}">PR</a></p>`);
  return lane;
};

/* ----------------------------------------------------------------- helpers */

async function parseHumanFeedback(
  lane: LaneState,
  text: string,
  source: "human" | "spec-gate",
): Promise<Defect[]> {
  const prompt = [
    readPrompt("parser"),
    `Source: ${source}. Existing defect IDs: ${lane.defects.map((d) => d.id).join(", ") || "none"}.`,
    `## Human feedback\n${text}`,
  ].join("\n\n---\n\n");
  const r = await runSeat(config().models.parser, "parse-feedback", prompt, {
    cwd: lane.worktree,
    write: false,
  });
  lane.usage.push(r.usage);
  return [...r.text.matchAll(/^(D-\d+|S-\d+)\s*\|\s*([^|]*)\|\s*(.+)$/gm)].map((m) => ({
    id: m[1] ?? "D-0", source,
    file: (m[2] ?? "").trim() === "-" ? null : (m[2] ?? "").trim() || null,
    summary: (m[3] ?? "").trim(), status: "open" as const,
  }));
}

export const nodes = {
  research, spec, "spec-gate": specGate, implement, verify, review, pr,
  "pr-gate": prGate, "merge-learn": mergeLearn,
} as const;

/**
 * Model seats (§3 harness): CLI/session auth only — no API keys in config.
 * codex → planning-class work (research, spec, parse, review).
 * claude (Opus 5) → the coder seat, the only expensive one.
 *
 * The 40% rule lives here mechanically: every invocation is a fresh session
 * assembled from durable state, hard-capped so a single call can never grow
 * a transcript past `compactAtWindowPct` of the model's window. "Compaction"
 * = checkpoint + this respawn; the caller counts them per lap.
 */
import { config, type SeatSpec } from "./config.ts";
import type { UsageEvent } from "./state.ts";

export interface SeatResult {
  readonly text: string;
  readonly usage: UsageEvent;
  /** True when the call consumed ≥ compactAtWindowPct of the window — caller must checkpoint + respawn. */
  readonly hitCompactionCeiling: boolean;
}

export async function runSeat(
  spec: SeatSpec,
  node: string,
  prompt: string,
  opts: { readonly cwd: string; readonly write?: boolean; readonly maxTurns?: number },
): Promise<SeatResult> {
  return spec.seat === "codex"
    ? runCodex(spec, node, prompt, opts)
    : runClaudeStdin(spec, node, prompt, opts);
}

/** Wall-clock ceiling per codex call — a hung seat fails the lap instead of freezing the lane. */
const CODEX_TIMEOUT_MS = 30 * 60 * 1000;

async function runCodex(
  spec: SeatSpec,
  node: string,
  prompt: string,
  opts: { readonly cwd: string; readonly write?: boolean },
): Promise<SeatResult> {
  const { spawn } = await import("node:child_process");
  const args = [
    "exec",
    "--model", spec.model,
    "--sandbox", opts.write ? "workspace-write" : "read-only",
    "--json",
    prompt,
  ];
  // stdin MUST be ignored: with a piped-but-open stdin, `codex exec` prints
  // "Reading additional input from stdin..." and blocks forever before the
  // first API call — the seat looks alive while doing nothing.
  const child = spawn("codex", args, { cwd: opts.cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
  child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
  const timer = setTimeout(() => child.kill("SIGKILL"), CODEX_TIMEOUT_MS);
  const code: number = await new Promise((res) => child.on("close", res));
  clearTimeout(timer);

  // codex --json emits JSONL events; the final agent_message carries the answer.
  let text = "";
  let inTok = 0;
  let outTok = 0;
  const errors: string[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line) as {
        type?: string;
        item?: { type?: string; text?: string; message?: string };
        usage?: { input_tokens?: number; output_tokens?: number };
        message?: string;
        error?: { message?: string };
      };
      if (ev.item?.type === "agent_message" && ev.item.text) text = ev.item.text;
      if (ev.type === "error" && ev.message) errors.push(ev.message);
      if (ev.type === "turn.failed") errors.push(ev.error?.message ?? "turn.failed");
      if (ev.usage) {
        inTok += ev.usage.input_tokens ?? 0;
        outTok += ev.usage.output_tokens ?? 0;
      }
    } catch {
      /* non-JSON narration line — ignore */
    }
  }
  // codex exec exits 0 even on failed turns — trust the event stream, not the
  // exit code. An empty answer is a failure too: silent-empty results once
  // masqueraded as "research done" and burned laps downstream.
  if (errors.length > 0 || !text.trim()) {
    throw new Error(
      `codex ${node} failed (exit ${code}): ${errors.join(" | ") || "no agent_message"} ${stderr.slice(0, 300)}`,
    );
  }
  return {
    text,
    usage: usageEvent(spec, node, inTok, outTok, null),
    hitCompactionCeiling: false,
  };
}

/** Prompt goes over stdin — argv stays clean of large payloads. */
export async function runClaudeStdin(
  spec: SeatSpec,
  node: string,
  prompt: string,
  opts: { readonly cwd: string; readonly write?: boolean; readonly maxTurns?: number },
): Promise<SeatResult> {
  const { spawn } = await import("node:child_process");
  const args = [
    "-p",
    "--model", spec.model,
    "--output-format", "json",
    "--max-turns", String(opts.maxTurns ?? 40),
  ];
  if (!opts.write) args.push("--permission-mode", "plan");
  const child = spawn("claude", args, { cwd: opts.cwd, env: process.env });
  child.stdin.write(prompt);
  child.stdin.end();
  let out = "";
  let err = "";
  child.stdout.on("data", (d: Buffer) => (out += d.toString()));
  child.stderr.on("data", (d: Buffer) => (err += d.toString()));
  const code: number = await new Promise((res) => child.on("close", res));
  if (code !== 0) throw new Error(`claude exited ${code}: ${err.slice(0, 500)}`);
  return parseClaudeJson(spec, node, out);
}

function parseClaudeJson(spec: SeatSpec, node: string, stdout: string): SeatResult {
  const parsed = JSON.parse(stdout) as {
    result?: string;
    total_cost_usd?: number;
    usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number };
  };
  const inTok =
    (parsed.usage?.input_tokens ?? 0) + (parsed.usage?.cache_read_input_tokens ?? 0);
  const outTok = parsed.usage?.output_tokens ?? 0;
  const window = spec.contextWindow ?? 200_000;
  const pct = ((inTok + outTok) / window) * 100;
  return {
    text: parsed.result ?? "",
    usage: usageEvent(spec, node, inTok, outTok, parsed.total_cost_usd ?? null),
    hitCompactionCeiling: pct >= config().context.compactAtWindowPct,
  };
}

function usageEvent(
  spec: SeatSpec,
  node: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number | null,
): UsageEvent {
  return {
    seat: spec.seat,
    model: spec.model,
    node,
    inputTokens,
    outputTokens,
    costUsd,
    at: new Date().toISOString(),
  };
}

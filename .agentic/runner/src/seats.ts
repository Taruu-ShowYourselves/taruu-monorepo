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
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config, type SeatSpec } from "./config.ts";
import type { UsageEvent } from "./state.ts";

const exec = promisify(execFile);
const MAX_BUF = 32 * 1024 * 1024;

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

async function runCodex(
  spec: SeatSpec,
  node: string,
  prompt: string,
  opts: { readonly cwd: string; readonly write?: boolean },
): Promise<SeatResult> {
  const args = [
    "exec",
    "--model", spec.model,
    "--sandbox", opts.write ? "workspace-write" : "read-only",
    "--json",
    prompt,
  ];
  const { stdout } = await exec("codex", args, { cwd: opts.cwd, maxBuffer: MAX_BUF });
  // codex --json emits JSONL events; the final agent_message carries the answer.
  let text = "";
  let inTok = 0;
  let outTok = 0;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line) as {
        type?: string;
        item?: { type?: string; text?: string };
        usage?: { input_tokens?: number; output_tokens?: number };
        message?: string;
      };
      if (ev.item?.type === "agent_message" && ev.item.text) text = ev.item.text;
      if (ev.usage) {
        inTok += ev.usage.input_tokens ?? 0;
        outTok += ev.usage.output_tokens ?? 0;
      }
    } catch {
      /* non-JSON narration line — ignore */
    }
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

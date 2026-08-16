import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface SeatSpec {
  readonly seat: "codex" | "claude";
  readonly model: string;
  readonly contextWindow?: number;
}

export interface Config {
  readonly repo: string;
  readonly board: { readonly owner: string; readonly projectNumber: number };
  readonly email: {
    readonly to: string;
    readonly from: string;
    readonly subjectPrefix: string;
    readonly digestHourLocal: number;
  };
  readonly lanes: { readonly max: number };
  readonly budgets: {
    readonly specLapsMax: number;
    readonly implLapsMax: number;
    readonly changeRequestResetsMax: number;
    readonly compactionsPerLapMax: number;
    readonly coderTokensPerLap: number;
    readonly dailyCoderTokens: number;
    readonly gateTimeoutHours: number;
  };
  readonly context: { readonly compactAtWindowPct: number };
  readonly models: Readonly<Record<"researcher" | "planner" | "parser" | "coder" | "reviewer", SeatSpec>>;
  readonly protectedPaths: readonly string[];
  readonly memoryAreas: readonly string[];
  readonly memoryLimits: { readonly factsPerArea: number; readonly openQuestionsPerArea: number };
  readonly verify: {
    readonly commands: readonly { readonly id: string; readonly run: string }[];
    readonly screenshotDir: string;
  };
}

let cached: Config | null = null;

/**
 * Host identity lives in gitignored `.agentic/config.local.json`, shallow-merged
 * over the committed config per top-level key. Each host MUST set at least
 * `email.to` and (once auto-admit exists) its own assignee filter — two daemons
 * on two machines split the board by assignee, so they never fight over work.
 */
export function config(): Config {
  if (!cached) {
    const base = JSON.parse(
      readFileSync(join(process.cwd(), ".agentic", "config.json"), "utf8"),
    ) as Config;
    const localPath = join(process.cwd(), ".agentic", "config.local.json");
    if (existsSync(localPath)) {
      const local = JSON.parse(readFileSync(localPath, "utf8")) as Partial<Config>;
      cached = { ...base, ...local } as Config;
    } else {
      cached = base;
    }
  }
  return cached;
}

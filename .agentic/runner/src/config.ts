import { readFileSync } from "node:fs";
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
  readonly autoAdmit?: {
    readonly enabled: boolean;
    readonly onlyAssignee?: string;
    readonly onlyStatus?: readonly string[];
  };
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

export function config(): Config {
  if (!cached) {
    cached = JSON.parse(
      readFileSync(join(process.cwd(), ".agentic", "config.json"), "utf8"),
    ) as Config;
  }
  return cached;
}

/**
 * Board mirror — reflects each lane's live phase onto the org project's
 * "Stage" and "Need Human" single-select fields, so the board answers
 * "where is every lane, and which ones are blocked on me" at a glance.
 *
 * Strictly best-effort: a board API failure must never break a lane, so
 * every entry point swallows errors after logging. Field/option IDs are
 * resolved by NAME at runtime (once per process) — nothing is hardcoded,
 * so rebuilding the board fields doesn't require a code change.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.ts";
import type { LaneState, Phase } from "./state.ts";

const exec = promisify(execFile);
const MAX_BUF = 16 * 1024 * 1024;

const STAGE_FIELD = "Stage";
const NEED_HUMAN_FIELD = "Need Human";
const STATUS_FIELD = "Status";

/** Lane phase → Stage option name (options live on the org project). */
const STAGE_BY_PHASE: Readonly<Record<Phase, string>> = {
  research: "Research",
  spec: "Spec",
  "spec-gate": "Spec approval",
  implement: "Coding",
  verify: "Verification",
  review: "Review",
  pr: "Human review",
  "pr-gate": "Human review",
  "merge-learn": "Done",
  done: "Done",
  parked: "Parked",
};

/** Phases where a human is the blocker → Need Human option (red). Others clear it. */
const NEED_HUMAN_BY_PHASE: Readonly<Partial<Record<Phase, string>>> = {
  "spec-gate": "Spec approval",
  "pr-gate": "PR review",
  parked: "Parked",
};

/**
 * Lane lifecycle → board Status. An admitted lane is In Progress the moment
 * work starts (also stops auto-admit re-grabbing it); done → Done. Parked
 * stays In Progress: the item is still claimed and needs a human, not a
 * fresh admit.
 */
function statusForPhase(phase: Phase): string {
  return phase === "done" ? "Done" : "In Progress";
}

interface SelectField {
  readonly id: string;
  readonly options: Readonly<Record<string, string>>; // option name → option id
}

interface BoardFields {
  readonly projectId: string;
  readonly stage: SelectField;
  readonly needHuman: SelectField;
  readonly status: SelectField;
}

let cachedFields: BoardFields | null | undefined; // undefined = not looked up yet
const itemIdByIssue = new Map<number, string>();
const lastSynced = new Map<number, string>(); // issue → phase, dedupes daemon ticks

async function graphql<T>(query: string): Promise<T> {
  const { stdout } = await exec("gh", ["api", "graphql", "-f", `query=${query}`], {
    maxBuffer: MAX_BUF,
  });
  return (JSON.parse(stdout) as { data: T }).data;
}

async function boardFields(): Promise<BoardFields | null> {
  if (cachedFields !== undefined) return cachedFields;
  const c = config();
  const data = await graphql<{
    organization: { projectV2: { id: string; fields: { nodes: {
      name?: string; id?: string; options?: { id: string; name: string }[];
    }[] } } };
  }>(`query{ organization(login:"${c.board.owner}"){ projectV2(number:${c.board.projectNumber}){ id fields(first:30){ nodes{ ...on ProjectV2SingleSelectField{ id name options{ id name } } } } } } }`);
  const proj = data.organization.projectV2;
  const pick = (name: string): SelectField | null => {
    const f = proj.fields.nodes.find((n) => n.name === name);
    if (!f?.id || !f.options) return null;
    return { id: f.id, options: Object.fromEntries(f.options.map((o) => [o.name, o.id])) };
  };
  const stage = pick(STAGE_FIELD);
  const needHuman = pick(NEED_HUMAN_FIELD);
  const status = pick(STATUS_FIELD);
  if (!stage || !needHuman || !status) {
    console.error(`[board] "${STAGE_FIELD}"/"${NEED_HUMAN_FIELD}"/"${STATUS_FIELD}" fields missing on project ${c.board.projectNumber} — board sync disabled for this run`);
    cachedFields = null;
    return null;
  }
  cachedFields = { projectId: proj.id, stage, needHuman, status };
  return cachedFields;
}

/** The issue's item id on THIS project (an issue can sit on several boards). */
async function itemIdFor(issue: number, projectId: string): Promise<string | null> {
  const hit = itemIdByIssue.get(issue);
  if (hit) return hit;
  const [owner = "", name = ""] = config().repo.split("/");
  const data = await graphql<{
    repository: { issue: { projectItems: { nodes: { id: string; project: { id: string } }[] } } };
  }>(`query{ repository(owner:"${owner}", name:"${name}"){ issue(number:${issue}){ projectItems(first:10){ nodes{ id project{ id } } } } } }`);
  const item = data.repository.issue.projectItems.nodes.find((n) => n.project.id === projectId);
  if (!item) return null;
  itemIdByIssue.set(issue, item.id);
  return item.id;
}

/**
 * Mirror one lane. Sets Stage from the phase; sets Need Human (red) when a
 * human is the blocker, clears it otherwise. Idempotent per phase — repeat
 * daemon ticks on a waiting gate cost zero API calls.
 */
export async function syncBoard(lane: LaneState): Promise<void> {
  try {
    if (lastSynced.get(lane.issue) === lane.phase) return;
    const f = await boardFields();
    if (!f) return;
    const item = await itemIdFor(lane.issue, f.projectId);
    if (!item) return;

    const stageOpt = f.stage.options[STAGE_BY_PHASE[lane.phase]];
    const humanName = NEED_HUMAN_BY_PHASE[lane.phase];
    const humanOpt = humanName ? f.needHuman.options[humanName] : undefined;
    const statusOpt = f.status.options[statusForPhase(lane.phase)];

    const parts: string[] = [];
    if (stageOpt) {
      parts.push(`stage: updateProjectV2ItemFieldValue(input:{projectId:"${f.projectId}", itemId:"${item}", fieldId:"${f.stage.id}", value:{singleSelectOptionId:"${stageOpt}"}}){ projectV2Item{ id } }`);
    }
    if (statusOpt) {
      parts.push(`status: updateProjectV2ItemFieldValue(input:{projectId:"${f.projectId}", itemId:"${item}", fieldId:"${f.status.id}", value:{singleSelectOptionId:"${statusOpt}"}}){ projectV2Item{ id } }`);
    }
    parts.push(humanOpt
      ? `human: updateProjectV2ItemFieldValue(input:{projectId:"${f.projectId}", itemId:"${item}", fieldId:"${f.needHuman.id}", value:{singleSelectOptionId:"${humanOpt}"}}){ projectV2Item{ id } }`
      : `human: clearProjectV2ItemFieldValue(input:{projectId:"${f.projectId}", itemId:"${item}", fieldId:"${f.needHuman.id}"}){ projectV2Item{ id } }`);
    await graphql(`mutation{ ${parts.join(" ")} }`);
    lastSynced.set(lane.issue, lane.phase);
  } catch (e) {
    console.error(`[board #${lane.issue}] sync failed: ${(e as Error).message}`);
  }
}

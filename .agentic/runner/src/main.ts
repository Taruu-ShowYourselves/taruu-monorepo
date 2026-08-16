/**
 * CLI entry. Run from the REPO ROOT (cwd must contain .agentic/).
 *
 *   node .agentic/runner/src/main.ts board            — show admit candidates
 *   node .agentic/runner/src/main.ts admit <issue> <slug>
 *   node .agentic/runner/src/main.ts tick             — one pass over lanes
 *   node .agentic/runner/src/main.ts daemon [minutes] — tick loop (default 10)
 *   node .agentic/runner/src/main.ts status
 */
import { admit, boardCandidates, tick } from "./autopilot.ts";
import { listLanes } from "./state.ts";

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "board": {
    const items = await boardCandidates();
    for (const i of items) console.log(`${i.priority}\t#${i.issue}\t${i.status}\t${i.title}`);
    break;
  }
  case "admit": {
    const issue = Number(rest[0]);
    const slug = rest[1];
    if (!issue || !slug) throw new Error("usage: admit <issue> <slug>");
    const lane = await admit(issue, slug);
    console.log(`lane #${lane.issue} → ${lane.phase} (branch ${lane.branch})`);
    break;
  }
  case "tick":
    await tick();
    break;
  case "daemon": {
    const minutes = Number(rest[0] ?? 10);
    console.log(`autopilot daemon: tick every ${minutes}m — ctrl-c to stop`);
    for (;;) {
      try {
        await tick();
      } catch (e) {
        console.error("[daemon] tick failed:", e);
      }
      await new Promise((r) => setTimeout(r, minutes * 60_000));
    }
  }
  case "status": {
    for (const l of listLanes()) {
      const usd = l.usage.reduce((n, u) => n + (u.costUsd ?? 0), 0);
      console.log(
        `#${l.issue} ${l.slug} · ${l.phase}` +
        ` · spec v${l.specVersion}${l.specApproved ? "✓" : ""}` +
        ` · lap ${l.implLaps} · defects ${l.defects.filter((d) => d.status === "open").length}` +
        ` · $${usd.toFixed(2)}` +
        (l.exitReason ? ` · ${l.exitReason}` : ""),
      );
    }
    break;
  }
  default:
    console.log("commands: board | admit <issue> <slug> | tick | daemon [min] | status");
}

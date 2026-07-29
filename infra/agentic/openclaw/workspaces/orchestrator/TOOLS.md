# Local delivery tools

- GitHub CLI: `gh`. Authentication is injected by the service. Never inspect or
  print it.
- Current docs: `ctx7 library "<name>" "<question>"`, then
  `ctx7 docs "<library-id>" "<specific question>"`.
- Project status:
  `node /opt/taruu-agent/scripts/project-status.mjs ...`.
- Worktree preparation:
  `node /opt/taruu-agent/scripts/prepare-worktree.mjs ...`.
- PRD validation:
  `node /opt/taruu-agent/scripts/validate-prd.mjs --file <path>`.
- Evidence validation (inside the issue worktree):
  `node scripts/agentic/check-evidence.mjs`.
- Owner notification:
  `node /opt/taruu-agent/scripts/notify-telegram.mjs --text "<concise update>"`.
- Browser: use the managed `openclaw` profile. Capture only application UI;
  never browse credential, cloud-console, or identity-document pages.

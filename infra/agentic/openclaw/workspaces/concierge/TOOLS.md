# Local tools

- GitHub CLI: `gh`. Authentication is injected. Never inspect or print it.
- Full PRD creation:
  `node /opt/taruu-agent/scripts/create-issue.mjs --title ... --body-file ...`.
- PRD validation:
  `node /opt/taruu-agent/scripts/validate-prd.mjs --file ...`.
- Current external documentation:
  `ctx7 library "<name>" "<question>"`, then
  `ctx7 docs "<library-id>" "<specific question>"`.
- GitHub reads should use `gh issue`, `gh pr`, `gh run`, and `gh api graphql`.

Do not call `project-status.mjs`; the Telegram concierge is intentionally
unable by policy to start work or change lifecycle state.

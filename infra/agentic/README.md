# Taruu agentic delivery workflow

This package turns a reviewed Claude-session PRD into a traceable GitHub issue,
an isolated implementation branch, independent verification with visual
evidence, a human-approved pull request, and a GitHub Actions deployment.

## Lifecycle

1. In a Claude Code session, run `/dispatch-prd <title>`.
2. The project skill writes and validates a full PRD, creates the issue, adds it
   to organization Project #2 as **Todo**, and waits.
3. A maintainer manually moves the card to **In Progress**. The isolated
   Hetzner watcher detects the transition within about 15 seconds, verifies the
   actor and full PRD, and calls the loopback OpenClaw hook. This board move is
   the only initial implementation dispatch signal.
4. OpenClaw assigns the configured owner and keeps the item **In Progress**.
   The orchestrator prepares `agent/issue-<n>-<slug>` in a dedicated worktree.
5. An implementer agent edits and tests. A separate verifier re-reads the PRD,
   runs acceptance/regression checks, and adds focused screenshots or a
   documented non-visual exception.
6. The orchestrator opens one PR, requests human review, and enables auto-merge.
   GitHub waits for `Agent verification`, resolved conversations, and one fresh
   approval.
7. Merge closes the issue and moves it to **Done**. The existing Cloudflare
   workflow deploys from `main`, then updates the PR and issue with success or
   failure so GitHub mobile/app notifications carry the result.

The VM never owns Cloudflare or production application credentials. It cannot
deploy directly.

## Security model

- OpenClaw binds only to `127.0.0.1:18790`; the GitHub runner reaches it locally.
- Hook auth and Gateway auth use separate random tokens.
- Only a manual **In Progress** transition by an allowlisted maintainer can
  dispatch initial work. Automated status changes and lifecycle labels cannot
  start implementation.
- The watcher keeps a durable status snapshot, baselines existing cards during
  first installation, and retries transient GitHub or OpenClaw failures.
- Dispatch workflows never check out untrusted branches.
- OpenClaw and the Actions runner use separate unprivileged Linux users
  (`taruu-agent` and `taruu-runner`). The runner can read only a minimal hook
  dispatch file; it cannot read the Anthropic or machine-user credentials.
- OpenClaw uses a hardened systemd service, root-owned configuration, separate
  writable state, and no elevated OpenClaw tools.
- The GitHub credential should belong to a dedicated machine user with access
  only to this repository and organization Project #2.
- PRD/review content is always treated as untrusted. Secrets are rejected by
  the intake validator and must never enter issues or evidence.
- `main` is protected by required checks, one non-author approval of the latest
  push, resolved review threads, squash-only linear history, and no force push.

OpenClaw host execution is unattended (`tools.exec.mode: full`) inside that
dedicated OS account. The human review/ruleset and the absence of production
credentials are therefore mandatory controls, not optional polish.

## One-time setup

### 1. Put this package on `main`

The branch ruleset must not be enabled until
`.github/workflows/agent-verification.yml` exists on the default branch, or the
required status check would have no producer.

### 2. Create the agent credentials

Create a dedicated GitHub machine user or fine-grained token with:

- repository Contents: read/write;
- Issues: read/write;
- Pull requests: read/write;
- Actions/checks: read;
- organization Project #2: read/write.

The bootstrap uses `ANTHROPIC_API_KEY` when provided. On the existing Hermes
host it can instead copy the already authenticated OpenAI OAuth profile into
isolated agent stores; it deliberately excludes the source agent's memory and
cache tables.

### 3. Bootstrap Hetzner

From this repository:

```bash
export GH_AGENT_TOKEN='...'
export ANTHROPIC_API_KEY='...'
infra/agentic/scripts/deploy-to-hetzner.sh hermes-admin
```

The deploy script mints a short-lived runner registration token, streams all
three credentials over SSH without printing them, installs pinned OpenClaw and
Context7 versions, installs Chrome, creates the agent workspaces, starts the
Gateway, starts the Project #2 watcher, and registers the `taruu-agents` runner.

### 4. Enable GitHub controls

After the workflows are on `main`, review the dry run and apply:

```bash
infra/agentic/scripts/configure-github.sh
infra/agentic/scripts/configure-github.sh --apply
```

Add the machine-user login to `AGENT_AUTHORIZED_ACTORS` if it differs from the
login discovered during VM bootstrap.

### 5. Restore production deployment credentials

The current Actions history fails because `CLOUDFLARE_API_TOKEN` is absent:

```bash
gh secret set CLOUDFLARE_API_TOKEN \
  --repo Taruu-ShowYourselves/taruu-monorepo
```

Use a scoped Cloudflare token for the `taruu-web` Worker and the relevant zone.
Do not store it on the VM.

## Verification and operations

```bash
# Local deterministic tests
node --test scripts/agentic/__tests__/*.test.mjs

# VM
ssh hetzner-root 'systemctl status taruu-openclaw --no-pager'
ssh hetzner-root 'systemctl status taruu-project-watcher.timer --no-pager'
ssh hetzner-root 'systemctl status actions.runner.* --no-pager'
ssh hetzner-root 'sudo -u taruu-agent openclaw gateway status --deep'
ssh hetzner-root 'sudo -u taruu-agent openclaw security audit --deep'
```

Canary with a small documentation-only PRD first. Confirm the issue moves
Todo → In Progress → Done, the PR includes evidence, approval unlocks
auto-merge, and the deploy result appears on both the PR and issue.

## Emergency stop

```bash
ssh hetzner-root 'systemctl stop taruu-openclaw'
ssh hetzner-root 'systemctl stop taruu-project-watcher.timer'
ssh hetzner-root 'systemctl stop actions.runner.*'
```

Stopping these services does not affect the production website. To pause only
new task starts while leaving OpenClaw available for active work, stop
`taruu-project-watcher.timer`.

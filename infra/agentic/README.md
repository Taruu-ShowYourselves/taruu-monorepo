# Taruu agentic delivery workflow

This package turns a reviewed Claude-session PRD into a traceable GitHub issue,
an isolated implementation branch, independent verification with visual
evidence, a human-approved pull request, and a GitHub Actions deployment.

## Lifecycle

1. In a Claude Code session, run `/dispatch-prd <title>`.
2. The project skill writes and validates a full PRD, creates the issue, adds it
   to organization Project #2 as **Todo**, and waits.
3. The issue must already be assigned to the host owner. A maintainer manually
   moves the card to **In Progress**. That owner's isolated watcher detects the
   transition within about 15 seconds, verifies the actor, issue assignee, and
   full PRD, and calls the loopback OpenClaw hook. Unassigned issues and issues
   owned by someone else are ignored. This board move is the only initial
   implementation dispatch signal. The owner immediately receives a Telegram
   start notification.
4. OpenClaw keeps the pre-assigned item **In Progress**.
   The orchestrator prepares `agent/issue-<n>-<slug>` in a dedicated worktree.
5. An implementer agent edits and tests. A separate verifier re-reads the PRD,
   runs acceptance/regression checks, and adds focused screenshots or a
   documented non-visual exception.
6. The orchestrator opens one PR, assigns it to the same host owner, requests
   human review, and enables auto-merge.
   GitHub waits for `Agent verification`, resolved conversations, and one fresh
   approval. Implementation, verification, blocker, PR, review, and merge
   updates return to the owner's Telegram chat.
7. Merge closes the issue and moves it to **Done**. The existing Cloudflare
   workflow deploys from `main`, then updates the PR and issue with success or
   failure. The result is sent to both GitHub and Telegram.

## Telegram control surface

The allowlisted owner talks to the existing `@Heremeionemama_bot`. Telegram
messages route to a dedicated concierge agent that can:

- answer current project, issue, pull-request, check, and deployment questions;
- turn a conversation into a complete PRD;
- create an explicitly requested issue and place it in **Todo**;
- link the exact GitHub item that needs human action.

The concierge cannot edit application code, merge, deploy, or move a card to
**In Progress**. Even if asked to "start" in Telegram, it links the card and
asks the owner to make the one authorized board transition.

The VM never owns Cloudflare or production application credentials. It cannot
deploy directly.

## Security model

- OpenClaw binds only to `127.0.0.1:18790`; the GitHub runner reaches it locally.
- Hook auth and Gateway auth use separate random tokens.
- Only a manual **In Progress** transition by an allowlisted maintainer for an
  issue already assigned to the configured host owner can dispatch initial
  work. Automated status changes and lifecycle labels cannot start
  implementation.
- PR events are routed by PR assignee to a dedicated owner runner label and
  checked again by the local dispatcher. Missing or mismatched ownership fails
  closed.
- Telegram DMs use a one-owner numeric allowlist. Groups are disabled. The bot
  token is injected through an OpenClaw `SecretRef`, never committed.
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
export TELEGRAM_BOT_TOKEN='...'
export TELEGRAM_ALLOWED_USER_ID='...'
export AGENT_OWNER_LOGIN='DolevSeren'
infra/agentic/scripts/deploy-to-hetzner.sh dolev-box
```

The deploy script mints a short-lived runner registration token, streams all
credentials over SSH without printing them, installs pinned OpenClaw and
Context7 versions, installs Chrome, creates the agent workspaces, starts the
Gateway, starts the Project #2 watcher, and registers a dedicated
`taruu-owner-<github-login>` runner.
On Hermes, blank Telegram variables reuse the one existing bot and paired owner
and safely move polling from the legacy gateway. Bootstrap rolls that move back
if the new Telegram channel fails its probe. Bootstrap also fails closed unless
the OpenClaw identity can write the repository, update Project #2, read Actions,
and access issues.

Store `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` as GitHub Actions secrets so
the production workflow can report its final outcome in the same chat.

### 4. Enable GitHub controls

After the workflows are on `main`, review the dry run and apply:

```bash
infra/agentic/scripts/configure-github.sh
infra/agentic/scripts/configure-github.sh --apply
```

Add the machine-user login to `AGENT_AUTHORIZED_ACTORS` if it differs from the
login discovered during VM bootstrap.

Ownership must be assigned before the board transition. If an issue is assigned
after it entered **In Progress**, move it out of **In Progress** and back again
to create a fresh dispatch transition.

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
ssh hetzner-root 'sudo -u taruu-agent openclaw channels status --probe'
ssh hetzner-root 'sudo -u taruu-agent openclaw security audit --deep'
```

Canary with small documentation-only PRDs first. Confirm unassigned and
other-owner issues do not execute, then confirm an issue assigned to this
host's owner moves Todo → In Progress → Done, the PR is assigned to the same
owner and includes evidence, approval unlocks auto-merge, and the deploy result
appears on both the PR and issue.

## Emergency stop

```bash
ssh hetzner-root 'systemctl stop taruu-openclaw'
ssh hetzner-root 'systemctl stop taruu-project-watcher.timer'
ssh hetzner-root 'systemctl stop actions.runner.*'
```

Stopping these services does not affect the production website. To pause only
new task starts while leaving OpenClaw available for active work, stop
`taruu-project-watcher.timer`.

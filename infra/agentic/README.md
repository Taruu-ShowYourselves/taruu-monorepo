# Taruu agentic delivery workflow

This package turns a reviewed Claude-session PRD into a traceable GitHub issue,
an isolated implementation branch, independent verification with visual
evidence, a human-approved pull request, and a GitHub Actions deployment.

## Commands

The agent does nothing unless it is asked, in a comment, by the maintainer whose
host it is. There is no watcher and no queue.

| Comment | Where | What happens |
| --- | --- | --- |
| `openclaw test` | on a pull request | Checks out the head, runs the repository checks, exercises the changed surfaces in a browser, and replies with **one** comment containing screenshots and every problem found. Read-only: it never edits, pushes, or merges. |
| `openclaw work` | on an issue assigned to you | Runs the full implementation lifecycle and opens one reviewable pull request. |

The command must be the entire first line of the comment. `openclaw test`
dispatches; `can you run openclaw test on this?` does not.

`openclaw test` is the intended loop for human-written branches: push, ask for a
test, read the findings, fix them locally. The agent reports problems and does
not fix them — that division is deliberate, so work does not accumulate
unattended.

## Lifecycle

1. In a Claude Code session, run `/dispatch-prd <title>`.
2. The project skill writes and validates a full PRD, creates the issue, adds it
   to organization Project #2 as **Todo**, and waits.
3. The issue must already be assigned to the host owner. That owner comments
   `openclaw work` on the issue. GitHub routes the comment to their runner,
   the local dispatcher re-checks the repository, the commenter, and the
   assignee, and calls the loopback OpenClaw hook. **This comment is the only
   initial implementation dispatch signal.** Nothing polls, nothing watches a
   board, and no label or column starts work.
4. OpenClaw moves the item to **In Progress** and notifies the owner on
   Telegram. The orchestrator prepares `agent/issue-<n>-<slug>` in a dedicated
   worktree.
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
- Only an explicit `openclaw work` comment can dispatch initial work, and only
  when the commenter is both allowlisted and this host's configured owner, and
  the issue is assigned exclusively to that owner. Board status, project
  automation, and lifecycle labels cannot start implementation — there is no
  longer any component that reads them.
- `openclaw test` is read-only by contract: the orchestrator may check out a
  pull request, run checks, and comment, but must not edit, push, change board
  or review state, or merge.
- Command parsing is strict. The command must be the entire first non-empty
  line of the comment, so prose that mentions the agent is inert. Comment
  bodies never reach a shell; the dispatcher passes the event file to node and
  posts JSON to a loopback socket.
- PR events are routed by PR assignee to a dedicated owner runner label and
  checked again by the local dispatcher. Missing or mismatched ownership fails
  closed.
- Telegram DMs use a one-owner numeric allowlist. Groups are disabled. The bot
  token is injected through an OpenClaw `SecretRef`, never committed.
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
Gateway, and registers a dedicated
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

Assign the issue before commenting `openclaw work`; the dispatcher reads the
assignee at comment time. If you assign it afterwards, just comment again.

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
ssh hetzner-root 'systemctl status actions.runner.* --no-pager'
ssh hetzner-root 'sudo -u taruu-agent openclaw gateway status --deep'
ssh hetzner-root 'sudo -u taruu-agent openclaw channels status --probe'
ssh hetzner-root 'sudo -u taruu-agent openclaw security audit --deep'
```

Canary with small documentation-only PRDs first. Confirm that an ordinary
comment does nothing, that `openclaw work` from a non-owner does nothing, and
that an unassigned issue does nothing. Then confirm an issue assigned to this
host's owner goes Todo → In Progress → Done on an `openclaw work` comment, the
PR is assigned to the same owner and includes evidence, approval unlocks
auto-merge, and the deploy result appears on both the PR and issue. Separately,
comment `openclaw test` on any open pull request and confirm a single reply
arrives with screenshots and findings, and that the branch is untouched.

## Emergency stop

```bash
ssh hetzner-root 'systemctl stop taruu-openclaw'
ssh hetzner-root 'systemctl stop actions.runner.*'
```

Stopping these services does not affect the production website. Because work
now starts only from an explicit comment, the ordinary way to pause the agent
is simply to stop writing commands — there is no queue draining in the
background. Stopping the runner blocks new commands while leaving OpenClaw
available to finish work already in flight.

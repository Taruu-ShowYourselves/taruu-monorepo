#!/usr/bin/env bash
# One-time host setup for the PR autopilot. Run ON the machine that will run
# the daemon, from the monorepo root:
#
#   bash .agentic/setup-host.sh
#
# Idempotent. Prompts only for what is missing. Never prints secret values.
set -euo pipefail

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
fail() { printf '\033[31mXX %s\033[0m\n' "$*"; exit 1; }

[ -f .agentic/config.json ] || fail "run from the monorepo root (needs .agentic/)"

say "1/6 node ≥ 24"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
[ "$NODE_MAJOR" -ge 24 ] || fail "node ≥24 required (native TS); found: $(node --version 2>/dev/null || echo none)"
echo "   $(node --version) ok"

say "2/6 CLIs (gh, claude, codex)"
command -v gh >/dev/null || fail "install gh first (https://cli.github.com)"
command -v claude >/dev/null || npm i -g @anthropic-ai/claude-code
command -v codex  >/dev/null || npm i -g @openai/codex
echo "   gh=$(command -v gh) claude=$(command -v claude || true) codex=$(command -v codex || true)"

say "3/6 auth checks (interactive if missing)"
gh auth status >/dev/null 2>&1 || gh auth login
gh auth setup-git >/dev/null 2>&1 || true
# claude: any of Keychain session, ~/.claude/.credentials.json, or CLAUDE_CODE_OAUTH_TOKEN
if ! printf 'ping' | claude -p --model claude-haiku-4-5-20251001 --max-turns 3 >/dev/null 2>&1; then
  echo "   Claude CLI not authenticated. Run:  claude setup-token"
  echo "   then export CLAUDE_CODE_OAUTH_TOKEN (or add it to the env file in step 5) and re-run."
fi
codex login status >/dev/null 2>&1 || { echo "   Codex CLI not authenticated — running codex login:"; codex login; }

say "4/6 host identity (.agentic/config.local.json — gitignored)"
if [ ! -f .agentic/config.local.json ]; then
  read -rp "   your email for cycle notifications: " HOST_EMAIL
  read -rp "   your GitHub login (assignee filter, e.g. DolevSeren): " HOST_LOGIN
  sed -e "s/YOUR-EMAIL@example.com/${HOST_EMAIL}/" -e "s/DolevSeren/${HOST_LOGIN}/" \
    .agentic/config.local.example.json > .agentic/config.local.json
  echo "   wrote .agentic/config.local.json"
else
  echo "   exists — leaving as is"
fi

say "5/6 env file (Resend key + optional Claude token)"
ENV_FILE="$HOME/.config/taruu-autopilot/env"
mkdir -p "$(dirname "$ENV_FILE")"; touch "$ENV_FILE"; chmod 600 "$ENV_FILE"
if ! grep -q '^RESEND_API_KEY=.' "$ENV_FILE"; then
  echo "   paste RESEND_API_KEY (input hidden; ask Sahar for the Pleiad key), or Enter to skip:"
  read -rs RESEND_KEY || true
  [ -n "${RESEND_KEY:-}" ] && printf 'RESEND_API_KEY=%s\n' "$RESEND_KEY" >> "$ENV_FILE"
  unset RESEND_KEY
fi
echo "   env file: $ENV_FILE (emails skip gracefully if key absent)"

say "6/6 daemon"
if command -v systemctl >/dev/null 2>&1 && [ "$(uname)" = "Linux" ]; then
  mkdir -p ~/.config/systemd/user
  cat > ~/.config/systemd/user/taruu-autopilot.service << UNIT
[Unit]
Description=Taruu PR autopilot (two-lane spec-gated delivery)
After=network-online.target

[Service]
WorkingDirectory=$(pwd)
EnvironmentFile=$ENV_FILE
Environment=PATH=$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin
ExecStartPre=/usr/bin/git pull --ff-only
ExecStart=$(command -v node) .agentic/runner/src/main.ts daemon 10
Restart=on-failure
RestartSec=60

[Install]
WantedBy=default.target
UNIT
  systemctl --user daemon-reload
  systemctl --user enable --now taruu-autopilot.service
  systemctl --user status taruu-autopilot.service --no-pager | head -4
  loginctl enable-linger "$USER" 2>/dev/null || echo "   NOTE: sudo loginctl enable-linger $USER  (so the daemon survives logout)"
  echo "   logs: journalctl --user -u taruu-autopilot -f"
else
  echo "   no systemd (macOS?) — run the daemon in tmux/screen:"
  echo "     set -a; . $ENV_FILE; set +a; node .agentic/runner/src/main.ts daemon 10"
fi

say "done — see .agentic/ONBOARDING.md for how the gates work"

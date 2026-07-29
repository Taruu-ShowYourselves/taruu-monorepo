#!/usr/bin/env bash
# Deploy the knesset-ranker to the VM agents space and schedule it.
#
# Target comes from DEPLOY_SSH in .env (defaults to dolev-box); HERMES_SSH /
# DOLEV_SSH document both boxes. Ships the package, writes the remote .env
# (Supabase creds lifted from apps/web/.env.local), installs node (nvm) +
# deps + the Claude Code CLI, and installs a 6-hourly crontab entry.
#
# One manual step remains per box: `ssh -tt <target> claude login`
# (device-code flow) so the Agent SDK has credentials.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then set -a; . ./.env; set +a; fi
TARGET="${DEPLOY_SSH:-dolev-box}"
WEB_ENV="../../apps/web/.env.local"
# Non-interactive ssh skips .bashrc — source nvm explicitly on every hop.
NVM='export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh";'

echo "==> deploying knesset-ranker to $TARGET"

ssh "$TARGET" 'mkdir -p ~/knesset-ranker/src'
rsync -az --delete --exclude node_modules --exclude .env \
  src package.json README.md "$TARGET":knesset-ranker/

# Remote .env — secrets streamed straight over ssh, never printed.
if [ -f "$WEB_ENV" ]; then
  { grep '^NEXT_PUBLIC_SUPABASE_URL=' "$WEB_ENV"; \
    grep '^SUPABASE_SERVICE_ROLE_KEY=' "$WEB_ENV"; } \
    | ssh "$TARGET" 'cat > ~/knesset-ranker/.env && chmod 600 ~/knesset-ranker/.env'
  echo "==> remote .env written"
else
  echo "!! $WEB_ENV not found — write ~/knesset-ranker/.env on the box yourself"
fi

echo "==> ensuring node via nvm"
ssh "$TARGET" "$NVM"'
  command -v node >/dev/null 2>&1 && node --version | grep -q "^v2[2-9]" || {
    curl -sS -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash >/dev/null
    export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
    nvm install 22 >/dev/null
  }
  node --version
'

echo "==> installing deps on $TARGET"
ssh "$TARGET" "$NVM"'cd ~/knesset-ranker && npm install --no-fund --no-audit --loglevel=error'

echo "==> ensuring Claude Code CLI"
ssh "$TARGET" "$NVM"'
  command -v claude >/dev/null 2>&1 || npm install -g --loglevel=error @anthropic-ai/claude-code
  claude --version || true
'

echo "==> installing crontab entries (docs every 30m, ranker every 6h)"
# Docs runs first and more often: the ranker reads the summaries it writes.
ssh "$TARGET" '
  DOCS="*/30 * * * * . \$HOME/.nvm/nvm.sh && cd \$HOME/knesset-ranker && npx tsx src/docs.ts --limit 8 >> \$HOME/knesset-ranker/docs.log 2>&1"
  RANK="17 */6 * * * . \$HOME/.nvm/nvm.sh && cd \$HOME/knesset-ranker && npx tsx src/rank.ts --limit 60 >> \$HOME/knesset-ranker/rank.log 2>&1"
  ( crontab -l 2>/dev/null | grep -v "knesset-ranker && " ; echo "$DOCS"; echo "$RANK" ) | crontab -
  crontab -l | tail -2
'

echo "==> done. If the box is not logged in yet, run:  ssh -tt $TARGET 'bash -lc \"claude login\"'"

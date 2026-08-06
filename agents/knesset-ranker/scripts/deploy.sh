#!/usr/bin/env bash
# Deploy the knesset-ranker to the VM agents space and schedule it.
#
# Target comes from DEPLOY_SSH in .env (defaults to dolev-box); HERMES_SSH /
# DOLEV_SSH document both boxes. Ships the package, writes the remote .env
# (Supabase creds lifted from apps/web/.dev.vars — the secrets source of
# truth), installs node (nvm) + deps + the Claude Code CLI, and installs a
# 6-hourly crontab entry.
#
# One manual step remains per box: `ssh -tt <target> claude login`
# (device-code flow) so the Agent SDK has credentials.
set -euo pipefail
cd "$(dirname "$0")/.."

# An explicitly passed DEPLOY_SSH must win: `set -a; . ./.env` would otherwise
# overwrite it with the file's value and silently deploy to the wrong box.
DEPLOY_SSH_ARG="${DEPLOY_SSH:-}"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
TARGET="${DEPLOY_SSH_ARG:-${DEPLOY_SSH:-dolev-box}}"
WEB_ENV="../../apps/web/.dev.vars"
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
# A box with a system-wide node (apt) has an unwritable global prefix, so the
# install must be user-scoped — never sudo. ~/.npm-global/bin then has to be on
# PATH for both interactive logins and cron.
ssh "$TARGET" "$NVM"'
  export PATH="$HOME/.npm-global/bin:$PATH"
  if ! command -v claude >/dev/null 2>&1; then
    npm config get prefix | grep -q "^$HOME" || npm config set prefix "$HOME/.npm-global"
    npm install -g --loglevel=error @anthropic-ai/claude-code
  fi
  grep -q ".npm-global/bin" "$HOME/.profile" 2>/dev/null \
    || echo "export PATH=\"\$HOME/.npm-global/bin:\$PATH\"" >> "$HOME/.profile"
  claude --version || true
'

echo "==> ensuring Higgsfield CLI (art job renderer)"
# Binary release from github.com/higgsfield-ai/cli; the box is linux. The art
# job still needs a one-time `higgsfield auth login` on the box (device flow).
ssh "$TARGET" '
  export PATH="$HOME/.npm-global/bin:$PATH"
  if ! command -v higgsfield >/dev/null 2>&1; then
    ARCH=$(uname -m); case "$ARCH" in x86_64) ARCH=amd64;; aarch64) ARCH=arm64;; esac
    TAG=$(curl -s https://api.github.com/repos/higgsfield-ai/cli/releases/latest \
      | grep -m1 "\"tag_name\"" | cut -d\" -f4)
    mkdir -p "$HOME/.npm-global/bin" /tmp/hf-cli
    curl -sL "https://github.com/higgsfield-ai/cli/releases/download/$TAG/hf_${TAG#v}_linux_${ARCH}.tar.gz" \
      | tar -xz -C /tmp/hf-cli
    BIN=$(find /tmp/hf-cli -maxdepth 2 -type f -perm -u+x | head -1)
    install -m 755 "$BIN" "$HOME/.npm-global/bin/higgsfield" && rm -rf /tmp/hf-cli
  fi
  higgsfield version || true
'

echo "==> installing crontab entries (docs every 30m, ranker every 6h, art every 6h)"
# Docs runs first and more often: the ranker reads the summaries it writes.
# The prelude must tolerate a box WITHOUT nvm (system node): sourcing a missing
# nvm.sh with `&&` would abort the whole entry and the job would never run.
ssh "$TARGET" '
  PRELUDE="export PATH=\$HOME/.npm-global/bin:\$PATH; [ -s \$HOME/.nvm/nvm.sh ] && . \$HOME/.nvm/nvm.sh; cd \$HOME/knesset-ranker"
  DOCS="*/30 * * * * $PRELUDE && npx tsx src/docs.ts --limit 8 >> \$HOME/knesset-ranker/docs.log 2>&1"
  RANK="17 */6 * * * $PRELUDE && npx tsx src/rank.ts --limit 60 >> \$HOME/knesset-ranker/rank.log 2>&1"
  ART="41 */6 * * * $PRELUDE && npx tsx src/art.ts --limit 12 >> \$HOME/knesset-ranker/art.log 2>&1"
  ( crontab -l 2>/dev/null | grep -v "knesset-ranker" ; echo "$DOCS"; echo "$RANK"; echo "$ART" ) | crontab -
  crontab -l | tail -3
'

echo "==> done. If the box is not logged in yet, run:  ssh -tt $TARGET 'bash -lc \"claude login\"'"

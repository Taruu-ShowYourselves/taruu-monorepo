#!/usr/bin/env bash
# Push ops tokens from .dev.vars -> GitHub Actions repo secrets.
# Same single source of truth as everything else (direnv loads it, wrangler
# reads it, sync-secrets.sh feeds the worker). Values are piped, never echoed.
#
#   ./scripts/sync-gh-secrets.sh            # push all filled ops tokens
#   ./scripts/sync-gh-secrets.sh --dry-run  # list what WOULD be pushed
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE=".dev.vars"
REPO="Taruu-ShowYourselves/taruu-monorepo"
DRY=${1:-}

# The ops tokens CI needs. Worker runtime secrets stay out of gh on purpose.
GH_KEYS="CLOUDFLARE_API_TOKEN TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID"

[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE"; exit 1; }

pushed=0; empty=0
for key in $GH_KEYS; do
  line=$(grep -m1 "^${key}=" "$ENV_FILE" || true)
  val=${line#*=}; val=${val%\"}; val=${val#\"}
  if [ -z "$val" ]; then
    echo "EMPTY in $ENV_FILE, skipped: $key" >&2
    empty=$((empty+1))
    continue
  fi
  if [ "$DRY" = "--dry-run" ]; then
    echo "would push: $key"
  else
    printf '%s' "$val" | gh secret set "$key" --repo "$REPO"
    echo "pushed to gh: $key"
  fi
  pushed=$((pushed+1))
done
echo "done: $pushed pushed, $empty empty"

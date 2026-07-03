#!/usr/bin/env bash
# Push filled secrets from .dev.vars -> Cloudflare Worker (taruu-web).
# Idempotent: only non-empty values are pushed; empty/placeholder lines skipped.
# Requires: `wrangler login` already done (CLI OAuth), run from apps/web.
#
#   ./scripts/sync-secrets.sh            # push all filled secrets
#   ./scripts/sync-secrets.sh --dry-run  # list what WOULD be pushed
#
# NOTE: NEXT_PUBLIC_* are inlined at BUILD time by Next/OpenNext, not read as
# runtime secrets. They must be present in the build env (.dev.vars is loaded by
# `opennextjs-cloudflare build`). They are pushed here too as a harmless no-op
# for parity, but the source of truth for them is build time.
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE=".dev.vars"
DRY=${1:-}
WRANGLER="node_modules/.bin/wrangler"

[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE"; exit 1; }

# Vars that live in wrangler.jsonc `vars` (NOT secrets) — never push as secrets.
SKIP="GREENINVOICE_ENV QUBIK_NETWORK"

pushed=0; skipped=0
while IFS= read -r line; do
  case "$line" in ''|\#*) continue;; esac
  key=${line%%=*}; val=${line#*=}
  # strip surrounding quotes
  val=${val%\"}; val=${val#\"}
  [ -z "$val" ] && { skipped=$((skipped+1)); continue; }
  case " $SKIP " in *" $key "*) continue;; esac
  if [ "$DRY" = "--dry-run" ]; then
    echo "would push: $key"
  else
    printf '%s' "$val" | "$WRANGLER" secret put "$key" >/dev/null
    echo "pushed: $key"
  fi
  pushed=$((pushed+1))
done < "$ENV_FILE"

echo "---"
echo "$pushed secret(s) ${DRY:+would be }pushed, $skipped empty skipped."

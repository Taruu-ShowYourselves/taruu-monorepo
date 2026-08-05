#!/usr/bin/env bash
#
# Fetch the Supabase project's legacy HS256 JWT secret and write it into
# apps/web/.dev.vars as SUPABASE_JWT_SECRET.
#
# The RLS transport (apps/web/src/lib/supabase/user-token.ts) signs its
# short-lived PostgREST access tokens with this secret. It is DISTINCT from
# JWT_SECRET, which signs the long-lived `sync-session` cookie.
#
# The secret is never printed and never leaves this machine: it goes straight
# from the Management API into .dev.vars (gitignored). Output is a length and a
# confirmation, nothing more.
#
# Usage:  ./scripts/fetch-supabase-jwt-secret.sh

set -euo pipefail

PROJECT_REF="wypqwnqeqfljefpkfnlh"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_VARS="${REPO_ROOT}/apps/web/.dev.vars"

# --- token -----------------------------------------------------------------

TOKEN="$(security find-generic-password -s 'Supabase CLI' -w 2>/dev/null || true)"
if [ -z "${TOKEN}" ]; then
  echo "No Supabase CLI token in the keychain. Run: supabase login" >&2
  exit 1
fi

# --- fetch -----------------------------------------------------------------

RESPONSE="$(curl -sS -X POST \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query":"select current_setting('"'"'app.settings.jwt_secret'"'"', true) as secret"}')"

SECRET="$(printf '%s' "${RESPONSE}" | python3 -c '
import sys, json
try:
    payload = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if isinstance(payload, dict):        # an error body, not a result set
    sys.exit(0)
if payload and isinstance(payload, list):
    print(payload[0].get("secret") or "")
')"

if [ -z "${SECRET}" ]; then
  echo "Could not read app.settings.jwt_secret from the database."
  echo
  echo "Newer Supabase projects do not expose it as a database setting. Two options:"
  echo "  1. Dashboard -> Project Settings -> API -> JWT Settings -> JWT Secret,"
  echo "     then paste it into ${DEV_VARS} as SUPABASE_JWT_SECRET=<value>"
  echo "  2. If that page shows only signing KEYS (ECC/RSA) and no legacy secret,"
  echo "     HS256 is disabled on this project and the transport needs a JWKS rework."
  echo
  echo "API response (first 300 chars, for diagnosis):"
  printf '%s' "${RESPONSE}" | head -c 300
  echo
  exit 2
fi

# --- write -----------------------------------------------------------------

touch "${DEV_VARS}"

if grep -qE '^SUPABASE_JWT_SECRET=' "${DEV_VARS}"; then
  # Replace in place. python rather than sed -i: the secret can contain
  # characters sed would treat as delimiters or backreferences.
  SECRET="${SECRET}" DEV_VARS="${DEV_VARS}" python3 - <<'PY'
import os
path, secret = os.environ["DEV_VARS"], os.environ["SECRET"]
lines = open(path, encoding="utf-8").read().split("\n")
out = [f"SUPABASE_JWT_SECRET={secret}" if l.startswith("SUPABASE_JWT_SECRET=") else l
       for l in lines]
open(path, "w", encoding="utf-8").write("\n".join(out))
PY
  ACTION="replaced"
else
  printf '\nSUPABASE_JWT_SECRET=%s\n' "${SECRET}" >> "${DEV_VARS}"
  ACTION="appended"
fi

echo "SUPABASE_JWT_SECRET ${ACTION} in apps/web/.dev.vars (${#SECRET} chars)."
echo "The value was not printed and is not in your shell history."
echo
echo "Sanity check: the anon and service_role keys are HS256 JWTs signed with"
echo "this same secret, so the RLS harness verifies it end to end."

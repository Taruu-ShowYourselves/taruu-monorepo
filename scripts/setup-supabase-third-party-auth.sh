#!/usr/bin/env bash
#
# Make Taruu its own JWT issuer for Supabase (RLS-01).
#
# This project's Supabase instance signs asymmetrically (ES256 in_use) and its
# legacy HS256 shared secret is retired, so there is no secret to borrow. We
# therefore mint our own tokens and let Supabase verify them against a JWKS we
# publish.
#
# Steps:
#   1. Generate an EC P-256 keypair (never leaves this machine).
#   2. Write the PRIVATE JWK into apps/web/.dev.vars as SUPABASE_TP_PRIVATE_JWK.
#   3. Register our JWKS URL with Supabase as a third-party auth integration.
#
# The private key is never printed. Step 3 is skipped unless the JWKS URL is
# already serving the public key - registering a URL Supabase cannot fetch
# leaves a broken integration behind.
#
# Usage:  ./scripts/setup-supabase-third-party-auth.sh [--register-only]

set -euo pipefail

PROJECT_REF="wypqwnqeqfljefpkfnlh"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_VARS="${REPO_ROOT}/apps/web/.dev.vars"
APP_URL="${APP_URL:-https://taruu.co.il}"
JWKS_URL="${APP_URL}/.well-known/jwks.json"

REGISTER_ONLY=0
[ "${1:-}" = "--register-only" ] && REGISTER_ONLY=1

# --- 1 + 2: generate and store ---------------------------------------------

if [ "${REGISTER_ONLY}" -eq 0 ]; then
  if grep -qE '^SUPABASE_TP_PRIVATE_JWK=.' "${DEV_VARS}" 2>/dev/null; then
    echo "SUPABASE_TP_PRIVATE_JWK already set in .dev.vars - keeping it."
    echo "Rotating? Remove that line first, then re-run."
  else
    echo "Generating an EC P-256 signing keypair..."
    DEV_VARS="${DEV_VARS}" node --input-type=module -e '
import { generateKeyPair, exportJWK } from "jose";
import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";

const { privateKey } = await generateKeyPair("ES256", { extractable: true });
const jwk = await exportJWK(privateKey);
jwk.kid = randomUUID();
jwk.alg = "ES256";
jwk.use = "sig";

appendFileSync(
  process.env.DEV_VARS,
  `\nSUPABASE_TP_PRIVATE_JWK=${JSON.stringify(jwk)}\n`,
  "utf8"
);
console.log(`  kid ${jwk.kid} written to .dev.vars (private half, not printed)`);
' || { echo "Key generation failed. Is jose installed? (pnpm install)" >&2; exit 1; }
  fi
  echo
fi

# --- 3: register with Supabase ---------------------------------------------

echo "Checking ${JWKS_URL} is live before registering..."
PUBLISHED="$(curl -sS --max-time 10 "${JWKS_URL}" 2>/dev/null || true)"

if ! printf '%s' "${PUBLISHED}" | grep -q '"kty"'; then
  cat <<EOF

The JWKS URL is not serving a key yet. Registering now would leave Supabase
holding an integration it cannot resolve.

Do this first:
  1. Deploy the web app so ${JWKS_URL} is reachable
     (SUPABASE_TP_PRIVATE_JWK must be set on the Worker:
      wrangler secret put SUPABASE_TP_PRIVATE_JWK)
  2. Re-run: ./scripts/setup-supabase-third-party-auth.sh --register-only

For LOCAL testing you do not need any of this - the RLS harness signs and
verifies against the same key without Supabase being involved in verification.
EOF
  exit 2
fi

echo "  JWKS is live."
echo

TOKEN="$(security find-generic-password -s 'Supabase CLI' -w 2>/dev/null || true)"
if [ -z "${TOKEN}" ]; then
  echo "No Supabase CLI token in the keychain. Run: supabase login" >&2
  exit 1
fi

echo "Existing third-party auth integrations:"
curl -sS "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth/third-party-auth" \
  -H "Authorization: Bearer ${TOKEN}" \
| python3 -c '
import sys, json
try:
    rows = json.load(sys.stdin)
except Exception:
    print("  (could not parse response)"); sys.exit(0)
if not rows:
    print("  none")
for r in rows if isinstance(rows, list) else [rows]:
    print(f"  {r.get(\"id\")}  type={r.get(\"type\")}  jwks_url={r.get(\"jwks_url\")}  resolved_at={r.get(\"resolved_at\")}")
'
echo

read -r -p "Register ${JWKS_URL} as a third-party auth issuer? [y/N] " CONFIRM
[ "${CONFIRM}" = "y" ] || [ "${CONFIRM}" = "Y" ] || { echo "Aborted."; exit 0; }

curl -sS -X POST \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth/third-party-auth" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"jwks_url\":\"${JWKS_URL}\"}" \
| python3 -c '
import sys, json
try:
    r = json.load(sys.stdin)
except Exception:
    print(sys.stdin.read()[:400]); sys.exit(0)
print(json.dumps({k: v for k, v in r.items() if k != "resolved_jwks"}, indent=2))
'

echo
echo "Registered. Supabase re-checks the JWKS periodically; allow a few minutes"
echo "before tokens verify, and up to ~30 minutes after any key rotation."

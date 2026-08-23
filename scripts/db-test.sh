#!/usr/bin/env bash
# Apply every migration to a disposable database, then run every SQL test in
# supabase/tests/ against it. Each test file wraps itself in BEGIN/ROLLBACK.
#
# Usage: DATABASE_URL=postgres://... scripts/db-test.sh
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --quiet --no-psqlrc)

echo "→ bootstrap"
"${PSQL[@]}" -f "$ROOT/supabase/tests/bootstrap.sql" >/dev/null

echo "→ migrations"
count=0
for migration in "$ROOT"/supabase/migrations/*.sql; do
  if ! "${PSQL[@]}" -f "$migration" >/tmp/db-test-migration.log 2>&1; then
    echo "✗ migration failed: $(basename "$migration")" >&2
    tail -20 /tmp/db-test-migration.log >&2
    exit 1
  fi
  count=$((count + 1))
done
echo "  applied $count migrations"

echo "→ tests"
failed=0
for test_file in "$ROOT"/supabase/tests/*.sql; do
  name="$(basename "$test_file")"
  [ "$name" = "bootstrap.sql" ] && continue
  if "${PSQL[@]}" -f "$test_file" >/tmp/db-test-run.log 2>&1; then
    echo "  ✓ $name"
  else
    echo "  ✗ $name" >&2
    tail -20 /tmp/db-test-run.log >&2
    failed=1
  fi
done

[ "$failed" -eq 0 ] || { echo "database tests failed" >&2; exit 1; }
echo "✓ all database tests passed"

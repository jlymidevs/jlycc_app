#!/usr/bin/env bash
set -euo pipefail

# MSYS_NO_PATHCONV / MSYS2_ARG_CONV_EXCL: Git Bash on Windows rewrites
# Unix-style absolute paths (e.g. /tests/foo.sql) to Windows paths
# (C:/Program Files/Git/tests/...). These vars disable that behavior
# so Docker container paths are passed through unchanged.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

CONTAINER=jly_postgres
DB=jly
USER=jly_admin
VERBOSE="${VERBOSE:-0}"

cd "$(dirname "$0")"

FAIL=0
for f in ./*.sql; do
  f="$(basename "$f")"
  echo "=== $f ==="
  if [ "$VERBOSE" = "1" ]; then
    docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" -X -f "/tests/$f"
  else
    docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" -X -q -f "/tests/$f"
  fi
done

#!/usr/bin/env bash
set -euo pipefail

# Disable MSYS path conversion on Git Bash (Windows) so absolute container
# paths like /tests/foo.sql aren't rewritten to C:/Program Files/Git/tests/...
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

CONTAINER=jly_postgres
DB=jly
USER=jly_admin

cd "$(dirname "$0")"

for f in $(ls *.sql | sort); do
  echo "=== $f ==="
  docker exec -i $CONTAINER psql -U $USER -d $DB -X -q -f "/tests/$f"
done

#!/usr/bin/env bash
# Spins up a throwaway Postgres, shapes it like Supabase, applies the
# migrations twice (they must be safe to re-run) and runs verify.sql.
#   npm run test:db
set -euo pipefail
cd "$(dirname "$0")/../.."

PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
SOCK="$DATA"
trap '"$PG_BIN/pg_ctl" -D "$DATA" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DATA"' EXIT

# Postgres refuses to run as root; use the postgres OS user when we are root.
RUN=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DATA"; RUN=(runuser -u postgres --); fi

"${RUN[@]}" "$PG_BIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"${RUN[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $SOCK -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null


PSQL=(psql -h "$SOCK" -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f tests/db/supabase-stub.sql >/dev/null
for pass in 1 2; do
  for f in supabase/migrations/*.sql; do PGOPTIONS="-c client_min_messages=warning" "${PSQL[@]}" -f "$f" >/dev/null; done
done
echo "Migrations applied twice without errors."
"${PSQL[@]}" -f tests/db/verify.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'

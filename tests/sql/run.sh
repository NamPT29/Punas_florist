#!/usr/bin/env bash
# Chạy schema.sql trên một PostgreSQL tạm thời rồi kiểm thử nghiệp vụ.
# Cần PostgreSQL 15+ (initdb, pg_ctl, psql).
set -euo pipefail
cd "$(dirname "$0")/../.."

PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PG_BIN:$PATH"
TMP="$(mktemp -d)"
trap 'pg_ctl -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT

RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  id postgres >/dev/null 2>&1 || useradd -m postgres
  chown -R postgres "$TMP"
  RUN_AS=(runuser -u postgres --)
fi

"${RUN_AS[@]}" initdb -D "$TMP/data" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" pg_ctl -D "$TMP/data" -o "-k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null

export PGOPTIONS="-c client_min_messages=warning"
PSQL=(psql -h "$TMP" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f tests/sql/supabase_stub.sql
"${PSQL[@]}" -f supabase/schema.sql
"${PSQL[@]}" -f supabase/schema.sql   # chạy lại lần 2: phải an toàn
"${PSQL[@]}" -f tests/sql/test_schema.sql

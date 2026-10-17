#!/usr/bin/env bash
# Kiểm thử tích hợp: chạy web/js/backend-supabase.js (đúng code dùng thật) với thư viện @supabase/supabase-js,
# PostgREST và PostgreSQL thật, cùng schema.sql và phân quyền như trên Supabase.
# Cần PostgreSQL 15+, Node 20+; lần đầu cần mạng để tải PostgREST và @supabase/supabase-js.
set -euo pipefail
cd "$(dirname "$0")/../.."

PGRST_VERSION=v12.2.3
SUPABASE_JS=2.117.2
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/shop-hoa"
mkdir -p "$CACHE"
if [ ! -x "$CACHE/postgrest" ]; then
  curl -sSL "https://github.com/PostgREST/postgrest/releases/download/$PGRST_VERSION/postgrest-$PGRST_VERSION-linux-static-x64.tar.xz" \
    | tar -xJ -C "$CACHE"
fi
if [ ! -d node_modules/@supabase/supabase-js ]; then
  npm install --no-save --no-package-lock --silent "@supabase/supabase-js@$SUPABASE_JS"
fi

PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PG_BIN:$PATH"
TMP="$(mktemp -d)"
PGRST_PID=""
trap '[ -n "$PGRST_PID" ] && kill "$PGRST_PID" 2>/dev/null; pg_ctl -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT

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
# Giống khi tắt "Automatically expose new tables" lúc tạo dự án Supabase: bảng mới không tự cấp quyền.
"${PSQL[@]}" <<'SQL'
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;
SQL
"${PSQL[@]}" -f supabase/schema.sql
"${PSQL[@]}" <<'SQL'
insert into auth.users values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'stranger@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'staff@example.com');
insert into staff (user_id, name, role) values
  ('00000000-0000-0000-0000-000000000001', 'Chủ shop', 'owner'),
  ('00000000-0000-0000-0000-000000000003', 'Nhân viên', 'staff');
SQL

export JWT_SECRET="shop-hoa-integration-test-secret-0123456789"
PORT=$((20000 + RANDOM % 20000))
PGRST_DB_URI="postgres://postgres@/postgres?host=$TMP" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT="$PORT" PGRST_LOG_LEVEL=crit \
  "$CACHE/postgrest" >"$TMP/postgrest.log" 2>&1 &
PGRST_PID=$!
for _ in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.2; done

node tests/supabase-it/it.mjs "http://127.0.0.1:$PORT"

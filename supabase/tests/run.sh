#!/usr/bin/env bash
# Levanta un Postgres descartable, reproduce el esquema de producción, aplica
# las migraciones 0013-0017 y corre el test de aislamiento multi-tenant.
#
#   ./supabase/tests/run.sh
#
# Existe porque el criterio de aceptación del bloque ("dos gimnasios no ven
# nada uno del otro") no se puede verificar leyendo el código: depende de cómo
# se combinan las policies en Postgres. Acá se ejecuta de verdad.
set -euo pipefail
cd "$(dirname "$0")/../.."

PORT="${PGTEST_PORT:-55432}"
DIR="${PGTEST_DIR:-/var/tmp/pgtest}"
export PATH="/usr/lib/postgresql/16/bin:$PATH"

if ! pg_isready -h "$DIR" -p "$PORT" >/dev/null 2>&1; then
  echo "▶ levantando Postgres descartable en $DIR:$PORT"
  rm -rf "$DIR"; mkdir -p "$DIR/pgdata"
  initdb -D "$DIR/pgdata" -A trust -U postgres >/dev/null
  pg_ctl -D "$DIR/pgdata" -o "-p $PORT -k $DIR" -l "$DIR/pg.log" start >/dev/null
  sleep 2
fi

P="psql -h $DIR -p $PORT -U postgres -q -v ON_ERROR_STOP=1"
$P -d postgres -c "DROP DATABASE IF EXISTS splitraw_test WITH (FORCE);" \
              -c "CREATE DATABASE splitraw_test;" 2>&1 | grep -v skipping || true

echo "▶ esquema de producción"
$P -d splitraw_test -f supabase/tests/fixture_schema.sql >/dev/null

echo "▶ migraciones"
for f in supabase/migrations/001[34567]_*.sql; do
  $P -d splitraw_test -f "$f" >/dev/null 2>&1
  echo "   ✓ $(basename "$f")"
done

echo "▶ test de aislamiento"
psql -h "$DIR" -p "$PORT" -U postgres -d splitraw_test -q \
  -f supabase/tests/test_multi_tenant.sql 2>&1 \
  | grep -E 'PASS|FAIL|ERROR|TODOS' | sed 's/^psql[^ ]* //;s/^NOTICE:  //'

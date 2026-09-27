#!/usr/bin/env bash
# Pruebas de base de datos contra un PostgreSQL real.
# Crea una base limpia, aplica las migraciones y ejecuta las pruebas de aislamiento y auditoría.
#
# Variables:
#   PG_SUPERUSER_URL  conexión de superusuario (solo para crear la base de pruebas)
#   PG_HOST_URL       base de la URL sin usuario, p. ej. postgres://localhost:5432
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
SUPER="${PG_SUPERUSER_URL:-postgres://postgres@localhost:5432/postgres}"
HOST="${PG_HOST_URL:-postgres://localhost:5432}"
DB=microslab_test

# Roles (idempotente) y base limpia.
psql "$SUPER" -v ON_ERROR_STOP=1 -q -X -f "$root/infra/db/bootstrap.sql" >/dev/null
psql "$SUPER" -v ON_ERROR_STOP=1 -q -X -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB OWNER microslab_owner"
psql "${SUPER%/*}/$DB" -v ON_ERROR_STOP=1 -q -X \
  -c "CREATE EXTENSION IF NOT EXISTS pgcrypto" \
  -c "GRANT CONNECT ON DATABASE $DB TO microslab_app, microslab_dispatcher" \
  -c "REVOKE CREATE ON SCHEMA public FROM PUBLIC"

owner_url() { echo "${HOST/\/\////microslab_owner:owner_dev_password@}/$DB"; }
app_url() { echo "${HOST/\/\////microslab_app:app_dev_password@}/$DB"; }
dispatcher_url() { echo "${HOST/\/\////microslab_dispatcher:dispatcher_dev_password@}/$DB"; }

DATABASE_URL_OWNER="$(owner_url)" node "$root/infra/db/migrate.mjs" >/dev/null 2>&1

psql "$(owner_url)" -v ON_ERROR_STOP=1 -q -X -o /dev/null -f "$here/fixtures.sql"

status=0
for t in "$here"/test_*.sql; do
  name="$(basename "$t")"
  case "$name" in
    test_*_superuser.sql) url="${SUPER%/*}/$DB" ;;
    test_*_dispatcher.sql) url="$(dispatcher_url)" ;;
    *) url="$(app_url)" ;;
  esac
  if out="$(psql "$url" -v ON_ERROR_STOP=1 -q -X -f "$t" 2>&1)"; then
    echo "✓ $name"
  else
    echo "✗ $name"
    echo "$out" | sed 's/^/    /'
    status=1
  fi
done
exit $status

#!/bin/sh
set -eu

# Small helper to wait for Postgres to be ready before running migrations.
# Supports overriding host/port/user with WAIT_DB_HOST/WAIT_DB_PORT/WAIT_DB_USER env vars.

host="${WAIT_DB_HOST:-db}"
port="${WAIT_DB_PORT:-5432}"
user="${WAIT_DB_USER:-postgres}"
attempts=${WAIT_DB_ATTEMPTS:-30}
interval=${WAIT_DB_INTERVAL:-2}

echo "Waiting for Postgres at ${host}:${port} (user=${user})..."
i=0
until pg_isready -h "$host" -p "$port" -U "$user" >/dev/null 2>&1; do
  i=$((i+1))
  if [ "$i" -ge "$attempts" ]; then
    echo "Timed out waiting for Postgres at ${host}:${port} after ${attempts} attempts"
    exit 1
  fi
  sleep "$interval"
done

echo "Postgres is available at ${host}:${port}"

exit 0

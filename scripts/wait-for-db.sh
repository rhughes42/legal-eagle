#!/bin/sh
# wait-for-db.sh
#
# Description:
#   Small helper script to wait for a PostgreSQL server to become available
#   before proceeding (e.g., running migrations or starting an application).
#   Polls the server using 'pg_isready' until it responds or a timeout is reached.
#
# Usage:
#   WAIT_DB_HOST=<host> WAIT_DB_PORT=<port> WAIT_DB_USER=<user> \
#     WAIT_DB_ATTEMPTS=<tries> WAIT_DB_INTERVAL=<seconds> ./wait-for-db.sh
#
# Environment variables (with defaults):
#   WAIT_DB_HOST     Hostname or service name of the Postgres server (default: "db")
#   WAIT_DB_PORT     TCP port of the Postgres server (default: "5432")
#   WAIT_DB_USER     Postgres user used for health checking (default: "postgres")
#   WAIT_DB_ATTEMPTS Number of polling attempts before giving up (default: 30)
#   WAIT_DB_INTERVAL Seconds to wait between attempts (default: 2)
#
# Behavior:
#   - Uses 'pg_isready -h <host> -p <port> -U <user>' to check server readiness.
#   - Polls up to WAIT_DB_ATTEMPTS times, sleeping WAIT_DB_INTERVAL seconds
#     between attempts.
#   - Prints status messages to stdout.
#
# Exit codes:
#   0  Postgres became available within the configured attempts.
#   1  Timed out waiting for Postgres (no response after configured attempts).
#   >1 Abnormal termination due to shell errors or missing dependencies.
#
# Dependencies:
#   - 'pg_isready' utility (part of PostgreSQL client tools) must be installed
#     and available on the PATH.
#   - POSIX-compatible /bin/sh; the script uses 'set -eu' for strict error handling.
#
# Integration tips:
#   - Use this script in container entrypoints to delay application startup
#     until the database container is ready.
#   - Combine with healthchecks or orchestration waits to avoid race conditions
#     between services (e.g., in docker-compose or Kubernetes init containers).
#
# Examples:
#   # Wait for a database running on host 'db' (default)
#   ./wait-for-db.sh
#
#   # Override host, port and tune timeout/interval
#   WAIT_DB_HOST=db.example.com WAIT_DB_PORT=5433 WAIT_DB_ATTEMPTS=60 \
#     WAIT_DB_INTERVAL=5 ./wait-for-db.sh
#
# Note: This script performs a lightweight readiness check and does not verify application-level connectivity or schema state. Use it as a simple guard to reduce transient connection failures at startup.

set -eu

# Small helper to wait for Postgres to be ready before running migrations.
# Supports overriding host/port/user with WAIT_DB_HOST/WAIT_DB_PORT/WAIT_DB_USER env vars.

host="${WAIT_DB_HOST:-db}"
port="${WAIT_DB_PORT:-5432}"
user="${WAIT_DB_USER:-postgres}"
attempts=${WAIT_DB_ATTEMPTS:-30}
interval=${WAIT_DB_INTERVAL:-2}

echo "Waiting for Postgres at ${host}:${port} (user=${user})..."
attempt=0
until pg_isready -h "$host" -p "$port" -U "$user" >/dev/null 2>&1; do
  attempt=$((attempt+1))
  if [ "$attempt" -ge "$attempts" ]; then
    echo "❌ Timed out waiting for Postgres at ${host}:${port} after ${attempts} attempts!"
    exit 1
  fi
  sleep "$interval"
done

echo "✅ Postgres is available at ${host}:${port}"

exit 0

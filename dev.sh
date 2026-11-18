#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_PID=""
FRONTEND_PID=""

if [[ ! -f "$BACKEND_DIR/.env" && -z "${DB_PASSWORD:-}" ]]; then
  echo "Set/export DB_PASSWORD or configure it in backend/.env before starting." >&2
  exit 1
fi

for command in docker setsid; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

cd "$BACKEND_DIR"

database_is_ready() {
  docker compose exec -T postgres pg_isready -U postgres -d movie >/dev/null 2>&1
}

if database_is_ready; then
  echo "PostgreSQL is already running."
else
  echo "Starting PostgreSQL..."
  docker compose up -d postgres

  for attempt in {1..30}; do
    if database_is_ready; then
      break
    fi
    if [[ "$attempt" -eq 30 ]]; then
      echo "PostgreSQL did not become ready within 60 seconds." >&2
      exit 1
    fi
    sleep 2
  done
  echo "PostgreSQL is ready."
fi

cleanup() {
  if [[ -n "$BACKEND_PID" ]]; then
    kill -- "-$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$FRONTEND_PID" ]]; then
    kill -- "-$FRONTEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Starting backend at http://localhost:8080 and frontend at http://localhost:4200..."
setsid bash -c 'cd "$1" && exec env SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run' _ "$BACKEND_DIR" &
BACKEND_PID=$!
setsid bash -c 'cd "$1" && exec npm start' _ "$FRONTEND_DIR" &
FRONTEND_PID=$!

if wait -n "$BACKEND_PID" "$FRONTEND_PID"; then
  status=0
else
  status=$?
fi

echo "A development server exited; stopping the other server."
exit "$status"

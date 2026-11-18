#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${MOVIES_API_COMPOSE_FILE:-$ROOT_DIR/docker-compose.production.yml}"
PRODUCTION_ENV_FILE="${MOVIES_API_PRODUCTION_ENV:-/etc/movies-api/production.env}"
BACKUP_DIR="${MOVIES_API_BACKUP_DIR:-/var/backups/movies-api}"
BACKUP_TYPE="${1:-}"

if [[ "$BACKUP_TYPE" != weekly && "$BACKUP_TYPE" != pre-deploy ]]; then
  echo "Usage: $0 {weekly|pre-deploy}" >&2
  exit 2
fi

for command in docker date find mktemp mv; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

if [[ ! -r "$COMPOSE_FILE" ]]; then
  echo "Cannot read production Compose file: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -r "$PRODUCTION_ENV_FILE" ]]; then
  echo "Cannot read production environment file: $PRODUCTION_ENV_FILE" >&2
  exit 1
fi

if [[ ! -d "$BACKUP_DIR" || ! -w "$BACKUP_DIR" ]]; then
  echo "Backup directory must exist and be writable: $BACKUP_DIR" >&2
  exit 1
fi

compose=(docker compose --env-file "$PRODUCTION_ENV_FILE" -f "$COMPOSE_FILE" -p movies-production)
temporary_file="$(mktemp "$BACKUP_DIR/.${BACKUP_TYPE}.XXXXXX")"
trap 'rm -f -- "$temporary_file"' EXIT

"${compose[@]}" exec -T postgres sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$temporary_file"
if [[ ! -s "$temporary_file" ]]; then
  echo "PostgreSQL backup is empty; refusing to keep it." >&2
  exit 1
fi

"${compose[@]}" exec -T -i postgres pg_restore --list < "$temporary_file" >/dev/null

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/${BACKUP_TYPE}-${timestamp}-$$.dump"
mv -- "$temporary_file" "$backup_file"
trap - EXIT

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'weekly-*.dump' -o -name 'pre-deploy-*.dump' \) \
  -mmin +43200 -delete

echo "PostgreSQL backup saved: $backup_file"

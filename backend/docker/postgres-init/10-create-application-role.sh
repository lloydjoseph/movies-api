#!/usr/bin/env bash
set -Eeuo pipefail

# The official image runs this only when initializing an empty data directory.
# Keep the backend's login separate from the bootstrap superuser.
psql \
  --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=app_user="$DB_USERNAME" \
  --set=app_password="$DB_PASSWORD" \
  --set=app_database="$POSTGRES_DB" <<'SQL'
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password';
ALTER DATABASE :"app_database" OWNER TO :"app_user";
SQL

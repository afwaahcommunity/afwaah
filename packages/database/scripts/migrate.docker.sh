#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"
ROOT_DIR="$SCRIPT_DIR/../../.."

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  . "$ROOT_DIR/.env"
  set +a
fi

POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-campus_chat}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
CONTAINER_MIGRATIONS_DIR="${CONTAINER_MIGRATIONS_DIR:-/tmp/campus-chat-migrations}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to run Docker-backed migrations." >&2
  exit 1
fi

cd "$ROOT_DIR"

docker compose up -d "$POSTGRES_SERVICE"
docker compose exec -T "$POSTGRES_SERVICE" sh -c "rm -rf '$CONTAINER_MIGRATIONS_DIR' && mkdir -p '$CONTAINER_MIGRATIONS_DIR'"
docker compose cp "$MIGRATIONS_DIR/." "$POSTGRES_SERVICE:$CONTAINER_MIGRATIONS_DIR"

docker compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"

for migration in "$MIGRATIONS_DIR"/*.sql; do
  filename=$(basename "$migration")
  already_applied=$(docker compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "SELECT 1 FROM public.schema_migrations WHERE filename = '$filename';" | tr -d '\r')

  if [ "$already_applied" = "1" ]; then
    echo "Already applied: $filename"
    continue
  fi

  echo "Applying: $filename"
  docker compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f "$CONTAINER_MIGRATIONS_DIR/$filename"
  docker compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "INSERT INTO public.schema_migrations (filename) VALUES ('$filename');"
done

echo "Database migrations complete."

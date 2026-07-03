# Campus Chat

Anonymous-first realtime chat foundation for NIT Raipur campus.

This repository is intentionally database-first right now. It contains the monorepo structure, local infrastructure, and the PostgreSQL/Redis design from `codex.md`, organized into clean package boundaries. The web app, API server, and realtime server are deliberately left for later implementation.

## Structure

```txt
apps/
  README.md                  Future app boundaries only
packages/
  database/                  Table schemas, model types, PostgreSQL migrations, Redis key plan
  typescript-config/         Shared TypeScript config
codex.md                     Original product and database brief
docker-compose.yml           Local Postgres + Redis
```

## Local Database

```bash
cp .env.example .env
docker compose up -d
pnpm db:migrate
```

Postgres is published on host port `5433` by default so it does not collide with a local or existing Docker Postgres on `5432`. The default migration command runs through Docker. If you need to run migrations against a direct `DATABASE_URL`, use `pnpm db:migrate:psql`.

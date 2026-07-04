# Campus Chat

Anonymous-first realtime chat foundation for NIT Raipur campus.

This repository contains the Campus Chat monorepo: Next.js web app, HTTP/tRPC API, Socket.IO realtime server, and shared PostgreSQL/Redis-backed packages.

## Structure

```txt
apps/
  web/                       Next.js product surface
  api/                       tRPC/HTTP API for non-hot-path operations
  realtime/                  Socket.IO realtime chat server
packages/
  database/                  Table schemas, model types, PostgreSQL migrations, Redis key plan
  services/                  Shared service/repository layer
  trpc/                      Shared tRPC router/client types
  typescript-config/         Shared TypeScript config
docker-compose.yml           Local Postgres + Redis
```

## Local Database

```bash
cp .env.example .env
docker compose up -d
pnpm db:migrate
```

Postgres is published on host port `5433` by default so it does not collide with a local or existing Docker Postgres on `5432`. The default migration command runs through Docker. If you need to run migrations against a hosted `DATABASE_URL`, use `pnpm db:migrate:node`.

## Chat Deployment

For the current testing phase, deploy only the chat flow:

- Vercel: `apps/web`
- Render: `apps/api` and `apps/realtime`
- Neon: Postgres
- Upstash: Redis-compatible TCP URL

See [docs/deployment-chat-free-tier.md](docs/deployment-chat-free-tier.md) for the exact free-tier checklist.

# @campus-chat/database

Database foundation for Campus Chat. This package owns PostgreSQL schema migrations, Redis key conventions, and database-level operational functions.

## Package Layout

```txt
packages/database/
  schema.ts                  Convenience export for all table definitions
  src/
    schema/
      core.ts                Anonymous users, sessions, rooms, messages, location, rate limits
      moderation.ts          Reports, bans, evidence, risk signals, network cooldowns
      admin.ts               Admin users, admin sessions, audit log
      media.ts               Media assets and upload tokens
      schemas.ts             PostgreSQL schemas and custom column types
    models/
      *.ts                   Select/insert TypeScript model types
    redis.ts                 Redis key helpers
  migrations/
    *.sql                    Deployable PostgreSQL migration history
```

## Scope

Included:

- Anonymous users and browser/device sessions
- Display name history with immutable message attribution
- Rooms, participants, messages, reactions, location checks, geofence config, rate-limit config
- Reports, bans, ban evidence, risk signals, and network cooldowns
- Admin users, admin sessions, and partitioned audit logs
- Media assets and upload tokens
- Core triggers and helper functions
- Monthly partitions for messages and audit logs
- Redis key patterns for session cache, bans, rate limits, presence, typing, recent messages, room metadata, and network cooldowns

Not included:

- Next.js UI
- tRPC routers
- Socket.IO/WebSocket implementation
- Admin dashboard implementation
- Media storage provider code

## Migrations

```txt
0001_schemas_extensions.sql       Schemas and required PostgreSQL extensions
0002_core_tables.sql              Anonymous identity, rooms, messages, geofence, rate limits
0003_moderation_tables.sql        Reports, bans, evidence, risk signals, network cooldowns
0004_admin_tables.sql             Admin users, sessions, partitioned audit log
0005_media_tables.sql             Media assets and upload tokens
0006_cross_domain_constraints.sql Admin foreign keys across domains
0007_functions_triggers.sql       Stats, display-name, reaction, risk, upload functions
0008_partitions.sql               Current and next six months of partitions
0009_seed_data.sql                Default geofence, rate limits, system user
0010_ban_target_safety.sql        Ban target safety constraints
0011_fix_check_active_ban_scope.sql Active ban scope corrections
0012_user_display_color.sql       Anonymous user display color
0013_expand_geofence_radius.sql   Larger geofence radius precision
0014_state_geofence_radius.sql    Admin-configurable geofence radius
0015_remove_seed_rooms.sql        Removes old demo rooms from existing local databases
```

Run them from the repository root:

```bash
pnpm db:migrate
```

The default root command runs migrations through the local Docker Postgres service. The direct `psql` runner is still available as `pnpm db:migrate:psql`; it reads `.env` from the root and uses `DATABASE_URL`.

## Intentional Corrections From codex.md

- Uses `gen_random_uuid()` from `pgcrypto` instead of requiring the older `uuid-ossp` extension.
- Partitioned tables use composite primary keys that include `created_at`, which PostgreSQL requires.
- Message reaction references to partitioned messages are app-enforced by `message_id` instead of a broken FK.
- The geofence default constraint is a partial unique index, allowing only one active default.
- Admin audit categories are generated from `action_type` to prevent category drift.
- A default admin account is not seeded. Admin bootstrap should be handled explicitly by a secure setup command later.

BEGIN;

CREATE SCHEMA IF NOT EXISTS core;
COMMENT ON SCHEMA core IS 'Core anonymous chat entities: users, sessions, rooms, messages, location, rate limits';

CREATE SCHEMA IF NOT EXISTS moderation;
COMMENT ON SCHEMA moderation IS 'Moderation entities: reports, bans, ban evidence, risk signals, network cooldowns';

CREATE SCHEMA IF NOT EXISTS admin;
COMMENT ON SCHEMA admin IS 'Admin identities, admin sessions, and immutable admin audit logs';

CREATE SCHEMA IF NOT EXISTS media;
COMMENT ON SCHEMA media IS 'Uploaded media assets and direct-upload tokens';

CREATE SCHEMA IF NOT EXISTS archive;
COMMENT ON SCHEMA archive IS 'Detached old partitions and archived operational data';

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

COMMIT;


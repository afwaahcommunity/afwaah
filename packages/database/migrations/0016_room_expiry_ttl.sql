BEGIN;

ALTER TABLE core.rooms
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '2 hours');

UPDATE core.rooms
SET expires_at = NOW() + INTERVAL '2 hours'
WHERE status = 'active'
  AND expires_at IS NULL;

COMMIT;

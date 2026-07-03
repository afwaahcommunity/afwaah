BEGIN;

UPDATE core.rooms
SET status = 'deleted',
    slug = NULL,
    archived_at = COALESCE(archived_at, NOW())
WHERE id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004'
  )
  AND created_by_user_id = '00000000-0000-0000-0000-000000000001'
  AND slug IN ('general', 'academics', 'events', 'random');

COMMIT;

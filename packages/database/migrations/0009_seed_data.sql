BEGIN;

INSERT INTO core.geofence_config (
  name,
  description,
  center_latitude,
  center_longitude,
  radius_km,
  is_default
)
VALUES (
  'NIT Raipur Campus',
  'Default campus geofence for write access',
  21.2497,
  81.6022,
  5.0,
  TRUE
)
ON CONFLICT DO NOTHING;

INSERT INTO core.rate_limit_config (
  action_type,
  max_requests,
  window_seconds,
  burst_max,
  burst_window_seconds
)
VALUES
  ('message_send', 30, 60, 5, 5),
  ('message_burst', 5, 5, NULL, NULL),
  ('room_create', 3, 3600, NULL, NULL),
  ('display_name_change', 1, 300, NULL, NULL),
  ('image_upload', 10, 3600, 3, 60),
  ('report_create', 10, 3600, NULL, NULL),
  ('reaction_add', 30, 60, 10, 10),
  ('room_join', 20, 60, NULL, NULL)
ON CONFLICT (action_type) DO NOTHING;

INSERT INTO core.anonymous_users (
  id,
  current_display_name,
  trust_level,
  status
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'System',
  100,
  'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.rooms (
  id,
  slug,
  name,
  description,
  room_type,
  created_by_user_id,
  status
)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'general',
    'General',
    'Main campus discussion',
    'public',
    '00000000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'academics',
    'Academics',
    'Academic discussions and help',
    'public',
    '00000000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'events',
    'Events',
    'Campus events and announcements',
    'public',
    '00000000-0000-0000-0000-000000000001',
    'active'
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'random',
    'Random',
    'Off-topic conversations',
    'public',
    '00000000-0000-0000-0000-000000000001',
    'active'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;


BEGIN;

UPDATE core.geofence_config
SET
  radius_km = 500.0,
  description = 'State-level geofence for write access',
  updated_at = NOW()
WHERE is_default = TRUE;

COMMIT;

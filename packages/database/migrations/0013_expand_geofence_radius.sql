BEGIN;

ALTER TABLE core.rooms
  ALTER COLUMN custom_geofence_radius_km TYPE DECIMAL(8, 2);

ALTER TABLE core.location_checks
  ALTER COLUMN geofence_radius_km TYPE DECIMAL(8, 2);

ALTER TABLE core.geofence_config
  ALTER COLUMN radius_km TYPE DECIMAL(8, 2);

COMMIT;

export const postgresSchemas = [
  "core",
  "moderation",
  "admin",
  "media",
  "archive",
] as const;

export const migrationTable = "public.schema_migrations";

export const campusDefaults = {
  geofenceName: "NIT Raipur Campus",
  geofenceLatitude: 21.2497,
  geofenceLongitude: 81.6022,
  geofenceRadiusKm: 500,
} as const;

export type PostgresSchema = (typeof postgresSchemas)[number];

export * from "./schema";
export * from "./models";

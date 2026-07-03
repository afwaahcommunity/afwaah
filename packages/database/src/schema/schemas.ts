import { customType, pgSchema } from "drizzle-orm/pg-core";

export const coreSchema = pgSchema("core");
export const moderationSchema = pgSchema("moderation");
export const adminSchema = pgSchema("admin");
export const mediaSchema = pgSchema("media");
export const archiveSchema = pgSchema("archive");

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const byteaArray = customType<{ data: Buffer[]; driverData: Buffer[] }>({
  dataType() {
    return "bytea[]";
  },
});

export const inet = customType<{ data: string; driverData: string }>({
  dataType() {
    return "inet";
  },
});

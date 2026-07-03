import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  decimal,
  index,
  integer,
  jsonb,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { anonymousSessions, anonymousUsers, rooms } from "./core";
import { bytea, mediaSchema } from "./schemas";

export const mediaAssets = mediaSchema.table(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => anonymousUsers.id),
    uploadedBySessionId: uuid("uploaded_by_session_id")
      .notNull()
      .references(() => anonymousSessions.id),
    originalFilename: varchar("original_filename", { length: 255 }),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
    storageProvider: varchar("storage_provider", { length: 20 })
      .notNull()
      .default("local"),
    storageKey: varchar("storage_key", { length: 500 }).notNull().unique(),
    storageBucket: varchar("storage_bucket", { length: 100 }),
    storageRegion: varchar("storage_region", { length: 50 }),
    publicUrl: text("public_url"),
    cdnUrl: text("cdn_url"),
    signedUrlExpiresAt: timestamp("signed_url_expires_at", {
      withTimezone: true,
    }),
    width: integer("width"),
    height: integer("height"),
    dominantColor: varchar("dominant_color", { length: 7 }),
    blurHash: varchar("blur_hash", { length: 100 }),
    thumbnailUrl: text("thumbnail_url"),
    thumbnailStorageKey: varchar("thumbnail_storage_key", { length: 500 }),
    thumbnailWidth: integer("thumbnail_width"),
    thumbnailHeight: integer("thumbnail_height"),
    contentHash: bytea("content_hash").notNull(),
    perceptualHash: bytea("perceptual_hash"),
    moderationStatus: varchar("moderation_status", { length: 20 })
      .notNull()
      .default("pending"),
    moderationLabels: jsonb("moderation_labels")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),
    moderationConfidence: smallint("moderation_confidence"),
    moderationNotes: text("moderation_notes"),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    moderatedByAdminId: uuid("moderated_by_admin_id"),
    autoModerationResult: jsonb("auto_moderation_result").$type<
      Record<string, unknown>
    >(),
    usageCount: integer("usage_count").notNull().default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    status: varchar("status", { length: 20 }).notNull().default("processing"),
    processingError: text("processing_error"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByAdminId: uuid("deleted_by_admin_id"),
    deletionReason: text("deletion_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_media_assets_uploader").on(
      table.uploadedByUserId,
      table.createdAt.desc(),
    ),
    index("idx_media_assets_session").on(table.uploadedBySessionId),
    index("idx_media_assets_content_hash").on(table.contentHash),
    index("idx_media_assets_perceptual_hash")
      .on(table.perceptualHash)
      .where(sql`${table.perceptualHash} IS NOT NULL`),
    index("idx_media_assets_moderation")
      .on(table.moderationStatus, table.createdAt.desc())
      .where(sql`${table.moderationStatus} IN ('pending', 'flagged')`),
    index("idx_media_assets_status")
      .on(table.status)
      .where(sql`${table.status} = 'active'`),
    index("idx_media_assets_cleanup")
      .on(table.createdAt)
      .where(
        sql`${table.status} = 'processing' OR (${table.status} = 'active' AND ${table.usageCount} = 0)`,
      ),
    check(
      "media_assets_storage_provider_check",
      sql`${table.storageProvider} IN ('local', 's3', 'r2', 'gcs', 'cloudinary')`,
    ),
    check(
      "media_assets_moderation_status_check",
      sql`${table.moderationStatus} IN ('pending', 'approved', 'rejected', 'flagged', 'auto_approved')`,
    ),
    check(
      "media_assets_moderation_confidence_check",
      sql`${table.moderationConfidence} IS NULL OR ${table.moderationConfidence} BETWEEN 0 AND 100`,
    ),
    check(
      "media_assets_status_check",
      sql`${table.status} IN ('uploading', 'processing', 'active', 'deleted', 'quarantined')`,
    ),
    check("media_assets_usage_count_check", sql`${table.usageCount} >= 0`),
    check(
      "valid_image_dimensions",
      sql`(${table.mimeType} NOT LIKE 'image/%') OR (${table.width} IS NOT NULL AND ${table.height} IS NOT NULL)`,
    ),
    check(
      "valid_file_size",
      sql`${table.fileSizeBytes} > 0 AND ${table.fileSizeBytes} <= 52428800`,
    ),
  ],
);

export const uploadTokens = mediaSchema.table(
  "upload_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anonymousUserId: uuid("anonymous_user_id")
      .notNull()
      .references(() => anonymousUsers.id),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => anonymousSessions.id),
    tokenHash: bytea("token_hash").notNull().unique(),
    allowedMimeTypes: text("allowed_mime_types")
      .array()
      .notNull()
      .default(
        sql`ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']`,
      ),
    maxFileSizeBytes: bigint("max_file_size_bytes", { mode: "number" })
      .notNull()
      .default(10485760),
    targetRoomId: uuid("target_room_id").references(() => rooms.id),
    uploadPurpose: varchar("upload_purpose", { length: 30 })
      .notNull()
      .default("message_attachment"),
    presignedUrl: text("presigned_url"),
    presignedUrlExpiresAt: timestamp("presigned_url_expires_at", {
      withTimezone: true,
    }),
    uploadKey: varchar("upload_key", { length: 500 }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    resultingAssetId: uuid("resulting_asset_id").references(
      () => mediaAssets.id,
    ),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    clientFilename: varchar("client_filename", { length: 255 }),
    clientMimeType: varchar("client_mime_type", { length: 100 }),
    clientFileSize: bigint("client_file_size", { mode: "number" }),
  },
  (table) => [
    index("idx_upload_tokens_token")
      .on(table.tokenHash)
      .where(sql`${table.status} = 'pending'`),
    index("idx_upload_tokens_user").on(
      table.anonymousUserId,
      table.createdAt.desc(),
    ),
    index("idx_upload_tokens_session").on(
      table.sessionId,
      table.createdAt.desc(),
    ),
    index("idx_upload_tokens_expiry")
      .on(table.expiresAt)
      .where(sql`${table.status} IN ('pending', 'uploading')`),
    index("idx_upload_tokens_room")
      .on(table.targetRoomId)
      .where(sql`${table.targetRoomId} IS NOT NULL`),
    index("idx_upload_tokens_cleanup")
      .on(table.createdAt)
      .where(sql`${table.status} IN ('pending', 'uploading', 'expired')`),
    check(
      "upload_tokens_max_file_size_bytes_check",
      sql`${table.maxFileSizeBytes} > 0`,
    ),
    check(
      "upload_tokens_upload_purpose_check",
      sql`${table.uploadPurpose} IN ('message_attachment', 'room_avatar', 'profile_avatar')`,
    ),
    check(
      "upload_tokens_status_check",
      sql`${table.status} IN ('pending', 'uploading', 'used', 'expired', 'cancelled', 'failed')`,
    ),
    check(
      "valid_upload_token_window",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

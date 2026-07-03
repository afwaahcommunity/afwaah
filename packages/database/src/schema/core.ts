import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  decimal,
  index,
  integer,
  jsonb,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { bytea, coreSchema } from "./schemas";

export const anonymousUsers = coreSchema.table(
  "anonymous_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    currentDisplayName: varchar("current_display_name", {
      length: 50,
    }).notNull(),
    currentDisplayColor: varchar("current_display_color", {
      length: 7,
    })
      .notNull()
      .default("#64748B"),
    trustLevel: smallint("trust_level").notNull().default(50),
    riskScore: smallint("risk_score").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    totalMessagesSent: integer("total_messages_sent").notNull().default(0),
    totalRoomsCreated: integer("total_rooms_created").notNull().default(0),
    totalReportsReceived: integer("total_reports_received")
      .notNull()
      .default(0),
  },
  (table) => [
    index("idx_anonymous_users_status")
      .on(table.status)
      .where(sql`${table.status} != 'active'`),
    index("idx_anonymous_users_last_seen").on(table.lastSeenAt),
    index("idx_anonymous_users_risk")
      .on(table.riskScore)
      .where(sql`${table.riskScore} > 50`),
    check(
      "anonymous_users_trust_level_check",
      sql`${table.trustLevel} BETWEEN 0 AND 100`,
    ),
    check(
      "anonymous_users_risk_score_check",
      sql`${table.riskScore} BETWEEN 0 AND 100`,
    ),
    check(
      "anonymous_users_status_check",
      sql`${table.status} IN ('active', 'quarantined', 'write_banned', 'hard_banned')`,
    ),
    check(
      "anonymous_users_display_color_check",
      sql`${table.currentDisplayColor} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
  ],
);

export const anonymousSessions = coreSchema.table(
  "anonymous_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anonymousUserId: uuid("anonymous_user_id")
      .notNull()
      .references(() => anonymousUsers.id),
    tokenHash: bytea("token_hash").notNull().unique(),
    deviceInstallIdHash: bytea("device_install_id_hash"),
    fingerprintHash: bytea("fingerprint_hash"),
    userAgentHash: bytea("user_agent_hash").notNull(),
    ipHash: bytea("ip_hash").notNull(),
    ipSubnetHash: bytea("ip_subnet_hash"),
    asn: varchar("asn", { length: 20 }),
    lastKnownLat: decimal("last_known_lat", { precision: 9, scale: 6 }),
    lastKnownLng: decimal("last_known_lng", { precision: 9, scale: 6 }),
    lastLocationCheckAt: timestamp("last_location_check_at", {
      withTimezone: true,
    }),
    locationVerified: boolean("location_verified").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: varchar("revocation_reason", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sessions_user").on(table.anonymousUserId),
    index("idx_sessions_token")
      .on(table.tokenHash)
      .where(sql`${table.isActive} = TRUE`),
    index("idx_sessions_device")
      .on(table.deviceInstallIdHash)
      .where(sql`${table.deviceInstallIdHash} IS NOT NULL`),
    index("idx_sessions_fingerprint")
      .on(table.fingerprintHash)
      .where(sql`${table.fingerprintHash} IS NOT NULL`),
    index("idx_sessions_ip").on(table.ipHash),
    index("idx_sessions_active").on(table.isActive, table.lastSeenAt),
    check(
      "valid_session_location",
      sql`(${table.lastKnownLat} IS NULL AND ${table.lastKnownLng} IS NULL)
        OR (${table.lastKnownLat} IS NOT NULL AND ${table.lastKnownLng} IS NOT NULL)`,
    ),
  ],
);

export const displayNameHistory = coreSchema.table(
  "display_name_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anonymousUserId: uuid("anonymous_user_id")
      .notNull()
      .references(() => anonymousUsers.id),
    displayName: varchar("display_name", { length: 50 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    changeReason: varchar("change_reason", { length: 20 }).default(
      "user_change",
    ),
    changedByAdminId: uuid("changed_by_admin_id"),
    sessionId: uuid("session_id").references(() => anonymousSessions.id),
  },
  (table) => [
    index("idx_display_name_user").on(
      table.anonymousUserId,
      table.startedAt.desc(),
    ),
    index("idx_display_name_active")
      .on(table.anonymousUserId)
      .where(sql`${table.endedAt} IS NULL`),
    index("idx_display_name_search").using(
      "gin",
      sql`${table.displayName} gin_trgm_ops`,
    ),
    check(
      "display_name_history_change_reason_check",
      sql`${table.changeReason} IN ('initial', 'user_change', 'admin_reset', 'policy_violation')`,
    ),
  ],
);

export const rooms = coreSchema.table(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 100 }).unique(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    roomType: varchar("room_type", { length: 20 }).notNull().default("public"),
    inviteCode: varchar("invite_code", { length: 20 }).unique(),
    inviteCodeExpiresAt: timestamp("invite_code_expires_at", {
      withTimezone: true,
    }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => anonymousUsers.id),
    createdBySessionId: uuid("created_by_session_id").references(
      () => anonymousSessions.id,
    ),
    maxParticipants: integer("max_participants").default(500),
    allowImages: boolean("allow_images").notNull().default(true),
    allowLinks: boolean("allow_links").notNull().default(true),
    slowModeSeconds: integer("slow_mode_seconds").default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    lockedReason: text("locked_reason"),
    lockedByAdminId: uuid("locked_by_admin_id"),
    participantCount: integer("participant_count").notNull().default(0),
    messageCount: integer("message_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    customGeofenceLat: decimal("custom_geofence_lat", {
      precision: 9,
      scale: 6,
    }),
    customGeofenceLng: decimal("custom_geofence_lng", {
      precision: 9,
      scale: 6,
    }),
    customGeofenceRadiusKm: decimal("custom_geofence_radius_km", {
      precision: 8,
      scale: 2,
    }),
  },
  (table) => [
    index("idx_rooms_status")
      .on(table.status)
      .where(sql`${table.status} = 'active'`),
    index("idx_rooms_type_status").on(table.roomType, table.status),
    index("idx_rooms_last_activity")
      .on(table.lastMessageAt.desc())
      .where(sql`${table.status} = 'active'`),
    index("idx_rooms_invite")
      .on(table.inviteCode)
      .where(
        sql`${table.inviteCode} IS NOT NULL AND ${table.status} = 'active'`,
      ),
    index("idx_rooms_expiry")
      .on(table.expiresAt)
      .where(
        sql`${table.expiresAt} IS NOT NULL AND ${table.status} = 'active'`,
      ),
    index("idx_rooms_creator").on(table.createdByUserId),
    check("rooms_slow_mode_seconds_check", sql`${table.slowModeSeconds} >= 0`),
    check("rooms_participant_count_check", sql`${table.participantCount} >= 0`),
    check("rooms_message_count_check", sql`${table.messageCount} >= 0`),
    check(
      "rooms_room_type_check",
      sql`${table.roomType} IN ('public', 'private', 'announcement')`,
    ),
    check(
      "rooms_status_check",
      sql`${table.status} IN ('active', 'archived', 'deleted', 'locked')`,
    ),
    check(
      "valid_room_geofence",
      sql`(
          ${table.customGeofenceLat} IS NULL
          AND ${table.customGeofenceLng} IS NULL
          AND ${table.customGeofenceRadiusKm} IS NULL
        )
        OR (
          ${table.customGeofenceLat} IS NOT NULL
          AND ${table.customGeofenceLng} IS NOT NULL
          AND ${table.customGeofenceRadiusKm} IS NOT NULL
          AND ${table.customGeofenceRadiusKm} > 0
        )`,
    ),
  ],
);

export const roomParticipants = coreSchema.table(
  "room_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    anonymousUserId: uuid("anonymous_user_id")
      .notNull()
      .references(() => anonymousUsers.id),
    role: varchar("role", { length: 20 }).notNull().default("member"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    bannedReason: text("banned_reason"),
    bannedByAdminId: uuid("banned_by_admin_id"),
    banExpiresAt: timestamp("ban_expires_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    notificationsEnabled: boolean("notifications_enabled")
      .notNull()
      .default(true),
  },
  (table) => [
    uniqueIndex("room_participants_room_id_anonymous_user_id_unique").on(
      table.roomId,
      table.anonymousUserId,
    ),
    index("idx_participants_room")
      .on(table.roomId)
      .where(sql`${table.status} = 'active'`),
    index("idx_participants_user").on(table.anonymousUserId, table.status),
    index("idx_participants_banned")
      .on(table.roomId, table.anonymousUserId)
      .where(sql`${table.status} = 'banned'`),
    index("idx_participants_ban_expiry")
      .on(table.banExpiresAt)
      .where(
        sql`${table.banExpiresAt} IS NOT NULL AND ${table.status} = 'banned'`,
      ),
    check(
      "room_participants_role_check",
      sql`${table.role} IN ('member', 'moderator', 'creator')`,
    ),
    check(
      "room_participants_status_check",
      sql`${table.status} IN ('active', 'left', 'kicked', 'banned')`,
    ),
  ],
);

export const messages = coreSchema.table(
  "messages",
  {
    id: uuid("id").notNull().defaultRandom(),
    clientMessageId: uuid("client_message_id").notNull(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id),
    anonymousUserId: uuid("anonymous_user_id")
      .notNull()
      .references(() => anonymousUsers.id),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => anonymousSessions.id),
    displayNameSnapshot: varchar("display_name_snapshot", {
      length: 50,
    }).notNull(),
    displayColorSnapshot: varchar("display_color_snapshot", {
      length: 7,
    })
      .notNull()
      .default("#64748B"),
    body: text("body").notNull(),
    bodyType: varchar("body_type", { length: 20 }).notNull().default("text"),
    mediaAssetId: uuid("media_asset_id"),
    status: varchar("status", { length: 20 }).notNull().default("visible"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByAdminId: uuid("deleted_by_admin_id"),
    deletionReason: text("deletion_reason"),
    replyToMessageId: uuid("reply_to_message_id"),
    reactionCounts: jsonb("reaction_counts")
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.createdAt] }),
    index("idx_messages_room_time").on(table.roomId, table.createdAt.desc()),
    index("idx_messages_user").on(
      table.anonymousUserId,
      table.createdAt.desc(),
    ),
    index("idx_messages_status")
      .on(table.status)
      .where(sql`${table.status} != 'visible'`),
    index("idx_messages_reply")
      .on(table.replyToMessageId)
      .where(sql`${table.replyToMessageId} IS NOT NULL`),
    index("idx_messages_dedup").on(
      table.roomId,
      table.clientMessageId,
      table.createdAt.desc(),
    ),
    check(
      "messages_body_length_check",
      sql`char_length(${table.body}) <= 4000`,
    ),
    check(
      "messages_body_type_check",
      sql`${table.bodyType} IN ('text', 'image', 'system')`,
    ),
    check(
      "messages_status_check",
      sql`${table.status} IN ('visible', 'deleted', 'moderation_pending', 'moderation_hidden')`,
    ),
    check(
      "messages_display_color_snapshot_check",
      sql`${table.displayColorSnapshot} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
  ],
);

export const messageReactions = coreSchema.table(
  "message_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull(),
    anonymousUserId: uuid("anonymous_user_id")
      .notNull()
      .references(() => anonymousUsers.id),
    emoji: varchar("emoji", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex(
      "message_reactions_message_id_anonymous_user_id_emoji_unique",
    ).on(table.messageId, table.anonymousUserId, table.emoji),
    index("idx_reactions_message").on(table.messageId),
    index("idx_reactions_user").on(table.anonymousUserId),
  ],
);

export const locationChecks = coreSchema.table(
  "location_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => anonymousSessions.id),
    anonymousUserId: uuid("anonymous_user_id")
      .notNull()
      .references(() => anonymousUsers.id),
    latitude: decimal("latitude", { precision: 9, scale: 6 }).notNull(),
    longitude: decimal("longitude", { precision: 9, scale: 6 }).notNull(),
    accuracyMeters: decimal("accuracy_meters", { precision: 10, scale: 2 }),
    isWithinGeofence: boolean("is_within_geofence").notNull(),
    distanceFromCenterKm: decimal("distance_from_center_km", {
      precision: 10,
      scale: 3,
    }),
    geofenceCenterLat: decimal("geofence_center_lat", {
      precision: 9,
      scale: 6,
    }).notNull(),
    geofenceCenterLng: decimal("geofence_center_lng", {
      precision: 9,
      scale: 6,
    }).notNull(),
    geofenceRadiusKm: decimal("geofence_radius_km", {
      precision: 8,
      scale: 2,
    }).notNull(),
    verificationMethod: varchar("verification_method", { length: 30 })
      .notNull()
      .default("browser_geolocation"),
    confidenceScore: smallint("confidence_score").notNull().default(50),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("idx_location_checks_session").on(
      table.sessionId,
      table.createdAt.desc(),
    ),
    index("idx_location_checks_valid")
      .on(table.sessionId, table.validUntil)
      .where(sql`${table.isWithinGeofence} = TRUE`),
    check(
      "location_checks_verification_method_check",
      sql`${table.verificationMethod} IN ('browser_geolocation', 'ip_geolocation', 'manual_override')`,
    ),
    check(
      "location_checks_confidence_score_check",
      sql`${table.confidenceScore} BETWEEN 0 AND 100`,
    ),
  ],
);

export const geofenceConfig = coreSchema.table(
  "geofence_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    centerLatitude: decimal("center_latitude", {
      precision: 9,
      scale: 6,
    }).notNull(),
    centerLongitude: decimal("center_longitude", {
      precision: 9,
      scale: 6,
    }).notNull(),
    radiusKm: decimal("radius_km", { precision: 8, scale: 2 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_geofence_active")
      .on(table.isActive)
      .where(sql`${table.isActive} = TRUE`),
    uniqueIndex("uniq_geofence_default")
      .on(table.isDefault)
      .where(sql`${table.isDefault} = TRUE`),
    check("geofence_config_radius_km_check", sql`${table.radiusKm} > 0`),
  ],
);

export const rateLimitConfig = coreSchema.table(
  "rate_limit_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionType: varchar("action_type", { length: 50 }).notNull().unique(),
    maxRequests: integer("max_requests").notNull(),
    windowSeconds: integer("window_seconds").notNull(),
    burstMax: integer("burst_max"),
    burstWindowSeconds: integer("burst_window_seconds"),
    trustMultipliers: jsonb("trust_multipliers")
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{"0": 0.5, "50": 1.0, "100": 2.0}'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "rate_limit_config_action_type_check",
      sql`${table.actionType} IN (
        'message_send',
        'message_burst',
        'room_create',
        'display_name_change',
        'display_color_change',
        'image_upload',
        'report_create',
        'reaction_add',
        'room_join'
      )`,
    ),
    check(
      "rate_limit_config_max_requests_check",
      sql`${table.maxRequests} > 0`,
    ),
    check(
      "rate_limit_config_window_seconds_check",
      sql`${table.windowSeconds} > 0`,
    ),
    check(
      "rate_limit_config_burst_max_check",
      sql`${table.burstMax} IS NULL OR ${table.burstMax} > 0`,
    ),
    check(
      "rate_limit_config_burst_window_seconds_check",
      sql`${table.burstWindowSeconds} IS NULL OR ${table.burstWindowSeconds} > 0`,
    ),
  ],
);

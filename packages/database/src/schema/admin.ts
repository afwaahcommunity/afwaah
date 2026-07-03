import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { bytea, byteaArray, adminSchema, inet } from "./schemas";

export const adminUsers = adminSchema.table(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    avatarUrl: text("avatar_url"),
    role: varchar("role", { length: 20 }).notNull().default("moderator"),
    permissions: jsonb("permissions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastLoginIp: inet("last_login_ip"),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    mfaSecretEncrypted: bytea("mfa_secret_encrypted"),
    mfaBackupCodesHash: byteaArray("mfa_backup_codes_hash"),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    mustChangePassword: boolean("must_change_password")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdByAdminId: uuid("created_by_admin_id"),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    deactivatedByAdminId: uuid("deactivated_by_admin_id"),
    deactivationReason: text("deactivation_reason"),
  },
  (table) => [
    uniqueIndex("idx_admin_users_email").on(sql`LOWER(${table.email})`),
    index("idx_admin_users_role")
      .on(table.role)
      .where(sql`${table.isActive} = TRUE`),
    index("idx_admin_users_active")
      .on(table.isActive)
      .where(sql`${table.isActive} = TRUE`),
    check(
      "admin_users_role_check",
      sql`${table.role} IN ('moderator', 'admin', 'super_admin')`,
    ),
    check(
      "admin_users_failed_login_attempts_check",
      sql`${table.failedLoginAttempts} >= 0`,
    ),
  ],
);

export const auditLog = adminSchema.table(
  "audit_log",
  {
    id: uuid("id").notNull().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => adminUsers.id),
    adminEmail: varchar("admin_email", { length: 255 }).notNull(),
    adminRole: varchar("admin_role", { length: 20 }).notNull(),
    actionType: varchar("action_type", { length: 50 }).notNull(),
    actionCategory: varchar("action_category", {
      length: 30,
    }).generatedAlwaysAs(sql`admin.get_action_category(action_type)`),
    targetUserId: uuid("target_user_id"),
    targetSessionId: uuid("target_session_id"),
    targetRoomId: uuid("target_room_id"),
    targetMessageId: uuid("target_message_id"),
    targetReportId: uuid("target_report_id"),
    targetBanId: uuid("target_ban_id"),
    targetAdminId: uuid("target_admin_id"),
    targetCooldownId: uuid("target_cooldown_id"),
    reason: text("reason"),
    internalNotes: text("internal_notes"),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    evidenceSnapshot:
      jsonb("evidence_snapshot").$type<Record<string, unknown>>(),
    previousState: jsonb("previous_state").$type<Record<string, unknown>>(),
    newState: jsonb("new_state").$type<Record<string, unknown>>(),
    ipAddress: inet("ip_address").notNull(),
    userAgent: text("user_agent"),
    requestId: uuid("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.createdAt] }),
    index("idx_audit_log_admin").on(table.adminId, table.createdAt.desc()),
    index("idx_audit_log_action").on(table.actionType, table.createdAt.desc()),
    index("idx_audit_log_category").on(
      table.actionCategory,
      table.createdAt.desc(),
    ),
    index("idx_audit_log_target_user")
      .on(table.targetUserId, table.createdAt.desc())
      .where(sql`${table.targetUserId} IS NOT NULL`),
    index("idx_audit_log_target_room")
      .on(table.targetRoomId, table.createdAt.desc())
      .where(sql`${table.targetRoomId} IS NOT NULL`),
    index("idx_audit_log_target_message")
      .on(table.targetMessageId)
      .where(sql`${table.targetMessageId} IS NOT NULL`),
    index("idx_audit_log_time").on(table.createdAt.desc()),
    check(
      "audit_log_action_type_check",
      sql`${table.actionType} IN (
        'DELETE_MESSAGE',
        'HIDE_MESSAGE',
        'APPROVE_MESSAGE',
        'ROOM_BAN',
        'GLOBAL_WRITE_BAN',
        'GLOBAL_HARD_BAN',
        'QUARANTINE',
        'UNBAN',
        'UPDATE_TRUST_LEVEL',
        'RESET_DISPLAY_NAME',
        'NETWORK_COOLDOWN',
        'CANCEL_COOLDOWN',
        'LOCK_ROOM',
        'UNLOCK_ROOM',
        'DELETE_ROOM',
        'ARCHIVE_ROOM',
        'UPDATE_ROOM_SETTINGS',
        'RESOLVE_REPORT',
        'DISMISS_REPORT',
        'ESCALATE_REPORT',
        'CREATE_ADMIN',
        'UPDATE_ADMIN',
        'DEACTIVATE_ADMIN',
        'REACTIVATE_ADMIN',
        'RESET_ADMIN_PASSWORD',
        'VIEW_USER_PROFILE',
        'VIEW_USER_MESSAGES',
        'VIEW_USER_SESSIONS',
        'EXPORT_DATA',
        'SEARCH_USERS',
        'UPDATE_RATE_LIMITS',
        'UPDATE_GEOFENCE',
        'SYSTEM_ANNOUNCEMENT'
      )`,
    ),
    check(
      "audit_log_action_category_check",
      sql`${table.actionCategory} IN (
        'message_moderation',
        'user_moderation',
        'network_moderation',
        'room_moderation',
        'report_handling',
        'admin_management',
        'data_access',
        'system_config'
      )`,
    ),
  ],
);

export const adminSessions = adminSchema.table(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => adminUsers.id),
    tokenHash: bytea("token_hash").notNull().unique(),
    refreshTokenHash: bytea("refresh_token_hash").unique(),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    ipAddress: inet("ip_address").notNull(),
    userAgent: text("user_agent"),
    deviceInfo: jsonb("device_info").$type<Record<string, unknown>>(),
    isActive: boolean("is_active").notNull().default(true),
    requiresMfaVerification: boolean("requires_mfa_verification")
      .notNull()
      .default(false),
    mfaVerifiedAt: timestamp("mfa_verified_at", { withTimezone: true }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActiveIp: inet("last_active_ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: varchar("revocation_reason", { length: 100 }),
    revokedByAdminId: uuid("revoked_by_admin_id").references(
      () => adminUsers.id,
    ),
  },
  (table) => [
    index("idx_admin_sessions_admin")
      .on(table.adminId)
      .where(sql`${table.isActive} = TRUE`),
    index("idx_admin_sessions_token")
      .on(table.tokenHash)
      .where(sql`${table.isActive} = TRUE`),
    index("idx_admin_sessions_refresh")
      .on(table.refreshTokenHash)
      .where(
        sql`${table.isActive} = TRUE AND ${table.refreshTokenHash} IS NOT NULL`,
      ),
    index("idx_admin_sessions_expiry")
      .on(table.expiresAt)
      .where(sql`${table.isActive} = TRUE`),
    index("idx_admin_sessions_activity")
      .on(table.lastActiveAt.desc())
      .where(sql`${table.isActive} = TRUE`),
  ],
);

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { anonymousSessions, anonymousUsers, rooms } from "./core";
import { bytea, moderationSchema } from "./schemas";

export const reports = moderationSchema.table(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => anonymousUsers.id),
    reporterSessionId: uuid("reporter_session_id").references(
      () => anonymousSessions.id,
    ),
    targetType: varchar("target_type", { length: 20 }).notNull(),
    targetMessageId: uuid("target_message_id"),
    targetRoomId: uuid("target_room_id"),
    targetUserId: uuid("target_user_id"),
    reason: varchar("reason", { length: 50 }).notNull(),
    description: text("description"),
    evidenceSnapshot: jsonb("evidence_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByAdminId: uuid("resolved_by_admin_id"),
    resolutionAction: varchar("resolution_action", { length: 50 }),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_reports_status").on(table.status, table.createdAt.desc()),
    index("idx_reports_target_user")
      .on(table.targetUserId)
      .where(sql`${table.targetType} = 'user'`),
    index("idx_reports_target_message")
      .on(table.targetMessageId)
      .where(sql`${table.targetType} = 'message'`),
    index("idx_reports_reporter").on(table.reporterUserId),
    check(
      "reports_target_type_check",
      sql`${table.targetType} IN ('message', 'room', 'user')`,
    ),
    check(
      "reports_reason_check",
      sql`${table.reason} IN (
        'spam',
        'harassment',
        'hate_speech',
        'threats',
        'illegal_content',
        'impersonation',
        'other'
      )`,
    ),
    check(
      "reports_status_check",
      sql`${table.status} IN ('pending', 'reviewing', 'resolved', 'dismissed')`,
    ),
    check(
      "valid_report_target",
      sql`(${table.targetType} = 'message' AND ${table.targetMessageId} IS NOT NULL)
        OR (${table.targetType} = 'room' AND ${table.targetRoomId} IS NOT NULL)
        OR (${table.targetType} = 'user' AND ${table.targetUserId} IS NOT NULL)`,
    ),
  ],
);

export const bans = moderationSchema.table(
  "bans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetUserId: uuid("target_user_id").references(() => anonymousUsers.id),
    targetSessionId: uuid("target_session_id").references(
      () => anonymousSessions.id,
    ),
    targetRoomId: uuid("target_room_id").references(() => rooms.id),
    banType: varchar("ban_type", { length: 30 }).notNull(),
    confidenceScore: smallint("confidence_score").notNull().default(100),
    reason: text("reason").notNull(),
    internalNotes: text("internal_notes"),
    primaryEvidenceId: uuid("primary_evidence_id"),
    isPermanent: boolean("is_permanent").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdByAdminId: uuid("created_by_admin_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByAdminId: uuid("revoked_by_admin_id"),
    revocationReason: text("revocation_reason"),
  },
  (table) => [
    index("idx_bans_active_user")
      .on(table.targetUserId)
      .where(sql`${table.isActive} = TRUE`),
    index("idx_bans_active_session")
      .on(table.targetSessionId)
      .where(sql`${table.isActive} = TRUE`),
    index("idx_bans_room")
      .on(table.targetRoomId, table.targetUserId)
      .where(sql`${table.banType} = 'room_ban' AND ${table.isActive} = TRUE`),
    index("idx_bans_expiry")
      .on(table.expiresAt)
      .where(sql`${table.isActive} = TRUE AND ${table.expiresAt} IS NOT NULL`),
    index("idx_bans_type")
      .on(table.banType)
      .where(sql`${table.isActive} = TRUE`),
    check(
      "bans_ban_type_check",
      sql`${table.banType} IN ('room_ban', 'global_write_ban', 'global_hard_ban', 'quarantine')`,
    ),
    check(
      "bans_confidence_score_check",
      sql`${table.confidenceScore} BETWEEN 0 AND 100`,
    ),
    check(
      "valid_ban_target",
      sql`${table.targetUserId} IS NOT NULL
        OR ${table.targetSessionId} IS NOT NULL`,
    ),
    check(
      "valid_ban_expiry",
      sql`${table.isPermanent} = TRUE OR ${table.expiresAt} IS NOT NULL`,
    ),
    check(
      "valid_room_ban",
      sql`(
          ${table.banType} = 'room_ban'
          AND ${table.targetRoomId} IS NOT NULL
          AND (
            ${table.targetUserId} IS NOT NULL
            OR ${table.targetSessionId} IS NOT NULL
          )
        )
        OR (
          ${table.banType} != 'room_ban'
          AND ${table.targetRoomId} IS NULL
        )`,
    ),
  ],
);

export const banEvidence = moderationSchema.table(
  "ban_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    banId: uuid("ban_id")
      .notNull()
      .references(() => bans.id),
    evidenceType: varchar("evidence_type", { length: 30 }).notNull(),
    signalName: varchar("signal_name", { length: 50 }).notNull(),
    signalValueHash: bytea("signal_value_hash"),
    signalValuePreview: varchar("signal_value_preview", { length: 100 }),
    matchConfidence: smallint("match_confidence").notNull(),
    matchedAgainstBanId: uuid("matched_against_ban_id").references(
      () => bans.id,
    ),
    description: text("description"),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_ban_evidence_ban").on(table.banId),
    index("idx_ban_evidence_type").on(table.evidenceType),
    index("idx_ban_evidence_signal")
      .on(table.signalValueHash)
      .where(sql`${table.signalValueHash} IS NOT NULL`),
    check(
      "ban_evidence_evidence_type_check",
      sql`${table.evidenceType} IN (
        'session_match',
        'device_match',
        'fingerprint_match',
        'ip_match',
        'subnet_match',
        'behavior_pattern',
        'content_similarity',
        'user_report',
        'admin_observation',
        'automated_detection'
      )`,
    ),
    check(
      "ban_evidence_match_confidence_check",
      sql`${table.matchConfidence} BETWEEN 0 AND 100`,
    ),
  ],
);

export const riskSignals = moderationSchema.table(
  "risk_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    signalType: varchar("signal_type", { length: 30 }).notNull(),
    signalValueHash: bytea("signal_value_hash").notNull(),
    riskLevel: varchar("risk_level", { length: 20 })
      .notNull()
      .default("unknown"),
    riskScore: smallint("risk_score").notNull().default(0),
    totalSessionsSeen: integer("total_sessions_seen").notNull().default(1),
    totalBansAssociated: integer("total_bans_associated").notNull().default(0),
    isSharedSignal: boolean("is_shared_signal").notNull().default(false),
    concurrentUsersEstimate: integer("concurrent_users_estimate"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastBanAt: timestamp("last_ban_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("risk_signals_signal_type_signal_value_hash_unique").on(
      table.signalType,
      table.signalValueHash,
    ),
    index("idx_risk_signals_lookup").on(
      table.signalType,
      table.signalValueHash,
    ),
    index("idx_risk_signals_high_risk")
      .on(table.riskLevel)
      .where(sql`${table.riskLevel} IN ('high', 'blocked')`),
    index("idx_risk_signals_shared")
      .on(table.isSharedSignal)
      .where(sql`${table.isSharedSignal} = TRUE`),
    check(
      "risk_signals_signal_type_check",
      sql`${table.signalType} IN (
        'ip_hash',
        'subnet_hash',
        'device_id_hash',
        'fingerprint_hash',
        'user_agent_hash',
        'asn'
      )`,
    ),
    check(
      "risk_signals_risk_level_check",
      sql`${table.riskLevel} IN ('safe', 'low', 'medium', 'high', 'blocked', 'unknown')`,
    ),
    check(
      "risk_signals_risk_score_check",
      sql`${table.riskScore} BETWEEN 0 AND 100`,
    ),
    check(
      "risk_signals_total_sessions_seen_check",
      sql`${table.totalSessionsSeen} >= 0`,
    ),
    check(
      "risk_signals_total_bans_associated_check",
      sql`${table.totalBansAssociated} >= 0`,
    ),
    check(
      "risk_signals_concurrent_users_estimate_check",
      sql`${table.concurrentUsersEstimate} IS NULL OR ${table.concurrentUsersEstimate} >= 0`,
    ),
  ],
);

export const networkCooldowns = moderationSchema.table(
  "network_cooldowns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: varchar("target_type", { length: 20 }).notNull(),
    targetValueHash: bytea("target_value_hash").notNull(),
    targetValuePreview: varchar("target_value_preview", { length: 50 }),
    restrictionType: varchar("restriction_type", { length: 30 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
    affectedSessionsEstimate: integer("affected_sessions_estimate"),
    createdByAdminId: uuid("created_by_admin_id").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByAdminId: uuid("cancelled_by_admin_id"),
    cancellationReason: text("cancellation_reason"),
  },
  (table) => [
    index("idx_cooldowns_active")
      .on(table.targetType, table.targetValueHash)
      .where(sql`${table.isActive} = TRUE`),
    index("idx_cooldowns_expiry")
      .on(table.expiresAt)
      .where(sql`${table.isActive} = TRUE`),
    index("idx_cooldowns_admin").on(table.createdByAdminId),
    check(
      "network_cooldowns_target_type_check",
      sql`${table.targetType} IN ('ip', 'subnet', 'asn')`,
    ),
    check(
      "network_cooldowns_restriction_type_check",
      sql`${table.restrictionType} IN (
        'rate_limit_reduced',
        'write_disabled',
        'room_creation_disabled',
        'quarantine_new_sessions'
      )`,
    ),
    check(
      "network_cooldowns_affected_sessions_estimate_check",
      sql`${table.affectedSessionsEstimate} IS NULL OR ${table.affectedSessionsEstimate} >= 0`,
    ),
    check(
      "valid_cooldown_window",
      sql`${table.expiresAt} > ${table.startedAt}`,
    ),
  ],
);

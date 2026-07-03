import {
  banEvidence,
  bans,
  reports,
  riskSignals,
} from "@campus-chat/database/schema";
import type { Ban, BanEvidence, Report } from "@campus-chat/database/models";
import { and, desc, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm";

import type {
  BanEvidenceInput,
  BanInput,
  CreateReportInput,
  ReportStatus,
  RiskSignalInput,
} from "../types";
import { BaseRepository, type DrizzleClient } from "./base";

export interface ActiveBanEvidenceMatch {
  ban: Ban;
  evidence: BanEvidence;
}

export interface BanEvidenceLookup {
  signalName: string;
  signalValueHash: Buffer;
}

export class ModerationRepository extends BaseRepository {
  constructor(db: DrizzleClient) {
    super(db);
  }

  async findMostSevereActiveBan(input: {
    roomId?: string;
    sessionId?: string;
    userId: string;
  }): Promise<Ban | null> {
    const now = new Date();
    const identityConditions: SQL[] = [eq(bans.targetUserId, input.userId)];
    if (input.sessionId) {
      identityConditions.push(eq(bans.targetSessionId, input.sessionId));
    }

    const identityMatch = or(...identityConditions);
    const globalBanMatch = and(
      identityMatch,
      or(
        eq(bans.banType, "global_hard_ban"),
        eq(bans.banType, "global_write_ban"),
        eq(bans.banType, "quarantine"),
      ),
    );
    const roomBanMatch = input.roomId
      ? and(
          identityMatch,
          eq(bans.banType, "room_ban"),
          eq(bans.targetRoomId, input.roomId),
        )
      : undefined;

    const [ban] = await this.db
      .select()
      .from(bans)
      .where(
        and(
          eq(bans.isActive, true),
          or(isNull(bans.expiresAt), gt(bans.expiresAt, now)),
          roomBanMatch ? or(globalBanMatch, roomBanMatch) : globalBanMatch,
        ),
      )
      .orderBy(
        sql`CASE ${bans.banType}
          WHEN 'global_hard_ban' THEN 1
          WHEN 'global_write_ban' THEN 2
          WHEN 'quarantine' THEN 3
          WHEN 'room_ban' THEN 4
          ELSE 5
        END`,
        desc(bans.confidenceScore),
        desc(bans.createdAt),
      )
      .limit(1);

    return ban ?? null;
  }

  async findActiveRoomBan(input: {
    roomId: string;
    sessionId?: string;
    userId: string;
  }): Promise<Ban | null> {
    const now = new Date();
    const identityConditions: SQL[] = [eq(bans.targetUserId, input.userId)];
    if (input.sessionId) {
      identityConditions.push(eq(bans.targetSessionId, input.sessionId));
    }

    const [ban] = await this.db
      .select()
      .from(bans)
      .where(
        and(
          eq(bans.isActive, true),
          or(isNull(bans.expiresAt), gt(bans.expiresAt, now)),
          eq(bans.banType, "room_ban"),
          eq(bans.targetRoomId, input.roomId),
          or(...identityConditions),
        ),
      )
      .orderBy(desc(bans.confidenceScore), desc(bans.createdAt))
      .limit(1);

    return ban ?? null;
  }

  async createBan(adminId: string, input: BanInput): Promise<Ban> {
    const [ban] = await this.db
      .insert(bans)
      .values({
        banType: input.banType,
        confidenceScore: input.confidenceScore ?? 100,
        createdByAdminId: adminId,
        expiresAt: input.isPermanent ? null : input.expiresAt,
        internalNotes: input.internalNotes,
        isPermanent: input.isPermanent ?? false,
        reason: input.reason,
        targetRoomId: input.targetRoomId,
        targetSessionId: input.targetSessionId,
        targetUserId: input.targetUserId,
      })
      .returning();

    if (!ban) {
      throw new Error("Failed to create ban.");
    }

    return ban;
  }

  async createBanEvidence(
    banId: string,
    evidenceItems: BanEvidenceInput[],
  ): Promise<BanEvidence[]> {
    if (evidenceItems.length === 0) return [];

    return this.db
      .insert(banEvidence)
      .values(
        evidenceItems.map((evidence) => ({
          banId,
          description: evidence.description,
          evidenceType: evidence.evidenceType,
          matchConfidence: evidence.matchConfidence,
          matchedAgainstBanId: evidence.matchedAgainstBanId,
          rawData: evidence.rawData,
          signalName: evidence.signalName,
          signalValueHash: evidence.signalValueHash,
          signalValuePreview: evidence.signalValuePreview,
        })),
      )
      .returning();
  }

  async findActiveBanByEvidence(
    lookups: BanEvidenceLookup[],
  ): Promise<ActiveBanEvidenceMatch | null> {
    if (lookups.length === 0) return null;

    const now = new Date();
    const lookupConditions = lookups.map((lookup) =>
      and(
        eq(banEvidence.signalName, lookup.signalName),
        eq(banEvidence.signalValueHash, lookup.signalValueHash),
      ),
    );

    const [match] = await this.db
      .select({ ban: bans, evidence: banEvidence })
      .from(banEvidence)
      .innerJoin(bans, eq(banEvidence.banId, bans.id))
      .where(
        and(
          eq(bans.isActive, true),
          or(isNull(bans.expiresAt), gt(bans.expiresAt, now)),
          or(...lookupConditions),
        ),
      )
      .orderBy(
        desc(banEvidence.matchConfidence),
        sql`CASE ${bans.banType}
          WHEN 'global_hard_ban' THEN 1
          WHEN 'global_write_ban' THEN 2
          WHEN 'quarantine' THEN 3
          WHEN 'room_ban' THEN 4
          ELSE 5
        END`,
        desc(bans.confidenceScore),
        desc(bans.createdAt),
      )
      .limit(1);

    return match ?? null;
  }

  async createReport(
    reporterUserId: string,
    reporterSessionId: string | null,
    input: CreateReportInput,
  ): Promise<Report> {
    const [report] = await this.db
      .insert(reports)
      .values({
        description: input.description,
        evidenceSnapshot: input.evidenceSnapshot ?? {},
        reason: input.reason,
        reporterSessionId,
        reporterUserId,
        targetMessageId: input.targetMessageId,
        targetRoomId: input.targetRoomId,
        targetType: input.targetType,
        targetUserId: input.targetUserId,
      })
      .returning();

    if (!report) {
      throw new Error("Failed to create report.");
    }

    return report;
  }

  async findReportById(reportId: string): Promise<Report | null> {
    const [report] = await this.db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    return report ?? null;
  }

  async listReports(limit = 100): Promise<Report[]> {
    return this.db
      .select()
      .from(reports)
      .orderBy(desc(reports.createdAt))
      .limit(limit);
  }

  async countOpenReports(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(
        or(eq(reports.status, "pending"), eq(reports.status, "reviewing")),
      );

    return result?.count ?? 0;
  }

  async countActiveBans(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bans)
      .where(
        and(
          eq(bans.isActive, true),
          or(isNull(bans.expiresAt), gt(bans.expiresAt, new Date())),
        ),
      );

    return result?.count ?? 0;
  }

  async listBansByUserId(userId: string, limit = 20): Promise<Ban[]> {
    return this.db
      .select()
      .from(bans)
      .where(eq(bans.targetUserId, userId))
      .orderBy(desc(bans.createdAt))
      .limit(limit);
  }

  async countReportsForUser(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(eq(reports.targetUserId, userId));

    return result?.count ?? 0;
  }

  async listFlaggedUserIds(
    limit = 20,
  ): Promise<Array<{ lastReportedAt: Date; reportCount: number; userId: string }>> {
    const rows = await this.db
      .select({
        lastReportedAt: sql<Date>`max(${reports.createdAt})`,
        reportCount: sql<number>`count(*)::int`,
        userId: reports.targetUserId,
      })
      .from(reports)
      .where(sql`${reports.targetUserId} IS NOT NULL`)
      .groupBy(reports.targetUserId)
      .orderBy(
        sql`count(*) DESC`,
        sql`max(${reports.createdAt}) DESC`,
      )
      .limit(limit);

    return rows.flatMap((row) =>
      row.userId
        ? [
            {
              lastReportedAt: row.lastReportedAt,
              reportCount: row.reportCount,
              userId: row.userId,
            },
          ]
        : [],
    );
  }

  async resolveReport(
    reportId: string,
    adminId: string,
    status: Extract<ReportStatus, "dismissed" | "resolved">,
    resolutionAction?: string,
    resolutionNotes?: string,
  ): Promise<Report | null> {
    const [report] = await this.db
      .update(reports)
      .set({
        resolutionAction,
        resolutionNotes,
        resolvedAt: new Date(),
        resolvedByAdminId: adminId,
        status,
      })
      .where(eq(reports.id, reportId))
      .returning();

    return report ?? null;
  }

  async markRiskSignalsBanned(signals: RiskSignalInput[]): Promise<void> {
    const now = new Date();

    for (const signal of signals) {
      await this.db
        .insert(riskSignals)
        .values({
          isSharedSignal: signal.isSharedSignal ?? false,
          lastBanAt: now,
          lastSeenAt: now,
          riskLevel: signal.riskLevel,
          riskScore: signal.riskScore,
          signalType: signal.signalType,
          signalValueHash: signal.signalValueHash,
          totalBansAssociated: 1,
          totalSessionsSeen: 0,
        })
        .onConflictDoUpdate({
          set: {
            isSharedSignal: signal.isSharedSignal ?? false,
            lastBanAt: now,
            lastSeenAt: now,
            riskLevel: signal.riskLevel,
            riskScore: sql`GREATEST(${riskSignals.riskScore}, ${signal.riskScore})`,
            totalBansAssociated: sql`${riskSignals.totalBansAssociated} + 1`,
          },
          target: [riskSignals.signalType, riskSignals.signalValueHash],
        });
    }
  }

  async observeRiskSignals(signals: RiskSignalInput[]): Promise<void> {
    const now = new Date();

    for (const signal of signals) {
      await this.db
        .insert(riskSignals)
        .values({
          concurrentUsersEstimate: signal.concurrentUsersEstimate,
          isSharedSignal: signal.isSharedSignal ?? false,
          lastSeenAt: now,
          riskLevel: signal.riskLevel,
          riskScore: signal.riskScore,
          signalType: signal.signalType,
          signalValueHash: signal.signalValueHash,
          totalBansAssociated: 0,
          totalSessionsSeen: 1,
        })
        .onConflictDoUpdate({
          set: {
            concurrentUsersEstimate: signal.concurrentUsersEstimate,
            isSharedSignal: signal.isSharedSignal ?? false,
            lastSeenAt: now,
            riskScore: sql`GREATEST(${riskSignals.riskScore}, ${signal.riskScore})`,
            totalSessionsSeen: sql`${riskSignals.totalSessionsSeen} + 1`,
          },
          target: [riskSignals.signalType, riskSignals.signalValueHash],
        });
    }
  }

  async revokeBan(
    banId: string,
    adminId: string,
    reason: string,
  ): Promise<Ban | null> {
    const [ban] = await this.db
      .update(bans)
      .set({
        isActive: false,
        revocationReason: reason,
        revokedAt: new Date(),
        revokedByAdminId: adminId,
      })
      .where(and(eq(bans.id, banId), eq(bans.isActive, true)))
      .returning();

    return ban ?? null;
  }
}

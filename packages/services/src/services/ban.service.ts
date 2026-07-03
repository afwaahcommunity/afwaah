import { BanCache, type RedisClient } from "../cache";
import { createError } from "../errors";
import {
  ModerationRepository,
  SessionRepository,
  UserRepository,
  type DrizzleClient,
} from "../repositories";
import type {
  ActiveBanInfo,
  BanData,
  BanInput,
  BanType,
  Result,
  RiskSignalInput,
  UserStatus,
} from "../types";
import { err, ok } from "../types";
import { getSessionBanSignals, type BanSignal } from "../utils";

export class BanService {
  private readonly banCache: BanCache;
  private readonly moderationRepo: ModerationRepository;
  private readonly sessionRepo: SessionRepository;
  private readonly userRepo: UserRepository;

  constructor(db: DrizzleClient, redis: RedisClient) {
    this.banCache = new BanCache(redis);
    this.moderationRepo = new ModerationRepository(db);
    this.sessionRepo = new SessionRepository(db);
    this.userRepo = new UserRepository(db);
  }

  async banUser(adminId: string, input: BanInput): Promise<Result<BanData>> {
    const targetSession = input.targetSessionId
      ? await this.sessionRepo.findById(input.targetSessionId)
      : null;

    if (input.targetSessionId && !targetSession) {
      return err(createError("SESSION_NOT_FOUND", "Session not found."));
    }

    const targetUserId = input.targetUserId ?? targetSession?.anonymousUserId;

    if (!targetUserId && !input.targetSessionId) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "A user or session ban target is required.",
        ),
      );
    }
    if (
      targetSession &&
      input.targetUserId &&
      targetSession.anonymousUserId !== input.targetUserId
    ) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Target session does not belong to target user.",
        ),
      );
    }
    if (input.banType === "room_ban" && !input.targetRoomId) {
      return err(
        createError("VALIDATION_ERROR", "Room bans require a room target."),
      );
    }
    if (input.banType !== "room_ban" && input.targetRoomId) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Only room bans can include a room target.",
        ),
      );
    }
    if (
      input.confidenceScore !== undefined &&
      (input.confidenceScore < 0 || input.confidenceScore > 100)
    ) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Ban confidence score must be between 0 and 100.",
        ),
      );
    }
    if (!input.isPermanent && !input.expiresAt) {
      return err(
        createError("VALIDATION_ERROR", "Temporary bans require expiresAt."),
      );
    }
    if (input.expiresAt && input.expiresAt <= new Date()) {
      return err(
        createError("VALIDATION_ERROR", "Ban expiry must be in the future."),
      );
    }

    if (targetUserId && !(await this.userRepo.findById(targetUserId))) {
      return err(createError("USER_NOT_FOUND", "User not found."));
    }

    const normalizedInput: BanInput = {
      ...input,
      targetUserId,
    };
    const ban = await this.moderationRepo.createBan(adminId, normalizedInput);
    const signals = await this.collectTargetSignals(
      targetUserId,
      input.targetSessionId,
    );

    await this.recordBanSignals(ban.id, signals);

    const info: ActiveBanInfo = {
      banId: ban.id,
      banType: ban.banType as BanType,
      confidence: ban.confidenceScore,
      expiresAt: ban.expiresAt,
      reason: ban.reason,
      targetRoomId: ban.targetRoomId,
    };

    if (ban.targetUserId && ban.banType !== "room_ban")
      await this.banCache.setUserBan(ban.targetUserId, info);
    if (ban.targetSessionId && ban.banType !== "room_ban")
      await this.banCache.setSessionBan(ban.targetSessionId, info);
    if (ban.targetUserId) {
      const status = userStatusForBan(ban.banType as BanType);
      if (status) await this.userRepo.updateStatus(ban.targetUserId, status);
    }

    return ok(mapBan(ban));
  }

  async checkActiveBan(input: {
    roomId?: string;
    sessionId?: string;
    userId: string;
  }): Promise<BanData | null> {
    const ban = await this.moderationRepo.findMostSevereActiveBan(input);
    return ban ? mapBan(ban) : null;
  }

  async checkActiveRoomBan(input: {
    roomId: string;
    sessionId?: string;
    userId: string;
  }): Promise<BanData | null> {
    const ban = await this.moderationRepo.findActiveRoomBan(input);
    return ban ? mapBan(ban) : null;
  }

  async revokeBan(
    banId: string,
    adminId: string,
    reason: string,
  ): Promise<Result<BanData>> {
    const ban = await this.moderationRepo.revokeBan(banId, adminId, reason);
    if (!ban) {
      return err(
        createError("BAN_ACTIVE", "Ban not found or already inactive."),
      );
    }

    if (ban.targetUserId) await this.banCache.deleteUserBan(ban.targetUserId);
    if (ban.targetSessionId)
      await this.banCache.deleteSessionBan(ban.targetSessionId);

    await this.syncTargetAfterRevocation(ban);

    return ok(mapBan(ban));
  }

  private async collectTargetSignals(
    targetUserId?: string,
    targetSessionId?: string,
  ): Promise<BanSignal[]> {
    const sessionsById = new Map(
      targetUserId
        ? (await this.sessionRepo.findActiveByUserId(targetUserId)).map(
            (session) => [session.id, session],
          )
        : [],
    );

    if (targetSessionId && !sessionsById.has(targetSessionId)) {
      const session = await this.sessionRepo.findById(targetSessionId);
      if (session) sessionsById.set(session.id, session);
    }

    return [...sessionsById.values()].flatMap(getSessionBanSignals);
  }

  private async recordBanSignals(
    banId: string,
    signals: BanSignal[],
  ): Promise<void> {
    await this.moderationRepo.createBanEvidence(
      banId,
      signals.map((signal) => ({
        description: signal.description,
        evidenceType: signal.evidenceType,
        matchConfidence: signal.matchConfidence,
        signalName: signal.signalName,
        signalValueHash: signal.signalValueHash,
        signalValuePreview: signal.signalValuePreview,
      })),
    );

    const riskSignals = signals
      .filter((signal) => signal.signalType)
      .map((signal): RiskSignalInput => ({
        isSharedSignal: signal.isSharedSignal,
        riskLevel: signal.riskLevel,
        riskScore: signal.riskScore,
        signalType: signal.signalType!,
        signalValueHash: signal.signalValueHash,
      }));

    await this.moderationRepo.markRiskSignalsBanned(riskSignals);
  }

  private async syncTargetAfterRevocation(
    ban: Parameters<typeof mapBanInner>[0],
  ): Promise<void> {
    const targetUserId =
      ban.targetUserId ??
      (ban.targetSessionId
        ? (await this.sessionRepo.findById(ban.targetSessionId))
            ?.anonymousUserId
        : undefined);

    if (!targetUserId) return;

    const activeBan = await this.moderationRepo.findMostSevereActiveBan({
      sessionId: ban.targetSessionId ?? undefined,
      userId: targetUserId,
    });

    if (!activeBan) {
      await this.userRepo.updateStatus(targetUserId, "active");
      return;
    }

    const info: ActiveBanInfo = {
      banId: activeBan.id,
      banType: activeBan.banType as BanType,
      confidence: activeBan.confidenceScore,
      expiresAt: activeBan.expiresAt,
      reason: activeBan.reason,
      targetRoomId: activeBan.targetRoomId,
    };

    if (activeBan.targetUserId) {
      await this.banCache.setUserBan(activeBan.targetUserId, info);
    }
    if (activeBan.targetSessionId) {
      await this.banCache.setSessionBan(activeBan.targetSessionId, info);
    }

    const status = userStatusForBan(info.banType);
    if (status) await this.userRepo.updateStatus(targetUserId, status);
  }
}

function mapBan(ban: Parameters<typeof mapBanInner>[0]): BanData {
  return mapBanInner(ban);
}

function mapBanInner(ban: {
  banType: string;
  confidenceScore: number;
  createdAt: Date;
  createdByAdminId: string;
  expiresAt: Date | null;
  id: string;
  isActive: boolean;
  isPermanent: boolean;
  reason: string;
  revokedAt: Date | null;
  revokedByAdminId: string | null;
  targetRoomId: string | null;
  targetSessionId: string | null;
  targetUserId: string | null;
}): BanData {
  return {
    banType: ban.banType as BanData["banType"],
    confidenceScore: ban.confidenceScore,
    createdAt: ban.createdAt,
    createdByAdminId: ban.createdByAdminId,
    expiresAt: ban.expiresAt,
    id: ban.id,
    isActive: ban.isActive,
    isPermanent: ban.isPermanent,
    reason: ban.reason,
    revokedAt: ban.revokedAt,
    revokedByAdminId: ban.revokedByAdminId,
    targetRoomId: ban.targetRoomId,
    targetSessionId: ban.targetSessionId,
    targetUserId: ban.targetUserId,
  };
}

function userStatusForBan(banType: BanType): UserStatus | null {
  const statusByBanType: Record<BanType, UserStatus | null> = {
    global_hard_ban: "hard_banned",
    global_write_ban: "write_banned",
    quarantine: "quarantined",
    room_ban: null,
  };

  return statusByBanType[banType];
}

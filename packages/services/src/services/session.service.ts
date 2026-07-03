import { BanCache, SessionCache, type RedisClient } from "../cache";
import { createError } from "../errors";
import {
  ModerationRepository,
  SessionRepository,
  UserRepository,
  type DrizzleClient,
} from "../repositories";
import type {
  CreateSessionInput,
  CreateSessionResult,
  ActiveBanInfo,
  BanEvidenceType,
  Result,
  ServiceContext,
  SessionData,
  BanType,
  UserStatus,
  ValidateSessionResult,
  RiskSignalInput,
} from "../types";
import { err, ok } from "../types";
import {
  generateDisplayName,
  generateDisplayColor,
  generateToken,
  getAutoBlockSignals,
  getSessionBanSignals,
  hashToken,
  optionalHash,
} from "../utils";

export class SessionService {
  private readonly banCache: BanCache;
  private readonly moderationRepo: ModerationRepository;
  private readonly sessionCache: SessionCache;
  private readonly sessionRepo: SessionRepository;
  private readonly userRepo: UserRepository;

  constructor(db: DrizzleClient, redis: RedisClient) {
    this.banCache = new BanCache(redis);
    this.moderationRepo = new ModerationRepository(db);
    this.sessionCache = new SessionCache(redis);
    this.sessionRepo = new SessionRepository(db);
    this.userRepo = new UserRepository(db);
  }

  async createSession(
    input: CreateSessionInput,
    context: ServiceContext,
  ): Promise<Result<CreateSessionResult>> {
    const ipHash = optionalHash(input.ipAddress ?? context.ipAddress);
    const userAgentHash = optionalHash(input.userAgent ?? context.userAgent);

    if (!ipHash || !userAgentHash) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "IP address and user agent are required.",
        ),
      );
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const user = await this.userRepo.create(
      generateDisplayName(),
      generateDisplayColor(),
    );
    const session = await this.sessionRepo.create({
      anonymousUserId: user.id,
      asn: input.asn,
      deviceInstallIdHash: optionalHash(input.deviceInstallId),
      fingerprintHash: optionalHash(input.fingerprint),
      ipHash,
      ipSubnetHash: optionalHash(input.ipSubnet),
      tokenHash,
      userAgentHash,
    });

    await this.observeSessionSignals(session);

    const banInfo = await this.applyInheritedBanIfNeeded(session, user.id);
    const sessionData = {
      ...mapSessionData(session, user),
      status: banInfo
        ? userStatusForBan(banInfo.banType)
        : (user.status as UserStatus),
    };
    await this.sessionCache.set(tokenHash.toString("hex"), sessionData);

    return ok({ banInfo, session: sessionData, token });
  }

  async revokeSession(
    sessionId: string,
    reason: string,
  ): Promise<Result<void>> {
    const session = await this.sessionRepo.findById(sessionId);

    if (!session) {
      return err(createError("SESSION_NOT_FOUND", "Session not found."));
    }

    await this.sessionRepo.revoke(sessionId, reason);
    await this.sessionCache.delete(session.tokenHash.toString("hex"));
    return ok(undefined);
  }

  async validateSession(token: string): Promise<Result<ValidateSessionResult>> {
    const tokenHash = hashToken(token);
    const tokenHashHex = tokenHash.toString("hex");
    const cached = await this.sessionCache.get(tokenHashHex);

    if (cached) {
      const banInfo = await this.resolveActiveBan(
        cached.userId,
        cached.sessionId,
        cached.status,
      );
      const session = {
        ...cached,
        lastSeenAt: new Date(),
        status: banInfo ? userStatusForBan(banInfo.banType) : "active",
      };
      await this.sessionCache.set(tokenHashHex, session);
      return ok({
        banInfo,
        session,
        valid: !banInfo || banInfo.banType !== "global_hard_ban",
      });
    }

    const sessionWithUser =
      await this.sessionRepo.findByTokenHashWithUser(tokenHash);

    if (!sessionWithUser) {
      return ok({ banInfo: null, session: null, valid: false });
    }

    const { session, user } = sessionWithUser;

    if (!session.isActive || session.revokedAt) {
      return ok({ banInfo: null, session: null, valid: false });
    }

    await this.sessionRepo.updateLastSeen(session.id);
    await this.userRepo.updateLastSeen(user.id);

    const banInfo = await this.resolveActiveBan(
      user.id,
      session.id,
      user.status as UserStatus,
    );
    const sessionData = {
      ...mapSessionData(session, user),
      status: banInfo ? userStatusForBan(banInfo.banType) : "active",
    };
    await this.sessionCache.set(tokenHashHex, sessionData);

    return ok({
      banInfo,
      session: sessionData,
      valid: !banInfo || banInfo.banType !== "global_hard_ban",
    });
  }

  private async applyInheritedBanIfNeeded(
    session: Awaited<ReturnType<SessionRepository["findById"]>> & {},
    userId: string,
  ): Promise<ActiveBanInfo | null> {
    const strongSignals = getAutoBlockSignals(session).filter((signal) =>
      ["device_id_hash", "fingerprint_hash"].includes(signal.signalName),
    );
    const match = await this.moderationRepo.findActiveBanByEvidence(
      strongSignals.map((signal) => ({
        signalName: signal.signalName,
        signalValueHash: signal.signalValueHash,
      })),
    );

    if (!match || match.evidence.matchConfidence < 90) {
      return null;
    }
    if (!match.ban.isPermanent && !match.ban.expiresAt) {
      return null;
    }

    const banType = match.ban.banType as BanType;
    const inheritedBan = await this.moderationRepo.createBan(
      match.ban.createdByAdminId,
      {
        banType,
        confidenceScore: Math.min(
          match.ban.confidenceScore,
          match.evidence.matchConfidence,
        ),
        expiresAt: match.ban.expiresAt ?? undefined,
        internalNotes: `Automatically linked to active ban ${match.ban.id} using ${match.evidence.signalName}.`,
        isPermanent: match.ban.isPermanent,
        reason: `Automatic ban evasion match: ${match.ban.reason}`,
        targetRoomId:
          banType === "room_ban"
            ? (match.ban.targetRoomId ?? undefined)
            : undefined,
        targetSessionId: session.id,
        targetUserId: userId,
      },
    );

    await this.moderationRepo.createBanEvidence(inheritedBan.id, [
      {
        description: `Matched active ban evidence from ban ${match.ban.id}.`,
        evidenceType: match.evidence.evidenceType as BanEvidenceType,
        matchConfidence: match.evidence.matchConfidence,
        matchedAgainstBanId: match.ban.id,
        rawData: {
          inheritedBanType: banType,
          sourceEvidenceId: match.evidence.id,
        },
        signalName: match.evidence.signalName,
        signalValueHash: match.evidence.signalValueHash,
        signalValuePreview: match.evidence.signalValuePreview ?? undefined,
      },
    ]);

    await this.markSessionSignalsBanned(session);

    const status = userStatusForBan(banType);
    if (status !== "active") {
      await this.userRepo.updateStatus(userId, status);
    }

    const banInfo: ActiveBanInfo = {
      banId: inheritedBan.id,
      banType,
      confidence: inheritedBan.confidenceScore,
      expiresAt: inheritedBan.expiresAt,
      reason: inheritedBan.reason,
      targetRoomId: inheritedBan.targetRoomId,
    };

    if (banType !== "room_ban") {
      await this.banCache.setUserBan(userId, banInfo);
      await this.banCache.setSessionBan(session.id, banInfo);
    }

    return banInfo;
  }

  private async resolveActiveBan(
    userId: string,
    sessionId: string,
    currentStatus: UserStatus,
  ): Promise<ActiveBanInfo | null> {
    const activeBan = await this.moderationRepo.findMostSevereActiveBan({
      sessionId,
      userId,
    });

    if (!activeBan) {
      await Promise.all([
        this.banCache.deleteUserBan(userId),
        this.banCache.deleteSessionBan(sessionId),
        currentStatus === "active"
          ? Promise.resolve(null)
          : this.userRepo.updateStatus(userId, "active"),
      ]);
      return null;
    }

    const banInfo: ActiveBanInfo = {
      banId: activeBan.id,
      banType: activeBan.banType as BanType,
      confidence: activeBan.confidenceScore,
      expiresAt: activeBan.expiresAt,
      reason: activeBan.reason,
      targetRoomId: activeBan.targetRoomId,
    };

    if (activeBan.targetUserId) {
      await this.banCache.setUserBan(activeBan.targetUserId, banInfo);
    }
    if (activeBan.targetSessionId) {
      await this.banCache.setSessionBan(activeBan.targetSessionId, banInfo);
    }

    const nextStatus = userStatusForBan(banInfo.banType);
    if (currentStatus !== nextStatus) {
      await this.userRepo.updateStatus(userId, nextStatus);
    }
    return banInfo;
  }

  private async observeSessionSignals(
    session: Awaited<ReturnType<SessionRepository["findById"]>> & {},
  ): Promise<void> {
    const riskSignals = getSessionBanSignals(session)
      .filter((signal) => signal.signalType)
      .map((signal): RiskSignalInput => ({
        isSharedSignal: signal.isSharedSignal,
        riskLevel: "unknown",
        riskScore: 0,
        signalType: signal.signalType!,
        signalValueHash: signal.signalValueHash,
      }));

    await this.moderationRepo.observeRiskSignals(riskSignals);
  }

  private async markSessionSignalsBanned(
    session: Awaited<ReturnType<SessionRepository["findById"]>> & {},
  ): Promise<void> {
    const riskSignals = getSessionBanSignals(session)
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
}

function mapSessionData(
  session: Awaited<ReturnType<SessionRepository["findById"]>> & {},
  user: Awaited<ReturnType<UserRepository["findById"]>> & {},
): SessionData {
  return {
    createdAt: session.createdAt,
    displayColor: user.currentDisplayColor,
    displayName: user.currentDisplayName,
    lastSeenAt: session.lastSeenAt,
    locationVerified: session.locationVerified,
    riskScore: user.riskScore,
    sessionId: session.id,
    status: user.status as UserStatus,
    trustLevel: user.trustLevel,
    userId: user.id,
  };
}

function userStatusForBan(banType: BanType): UserStatus {
  const statusByBanType: Record<BanType, UserStatus> = {
    global_hard_ban: "hard_banned",
    global_write_ban: "write_banned",
    quarantine: "quarantined",
    room_ban: "active",
  };

  return statusByBanType[banType];
}

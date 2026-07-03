import { RateLimitCache, SessionCache, type RedisClient } from "../cache";
import { createError } from "../errors";
import {
  SessionRepository,
  UserRepository,
  type DrizzleClient,
} from "../repositories";
import type {
  DisplayNameHistoryEntry,
  Result,
  UpdateDisplayColorInput,
  UpdateDisplayNameInput,
  UserStatus,
  UserProfile,
} from "../types";
import { err, ok } from "../types";
import {
  normalizeDisplayColor,
  sanitizeDisplayName,
  validateDisplayColor,
  validateDisplayName,
} from "../utils";
import { WriteGuardService } from "./write-guard.service";

export class UserService {
  private readonly rateLimitCache: RateLimitCache;
  private readonly sessionCache: SessionCache;
  private readonly sessionRepo: SessionRepository;
  private readonly userRepo: UserRepository;
  private readonly writeGuard: WriteGuardService;

  constructor(db: DrizzleClient, redis: RedisClient) {
    this.rateLimitCache = new RateLimitCache(redis);
    this.sessionCache = new SessionCache(redis);
    this.sessionRepo = new SessionRepository(db);
    this.userRepo = new UserRepository(db);
    this.writeGuard = new WriteGuardService(db);
  }

  async getDisplayNameHistory(
    userId: string,
    limit = 20,
  ): Promise<Result<DisplayNameHistoryEntry[]>> {
    const user = await this.userRepo.findById(userId);
    if (!user) return err(createError("USER_NOT_FOUND", "User not found."));

    const history = await this.userRepo.getDisplayNameHistory(userId, limit);
    return ok(
      history.map((entry) => ({
        changeReason: entry.changeReason,
        displayName: entry.displayName,
        endedAt: entry.endedAt,
        id: entry.id,
        startedAt: entry.startedAt,
      })),
    );
  }

  async getUserProfile(userId: string): Promise<Result<UserProfile>> {
    const user = await this.userRepo.findById(userId);
    return user
      ? ok(mapUser(user))
      : err(createError("USER_NOT_FOUND", "User not found."));
  }

  async updateDisplayName(
    input: UpdateDisplayNameInput,
  ): Promise<Result<UserProfile>> {
    const displayName = sanitizeDisplayName(input.newDisplayName);
    const validation = validateDisplayName(displayName);

    if (!validation.valid) {
      return err(
        createError(
          "DISPLAY_NAME_INVALID",
          validation.reason ?? "Invalid display name.",
        ),
      );
    }
    if (!input.sessionId) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "sessionId is required to update display name.",
        ),
      );
    }

    const interactionAccess = await this.writeGuard.requireInteractionAccess({
      sessionId: input.sessionId,
      userId: input.userId,
    });
    if (!interactionAccess.ok) return err(interactionAccess.error);

    const rateLimit = await this.rateLimitCache.checkAndIncrement(
      "display_name_change",
      input.userId,
      { maxRequests: 1, windowSeconds: 300 },
    );

    if (!rateLimit.allowed) {
      return err(
        createError("RATE_LIMITED", "Display name change rate limited.", {
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        }),
      );
    }

    const updated = await this.userRepo.updateDisplayName(
      input.userId,
      displayName,
    );

    if (!updated) {
      return err(createError("USER_NOT_FOUND", "User not found."));
    }

    const sessions = await this.sessionRepo.findActiveByUserId(input.userId);
    await Promise.all(
      sessions.map((session) =>
        this.sessionCache.updateDisplayName(
          session.tokenHash.toString("hex"),
          displayName,
        ),
      ),
    );

    return ok(mapUser(updated));
  }

  async updateDisplayColor(
    input: UpdateDisplayColorInput,
  ): Promise<Result<UserProfile>> {
    const displayColor = normalizeDisplayColor(input.newDisplayColor);
    const validation = validateDisplayColor(displayColor);

    if (!validation.valid) {
      return err(
        createError(
          "VALIDATION_ERROR",
          validation.reason ?? "Invalid display color.",
        ),
      );
    }

    const interactionAccess = await this.writeGuard.requireInteractionAccess({
      sessionId: input.sessionId,
      userId: input.userId,
    });
    if (!interactionAccess.ok) return err(interactionAccess.error);

    const rateLimit = await this.rateLimitCache.checkAndIncrement(
      "display_color_change",
      input.userId,
      { maxRequests: 5, windowSeconds: 300 },
    );

    if (!rateLimit.allowed) {
      return err(
        createError("RATE_LIMITED", "Display color change rate limited.", {
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        }),
      );
    }

    const updated = await this.userRepo.updateDisplayColor(
      input.userId,
      displayColor,
    );

    if (!updated) {
      return err(createError("USER_NOT_FOUND", "User not found."));
    }

    const sessions = await this.sessionRepo.findActiveByUserId(input.userId);
    await Promise.all(
      sessions.map((session) =>
        this.sessionCache.updateDisplayColor(
          session.tokenHash.toString("hex"),
          displayColor,
        ),
      ),
    );

    return ok(mapUser(updated));
  }

  async searchByDisplayName(query: string, limit = 20): Promise<UserProfile[]> {
    const users = await this.userRepo.searchByDisplayName(query, limit);
    return users.map(mapUser);
  }
}

function mapUser(
  user: Awaited<ReturnType<UserRepository["findById"]>> & {},
): UserProfile {
  return {
    createdAt: user.createdAt,
    currentDisplayColor: user.currentDisplayColor,
    currentDisplayName: user.currentDisplayName,
    id: user.id,
    lastSeenAt: user.lastSeenAt,
    riskScore: user.riskScore,
    status: user.status as UserStatus,
    totalMessagesSent: user.totalMessagesSent,
    totalReportsReceived: user.totalReportsReceived,
    totalRoomsCreated: user.totalRoomsCreated,
    trustLevel: user.trustLevel,
  };
}

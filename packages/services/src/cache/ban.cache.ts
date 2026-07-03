import { redisKeys } from "@campus-chat/database/redis";

import type { ActiveBanInfo, BanType } from "../types";
import type { RedisClient } from "./client";

export class BanCache {
  private readonly redis: RedisClient;

  constructor(redis: RedisClient) {
    this.redis = redis;
  }

  async checkBan(
    userId: string,
    sessionId: string,
  ): Promise<ActiveBanInfo | null> {
    const [userBan, sessionBan] = await Promise.all([
      this.getUserBan(userId),
      this.getSessionBan(sessionId),
    ]);

    if (!userBan) return sessionBan;
    if (!sessionBan) return userBan;

    return severity(userBan.banType) <= severity(sessionBan.banType)
      ? userBan
      : sessionBan;
  }

  async deleteUserBan(userId: string): Promise<void> {
    await this.redis.del(redisKeys.userBan(userId));
  }

  async deleteSessionBan(sessionId: string): Promise<void> {
    await this.redis.del(redisKeys.sessionBan(sessionId));
  }

  async getSessionBan(sessionId: string): Promise<ActiveBanInfo | null> {
    return this.get(redisKeys.sessionBan(sessionId));
  }

  async getUserBan(userId: string): Promise<ActiveBanInfo | null> {
    return this.get(redisKeys.userBan(userId));
  }

  async setSessionBan(sessionId: string, ban: ActiveBanInfo): Promise<void> {
    await this.set(redisKeys.sessionBan(sessionId), ban);
  }

  async setUserBan(userId: string, ban: ActiveBanInfo): Promise<void> {
    await this.set(redisKeys.userBan(userId), ban);
  }

  private async get(key: string): Promise<ActiveBanInfo | null> {
    const data = await this.redis.hgetall(key);

    if (!data.banId || !data.banType) {
      return null;
    }

    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) {
      await this.redis.del(key);
      return null;
    }

    return {
      banId: data.banId,
      banType: data.banType as BanType,
      confidence: Number(data.confidence ?? 100),
      expiresAt,
      reason: data.reason ?? "",
      targetRoomId: data.targetRoomId || null,
    };
  }

  private async set(key: string, ban: ActiveBanInfo): Promise<void> {
    const expiresIn = ban.expiresAt
      ? Math.max(60, Math.floor((ban.expiresAt.getTime() - Date.now()) / 1000))
      : 60 * 60 * 24 * 7;

    await this.redis
      .multi()
      .hset(key, {
        banId: ban.banId,
        banType: ban.banType,
        confidence: String(ban.confidence),
        expiresAt: ban.expiresAt?.toISOString() ?? "",
        reason: ban.reason,
        targetRoomId: ban.targetRoomId ?? "",
      })
      .expire(key, expiresIn)
      .exec();
  }
}

function severity(type: BanType): number {
  const weights: Record<BanType, number> = {
    global_hard_ban: 1,
    global_write_ban: 2,
    quarantine: 3,
    room_ban: 4,
  };
  return weights[type];
}

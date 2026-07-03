import { redisKeys, redisTtlSeconds } from "@campus-chat/database/redis";

import type { SessionData, UserStatus } from "../types";
import type { RedisClient } from "./client";

export class SessionCache {
  private readonly redis: RedisClient;

  constructor(redis: RedisClient) {
    this.redis = redis;
  }

  async delete(tokenHashHex: string): Promise<void> {
    await this.redis.del(redisKeys.session(tokenHashHex));
  }

  async get(tokenHashHex: string): Promise<SessionData | null> {
    const data = await this.redis.hgetall(redisKeys.session(tokenHashHex));

    if (!data.sessionId || !data.userId) {
      return null;
    }

    return {
      createdAt: new Date(data.createdAt ?? Date.now()),
      displayColor: data.displayColor ?? "#64748B",
      displayName: data.displayName ?? "",
      lastSeenAt: new Date(data.lastSeenAt ?? Date.now()),
      locationVerified: data.locationVerified === "1",
      riskScore: Number(data.riskScore ?? 0),
      sessionId: data.sessionId,
      status: (data.status ?? "active") as UserStatus,
      trustLevel: Number(data.trustLevel ?? 50),
      userId: data.userId,
    };
  }

  async set(tokenHashHex: string, session: SessionData): Promise<void> {
    const key = redisKeys.session(tokenHashHex);

    await this.redis
      .multi()
      .hset(key, {
        createdAt: session.createdAt.toISOString(),
        displayColor: session.displayColor,
        displayName: session.displayName,
        lastSeenAt: session.lastSeenAt.toISOString(),
        locationVerified: session.locationVerified ? "1" : "0",
        riskScore: String(session.riskScore),
        sessionId: session.sessionId,
        status: session.status,
        trustLevel: String(session.trustLevel),
        userId: session.userId,
      })
      .expire(key, redisTtlSeconds.session)
      .exec();
  }

  async updateDisplayColor(
    tokenHashHex: string,
    displayColor: string,
  ): Promise<void> {
    await this.redis.hset(
      redisKeys.session(tokenHashHex),
      "displayColor",
      displayColor,
    );
  }

  async updateDisplayName(
    tokenHashHex: string,
    displayName: string,
  ): Promise<void> {
    await this.redis.hset(
      redisKeys.session(tokenHashHex),
      "displayName",
      displayName,
    );
  }

  async updateLastSeen(tokenHashHex: string): Promise<void> {
    const key = redisKeys.session(tokenHashHex);
    await this.redis.hset(key, "lastSeenAt", new Date().toISOString());
    await this.redis.expire(key, redisTtlSeconds.session);
  }

  async updateLocationVerified(
    tokenHashHex: string,
    locationVerified: boolean,
  ): Promise<void> {
    const key = redisKeys.session(tokenHashHex);
    await this.redis.hset(
      key,
      "locationVerified",
      locationVerified ? "1" : "0",
    );
    await this.redis.expire(key, redisTtlSeconds.session);
  }
}

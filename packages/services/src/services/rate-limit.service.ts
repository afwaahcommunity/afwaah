import {
  RateLimitCache,
  type RateLimitConfig,
  type RedisClient,
} from "../cache";
import type { RateLimitAction } from "../types";

export class RateLimitService {
  private readonly rateLimitCache: RateLimitCache;

  constructor(_db: unknown, redis: RedisClient) {
    this.rateLimitCache = new RateLimitCache(redis);
  }

  async check(
    action: RateLimitAction,
    subjectId: string,
    config: RateLimitConfig,
    trustMultiplier = 1,
  ) {
    return this.rateLimitCache.checkWithBurst(
      action,
      subjectId,
      config,
      trustMultiplier,
    );
  }
}

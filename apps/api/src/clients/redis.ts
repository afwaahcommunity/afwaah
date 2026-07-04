import type { RedisClient, RedisPipeline } from "@campus-chat/services/cache";
import Redis, { type ChainableCommander } from "ioredis";

import type { ApiEnv } from "../env";

export interface RedisConnection {
  client: RedisClient;
  close(): Promise<void>;
  healthCheck(): Promise<void>;
  raw: Redis;
}

export function createRedisConnection(env: ApiEnv): RedisConnection {
  const raw = new Redis(env.REDIS_URL, {
    enableReadyCheck: env.REDIS_ENABLE_READY_CHECK,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      return Math.min(times * 100, 2_000);
    },
  });

  return {
    client: new IoredisClient(raw),
    async close() {
      await raw.quit();
    },
    async healthCheck() {
      await raw.ping();
    },
    raw,
  };
}

class IoredisClient implements RedisClient {
  constructor(private readonly redis: Redis) {}

  decr(key: string): Promise<number> {
    return this.redis.decr(key);
  }

  del(...keys: string[]): Promise<number> {
    return this.redis.del(...keys);
  }

  exists(key: string): Promise<number> {
    return this.redis.exists(key);
  }

  expire(key: string, seconds: number): Promise<number> {
    return this.redis.expire(key, seconds);
  }

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  hdel(key: string, ...fields: string[]): Promise<number> {
    return this.redis.hdel(key, ...fields);
  }

  hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }

  hset(
    key: string,
    fieldOrValues: string | Record<string, string>,
    value?: string,
  ): Promise<number> {
    if (typeof fieldOrValues === "string") {
      return this.redis.hset(key, fieldOrValues, value ?? "");
    }

    return this.redis.hset(key, fieldOrValues);
  }

  incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.redis.lrange(key, start, stop);
  }

  multi(): RedisPipeline {
    return new IoredisPipeline(this.redis.multi());
  }

  async set(
    key: string,
    value: string,
    mode?: string,
    duration?: number,
  ): Promise<string | null> {
    const args = [key, value];
    if (mode && duration !== undefined) {
      args.push(mode, String(duration));
    }

    const result = await this.redis.call("set", ...args);
    return typeof result === "string" ? result : null;
  }

  zadd(key: string, score: number, member: string): Promise<number> {
    return this.redis.zadd(key, score, member);
  }

  zcard(key: string): Promise<number> {
    return this.redis.zcard(key);
  }

  zrange(
    key: string,
    start: number,
    stop: number,
    withScores?: "WITHSCORES",
  ): Promise<string[]> {
    return withScores
      ? this.redis.zrange(key, start, stop, withScores)
      : this.redis.zrange(key, start, stop);
  }

  zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<string[]> {
    return this.redis.zrangebyscore(key, min, max);
  }

  zrem(key: string, ...members: string[]): Promise<number> {
    return this.redis.zrem(key, ...members);
  }

  zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<number> {
    return this.redis.zremrangebyscore(key, min, max);
  }
}

class IoredisPipeline implements RedisPipeline {
  constructor(private readonly pipeline: ChainableCommander) {}

  del(...keys: string[]): RedisPipeline {
    this.pipeline.del(...keys);
    return this;
  }

  exec(): Promise<Array<[Error | null, unknown]> | null> {
    return this.pipeline.exec();
  }

  expire(key: string, seconds: number): RedisPipeline {
    this.pipeline.expire(key, seconds);
    return this;
  }

  hset(key: string, values: Record<string, string>): RedisPipeline {
    this.pipeline.hset(key, values);
    return this;
  }

  lpush(key: string, value: string): RedisPipeline {
    this.pipeline.lpush(key, value);
    return this;
  }

  ltrim(key: string, start: number, stop: number): RedisPipeline {
    this.pipeline.ltrim(key, start, stop);
    return this;
  }

  zadd(key: string, score: number, member: string): RedisPipeline {
    this.pipeline.zadd(key, score, member);
    return this;
  }

  zcard(key: string): RedisPipeline {
    this.pipeline.zcard(key);
    return this;
  }

  zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): RedisPipeline {
    this.pipeline.zremrangebyscore(key, min, max);
    return this;
  }
}

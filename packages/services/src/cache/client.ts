export interface RedisPipeline {
  del(...keys: string[]): RedisPipeline;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
  expire(key: string, seconds: number): RedisPipeline;
  hset(key: string, values: Record<string, string>): RedisPipeline;
  lpush(key: string, value: string): RedisPipeline;
  ltrim(key: string, start: number, stop: number): RedisPipeline;
  zadd(key: string, score: number, member: string): RedisPipeline;
  zcard(key: string): RedisPipeline;
  zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): RedisPipeline;
}

export interface RedisClient {
  decr(key: string): Promise<number>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  hset(key: string, field: string, value: string): Promise<number>;
  hset(key: string, values: Record<string, string>): Promise<number>;
  incr(key: string): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  multi(): RedisPipeline;
  set(
    key: string,
    value: string,
    mode?: string,
    duration?: number,
  ): Promise<string | null>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zcard(key: string): Promise<number>;
  zrange(
    key: string,
    start: number,
    stop: number,
    withScores?: "WITHSCORES",
  ): Promise<string[]>;
  zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<string[]>;
  zrem(key: string, ...members: string[]): Promise<number>;
  zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<number>;
}

import type { RedisClient } from "@campus-chat/services/cache";
import type { DrizzleClient } from "@campus-chat/services/repositories";

import type { RealtimeEnv } from "../env";
import { createPostgresClient, type PostgresClient } from "./postgres";
import { createRedisConnection, type RedisConnection } from "./redis";

export interface RealtimeClients {
  db: DrizzleClient;
  postgres: PostgresClient;
  redis: RedisClient;
  redisConnection: RedisConnection;
}

export function createRealtimeClients(env: RealtimeEnv): RealtimeClients {
  const postgres = createPostgresClient(env);
  const redisConnection = createRedisConnection(env);

  return {
    db: postgres.db,
    postgres,
    redis: redisConnection.client,
    redisConnection,
  };
}

export async function closeRealtimeClients(
  clients: RealtimeClients,
): Promise<void> {
  await Promise.all([
    clients.postgres.close(),
    clients.redisConnection.close(),
  ]);
}

export type { PostgresClient } from "./postgres";
export type { RedisConnection } from "./redis";

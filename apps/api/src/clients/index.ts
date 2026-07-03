import type { RedisClient } from "@campus-chat/services/cache";
import type { DrizzleClient } from "@campus-chat/services/repositories";

import type { ApiEnv } from "../env";
import { createPostgresClient, type PostgresClient } from "./postgres";
import { createRedisConnection, type RedisConnection } from "./redis";

export interface ApiClients {
  db: DrizzleClient;
  postgres: PostgresClient;
  redis: RedisClient;
  redisConnection: RedisConnection;
}

export function createApiClients(env: ApiEnv): ApiClients {
  const postgres = createPostgresClient(env);
  const redisConnection = createRedisConnection(env);

  return {
    db: postgres.db,
    postgres,
    redis: redisConnection.client,
    redisConnection,
  };
}

export async function closeApiClients(clients: ApiClients): Promise<void> {
  await Promise.all([
    clients.postgres.close(),
    clients.redisConnection.close(),
  ]);
}

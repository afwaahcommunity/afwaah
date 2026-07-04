import * as schema from "@campus-chat/database/schema";
import type { DrizzleClient } from "@campus-chat/services/repositories";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { RealtimeEnv } from "../env";

export interface PostgresClient {
  close(): Promise<void>;
  db: DrizzleClient;
  healthCheck(): Promise<void>;
  pool: Pool;
}

export function createPostgresClient(env: RealtimeEnv): PostgresClient {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.POSTGRES_POOL_MAX,
    ssl: shouldUseSsl(env.DATABASE_URL)
      ? { rejectUnauthorized: false }
      : undefined,
  });
  const db = drizzle(pool, { schema });

  return {
    async close() {
      await pool.end();
    },
    db,
    async healthCheck() {
      await pool.query("select 1");
    },
    pool,
  };
}

function shouldUseSsl(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    return (
      url.searchParams.get("sslmode") === "require" ||
      url.hostname.endsWith(".neon.tech")
    );
  } catch {
    return connectionString.includes("sslmode=require");
  }
}

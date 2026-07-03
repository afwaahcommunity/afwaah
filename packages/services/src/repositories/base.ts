import type * as schema from "@campus-chat/database/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type DrizzleClient = NodePgDatabase<typeof schema>;

export abstract class BaseRepository {
  protected readonly db: DrizzleClient;

  constructor(db: DrizzleClient) {
    this.db = db;
  }
}

import {
  anonymousUsers,
  displayNameHistory,
} from "@campus-chat/database/schema";
import type {
  AnonymousUser,
  DisplayNameHistory,
} from "@campus-chat/database/models";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { UserStatus } from "../types";
import { BaseRepository, type DrizzleClient } from "./base";

export class UserRepository extends BaseRepository {
  constructor(db: DrizzleClient) {
    super(db);
  }

  async create(
    displayName: string,
    displayColor: string,
  ): Promise<AnonymousUser> {
    const [user] = await this.db
      .insert(anonymousUsers)
      .values({
        currentDisplayColor: displayColor,
        currentDisplayName: displayName,
      })
      .returning();

    if (!user) {
      throw new Error("Failed to create anonymous user.");
    }

    return user;
  }

  async findById(userId: string): Promise<AnonymousUser | null> {
    const [user] = await this.db
      .select()
      .from(anonymousUsers)
      .where(eq(anonymousUsers.id, userId))
      .limit(1);

    return user ?? null;
  }

  async getDisplayNameHistory(
    userId: string,
    limit = 20,
  ): Promise<DisplayNameHistory[]> {
    return this.db
      .select()
      .from(displayNameHistory)
      .where(eq(displayNameHistory.anonymousUserId, userId))
      .orderBy(desc(displayNameHistory.startedAt))
      .limit(limit);
  }

  async getCurrentDisplayNameEntry(
    userId: string,
  ): Promise<DisplayNameHistory | null> {
    const [entry] = await this.db
      .select()
      .from(displayNameHistory)
      .where(
        and(
          eq(displayNameHistory.anonymousUserId, userId),
          isNull(displayNameHistory.endedAt),
        ),
      )
      .limit(1);

    return entry ?? null;
  }

  async updateDisplayName(
    userId: string,
    displayName: string,
  ): Promise<AnonymousUser | null> {
    const [user] = await this.db
      .update(anonymousUsers)
      .set({ currentDisplayName: displayName, lastSeenAt: new Date() })
      .where(eq(anonymousUsers.id, userId))
      .returning();

    return user ?? null;
  }

  async updateDisplayColor(
    userId: string,
    displayColor: string,
  ): Promise<AnonymousUser | null> {
    const [user] = await this.db
      .update(anonymousUsers)
      .set({ currentDisplayColor: displayColor, lastSeenAt: new Date() })
      .where(eq(anonymousUsers.id, userId))
      .returning();

    return user ?? null;
  }

  async updateLastSeen(userId: string): Promise<void> {
    await this.db
      .update(anonymousUsers)
      .set({ lastSeenAt: new Date() })
      .where(eq(anonymousUsers.id, userId));
  }

  async updateStatus(
    userId: string,
    status: UserStatus,
  ): Promise<AnonymousUser | null> {
    const [user] = await this.db
      .update(anonymousUsers)
      .set({ lastSeenAt: new Date(), status })
      .where(eq(anonymousUsers.id, userId))
      .returning();

    return user ?? null;
  }

  async searchByDisplayName(
    query: string,
    limit = 20,
  ): Promise<AnonymousUser[]> {
    return this.db
      .select()
      .from(anonymousUsers)
      .where(sql`${anonymousUsers.currentDisplayName} ILIKE ${`%${query}%`}`)
      .limit(limit);
  }
}

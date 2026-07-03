import {
  anonymousSessions,
  anonymousUsers,
} from "@campus-chat/database/schema";
import type {
  AnonymousSession,
  AnonymousUser,
} from "@campus-chat/database/models";
import { and, desc, eq } from "drizzle-orm";

import { BaseRepository, type DrizzleClient } from "./base";

export interface CreateSessionRecord {
  anonymousUserId: string;
  asn?: string;
  deviceInstallIdHash?: Buffer | null;
  fingerprintHash?: Buffer | null;
  ipHash: Buffer;
  ipSubnetHash?: Buffer | null;
  tokenHash: Buffer;
  userAgentHash: Buffer;
}

export interface SessionWithUser {
  session: AnonymousSession;
  user: AnonymousUser;
}

export class SessionRepository extends BaseRepository {
  constructor(db: DrizzleClient) {
    super(db);
  }

  async create(input: CreateSessionRecord): Promise<AnonymousSession> {
    const [session] = await this.db
      .insert(anonymousSessions)
      .values(input)
      .returning();

    if (!session) {
      throw new Error("Failed to create anonymous session.");
    }

    return session;
  }

  async findActiveByUserId(userId: string): Promise<AnonymousSession[]> {
    return this.db
      .select()
      .from(anonymousSessions)
      .where(
        and(
          eq(anonymousSessions.anonymousUserId, userId),
          eq(anonymousSessions.isActive, true),
        ),
      )
      .orderBy(desc(anonymousSessions.lastSeenAt));
  }

  async findById(sessionId: string): Promise<AnonymousSession | null> {
    const [session] = await this.db
      .select()
      .from(anonymousSessions)
      .where(eq(anonymousSessions.id, sessionId))
      .limit(1);

    return session ?? null;
  }

  async findByTokenHashWithUser(
    tokenHash: Buffer,
  ): Promise<SessionWithUser | null> {
    const [result] = await this.db
      .select({ session: anonymousSessions, user: anonymousUsers })
      .from(anonymousSessions)
      .innerJoin(
        anonymousUsers,
        eq(anonymousSessions.anonymousUserId, anonymousUsers.id),
      )
      .where(
        and(
          eq(anonymousSessions.tokenHash, tokenHash),
          eq(anonymousSessions.isActive, true),
        ),
      )
      .limit(1);

    return result ?? null;
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    await this.db
      .update(anonymousSessions)
      .set({
        isActive: false,
        revocationReason: reason,
        revokedAt: new Date(),
      })
      .where(eq(anonymousSessions.id, sessionId));
  }

  async updateLastSeen(sessionId: string): Promise<void> {
    await this.db
      .update(anonymousSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(anonymousSessions.id, sessionId));
  }
}

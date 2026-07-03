import { adminSessions, adminUsers } from "@campus-chat/database/schema";
import type { DrizzleClient } from "@campus-chat/services/repositories";
import type { AdminUserData } from "@campus-chat/services/types";
import { generateToken, hashToken } from "@campus-chat/services/utils";
import { and, eq, gt, isNull } from "drizzle-orm";

import type { BaseContext } from "./context";

export interface CreatedAdminSession {
  expiresAt: Date;
  token: string;
}

export interface ValidatedAdminSession {
  admin: AdminUserData;
  sessionId: string;
  tokenHashHex: string;
}

export class AdminSessionManager {
  constructor(private readonly db: DrizzleClient) {}

  async create(
    admin: AdminUserData,
    ctx: BaseContext,
  ): Promise<CreatedAdminSession> {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + ctx.adminSessionTtlSeconds * 1000,
    );

    await this.db.insert(adminSessions).values({
      adminId: admin.id,
      expiresAt,
      ipAddress: ctx.ipAddress,
      lastActiveAt: now,
      lastActiveIp: ctx.ipAddress,
      tokenHash,
      userAgent: ctx.userAgent,
    });

    await this.db
      .update(adminUsers)
      .set({
        failedLoginAttempts: 0,
        lastLoginAt: now,
        lastLoginIp: ctx.ipAddress,
      })
      .where(eq(adminUsers.id, admin.id));

    return { expiresAt, token };
  }

  async validate(
    token: string,
    ctx: BaseContext,
  ): Promise<ValidatedAdminSession | null> {
    const now = new Date();
    const tokenHash = hashToken(token);
    const tokenHashHex = tokenHash.toString("hex");
    const [row] = await this.db
      .select({
        admin: adminUsers,
        session: adminSessions,
      })
      .from(adminSessions)
      .innerJoin(adminUsers, eq(adminSessions.adminId, adminUsers.id))
      .where(
        and(
          eq(adminSessions.tokenHash, tokenHash),
          eq(adminSessions.isActive, true),
          isNull(adminSessions.revokedAt),
          gt(adminSessions.expiresAt, now),
          eq(adminUsers.isActive, true),
        ),
      )
      .limit(1);

    if (!row) return null;

    await this.db
      .update(adminSessions)
      .set({
        lastActiveAt: now,
        lastActiveIp: ctx.ipAddress,
      })
      .where(eq(adminSessions.id, row.session.id));

    return {
      admin: {
        createdAt: row.admin.createdAt,
        displayName: row.admin.displayName,
        email: row.admin.email,
        id: row.admin.id,
        isActive: row.admin.isActive,
        lastLoginAt: row.admin.lastLoginAt,
        role: row.admin.role as AdminUserData["role"],
      },
      sessionId: row.session.id,
      tokenHashHex,
    };
  }

  async revoke(token: string, reason = "admin_logout"): Promise<boolean> {
    const revoked = await this.db
      .update(adminSessions)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revocationReason: reason,
      })
      .where(
        and(
          eq(adminSessions.tokenHash, hashToken(token)),
          eq(adminSessions.isActive, true),
        ),
      )
      .returning({ id: adminSessions.id });

    return revoked.length > 0;
  }
}

import {
  anonymousUsers,
  roomParticipants,
  rooms,
} from "@campus-chat/database/schema";
import type { Room, RoomParticipant } from "@campus-chat/database/models";
import { and, desc, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm";

import type {
  CreateRoomInput,
  ParticipantRole,
  ParticipantStatus,
} from "../types";
import { BaseRepository, type DrizzleClient } from "./base";

export interface ParticipantWithDisplayName {
  bannedAt: Date | null;
  banExpiresAt: Date | null;
  displayColor: string;
  displayName: string;
  id: string;
  joinedAt: Date;
  lastMessageAt: Date | null;
  role: string;
  roomId: string;
  status: string;
  userId: string;
}

export interface PurgedRoom {
  id: string;
  name: string;
}

export class RoomRepository extends BaseRepository {
  constructor(db: DrizzleClient) {
    super(db);
  }

  async addParticipant(
    roomId: string,
    userId: string,
    role: ParticipantRole,
  ): Promise<RoomParticipant> {
    const [participant] = await this.db
      .insert(roomParticipants)
      .values({ anonymousUserId: userId, role, roomId })
      .returning();

    if (!participant) {
      throw new Error("Failed to add room participant.");
    }

    return participant;
  }

  async create(
    userId: string,
    sessionId: string,
    input: CreateRoomInput,
    slug: string,
    inviteCode?: string,
  ): Promise<Room> {
    const [room] = await this.db
      .insert(rooms)
      .values({
        allowImages: input.allowImages ?? true,
        allowLinks: input.allowLinks ?? true,
        createdBySessionId: sessionId,
        createdByUserId: userId,
        description: input.description,
        expiresAt: input.expiresAt,
        inviteCode,
        maxParticipants: input.maxParticipants,
        name: input.name,
        roomType: input.roomType ?? "public",
        slug,
      })
      .returning();

    if (!room) {
      throw new Error("Failed to create room.");
    }

    return room;
  }

  async countActiveCreatedByUser(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(rooms)
      .where(
        and(
          eq(rooms.createdByUserId, userId),
          eq(rooms.status, "active"),
          or(isNull(rooms.expiresAt), gt(rooms.expiresAt, new Date())),
        ),
      );

    return result?.count ?? 0;
  }

  async findById(roomId: string): Promise<Room | null> {
    const [room] = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    return room ?? null;
  }

  async findByInviteCode(inviteCode: string): Promise<Room | null> {
    const [room] = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.inviteCode, inviteCode))
      .limit(1);

    return room ?? null;
  }

  async findBySlug(slug: string): Promise<Room | null> {
    const [room] = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.slug, slug))
      .limit(1);

    return room ?? null;
  }

  async updateInviteCode(
    roomId: string,
    inviteCode: string | null,
    expiresAt: Date | null,
  ): Promise<Room | null> {
    const [room] = await this.db
      .update(rooms)
      .set({ inviteCode, inviteCodeExpiresAt: expiresAt })
      .where(eq(rooms.id, roomId))
      .returning();

    return room ?? null;
  }

  async getParticipant(
    roomId: string,
    userId: string,
  ): Promise<RoomParticipant | null> {
    const [participant] = await this.db
      .select()
      .from(roomParticipants)
      .where(
        and(
          eq(roomParticipants.roomId, roomId),
          eq(roomParticipants.anonymousUserId, userId),
        ),
      )
      .limit(1);

    return participant ?? null;
  }

  async listParticipants(
    roomId: string,
    status: ParticipantStatus = "active",
    limit = 100,
  ): Promise<ParticipantWithDisplayName[]> {
    return this.db
      .select({
        bannedAt: roomParticipants.bannedAt,
        banExpiresAt: roomParticipants.banExpiresAt,
        displayColor: anonymousUsers.currentDisplayColor,
        displayName: anonymousUsers.currentDisplayName,
        id: roomParticipants.id,
        joinedAt: roomParticipants.joinedAt,
        lastMessageAt: roomParticipants.lastMessageAt,
        role: roomParticipants.role,
        roomId: roomParticipants.roomId,
        status: roomParticipants.status,
        userId: roomParticipants.anonymousUserId,
      })
      .from(roomParticipants)
      .innerJoin(
        anonymousUsers,
        eq(roomParticipants.anonymousUserId, anonymousUsers.id),
      )
      .where(
        and(
          eq(roomParticipants.roomId, roomId),
          eq(roomParticipants.status, status),
        ),
      )
      .limit(limit);
  }

  async listPublic(limit = 50, cursor?: string): Promise<Room[]> {
    const activityAt = sql<Date>`COALESCE(${rooms.lastMessageAt}, ${rooms.createdAt})`;
    const baseConditions: SQL[] = [
      eq(rooms.roomType, "public"),
      eq(rooms.status, "active"),
      or(isNull(rooms.expiresAt), gt(rooms.expiresAt, new Date()))!,
    ];

    const cursorDate = cursor ? new Date(cursor) : null;
    if (cursorDate && !Number.isNaN(cursorDate.getTime())) {
      baseConditions.push(sql`${activityAt} < ${cursorDate}`);
    }

    return this.db
      .select()
      .from(rooms)
      .where(and(...baseConditions))
      .orderBy(sql`${activityAt} DESC`, desc(rooms.createdAt))
      .limit(limit);
  }

  async listVisibleForUser(
    userId: string,
    limit = 50,
    cursor?: string,
  ): Promise<Room[]> {
    const activityAt = sql<Date>`COALESCE(${rooms.lastMessageAt}, ${rooms.createdAt})`;
    const baseConditions: SQL[] = [
      eq(rooms.status, "active"),
      or(isNull(rooms.expiresAt), gt(rooms.expiresAt, new Date()))!,
      or(
        eq(rooms.roomType, "public"),
        eq(rooms.createdByUserId, userId),
        sql`EXISTS (
          SELECT 1
          FROM ${roomParticipants}
          WHERE ${roomParticipants.roomId} = ${rooms.id}
            AND ${roomParticipants.anonymousUserId} = ${userId}
            AND ${roomParticipants.status} = 'active'
        )`,
      )!,
    ];

    const cursorDate = cursor ? new Date(cursor) : null;
    if (cursorDate && !Number.isNaN(cursorDate.getTime())) {
      baseConditions.push(sql`${activityAt} < ${cursorDate}`);
    }

    return this.db
      .select()
      .from(rooms)
      .where(and(...baseConditions))
      .orderBy(sql`${activityAt} DESC`, desc(rooms.createdAt))
      .limit(limit);
  }

  async listForAdmin(limit = 100, cursor?: string): Promise<Room[]> {
    const activityAt = sql<Date>`COALESCE(${rooms.lastMessageAt}, ${rooms.createdAt})`;
    const baseConditions: SQL[] = [sql`${rooms.status} != 'deleted'`];

    const cursorDate = cursor ? new Date(cursor) : null;
    if (cursorDate && !Number.isNaN(cursorDate.getTime())) {
      baseConditions.push(sql`${activityAt} < ${cursorDate}`);
    }

    return this.db
      .select()
      .from(rooms)
      .where(and(...baseConditions))
      .orderBy(sql`${activityAt} DESC`, desc(rooms.createdAt))
      .limit(limit);
  }

  async purgeExpiredRooms(limit = 100): Promise<PurgedRoom[]> {
    return this.db.transaction(async (tx) => {
      const expiredRooms = rowsFromResult<PurgedRoom>(
        await tx.execute(
          sql`
            SELECT id, name
            FROM core.rooms
            WHERE status = 'active'
              AND expires_at IS NOT NULL
              AND expires_at <= NOW()
            ORDER BY expires_at ASC
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          `,
        ),
      );

      if (expiredRooms.length === 0) return [];

      const roomIds = expiredRooms.map((room) => room.id);
      const roomIdsSql = uuidArraySql(roomIds);

      const messageIds = rowsFromResult<{ id: string }>(
        await tx.execute(
          sql`
            SELECT id
            FROM core.messages
            WHERE room_id = ANY(${roomIdsSql})
          `,
        ),
      ).map((row) => row.id);
      const messageIdsSql = uuidArraySql(messageIds);

      const mediaIds = rowsFromResult<{ id: string }>(
        await tx.execute(
          sql`
            SELECT DISTINCT id
            FROM (
              SELECT media_asset_id AS id
              FROM core.messages
              WHERE room_id = ANY(${roomIdsSql})
                AND media_asset_id IS NOT NULL

              UNION

              SELECT resulting_asset_id AS id
              FROM media.upload_tokens
              WHERE target_room_id = ANY(${roomIdsSql})
                AND resulting_asset_id IS NOT NULL
            ) AS room_media
          `,
        ),
      ).map((row) => row.id);
      const mediaIdsSql = uuidArraySql(mediaIds);

      const reportIds = rowsFromResult<{ id: string }>(
        await tx.execute(
          sql`
            SELECT id
            FROM moderation.reports
            WHERE target_room_id = ANY(${roomIdsSql})
              OR target_message_id = ANY(${messageIdsSql})
          `,
        ),
      ).map((row) => row.id);
      const reportIdsSql = uuidArraySql(reportIds);

      const banIds = rowsFromResult<{ id: string }>(
        await tx.execute(
          sql`
            SELECT id
            FROM moderation.bans
            WHERE target_room_id = ANY(${roomIdsSql})
          `,
        ),
      ).map((row) => row.id);
      const banIdsSql = uuidArraySql(banIds);

      await tx.execute(
        sql`
          DELETE FROM admin.audit_log
          WHERE target_room_id = ANY(${roomIdsSql})
            OR target_message_id = ANY(${messageIdsSql})
            OR target_report_id = ANY(${reportIdsSql})
            OR target_ban_id = ANY(${banIdsSql})
        `,
      );

      await tx.execute(
        sql`
          UPDATE moderation.bans
          SET primary_evidence_id = NULL
          WHERE id = ANY(${banIdsSql})
        `,
      );

      await tx.execute(
        sql`
          DELETE FROM moderation.ban_evidence
          WHERE ban_id = ANY(${banIdsSql})
            OR matched_against_ban_id = ANY(${banIdsSql})
        `,
      );

      await tx.execute(
        sql`
          DELETE FROM moderation.bans
          WHERE id = ANY(${banIdsSql})
        `,
      );

      await tx.execute(
        sql`
          DELETE FROM moderation.reports
          WHERE id = ANY(${reportIdsSql})
        `,
      );

      await tx.execute(
        sql`
          DELETE FROM media.upload_tokens
          WHERE target_room_id = ANY(${roomIdsSql})
            OR resulting_asset_id = ANY(${mediaIdsSql})
        `,
      );

      await tx.execute(
        sql`
          DELETE FROM core.message_reactions
          WHERE message_id = ANY(${messageIdsSql})
        `,
      );

      await tx.execute(
        sql`
          DELETE FROM core.messages
          WHERE room_id = ANY(${roomIdsSql})
        `,
      );

      await tx.execute(
        sql`
          DELETE FROM media.media_assets AS media_asset
          WHERE media_asset.id = ANY(${mediaIdsSql})
            AND NOT EXISTS (
              SELECT 1
              FROM core.messages AS message
              WHERE message.media_asset_id = media_asset.id
            )
        `,
      );

      await tx.execute(
        sql`
          DELETE FROM core.rooms
          WHERE id = ANY(${roomIdsSql})
        `,
      );

      return expiredRooms;
    });
  }

  async reactivateParticipant(
    participantId: string,
  ): Promise<RoomParticipant | null> {
    const [participant] = await this.db
      .update(roomParticipants)
      .set({
        banExpiresAt: null,
        bannedAt: null,
        bannedReason: null,
        joinedAt: new Date(),
        status: "active",
      })
      .where(eq(roomParticipants.id, participantId))
      .returning();

    return participant ?? null;
  }

  async updateParticipantLastMessage(
    roomId: string,
    userId: string,
  ): Promise<void> {
    await this.db
      .update(roomParticipants)
      .set({ lastMessageAt: new Date() })
      .where(
        and(
          eq(roomParticipants.roomId, roomId),
          eq(roomParticipants.anonymousUserId, userId),
        ),
      );
  }

  async updateParticipantStatus(
    participantId: string,
    status: ParticipantStatus,
  ): Promise<RoomParticipant | null> {
    const [participant] = await this.db
      .update(roomParticipants)
      .set({ status })
      .where(eq(roomParticipants.id, participantId))
      .returning();

    return participant ?? null;
  }

  async updateStatus(
    roomId: string,
    status: Room["status"],
  ): Promise<Room | null> {
    const [room] = await this.db
      .update(rooms)
      .set({
        archivedAt:
          status === "archived" || status === "deleted" ? new Date() : null,
        status,
      })
      .where(eq(rooms.id, roomId))
      .returning();

    return room ?? null;
  }
}

function rowsFromResult<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as T[]) : [];
  }
  return [];
}

function uuidArraySql(ids: string[]): SQL {
  if (ids.length === 0) return sql`ARRAY[]::uuid[]`;
  return sql`ARRAY[${sql.join(ids.map((id) => sql`${id}`), sql`, `)}]::uuid[]`;
}

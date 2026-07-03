import { RateLimitCache, RoomCache, type RedisClient } from "../cache";
import { createError } from "../errors";
import { RoomRepository, type DrizzleClient } from "../repositories";
import type {
  CreateRoomInput,
  JoinRoomResult,
  PaginatedResult,
  ParticipantRole,
  Result,
  RoomDetails,
  RoomShareInfo,
  RoomSummary,
} from "../types";
import { err, ok } from "../types";
import {
  createRoomSlug,
  generateInviteCode,
  normalizeRoomName,
  validateRoomName,
} from "../utils";
import { WriteGuardService } from "./write-guard.service";

const MAX_ACTIVE_CREATED_ROOMS_PER_USER = 3;
export const ROOM_LIFETIME_MS = 2 * 60 * 60 * 1000;
export const ROOM_EXPIRY_WARNING_MS = 15 * 60 * 1000;

export class RoomService {
  private readonly rateLimitCache: RateLimitCache;
  private readonly roomCache: RoomCache;
  private readonly roomRepo: RoomRepository;
  private readonly writeGuard: WriteGuardService;

  constructor(db: DrizzleClient, redis: RedisClient) {
    this.rateLimitCache = new RateLimitCache(redis);
    this.roomCache = new RoomCache(redis);
    this.roomRepo = new RoomRepository(db);
    this.writeGuard = new WriteGuardService(db);
  }

  async createRoom(
    userId: string,
    sessionId: string,
    input: CreateRoomInput,
  ): Promise<Result<RoomDetails>> {
    const writeAccess = await this.writeGuard.requireWriteAccess({
      sessionId,
      userId,
    });
    if (!writeAccess.ok) return err(writeAccess.error);

    const name = normalizeRoomName(input.name);
    const nameError = validateRoomName(name);
    if (nameError) return err(createError("VALIDATION_ERROR", nameError));
    const roomError = validateCreateRoomInput(input);
    if (roomError) return err(createError("VALIDATION_ERROR", roomError));

    const activeCreatedRooms =
      await this.roomRepo.countActiveCreatedByUser(userId);
    if (activeCreatedRooms >= MAX_ACTIVE_CREATED_ROOMS_PER_USER) {
      return err(
        createError("RATE_LIMITED", "Active room creation limit reached.", {
          activeRoomLimit: MAX_ACTIVE_CREATED_ROOMS_PER_USER,
        }),
      );
    }

    const limit = await this.rateLimitCache.checkAndIncrement(
      "room_create",
      userId,
      { maxRequests: 3, windowSeconds: 3600 },
    );
    if (!limit.allowed) {
      return err(
        createError("RATE_LIMITED", "Room creation rate limited.", {
          retryAfterSeconds: limit.retryAfterSeconds,
        }),
      );
    }

    const slug = await this.createAvailableSlug(input.slug ?? name);
    const expiresAt = new Date(Date.now() + ROOM_LIFETIME_MS);
    const room = await this.roomRepo.create(
      userId,
      sessionId,
      { ...input, expiresAt, name, roomType: input.roomType ?? "public" },
      slug,
      input.roomType === "private" ? generateInviteCode() : undefined,
    );
    await this.roomRepo.addParticipant(room.id, userId, "creator");

    const details = mapRoomDetails({ ...room, participantCount: 1 });
    await this.roomCache.setMetadata(room.id, details);
    return ok(details);
  }

  async getRoomById(roomId: string): Promise<Result<RoomDetails>> {
    const room = await this.roomRepo.findById(roomId);
    return room
      ? ok(mapRoomDetails(room))
      : err(createError("ROOM_NOT_FOUND", "Room not found."));
  }

  async getRoomBySlug(slug: string): Promise<Result<RoomDetails>> {
    const room = await this.roomRepo.findBySlug(slug);
    return room
      ? ok(mapRoomDetails(room))
      : err(createError("ROOM_NOT_FOUND", "Room not found."));
  }

  async getActivePresence(roomId: string): Promise<string[]> {
    return this.roomCache.getActivePresence(roomId);
  }

  async getParticipants(roomId: string, limit = 100) {
    const room = await this.roomRepo.findById(roomId);
    if (!room) return err(createError("ROOM_NOT_FOUND", "Room not found."));

    return ok(await this.roomRepo.listParticipants(roomId, "active", limit));
  }

  async getShareInfo(
    roomId: string,
    userId: string,
  ): Promise<Result<RoomShareInfo>> {
    const room = await this.roomRepo.findById(roomId);
    if (!room) return err(createError("ROOM_NOT_FOUND", "Room not found."));

    const participant = await this.roomRepo.getParticipant(roomId, userId);
    const canInvite =
      room.roomType === "public" ||
      room.createdByUserId === userId ||
      participant?.status === "active";

    return ok(mapRoomShareInfo(room, canInvite));
  }

  async getTypingUsers(roomId: string) {
    return this.roomCache.getTypingUsers(roomId);
  }

  async joinRoom(
    roomId: string,
    userId: string,
    sessionId?: string,
  ): Promise<Result<JoinRoomResult>> {
    const limit = await this.rateLimitCache.checkAndIncrement(
      "room_join",
      userId,
      { maxRequests: 20, windowSeconds: 60 },
    );
    if (!limit.allowed) {
      return err(
        createError("RATE_LIMITED", "Room join rate limited.", {
          retryAfterSeconds: limit.retryAfterSeconds,
        }),
      );
    }

    const room = await this.roomRepo.findById(roomId);
    if (!room) return err(createError("ROOM_NOT_FOUND", "Room not found."));

    const roomAccess = await this.writeGuard.requireRoomEntryAccess({
      roomId,
      sessionId,
      userId,
    });
    if (!roomAccess.ok) return err(roomAccess.error);

    if (room.status === "locked")
      return err(createError("ROOM_LOCKED", "Room is locked."));
    if (room.status === "archived")
      return err(createError("ROOM_ARCHIVED", "Room is archived."));
    if (room.status !== "active")
      return err(createError("ROOM_NOT_FOUND", "Room is not active."));
    if (room.expiresAt && room.expiresAt <= new Date()) {
      return err(createError("ROOM_EXPIRED", "Room has expired."));
    }
    if (room.maxParticipants && room.participantCount >= room.maxParticipants) {
      return err(createError("ROOM_FULL", "Room is full."));
    }

    const existing = await this.roomRepo.getParticipant(roomId, userId);
    if (existing?.status === "active") {
      return ok({
        isNewJoin: false,
        participantId: existing.id,
        role: existing.role as ParticipantRole,
      });
    }
    if (existing?.status === "banned") {
      if (!existing.banExpiresAt || existing.banExpiresAt > new Date()) {
        return err(
          createError("ROOM_BANNED", "You are banned from this room."),
        );
      }
      const reactivated = await this.roomRepo.reactivateParticipant(
        existing.id,
      );
      if (!reactivated)
        return err(createError("INTERNAL_ERROR", "Failed to join room."));
      return ok({
        isNewJoin: true,
        participantId: reactivated.id,
        role: reactivated.role as ParticipantRole,
      });
    }
    if (existing) {
      const active = await this.roomRepo.reactivateParticipant(existing.id);
      if (!active)
        return err(createError("INTERNAL_ERROR", "Failed to join room."));
      return ok({
        isNewJoin: true,
        participantId: active.id,
        role: active.role as ParticipantRole,
      });
    }

    const participant = await this.roomRepo.addParticipant(
      roomId,
      userId,
      "member",
    );
    return ok({
      isNewJoin: true,
      participantId: participant.id,
      role: participant.role as ParticipantRole,
    });
  }

  async listPublicRooms(
    limit = 50,
    cursor?: string,
  ): Promise<PaginatedResult<RoomSummary>> {
    const safeLimit = clampLimit(limit, 1, 100);
    const rooms = await this.roomRepo.listPublic(safeLimit + 1, cursor);
    const hasMore = rooms.length > safeLimit;
    const items = hasMore ? rooms.slice(0, safeLimit) : rooms;

    return {
      hasMore,
      items: items.map(mapRoomSummary),
      nextCursor:
        hasMore && items.length > 0
          ? ((
              items.at(-1)?.lastMessageAt ?? items.at(-1)?.createdAt
            )?.toISOString() ?? null)
          : null,
    };
  }

  async listVisibleRoomsForUser(
    userId: string,
    limit = 50,
    cursor?: string,
  ): Promise<PaginatedResult<RoomSummary>> {
    const safeLimit = clampLimit(limit, 1, 100);
    const rooms = await this.roomRepo.listVisibleForUser(
      userId,
      safeLimit + 1,
      cursor,
    );
    const hasMore = rooms.length > safeLimit;
    const items = hasMore ? rooms.slice(0, safeLimit) : rooms;

    return {
      hasMore,
      items: items.map(mapRoomSummary),
      nextCursor:
        hasMore && items.length > 0
          ? ((
              items.at(-1)?.lastMessageAt ?? items.at(-1)?.createdAt
            )?.toISOString() ?? null)
          : null,
    };
  }

  async getCreationLimits(userId: string): Promise<{
    currentRoomsCreated: number;
    maxRoomsPerUser: number;
  }> {
    return {
      currentRoomsCreated: await this.roomRepo.countActiveCreatedByUser(userId),
      maxRoomsPerUser: MAX_ACTIVE_CREATED_ROOMS_PER_USER,
    };
  }

  async purgeExpiredRooms(
    limit = 100,
  ): Promise<Result<{ purgedCount: number; roomIds: string[] }>> {
    try {
      const safeLimit = clampLimit(limit, 1, 500);
      const purgedRooms = await this.roomRepo.purgeExpiredRooms(safeLimit);
      await Promise.all(
        purgedRooms.map((room) => this.roomCache.clearRoom(room.id)),
      );

      return ok({
        purgedCount: purgedRooms.length,
        roomIds: purgedRooms.map((room) => room.id),
      });
    } catch (error) {
      return err(
        createError("INTERNAL_ERROR", "Failed to purge expired rooms.", {
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  async regenerateInviteCode(
    roomId: string,
    userId: string,
    sessionId: string,
    expiresAt?: Date,
  ): Promise<Result<RoomShareInfo>> {
    const access = await this.writeGuard.requireInteractionAccess({
      roomId,
      sessionId,
      userId,
    });
    if (!access.ok) return err(access.error);

    const room = await this.roomRepo.findById(roomId);
    if (!room) return err(createError("ROOM_NOT_FOUND", "Room not found."));
    if (room.createdByUserId !== userId) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Only the room creator can manage invite links.",
        ),
      );
    }
    if (room.roomType !== "private") {
      return err(
        createError("VALIDATION_ERROR", "Only private rooms use invite links."),
      );
    }
    if (room.status !== "active") {
      return err(createError("ROOM_NOT_FOUND", "Room is not active."));
    }
    if (expiresAt && expiresAt <= new Date()) {
      return err(
        createError("VALIDATION_ERROR", "Invite expiry must be in the future."),
      );
    }

    const inviteCode = await this.createAvailableInviteCode();
    const updated = await this.roomRepo.updateInviteCode(
      roomId,
      inviteCode,
      expiresAt ?? null,
    );
    if (!updated) {
      return err(createError("INTERNAL_ERROR", "Failed to update invite."));
    }

    await this.roomCache.setMetadata(roomId, mapRoomDetails(updated));
    return ok(mapRoomShareInfo(updated, true));
  }

  async disableInviteCode(
    roomId: string,
    userId: string,
    sessionId: string,
  ): Promise<Result<RoomShareInfo>> {
    const access = await this.writeGuard.requireInteractionAccess({
      roomId,
      sessionId,
      userId,
    });
    if (!access.ok) return err(access.error);

    const room = await this.roomRepo.findById(roomId);
    if (!room) return err(createError("ROOM_NOT_FOUND", "Room not found."));
    if (room.createdByUserId !== userId) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Only the room creator can manage invite links.",
        ),
      );
    }
    if (room.roomType !== "private") {
      return err(
        createError("VALIDATION_ERROR", "Only private rooms use invite links."),
      );
    }

    const updated = await this.roomRepo.updateInviteCode(roomId, null, null);
    if (!updated) {
      return err(createError("INTERNAL_ERROR", "Failed to disable invite."));
    }

    await this.roomCache.setMetadata(roomId, mapRoomDetails(updated));
    return ok(mapRoomShareInfo(updated, true));
  }

  async leaveRoom(roomId: string, userId: string): Promise<Result<void>> {
    const participant = await this.roomRepo.getParticipant(roomId, userId);
    if (!participant || participant.status !== "active") {
      return err(
        createError("NOT_ROOM_PARTICIPANT", "Not an active room participant."),
      );
    }

    await this.roomRepo.updateParticipantStatus(participant.id, "left");
    return ok(undefined);
  }

  async removePresence(
    roomId: string,
    sessionId: string,
    connectionId?: string,
  ): Promise<void> {
    await this.roomCache.removePresence(roomId, sessionId, connectionId);
  }

  async removeTyping(roomId: string, sessionId: string): Promise<void> {
    await this.roomCache.removeTyping(roomId, sessionId);
  }

  async setPresence(
    roomId: string,
    sessionId: string,
    connectionId?: string,
  ): Promise<void> {
    await this.roomCache.addPresence(roomId, sessionId, connectionId);
  }

  async setTyping(
    roomId: string,
    userId: string,
    sessionId: string,
    displayName: string,
  ): Promise<Result<void>> {
    const writeAccess = await this.writeGuard.requireWriteAccess({
      roomId,
      sessionId,
      userId,
    });
    if (!writeAccess.ok) return err(writeAccess.error);

    await this.roomCache.setTyping(roomId, sessionId, displayName, userId);
    return ok(undefined);
  }

  private async createAvailableSlug(seed: string): Promise<string> {
    const base = createRoomSlug(seed) || `room-${Date.now()}`;
    let slug = base;
    let suffix = 2;

    while (await this.roomRepo.findBySlug(slug)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private async createAvailableInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const inviteCode = generateInviteCode();
      if (!(await this.roomRepo.findByInviteCode(inviteCode))) {
        return inviteCode;
      }
    }

    throw new Error("Failed to generate unique invite code.");
  }
}

function validateCreateRoomInput(input: CreateRoomInput): string | null {
  if (input.roomType === "announcement") {
    return "Announcement rooms can only be created by admins.";
  }
  if (
    input.maxParticipants !== undefined &&
    (!Number.isInteger(input.maxParticipants) ||
      input.maxParticipants < 2 ||
      input.maxParticipants > 5000)
  ) {
    return "maxParticipants must be between 2 and 5000.";
  }
  if (input.description && input.description.length > 500) {
    return "Room description is too long.";
  }

  return null;
}

function clampLimit(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return max;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function mapRoomSummary(room: {
  allowImages: boolean;
  allowLinks: boolean;
  createdAt: Date;
  createdByUserId: string;
  description: string | null;
  expiresAt: Date | null;
  id: string;
  lastMessageAt: Date | null;
  messageCount: number;
  name: string;
  participantCount: number;
  roomType: string;
  slug: string | null;
  slowModeSeconds: number | null;
  status: string;
}): RoomSummary {
  return {
    allowImages: room.allowImages,
    allowLinks: room.allowLinks,
    createdAt: room.createdAt,
    createdByUserId: room.createdByUserId,
    description: room.description,
    expiresAt: room.expiresAt,
    id: room.id,
    lastMessageAt: room.lastMessageAt,
    messageCount: room.messageCount,
    name: room.name,
    participantCount: room.participantCount,
    roomType: room.roomType as RoomSummary["roomType"],
    slug: room.slug,
    slowModeSeconds: room.slowModeSeconds ?? 0,
    status: room.status as RoomSummary["status"],
  };
}

function mapRoomDetails(
  room: Parameters<typeof mapRoomSummary>[0] & {
    createdByUserId: string;
    inviteCode: string | null;
    inviteCodeExpiresAt: Date | null;
    maxParticipants: number | null;
  },
): RoomDetails {
  return {
    ...mapRoomSummary(room),
    createdByUserId: room.createdByUserId,
    expiresAt: room.expiresAt,
    inviteCode: room.inviteCode,
    inviteCodeExpiresAt: room.inviteCodeExpiresAt,
    maxParticipants: room.maxParticipants,
  };
}

function mapRoomShareInfo(
  room: Parameters<typeof mapRoomDetails>[0],
  canInvite: boolean,
): RoomShareInfo {
  const inviteCode = getActiveInviteCode(room, canInvite);
  const inviteQuery = inviteCode
    ? `?inviteCode=${encodeURIComponent(inviteCode)}`
    : "";

  return {
    canInvite,
    inviteCode,
    inviteCodeExpiresAt: inviteCode ? room.inviteCodeExpiresAt : null,
    isInviteEnabled: room.roomType === "public" || Boolean(inviteCode),
    roomId: room.id,
    roomType: room.roomType as RoomShareInfo["roomType"],
    sharePath: `/rooms/${room.id}${inviteQuery}`,
    slug: room.slug,
  };
}

function getActiveInviteCode(
  room: Parameters<typeof mapRoomDetails>[0],
  canInvite: boolean,
): string | null {
  if (!canInvite || room.roomType !== "private" || !room.inviteCode) {
    return null;
  }
  if (room.inviteCodeExpiresAt && room.inviteCodeExpiresAt <= new Date()) {
    return null;
  }

  return room.inviteCode;
}

import { TRPCError } from "@trpc/server";
import type { RoomDetails } from "@campus-chat/services/types";
import { BanService, RoomService } from "@campus-chat/services/services";
import { RoomRepository } from "@campus-chat/services/repositories";

import type { AuthenticatedContext } from "./context";
import { handleServiceResult } from "./errors";

export async function assertCanReadRoom(
  ctx: AuthenticatedContext,
  roomId: string,
  inviteCode?: string,
): Promise<RoomDetails> {
  const roomService = new RoomService(ctx.db, ctx.redis);
  const room = handleServiceResult(await roomService.getRoomById(roomId));

  await assertNotRoomBanned(ctx, room.id);
  await assertPrivateRoomReadable(ctx, room, inviteCode);

  if (room.status === "deleted") {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Room not found.",
    });
  }

  return maskRoomInvite(room, await canSeeRoomInvite(ctx, room));
}

export async function assertCanJoinRoom(
  ctx: AuthenticatedContext,
  roomId: string,
  inviteCode?: string,
): Promise<RoomDetails> {
  const roomService = new RoomService(ctx.db, ctx.redis);
  const room = handleServiceResult(await roomService.getRoomById(roomId));
  const participant = await getParticipant(ctx, room.id);

  if (
    room.roomType === "private" &&
    participant?.status !== "active" &&
    !isValidInvite(room, inviteCode)
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A valid invite is required to join this room.",
    });
  }

  return room;
}

export async function sanitizeRoomDetailsForViewer(
  ctx: AuthenticatedContext,
  room: RoomDetails,
): Promise<RoomDetails> {
  return maskRoomInvite(room, await canSeeRoomInvite(ctx, room));
}

async function assertNotRoomBanned(
  ctx: AuthenticatedContext,
  roomId: string,
): Promise<void> {
  const banService = new BanService(ctx.db, ctx.redis);
  const ban = await banService.checkActiveBan({
    roomId,
    sessionId: ctx.session.sessionId,
    userId: ctx.session.userId,
  });

  const roomBan =
    ban?.banType === "room_ban"
      ? ban
      : await banService.checkActiveRoomBan({
          roomId,
          sessionId: ctx.session.sessionId,
          userId: ctx.session.userId,
        });

  if (roomBan) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are banned from this room.",
    });
  }
}

async function assertPrivateRoomReadable(
  ctx: AuthenticatedContext,
  room: RoomDetails,
  inviteCode?: string,
): Promise<void> {
  if (room.roomType !== "private") return;

  const participant = await getParticipant(ctx, room.id);
  if (
    participant?.status === "active" ||
    room.createdByUserId === ctx.session.userId ||
    isValidInvite(room, inviteCode)
  ) {
    return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You do not have access to this room.",
  });
}

async function canSeeRoomInvite(
  ctx: AuthenticatedContext,
  room: RoomDetails,
): Promise<boolean> {
  if (room.createdByUserId === ctx.session.userId) return true;
  const participant = await getParticipant(ctx, room.id);
  return participant?.status === "active";
}

async function getParticipant(
  ctx: AuthenticatedContext,
  roomId: string,
): Promise<Awaited<ReturnType<RoomRepository["getParticipant"]>>> {
  const roomRepo = new RoomRepository(ctx.db);
  return roomRepo.getParticipant(roomId, ctx.session.userId);
}

function isValidInvite(room: RoomDetails, inviteCode?: string): boolean {
  if (!inviteCode || !room.inviteCode || inviteCode !== room.inviteCode) {
    return false;
  }

  return !room.inviteCodeExpiresAt || room.inviteCodeExpiresAt > new Date();
}

function maskRoomInvite(room: RoomDetails, canSeeInvite: boolean): RoomDetails {
  if (canSeeInvite) return room;
  return {
    ...room,
    inviteCode: null,
  };
}

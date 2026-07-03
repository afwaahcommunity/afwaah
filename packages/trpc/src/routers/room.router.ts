import { z } from "zod";
import { RoomService } from "@campus-chat/services/services";
import type {
  ParticipantRole,
  ParticipantStatus,
} from "@campus-chat/services/types";

import { assertCanJoinRoom, assertCanReadRoom } from "../access";
import { handleServiceResult } from "../errors";
import {
  createRoomInputSchema,
  disableRoomInviteInputSchema,
  getParticipantsInputSchema,
  getRoomByIdInputSchema,
  getRoomBySlugInputSchema,
  getRoomShareInfoInputSchema,
  joinRoomInputSchema,
  joinRoomOutputSchema,
  leaveRoomInputSchema,
  listRoomsInputSchema,
  listRoomsOutputSchema,
  regenerateRoomInviteInputSchema,
  participantSchema,
  roomCreationLimitsOutputSchema,
  roomDetailsSchema,
  roomShareInfoSchema,
  successOutputSchema,
} from "../schemas";
import { router, sessionProcedure } from "../trpc";

export const roomRouter = router({
  create: sessionProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/rooms",
        protected: "session",
        summary: "Create a room",
        tags: ["Rooms"],
      },
    })
    .input(createRoomInputSchema)
    .output(roomDetailsSchema)
    .mutation(async ({ ctx, input }) => {
      const roomService = new RoomService(ctx.db, ctx.redis);
      const room = handleServiceResult(
        await roomService.createRoom(
          ctx.session.userId,
          ctx.session.sessionId,
          input,
        ),
      );

      return room;
    }),

  creationLimits: sessionProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/rooms/creation-limits",
        protected: "session",
        summary: "Get current room creation limits",
        tags: ["Rooms"],
      },
    })
    .output(roomCreationLimitsOutputSchema)
    .query(async ({ ctx }) => {
      const roomService = new RoomService(ctx.db, ctx.redis);
      return roomService.getCreationLimits(ctx.session.userId);
    }),

  getById: sessionProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/rooms/by-id",
        protected: "session",
        summary: "Get room details by id",
        tags: ["Rooms"],
      },
    })
    .input(getRoomByIdInputSchema)
    .output(roomDetailsSchema)
    .query(({ ctx, input }) =>
      assertCanReadRoom(ctx, input.roomId, input.inviteCode),
    ),

  getBySlug: sessionProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/rooms/by-slug",
        protected: "session",
        summary: "Get room details by slug",
        tags: ["Rooms"],
      },
    })
    .input(getRoomBySlugInputSchema)
    .output(roomDetailsSchema)
    .query(async ({ ctx, input }) => {
      const roomService = new RoomService(ctx.db, ctx.redis);
      const room = handleServiceResult(
        await roomService.getRoomBySlug(input.slug),
      );

      return assertCanReadRoom(ctx, room.id, input.inviteCode);
    }),

  getShareInfo: sessionProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/rooms/share-info",
        protected: "session",
        summary: "Get share information for a room",
        tags: ["Rooms"],
      },
    })
    .input(getRoomShareInfoInputSchema)
    .output(roomShareInfoSchema)
    .query(async ({ ctx, input }) => {
      await assertCanReadRoom(ctx, input.roomId, input.inviteCode);

      const roomService = new RoomService(ctx.db, ctx.redis);
      return handleServiceResult(
        await roomService.getShareInfo(input.roomId, ctx.session.userId),
      );
    }),

  getParticipants: sessionProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/rooms/participants",
        protected: "session",
        summary: "List active room participants",
        tags: ["Rooms"],
      },
    })
    .input(getParticipantsInputSchema)
    .output(z.array(participantSchema))
    .query(async ({ ctx, input }) => {
      await assertCanReadRoom(ctx, input.roomId);

      const roomService = new RoomService(ctx.db, ctx.redis);
      const result = await roomService.getParticipants(
        input.roomId,
        input.limit,
      );

      return handleServiceResult(result).map((participant) => ({
        ...participant,
        role: participant.role as ParticipantRole,
        status: participant.status as ParticipantStatus,
      }));
    }),

  join: sessionProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/rooms/join",
        protected: "session",
        summary: "Join a room",
        tags: ["Rooms"],
      },
    })
    .input(joinRoomInputSchema)
    .output(joinRoomOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCanJoinRoom(ctx, input.roomId, input.inviteCode);

      const roomService = new RoomService(ctx.db, ctx.redis);
      const result = await roomService.joinRoom(
        input.roomId,
        ctx.session.userId,
        ctx.session.sessionId,
      );

      return handleServiceResult(result);
    }),

  regenerateInvite: sessionProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/rooms/invite/regenerate",
        protected: "session",
        summary: "Regenerate a private room invite link",
        tags: ["Rooms"],
      },
    })
    .input(regenerateRoomInviteInputSchema)
    .output(roomShareInfoSchema)
    .mutation(async ({ ctx, input }) => {
      const roomService = new RoomService(ctx.db, ctx.redis);
      return handleServiceResult(
        await roomService.regenerateInviteCode(
          input.roomId,
          ctx.session.userId,
          ctx.session.sessionId,
          input.expiresAt,
        ),
      );
    }),

  disableInvite: sessionProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/rooms/invite/disable",
        protected: "session",
        summary: "Disable a private room invite link",
        tags: ["Rooms"],
      },
    })
    .input(disableRoomInviteInputSchema)
    .output(roomShareInfoSchema)
    .mutation(async ({ ctx, input }) => {
      const roomService = new RoomService(ctx.db, ctx.redis);
      return handleServiceResult(
        await roomService.disableInviteCode(
          input.roomId,
          ctx.session.userId,
          ctx.session.sessionId,
        ),
      );
    }),

  leave: sessionProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/rooms/leave",
        protected: "session",
        summary: "Leave a room",
        tags: ["Rooms"],
      },
    })
    .input(leaveRoomInputSchema)
    .output(successOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const roomService = new RoomService(ctx.db, ctx.redis);
      handleServiceResult(
        await roomService.leaveRoom(input.roomId, ctx.session.userId),
      );

      return { success: true };
    }),

  list: sessionProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/rooms",
        protected: "session",
        summary: "List public rooms",
        tags: ["Rooms"],
      },
    })
    .input(listRoomsInputSchema)
    .output(listRoomsOutputSchema)
    .query(async ({ ctx, input }) => {
      const roomService = new RoomService(ctx.db, ctx.redis);
      const result = await roomService.listVisibleRoomsForUser(
        ctx.session.userId,
        input.limit,
        input.cursor,
      );

      return result;
    }),
});

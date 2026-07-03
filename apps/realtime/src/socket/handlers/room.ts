import { RoomService } from "@campus-chat/services/services";

import type { RealtimeClients } from "../../clients";
import type { RoomJoinResponse, RoomLeaveResponse } from "../../types/events";
import type { RealtimeServer, RealtimeSocket } from "../../types/socket";
import { emitSocketError, respondOrEmit } from "../errors";
import type { PresenceManager } from "../presence";
import { roomPayloadSchema } from "../schemas";

export function registerRoomHandlers(
  io: RealtimeServer,
  socket: RealtimeSocket,
  clients: RealtimeClients,
  presenceManager: PresenceManager,
): void {
  const roomService = new RoomService(clients.db, clients.redis);

  socket.on("room:join", async (payload, callback) => {
    try {
      const input = roomPayloadSchema.safeParse(payload);
      if (!input.success) {
        respondOrEmit<RoomJoinResponse>(socket, callback, {
          error: "Invalid room ID.",
          success: false,
        });
        return;
      }

      const result = await roomService.joinRoom(
        input.data.roomId,
        socket.data.userId,
        socket.data.sessionId,
      );
      if (!result.ok) {
        respondOrEmit<RoomJoinResponse>(socket, callback, {
          error: result.error.message,
          success: false,
        });
        return;
      }

      await presenceManager.addToRoom(io, socket, input.data.roomId);
      socket.emit("room:joined", { roomId: input.data.roomId });
      respondOrEmit<RoomJoinResponse>(socket, callback, {
        roomId: input.data.roomId,
        success: true,
      });
    } catch (error) {
      console.error("room:join failed", error);
      respondOrEmit<RoomJoinResponse>(socket, callback, {
        error: "Failed to join room.",
        success: false,
      });
    }
  });

  socket.on("room:leave", async (payload, callback) => {
    try {
      const input = roomPayloadSchema.safeParse(payload);
      if (!input.success) {
        respondOrEmit<RoomLeaveResponse>(socket, callback, {
          error: "Invalid room ID.",
          success: false,
        });
        return;
      }

      if (!socket.data.rooms.has(input.data.roomId)) {
        respondOrEmit<RoomLeaveResponse>(socket, callback, {
          error: "Not in room.",
          success: false,
        });
        return;
      }

      const result = await roomService.leaveRoom(
        input.data.roomId,
        socket.data.userId,
      );
      if (!result.ok) {
        respondOrEmit<RoomLeaveResponse>(socket, callback, {
          error: result.error.message,
          success: false,
        });
        return;
      }

      await presenceManager.removeFromRoom(io, socket, input.data.roomId);
      socket.emit("room:left", { roomId: input.data.roomId });
      respondOrEmit<RoomLeaveResponse>(socket, callback, {
        roomId: input.data.roomId,
        success: true,
      });
    } catch (error) {
      console.error("room:leave failed", error);
      emitSocketError(socket, "ROOM_LEAVE_FAILED", "Failed to leave room.");
      respondOrEmit<RoomLeaveResponse>(socket, callback, {
        error: "Failed to leave room.",
        success: false,
      });
    }
  });
}

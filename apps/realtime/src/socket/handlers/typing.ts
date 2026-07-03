import { RoomService } from "@campus-chat/services/services";

import type { RealtimeClients } from "../../clients";
import type { RealtimeServer, RealtimeSocket } from "../../types/socket";
import { emitSocketError } from "../errors";
import type { PresenceManager } from "../presence";
import { typingPayloadSchema } from "../schemas";

export function registerTypingHandlers(
  io: RealtimeServer,
  socket: RealtimeSocket,
  clients: RealtimeClients,
  presenceManager: PresenceManager,
): void {
  const roomService = new RoomService(clients.db, clients.redis);

  socket.on("typing:start", async (payload) => {
    try {
      const input = typingPayloadSchema.safeParse(payload);
      if (!input.success || !socket.data.rooms.has(input.data.roomId)) return;
      if (socket.data.readOnly) {
        emitSocketError(
          socket,
          "READ_ONLY",
          "Read-only sessions cannot send typing events.",
        );
        return;
      }

      const result = await roomService.setTyping(
        input.data.roomId,
        socket.data.userId,
        socket.data.sessionId,
        socket.data.displayName,
      );
      if (!result.ok) {
        emitSocketError(socket, result.error.code, result.error.message);
        return;
      }

      await presenceManager.broadcastTyping(io, input.data.roomId);
    } catch (error) {
      console.error("typing:start failed", error);
    }
  });

  socket.on("typing:stop", async (payload) => {
    try {
      const input = typingPayloadSchema.safeParse(payload);
      if (!input.success || !socket.data.rooms.has(input.data.roomId)) return;

      await roomService.removeTyping(input.data.roomId, socket.data.sessionId);
      await presenceManager.broadcastTyping(io, input.data.roomId);
    } catch (error) {
      console.error("typing:stop failed", error);
    }
  });
}

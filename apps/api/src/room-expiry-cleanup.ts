import { RoomService } from "@campus-chat/services/services";

import type { ApiClients } from "./clients";

const ROOM_EXPIRY_CLEANUP_INTERVAL_MS = 30_000;

export interface RoomExpiryCleanupHandle {
  stop(): void;
}

export function startRoomExpiryCleanup(
  clients: ApiClients,
): RoomExpiryCleanupHandle {
  const roomService = new RoomService(clients.db, clients.redis);
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;

    try {
      const result = await roomService.purgeExpiredRooms();
      if (!result.ok) {
        console.error("Expired room cleanup failed", result.error);
        return;
      }

      if (result.value.purgedCount > 0) {
        console.log(
          `Purged ${result.value.purgedCount} expired room(s): ${result.value.roomIds.join(", ")}`,
        );
      }
    } catch (error) {
      console.error("Expired room cleanup failed", error);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(run, ROOM_EXPIRY_CLEANUP_INTERVAL_MS);
  timer.unref?.();
  void run();

  return {
    stop() {
      clearInterval(timer);
    },
  };
}

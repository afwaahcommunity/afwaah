import type { ErrorPayload } from "../types/events";
import type { RealtimeSocket } from "../types/socket";

export function emitSocketError(
  socket: RealtimeSocket,
  code: string,
  message: string,
): ErrorPayload {
  const payload = { code, message };
  socket.emit("error", payload);
  return payload;
}

export function respondOrEmit<T extends { error?: string; success: boolean }>(
  socket: RealtimeSocket,
  callback: ((response: T) => void) | undefined,
  response: T,
  errorCode = "REALTIME_ERROR",
): void {
  if (typeof callback === "function") {
    callback(response);
    return;
  }

  if (!response.success) {
    emitSocketError(socket, errorCode, response.error ?? "Realtime error.");
  }
}

/**
 * Realtime client (ISOLATED).
 *
 * In production this wraps `socket.io-client` against `env.realtimeUrl`.
 * When no backend is reachable, falls back to a local mock event bus that
 * simulates message arrival, typing, and presence.
 */
import { io, type Socket } from "socket.io-client";
import { env } from "../env";
import { mockGenerateMessage } from "../mocks/data";
import type { Message, Presence, TypingUser } from "../types";

type Listener<T> = (payload: T) => void;

export interface RoomChannel {
  onMessage: (fn: Listener<Message>) => () => void;
  onTyping: (fn: Listener<TypingUser[]>) => () => void;
  onPresence: (fn: Listener<Presence[]>) => () => void;
  sendTyping: () => void;
  leave: () => void;
}

interface ConnectOpts {
  token: string;
}

let socket: Socket | null = null;

function ensureSocket(opts: ConnectOpts): Socket | null {
  if (env.useMocks) return null;
  if (socket) return socket;
  try {
    socket = io(env.realtimeUrl, {
      auth: { token: opts.token },
      transports: ["websocket"],
      autoConnect: true,
    });
    return socket;
  } catch {
    return null;
  }
}

export function joinRoom(roomId: string, opts: ConnectOpts): RoomChannel {
  const s = ensureSocket(opts);

  const messageListeners = new Set<Listener<Message>>();
  const typingListeners = new Set<Listener<TypingUser[]>>();
  const presenceListeners = new Set<Listener<Presence[]>>();

  let mockInterval: ReturnType<typeof setInterval> | null = null;
  let mockTypingTimer: ReturnType<typeof setTimeout> | null = null;

  if (s) {
    s.emit("room:join", { roomId });
    const onMsg = (m: Message) => { if (m.roomId === roomId) messageListeners.forEach((l) => l(m)); };
    const onTyping = (list: TypingUser[]) => typingListeners.forEach((l) => l(list));
    const onPres = (list: Presence[]) => presenceListeners.forEach((l) => l(list));
    s.on("message", onMsg);
    s.on("typing", onTyping);
    s.on("presence", onPres);

    return {
      onMessage: (fn) => (messageListeners.add(fn), () => messageListeners.delete(fn)),
      onTyping: (fn) => (typingListeners.add(fn), () => typingListeners.delete(fn)),
      onPresence: (fn) => (presenceListeners.add(fn), () => presenceListeners.delete(fn)),
      sendTyping: () => s.emit("typing", { roomId }),
      leave: () => {
        s.emit("room:leave", { roomId });
        s.off("message", onMsg);
        s.off("typing", onTyping);
        s.off("presence", onPres);
      },
    };
  }

  // Mock mode
  const emitPresence = () =>
    presenceListeners.forEach((l) =>
      l([
        { userId: "u_a", displayName: "quiet-otter-42", displayColor: "#22d3ee" },
        { userId: "u_b", displayName: "brave-heron-08", displayColor: "#f472b6" },
        { userId: "u_c", displayName: "amber-koi-77", displayColor: "#fbbf24" },
      ]),
    );

  setTimeout(emitPresence, 200);

  mockInterval = setInterval(() => {
    if (Math.random() > 0.55) {
      const m = mockGenerateMessage(roomId);
      messageListeners.forEach((l) => l(m));
    } else {
      typingListeners.forEach((l) =>
        l([{ userId: "u_a", displayName: "quiet-otter-42" }]),
      );
      if (mockTypingTimer) clearTimeout(mockTypingTimer);
      mockTypingTimer = setTimeout(() => {
        typingListeners.forEach((l) => l([]));
      }, 2200);
    }
  }, 6500);

  return {
    onMessage: (fn) => (messageListeners.add(fn), () => messageListeners.delete(fn)),
    onTyping: (fn) => (typingListeners.add(fn), () => typingListeners.delete(fn)),
    onPresence: (fn) => (presenceListeners.add(fn), () => presenceListeners.delete(fn)),
    sendTyping: () => {},
    leave: () => {
      if (mockInterval) clearInterval(mockInterval);
      if (mockTypingTimer) clearTimeout(mockTypingTimer);
      messageListeners.clear();
      typingListeners.clear();
      presenceListeners.clear();
    },
  };
}

export function disconnectRealtime() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

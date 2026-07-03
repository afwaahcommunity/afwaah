/**
 * tRPC-shaped API client (ISOLATED).
 *
 * The real app should import types from `@campus-chat/trpc/client` and use
 * `createTRPCProxyClient` against `env.trpcUrl`. Here we expose a thin,
 * hand-written surface with the SAME method shape so components stay stable
 * when swapped into the real Next.js `apps/web`.
 */
import { env } from "../env";
import {
  mockRooms,
  mockMessages,
  mockReports,
  mockAdminUsers,
  mockOverview,
} from "../mocks/data";
import type {
  AnonSession,
  Room,
  Message,
  Report,
  AdminUser,
  AdminOverview,
  BanState,
} from "../types";
import { randomDisplayColor, randomDisplayName } from "../constants";

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

async function tryFetch<T>(path: string): Promise<T | null> {
  if (env.useMocks) return null;
  try {
    const res = await fetch(`${env.trpcUrl}/${path}`, {
      headers: { "content-type": "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  session: {
    async bootstrap(existing: AnonSession | null): Promise<AnonSession> {
      await delay(300);
      const fromServer = await tryFetch<AnonSession>("session.bootstrap");
      if (fromServer) return fromServer;
      if (existing) return existing;
      return {
        token: `anon_${Math.random().toString(36).slice(2, 14)}`,
        userId: `u_${Math.random().toString(36).slice(2, 10)}`,
        displayName: randomDisplayName(),
        displayColor: randomDisplayColor(),
        createdAt: new Date().toISOString(),
        writeAccess: { kind: "unverified" },
        ban: null,
      };
    },
    async updateProfile(input: { displayName?: string; displayColor?: string }): Promise<void> {
      await delay(200);
      void input;
    },
    async verifyLocation(): Promise<{ kind: "allowed" } | { kind: "off_campus" } | { kind: "denied" }> {
      await delay(700);
      return { kind: "allowed" };
    },
  },

  rooms: {
    async list(): Promise<Room[]> {
      await delay(200);
      return mockRooms;
    },
    async get(id: string): Promise<Room | null> {
      await delay(200);
      return mockRooms.find((r) => r.id === id) ?? null;
    },
    async create(input: { name: string; description?: string; visibility: "public" | "private" }): Promise<Room> {
      await delay(300);
      return {
        id: `r_${Math.random().toString(36).slice(2, 8)}`,
        name: input.name,
        description: input.description,
        visibility: input.visibility,
        participantCount: 1,
        lastActivityAt: new Date().toISOString(),
        createdBy: "me",
        createdAt: new Date().toISOString(),
        createdByMe: true,
      };
    },
    async limits(): Promise<{ maxRoomsPerUser: number; currentRoomsCreated: number }> {
      await delay(120);
      return { maxRoomsPerUser: 3, currentRoomsCreated: 1 };
    },
    async createInvite(_roomId: string): Promise<{ code: string; url: string }> {
      await delay(200);
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      return { code, url: `${window.location.origin}/rooms/${_roomId}?inviteCode=${code}` };
    },
    async joinByInvite(_roomId: string, code: string): Promise<{ ok: boolean; reason?: "invalid" | "expired" | "disabled" | "room_banned" }> {
      await delay(300);
      if (code === "EXPIRED") return { ok: false, reason: "expired" };
      if (code === "INVALID") return { ok: false, reason: "invalid" };
      return { ok: true };
    },
  },

  messages: {
    async list(roomId: string): Promise<Message[]> {
      await delay(200);
      return mockMessages.filter((m) => m.roomId === roomId || roomId === "r_general");
    },
    async send(_input: { roomId: string; content: string }): Promise<void> {
      await delay(150);
    },
    async react(_input: { messageId: string; emoji: string }): Promise<void> {
      await delay(120);
    },
    async remove(_id: string): Promise<void> {
      await delay(150);
    },
  },

  reports: {
    async create(input: {
      targetType: "message" | "user" | "room";
      targetId: string;
      reason: string;
      details?: string;
      roomId?: string;
      reportedUserId?: string;
      reporterId?: string;
      context?: Report["context"];
    }): Promise<Report> {
      await delay(220);
      const rep: Report = {
        id: `rep_${Date.now().toString(36)}`,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details,
        status: "open",
        createdAt: new Date().toISOString(),
        reporterId: input.reporterId,
        reportedUserId: input.reportedUserId,
        roomId: input.roomId,
        context: input.context,
      };
      mockReports.unshift(rep);
      return rep;
    },
  },

  admin: {
    async login(_input: { email: string; password: string }): Promise<{ token: string; name: string }> {
      await delay(400);
      if (_input.password.length < 3) throw new Error("Invalid credentials");
      return { token: `admin_${Math.random().toString(36).slice(2, 12)}`, name: _input.email.split("@")[0] };
    },
    async overview(): Promise<AdminOverview> {
      await delay(250);
      return mockOverview;
    },
    async reports(): Promise<Report[]> {
      await delay(220);
      return mockReports;
    },
    async resolveReport(_id: string): Promise<void> { await delay(180); },
    async dismissReport(_id: string): Promise<void> { await delay(180); },
    async user(id: string): Promise<AdminUser | null> {
      await delay(220);
      return mockAdminUsers.find((u) => u.id === id) ?? mockAdminUsers[0] ?? null;
    },
    async banUser(_input: { userId: string; kind: BanState["kind"]; reason?: string; expiresAt?: string | null }): Promise<void> {
      await delay(250);
    },
    async rooms(): Promise<Room[]> {
      await delay(220);
      return mockRooms;
    },
    async room(id: string): Promise<Room | null> {
      await delay(200);
      return mockRooms.find((r) => r.id === id) ?? null;
    },
    async removeRoom(_id: string): Promise<void> { await delay(220); },
  },
};

export type Api = typeof api;

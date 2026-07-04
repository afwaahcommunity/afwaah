import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

import { redisKeys } from "@campus-chat/database/redis";
import * as schema from "@campus-chat/database/schema";
import type { RedisClient } from "@campus-chat/services/cache";
import type { DrizzleClient } from "@campus-chat/services/repositories";
import {
  BanService,
  LocationService,
  RoomService,
  SessionService,
} from "@campus-chat/services/services";
import { hashToken } from "@campus-chat/services/utils";
import { eq } from "drizzle-orm";

import {
  closeRealtimeClients,
  createRealtimeClients,
  type RealtimeClients,
} from "../src/clients";
import { loadEnv } from "../src/env";
import {
  createRealtimeServer,
  type RealtimeServer,
} from "../src/socket/server";

const CAMPUS_LOCATION = {
  accuracyMeters: 25,
  latitude: 21.2497,
  longitude: 81.6022,
  method: "browser_geolocation" as const,
};

class SmokeRollback extends Error {
  constructor() {
    super("rollback realtime smoke transaction");
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  const clients = createRealtimeClients(env);
  const cleanup = createCleanupTracker();

  try {
    await clients.db.transaction(async (tx) => {
      const smokeClients: RealtimeClients = {
        ...clients,
        db: tx as unknown as DrizzleClient,
      };
      let server: RealtimeServer | null = null;

      try {
        const sessionService = new SessionService(
          smokeClients.db,
          smokeClients.redis,
        );
        const locationService = new LocationService(
          smokeClients.db,
          smokeClients.redis,
        );
        const roomService = new RoomService(
          smokeClients.db,
          smokeClients.redis,
        );
        const banService = new BanService(smokeClients.db, smokeClients.redis);

        const createdSession = await sessionService.createSession(
          {
            asn: "smoke",
            deviceInstallId: `realtime-smoke-device-${randomUUID()}`,
            fingerprint: `realtime-smoke-fingerprint-${randomUUID()}`,
            ipSubnet: "127.0.0.0/24",
          },
          {
            ipAddress: "127.0.0.1",
            requestId: randomUUID(),
            userAgent: "campus-chat-realtime-smoke/1.0",
          },
        );
        assert(createdSession.ok, "session creation succeeds");
        cleanup.trackSession(
          createdSession.value.token,
          createdSession.value.session.sessionId,
          createdSession.value.session.userId,
        );

        const location = await locationService.verifyLocation({
          ...CAMPUS_LOCATION,
          sessionId: createdSession.value.session.sessionId,
          userId: createdSession.value.session.userId,
        });
        assert(location.ok, "location verification succeeds");
        assert(location.value.isWithinGeofence, "location is inside campus");

        const room = await roomService.createRoom(
          createdSession.value.session.userId,
          createdSession.value.session.sessionId,
          {
            name: `Realtime Smoke ${Date.now()}`,
            roomType: "public",
          },
        );
        assert(room.ok, "room creation succeeds");
        cleanup.trackRoom(room.value.id);

        const [admin] = await smokeClients.db
          .insert(schema.adminUsers)
          .values({
            displayName: "Realtime Smoke Admin",
            email: "realtime-smoke-admin@example.test",
            passwordHash: "smoke-password",
            role: "super_admin",
          })
          .returning({ id: schema.adminUsers.id });
        assert(admin, "admin fixture created");

        const readOnlySession = await sessionService.createSession(
          {
            asn: "smoke",
            deviceInstallId: `realtime-readonly-device-${randomUUID()}`,
            fingerprint: `realtime-readonly-fingerprint-${randomUUID()}`,
            ipSubnet: "127.0.0.0/24",
          },
          {
            ipAddress: "127.0.0.1",
            requestId: randomUUID(),
            userAgent: "campus-chat-realtime-smoke/1.0",
          },
        );
        assert(readOnlySession.ok, "read-only session creation succeeds");
        cleanup.trackSession(
          readOnlySession.value.token,
          readOnlySession.value.session.sessionId,
          readOnlySession.value.session.userId,
        );
        const writeBan = await banService.banUser(admin.id, {
          banType: "global_write_ban",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          reason: "realtime smoke write ban",
          targetUserId: readOnlySession.value.session.userId,
        });
        assert(writeBan.ok, "write ban succeeds");

        const hardBannedSession = await sessionService.createSession(
          {
            asn: "smoke",
            deviceInstallId: `realtime-hardban-device-${randomUUID()}`,
            fingerprint: `realtime-hardban-fingerprint-${randomUUID()}`,
            ipSubnet: "127.0.0.0/24",
          },
          {
            ipAddress: "127.0.0.1",
            requestId: randomUUID(),
            userAgent: "campus-chat-realtime-smoke/1.0",
          },
        );
        assert(hardBannedSession.ok, "hard-ban session creation succeeds");
        cleanup.trackSession(
          hardBannedSession.value.token,
          hardBannedSession.value.session.sessionId,
          hardBannedSession.value.session.userId,
        );
        const hardBan = await banService.banUser(admin.id, {
          banType: "global_hard_ban",
          isPermanent: true,
          reason: "realtime smoke hard ban",
          targetUserId: hardBannedSession.value.session.userId,
        });
        assert(hardBan.ok, "hard ban succeeds");

        server = createRealtimeServer(
          { ...env, HOST: "127.0.0.1" },
          smokeClients,
        );
        const port = await listenOnEphemeralPort(server);
        const socketUrl = `http://127.0.0.1:${port}/socket.io/?EIO=4&transport=polling`;
        await PollingSocket.connectRejected(
          socketUrl,
          hardBannedSession.value.token,
          "Invalid or expired session.",
        );

        const socket = await PollingSocket.connect(
          socketUrl,
          createdSession.value.token,
        );
        const readOnlySocket = await PollingSocket.connect(
          socketUrl,
          readOnlySession.value.token,
        );

        await socket.emit("room:join", { roomId: room.value.id });
        await socket.pollUntil(
          (payload) => payload.includes("room:joined"),
          "room joined",
        );
        await readOnlySocket.emit("room:join", { roomId: room.value.id });
        await readOnlySocket.pollUntil(
          (payload) => payload.includes("room:joined"),
          "read-only room joined",
        );

        await socket.emit("typing:start", { roomId: room.value.id });
        await socket.pollUntil(
          (payload) => payload.includes("typing:update"),
          "typing update",
        );
        await readOnlySocket.emit("typing:start", { roomId: room.value.id });
        await readOnlySocket.pollUntil(
          (payload) => payload.includes("READ_ONLY"),
          "read-only typing blocked",
        );

        const clientMessageId = randomUUID();
        await readOnlySocket.emit("message:send", {
          body: `blocked realtime smoke ${clientMessageId}`,
          bodyType: "text",
          clientMessageId: randomUUID(),
          roomId: room.value.id,
        });
        await readOnlySocket.pollUntil(
          (payload) => payload.includes("READ_ONLY"),
          "read-only message send blocked",
        );

        await socket.emit("message:send", {
          body: `realtime smoke ${clientMessageId}`,
          bodyType: "text",
          clientMessageId,
          roomId: room.value.id,
        });
        await readOnlySocket.pollUntil(
          (payload) =>
            payload.includes("message:new") &&
            payload.includes(clientMessageId),
          "read-only socket receives new message broadcast",
        );

        const [sentMessage] = await smokeClients.db
          .select({ id: schema.messages.id })
          .from(schema.messages)
          .where(eq(schema.messages.clientMessageId, clientMessageId))
          .limit(1);
        assert(sentMessage, "sent message fixture exists");

        await readOnlySocket.emit("message:react", {
          emoji: "👍",
          messageId: sentMessage.id,
          roomId: room.value.id,
        });
        await readOnlySocket.pollUntil(
          (payload) => payload.includes("READ_ONLY"),
          "read-only reaction blocked",
        );

        await socket.emit("message:react", {
          emoji: "👍",
          messageId: sentMessage.id,
          roomId: room.value.id,
        });
        await readOnlySocket.pollUntil(
          (payload) =>
            payload.includes("message:reaction:update") &&
            payload.includes(sentMessage.id),
          "reaction update broadcast",
        );

        await sleep(6100);
        const repeatedBody = `duplicate realtime smoke ${randomUUID()}`;
        await socket.emit("message:send", {
          body: repeatedBody,
          bodyType: "text",
          clientMessageId: randomUUID(),
          roomId: room.value.id,
        });
        await socket.emit("message:send", {
          body: repeatedBody,
          bodyType: "text",
          clientMessageId: randomUUID(),
          roomId: room.value.id,
        });
        await socket.emit("message:send", {
          body: repeatedBody,
          bodyType: "text",
          clientMessageId: randomUUID(),
          roomId: room.value.id,
        });
        await socket.pollUntil(
          (payload) =>
            payload.includes("RATE_LIMITED") &&
            payload.includes("Repeated message blocked"),
          "duplicate message spam blocked",
        );

        await readOnlySocket.close();
        await socket.close();
      } finally {
        await server?.close();
      }

      throw new SmokeRollback();
    });
  } catch (error) {
    if (!(error instanceof SmokeRollback)) {
      throw error;
    }
  } finally {
    await cleanup.flush(clients.redis);
    await closeRealtimeClients(clients);
  }

  console.log("Realtime smoke test passed");
}

class PollingSocket {
  private constructor(
    private readonly baseUrl: string,
    private readonly sid: string,
  ) {}

  static async connect(baseUrl: string, token: string): Promise<PollingSocket> {
    const openResponse = await fetch(baseUrl);
    assert(openResponse.ok, "Engine.IO open request succeeds");
    const openPayload = await openResponse.text();
    const sid = JSON.parse(openPayload.slice(1)).sid as string;
    const socket = new PollingSocket(baseUrl, sid);

    await socket.post(`40${JSON.stringify({ token })}`);
    await socket.pollUntil(
      (payload) => payload.includes("40"),
      "Socket.IO namespace connected",
    );

    return socket;
  }

  static async connectRejected(
    baseUrl: string,
    token: string,
    expectedMessage: string,
  ): Promise<void> {
    const openResponse = await fetch(baseUrl);
    assert(openResponse.ok, "Engine.IO open request succeeds");
    const openPayload = await openResponse.text();
    const sid = JSON.parse(openPayload.slice(1)).sid as string;
    const socket = new PollingSocket(baseUrl, sid);

    await socket.post(`40${JSON.stringify({ token })}`);
    await socket.pollUntil(
      (payload) => payload.includes("44") && payload.includes(expectedMessage),
      "Socket.IO namespace rejected",
    );
    await socket.close();
  }

  async close(): Promise<void> {
    await this.post("41").catch(() => undefined);
  }

  async emit(event: string, payload: unknown): Promise<void> {
    await this.post(`42${JSON.stringify([event, payload])}`);
  }

  async pollUntil(
    predicate: (payload: string) => boolean,
    label: string,
  ): Promise<string> {
    let payload = "";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      payload += await this.poll();
      if (predicate(payload)) return payload;
      await sleep(50);
    }

    throw new Error(`Timed out waiting for ${label}: ${payload}`);
  }

  private async poll(): Promise<string> {
    const response = await fetch(this.url);
    assert(response.ok, "Engine.IO poll request succeeds");
    return response.text();
  }

  private async post(body: string): Promise<void> {
    const response = await fetch(this.url, {
      body,
      headers: { "content-type": "text/plain;charset=UTF-8" },
      method: "POST",
    });
    assert(response.ok, "Engine.IO post request succeeds");
  }

  private get url(): string {
    return `${this.baseUrl}&sid=${encodeURIComponent(this.sid)}`;
  }
}

function createCleanupTracker() {
  const roomIds = new Set<string>();
  const sessionIds = new Set<string>();
  const sessionTokens = new Set<string>();
  const userIds = new Set<string>();

  return {
    async flush(redis: RedisClient) {
      await Promise.allSettled([
        ...Array.from(sessionTokens).map((token) =>
          redis.del(redisKeys.session(hashToken(token).toString("hex"))),
        ),
        ...Array.from(sessionIds).map((sessionId) =>
          redis.del(redisKeys.sessionBan(sessionId)),
        ),
        ...Array.from(userIds).flatMap((userId) => [
          redis.del(redisKeys.userBan(userId)),
          redis.del(redisKeys.rateLimit("display_color_change", userId)),
          redis.del(redisKeys.rateLimit("message_send", userId)),
          redis.del(redisKeys.rateLimitBurst("message_send", userId)),
          redis.del(redisKeys.rateLimit("room_create", userId)),
          redis.del(redisKeys.rateLimit("room_join", userId)),
        ]),
        ...Array.from(userIds).flatMap((userId) =>
          Array.from(roomIds).flatMap((roomId) => [
            redis.del(
              redisKeys.rateLimit("message_burst", `${userId}:${roomId}`),
            ),
            redis.del(
              redisKeys.rateLimitBurst("message_burst", `${userId}:${roomId}`),
            ),
            redis.del(
              redisKeys.rateLimit("message_burst", `${userId}:${roomId}:short`),
            ),
          ]),
        ),
        ...Array.from(roomIds).flatMap((roomId) => [
          redis.del(redisKeys.recentRoomMessages(roomId)),
          redis.del(redisKeys.roomMetadata(roomId)),
          redis.del(redisKeys.roomPresence(roomId)),
          redis.del(redisKeys.typing(roomId)),
        ]),
      ]);
    },
    trackRoom(roomId: string) {
      roomIds.add(roomId);
    },
    trackSession(token: string, sessionId: string, userId: string) {
      sessionTokens.add(token);
      sessionIds.add(sessionId);
      userIds.add(userId);
    },
  };
}

async function listenOnEphemeralPort(server: RealtimeServer): Promise<number> {
  await new Promise<void>((resolve) => {
    server.httpServer.listen(0, "127.0.0.1", resolve);
  });

  const address = server.httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Realtime smoke server did not expose a TCP address.");
  }

  return (address as AddressInfo).port;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();

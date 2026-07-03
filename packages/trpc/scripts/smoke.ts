import net from "node:net";

import * as schema from "@campus-chat/database/schema";
import { redisKeys } from "@campus-chat/database/redis";
import { hashToken } from "@campus-chat/services/utils";
import type { DrizzleClient } from "@campus-chat/services/repositories";
import type { RedisClient, RedisPipeline } from "@campus-chat/services/cache";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  createCallerFactory,
  createContext,
  serverRouter,
} from "../server/index.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5433/campus_chat";
const REDIS_HOST = process.env.REDIS_HOST ?? "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT ?? "6379");

const NIT_RAIPUR_LOCATION = {
  accuracyMeters: 20,
  latitude: 21.2497,
  longitude: 81.6022,
  method: "browser_geolocation" as const,
};

class SmokeRollback extends Error {
  constructor() {
    super("rollback smoke transaction");
  }
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema });
  const redis = new RespRedisClient(REDIS_HOST, REDIS_PORT);
  const createCaller = createCallerFactory(serverRouter);
  const sessionTokens: string[] = [];
  const sessionIds: string[] = [];
  const userIds: string[] = [];

  try {
    await assertRedis(redis);
    await db.transaction(async (tx) => {
      const smokeDb = tx as unknown as DrizzleClient;
      const baseHeaders = {
        "user-agent": "campus-chat-trpc-smoke/1.0",
        "x-forwarded-for": "127.0.0.1",
        "x-request-id": crypto.randomUUID(),
      };
      const verifyAdminPassword = (plain: string, hash: string) =>
        plain === hash;

      const publicCaller = createCaller(
        createContext({
          db: smokeDb,
          redis,
          req: { headers: baseHeaders },
          verifyAdminPassword,
        }),
      );
      const createTrackedSessionCaller = async () => {
        const publicSessionCaller = createCaller(
          createContext({
            db: smokeDb,
            redis,
            req: {
              headers: {
                ...baseHeaders,
                "x-request-id": crypto.randomUUID(),
              },
            },
            verifyAdminPassword,
          }),
        );
        const session = await publicSessionCaller.session.create({
          asn: "smoke",
          deviceInstallId: `smoke-device-${crypto.randomUUID()}`,
          fingerprint: `smoke-fingerprint-${crypto.randomUUID()}`,
          ipSubnet: "127.0.0.0/24",
        });
        trackSession(session);

        return createCaller(
          createContext({
            db: smokeDb,
            redis,
            req: {
              headers: {
                ...baseHeaders,
                authorization: `Bearer ${session.token}`,
              },
            },
            verifyAdminPassword,
          }),
        );
      };

      const firstSession = await publicCaller.session.create({
        asn: "smoke",
        deviceInstallId: `smoke-device-${crypto.randomUUID()}`,
        fingerprint: `smoke-fingerprint-${crypto.randomUUID()}`,
        ipSubnet: "127.0.0.0/24",
      });
      trackSession(firstSession);
      assert(firstSession.session.sessionId, "session.create returned session");

      const sessionCaller = createCaller(
        createContext({
          db: smokeDb,
          redis,
          req: {
            headers: {
              ...baseHeaders,
              authorization: `Bearer ${firstSession.token}`,
            },
          },
          verifyAdminPassword,
        }),
      );

      const current = await sessionCaller.session.getCurrent();
      assert(
        current.userId === firstSession.session.userId,
        "session auth resolves current user",
      );

      const location = await sessionCaller.location.verify(NIT_RAIPUR_LOCATION);
      assert(location.isWithinGeofence, "campus location verifies");

      const updated = await sessionCaller.session.updateDisplayName({
        displayName: `Smoke ${Date.now()}`,
      });
      assert(
        updated.session.displayName === updated.user.currentDisplayName,
        "display name update syncs session output",
      );
      const colorUpdated = await sessionCaller.session.updateDisplayColor({
        displayColor: "#2563EB",
      });
      assert(
        colorUpdated.session.displayColor === "#2563EB" &&
          colorUpdated.user.currentDisplayColor === "#2563EB",
        "display color update syncs session output",
      );

      const room = await sessionCaller.room.create({
        description: "tRPC smoke test room",
        maxParticipants: 10,
        name: `Smoke Room ${Date.now()}`,
        roomType: "public",
      });
      assert(room.id, "room.create returned room id");

      const fetchedRoom = await sessionCaller.room.getById({
        roomId: room.id,
      });
      assert(fetchedRoom.id === room.id, "room.getById reads created room");

      const participants = await sessionCaller.room.getParticipants({
        roomId: room.id,
      });
      assert(participants.length === 1, "creator is active participant");

      const history = await sessionCaller.message.getHistory({
        roomId: room.id,
      });
      assert(history.items.length === 0, "new room has empty history");

      const report = await sessionCaller.report.create({
        reason: "spam",
        targetRoomId: room.id,
        targetType: "room",
      });
      assert(
        report.targetRoomId === room.id,
        "report.create stores room target",
      );

      const publicShare = await sessionCaller.room.getShareInfo({
        roomId: room.id,
      });
      assert(
        publicShare.sharePath === `/rooms/${room.id}`,
        "public room share path is stable",
      );
      assert(
        publicShare.inviteCode === null,
        "public room share does not expose invite code",
      );

      const privateRoom = await sessionCaller.room.create({
        description: "tRPC private share smoke test room",
        maxParticipants: 10,
        name: `Private Smoke Room ${Date.now()}`,
        roomType: "private",
      });
      assert(privateRoom.id, "private room creation succeeds");

      const privateShare = await sessionCaller.room.getShareInfo({
        roomId: privateRoom.id,
      });
      const privateInviteCode = privateShare.inviteCode;
      assert(privateInviteCode, "private room share exposes invite code");
      assert(
        privateShare.sharePath ===
          `/rooms/${privateRoom.id}?inviteCode=${encodeURIComponent(privateInviteCode)}`,
        "private room share path includes invite code",
      );

      const privateGuestCaller = await createTrackedSessionCaller();
      await assertRejectsForbidden(
        () => privateGuestCaller.room.getById({ roomId: privateRoom.id }),
        "private room requires invite before reading",
      );
      const privateJoin = await privateGuestCaller.room.join({
        inviteCode: privateInviteCode,
        roomId: privateRoom.id,
      });
      assert(privateJoin.participantId, "private room invite allows joining");

      const disabledShare = await sessionCaller.room.disableInvite({
        roomId: privateRoom.id,
      });
      assert(
        !disabledShare.isInviteEnabled && !disabledShare.inviteCode,
        "private room invite can be disabled",
      );

      const blockedInviteCaller = await createTrackedSessionCaller();
      await assertRejectsForbidden(
        () =>
          blockedInviteCaller.room.join({
            inviteCode: privateInviteCode,
            roomId: privateRoom.id,
          }),
        "disabled private invite cannot be used by a new visitor",
      );

      const regeneratedShare = await sessionCaller.room.regenerateInvite({
        roomId: privateRoom.id,
      });
      const regeneratedInviteCode = regeneratedShare.inviteCode;
      assert(regeneratedInviteCode, "private invite can be regenerated");
      assert(
        regeneratedInviteCode !== privateInviteCode,
        "regenerated private invite changes code",
      );

      const regeneratedInviteCaller = await createTrackedSessionCaller();
      const regeneratedJoin = await regeneratedInviteCaller.room.join({
        inviteCode: regeneratedInviteCode,
        roomId: privateRoom.id,
      });
      assert(
        regeneratedJoin.participantId,
        "regenerated private invite allows joining",
      );

      await sessionCaller.room.create({
        name: `Smoke Room Extra A ${Date.now()}`,
        roomType: "public",
      });
      await assertRejectsCode(
        () =>
          sessionCaller.room.create({
            name: `Smoke Room Extra B ${Date.now()}`,
            roomType: "public",
          }),
        "TOO_MANY_REQUESTS",
        "active room creation limit is enforced",
      );
      await assertRejectsCode(
        () =>
          sessionCaller.room.create({
            name: `Smoke Announcement ${Date.now()}`,
            roomType: "announcement",
          }),
        "BAD_REQUEST",
        "normal users cannot create announcement rooms",
      );

      await tx.insert(schema.adminUsers).values({
        displayName: "Smoke Admin",
        email: "smoke-admin@example.test",
        passwordHash: "smoke-password",
        role: "super_admin",
      });

      const adminLogin = await publicCaller.admin.login({
        email: "smoke-admin@example.test",
        password: "smoke-password",
      });
      assert(adminLogin.token, "admin.login returns session token");

      const adminCaller = createCaller(
        createContext({
          db: smokeDb,
          redis,
          req: {
            headers: {
              ...baseHeaders,
              "x-admin-token": adminLogin.token,
            },
          },
          verifyAdminPassword,
        }),
      );

      const adminCurrent = await adminCaller.admin.getCurrent();
      assert(
        adminCurrent.email === "smoke-admin@example.test",
        "admin token resolves current admin",
      );
      const geofence = await adminCaller.admin.geofence();
      assert(geofence.radiusKm > 0, "admin can read geofence settings");
      const updatedGeofence = await adminCaller.admin.updateGeofence({
        radiusKm: 50,
      });
      assert(
        updatedGeofence.radiusKm === 50,
        "admin can update geofence radius",
      );

      const writeLimitedPublicCaller = createCaller(
        createContext({
          db: smokeDb,
          redis,
          req: {
            headers: {
              ...baseHeaders,
              "x-request-id": crypto.randomUUID(),
            },
          },
          verifyAdminPassword,
        }),
      );
      const writeLimitedSession = await writeLimitedPublicCaller.session.create(
        {
          asn: "smoke",
          deviceInstallId: `smoke-device-${crypto.randomUUID()}`,
          fingerprint: `smoke-fingerprint-${crypto.randomUUID()}`,
          ipSubnet: "127.0.0.0/24",
        },
      );
      trackSession(writeLimitedSession);

      const writeBan = await adminCaller.moderation.banUser({
        banType: "global_write_ban",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        reason: "smoke test write ban",
        targetUserId: writeLimitedSession.session.userId,
      });
      assert(
        writeBan.targetUserId === writeLimitedSession.session.userId,
        "write ban targets user",
      );

      const writeLimitedCaller = createCaller(
        createContext({
          db: smokeDb,
          redis,
          req: {
            headers: {
              ...baseHeaders,
              authorization: `Bearer ${writeLimitedSession.token}`,
            },
          },
          verifyAdminPassword,
        }),
      );

      const readOnlyCurrent = await writeLimitedCaller.session.getCurrent();
      assert(
        readOnlyCurrent.status === "write_banned",
        "write-banned session stays readable",
      );
      const readableRooms = await writeLimitedCaller.room.list({});
      assert(
        readableRooms.items.some((item) => item.id === room.id),
        "write-banned user can list rooms",
      );
      const readableRoom = await writeLimitedCaller.room.getById({
        roomId: room.id,
      });
      assert(
        readableRoom.id === room.id,
        "write-banned user can read room details",
      );
      const readOnlyJoin = await writeLimitedCaller.room.join({
        roomId: room.id,
      });
      assert(readOnlyJoin.participantId, "write-banned user can join rooms");
      const readOnlyHistory = await writeLimitedCaller.message.getHistory({
        roomId: room.id,
      });
      assert(
        Array.isArray(readOnlyHistory.items),
        "write-banned user can read history",
      );

      const [writeLimitedMessage] = await tx
        .insert(schema.messages)
        .values({
          anonymousUserId: writeLimitedSession.session.userId,
          body: "smoke read-only historical message",
          bodyType: "text",
          clientMessageId: crypto.randomUUID(),
          displayNameSnapshot: writeLimitedSession.session.displayName,
          roomId: room.id,
          sessionId: writeLimitedSession.session.sessionId,
        })
        .returning({ id: schema.messages.id });
      assert(writeLimitedMessage, "write-limited message fixture created");
      await tx.insert(schema.messageReactions).values({
        anonymousUserId: writeLimitedSession.session.userId,
        emoji: "+1",
        messageId: writeLimitedMessage.id,
      });

      await assertRejectsForbidden(
        () =>
          writeLimitedCaller.message.addReaction({
            emoji: "x",
            messageId: writeLimitedMessage.id,
          }),
        "write-banned user cannot add reactions",
      );
      await assertRejectsForbidden(
        () =>
          writeLimitedCaller.message.removeReaction({
            emoji: "+1",
            messageId: writeLimitedMessage.id,
          }),
        "write-banned user cannot remove reactions",
      );
      await assertRejectsForbidden(
        () =>
          writeLimitedCaller.message.deleteOwn({
            messageId: writeLimitedMessage.id,
          }),
        "write-banned user cannot delete own messages",
      );
      await assertRejectsForbidden(
        () =>
          writeLimitedCaller.report.create({
            reason: "spam",
            targetRoomId: room.id,
            targetType: "room",
          }),
        "write-banned user cannot create reports",
      );
      await assertRejectsForbidden(
        () =>
          writeLimitedCaller.session.updateDisplayName({
            displayName: `Blocked ${Date.now()}`,
          }),
        "write-banned user cannot edit display name",
      );
      await assertRejectsForbidden(
        () =>
          writeLimitedCaller.session.updateDisplayColor({
            displayColor: "#DC2626",
          }),
        "write-banned user cannot edit display color",
      );
      await assertRejectsForbidden(
        () =>
          writeLimitedCaller.media.createUploadToken({
            targetRoomId: room.id,
            uploadPurpose: "message_attachment",
          }),
        "write-banned user cannot upload media",
      );
      await assertRejectsForbidden(
        () =>
          writeLimitedCaller.room.create({
            name: `Blocked Room ${Date.now()}`,
            roomType: "public",
          }),
        "write-banned user cannot create rooms",
      );

      const roomBannedPublicCaller = createCaller(
        createContext({
          db: smokeDb,
          redis,
          req: {
            headers: {
              ...baseHeaders,
              "x-request-id": crypto.randomUUID(),
            },
          },
          verifyAdminPassword,
        }),
      );
      const roomBannedSession = await roomBannedPublicCaller.session.create({
        asn: "smoke",
        deviceInstallId: `smoke-device-${crypto.randomUUID()}`,
        fingerprint: `smoke-fingerprint-${crypto.randomUUID()}`,
        ipSubnet: "127.0.0.0/24",
      });
      trackSession(roomBannedSession);
      await adminCaller.moderation.banUser({
        banType: "room_ban",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        reason: "smoke test room ban",
        targetRoomId: room.id,
        targetUserId: roomBannedSession.session.userId,
      });
      const roomBannedCaller = createCaller(
        createContext({
          db: smokeDb,
          redis,
          req: {
            headers: {
              ...baseHeaders,
              authorization: `Bearer ${roomBannedSession.token}`,
            },
          },
          verifyAdminPassword,
        }),
      );
      await assertRejectsForbidden(
        () => roomBannedCaller.room.getById({ roomId: room.id }),
        "room-banned user cannot read room details",
      );
      await assertRejectsForbidden(
        () => roomBannedCaller.room.join({ roomId: room.id }),
        "room-banned user cannot join room",
      );

      const secondPublicCaller = createCaller(
        createContext({
          db: smokeDb,
          redis,
          req: {
            headers: {
              ...baseHeaders,
              "x-request-id": crypto.randomUUID(),
            },
          },
          verifyAdminPassword,
        }),
      );
      const secondSession = await secondPublicCaller.session.create({
        asn: "smoke",
        deviceInstallId: `smoke-device-${crypto.randomUUID()}`,
        fingerprint: `smoke-fingerprint-${crypto.randomUUID()}`,
        ipSubnet: "127.0.0.0/24",
      });
      trackSession(secondSession);

      const ban = await adminCaller.moderation.banUser({
        banType: "global_hard_ban",
        isPermanent: true,
        reason: "smoke test hard ban",
        targetUserId: secondSession.session.userId,
      });
      assert(
        ban.targetUserId === secondSession.session.userId,
        "ban targets user",
      );

      const bannedCaller = createCaller(
        createContext({
          db: smokeDb,
          redis,
          req: {
            headers: {
              ...baseHeaders,
              authorization: `Bearer ${secondSession.token}`,
            },
          },
          verifyAdminPassword,
        }),
      );

      await assertRejectsForbidden(
        () => bannedCaller.session.getCurrent(),
        "hard-banned session is blocked by tRPC middleware",
      );

      throw new SmokeRollback();
    });
  } catch (error) {
    if (!(error instanceof SmokeRollback)) {
      throw error;
    }
  } finally {
    await Promise.allSettled([
      ...sessionTokens.map((token) =>
        redis.del(redisKeys.session(hashToken(token).toString("hex"))),
      ),
      ...sessionIds.map((sessionId) =>
        redis.del(redisKeys.sessionBan(sessionId)),
      ),
      ...userIds.flatMap((userId) => [
        redis.del(redisKeys.userBan(userId)),
        redis.del(redisKeys.rateLimit("display_color_change", userId)),
        redis.del(redisKeys.rateLimit("display_name_change", userId)),
        redis.del(redisKeys.rateLimit("image_upload", userId)),
        redis.del(redisKeys.rateLimit("reaction_add", userId)),
        redis.del(redisKeys.rateLimit("report_create", userId)),
        redis.del(redisKeys.rateLimit("room_create", userId)),
        redis.del(redisKeys.rateLimit("room_join", userId)),
      ]),
    ]);
    await redis.quit();
    await pool.end();
  }

  console.log("tRPC smoke test passed");

  function trackSession(sessionResult: {
    session: { sessionId: string; userId: string };
    token: string;
  }): void {
    sessionTokens.push(sessionResult.token);
    sessionIds.push(sessionResult.session.sessionId);
    userIds.push(sessionResult.session.userId);
  }
}

async function assertRedis(redis: RespRedisClient): Promise<void> {
  const pong = await redis.command("PING");
  assert(pong === "PONG", "redis responds to PING");
}

async function assertRejectsForbidden(
  fn: () => Promise<unknown>,
  message: string,
) {
  await assertRejectsCode(fn, "FORBIDDEN", message);
}

async function assertRejectsCode(
  fn: () => Promise<unknown>,
  expectedCode: string,
  message: string,
) {
  try {
    await fn();
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? (error as { code?: unknown }).code
        : null;
    assert(code === expectedCode, message);
    return;
  }

  throw new Error(`Assertion failed: ${message}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

class RespRedisClient implements RedisClient {
  constructor(
    private readonly host: string,
    private readonly port: number,
  ) {}

  async command(command: string, ...args: Array<number | string>) {
    return sendRedisCommand(this.host, this.port, [
      command,
      ...args.map(String),
    ]);
  }

  async decr(key: string): Promise<number> {
    return Number(await this.command("DECR", key));
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return Number(await this.command("DEL", ...keys));
  }

  async exists(key: string): Promise<number> {
    return Number(await this.command("EXISTS", key));
  }

  async expire(key: string, seconds: number): Promise<number> {
    return Number(await this.command("EXPIRE", key, seconds));
  }

  async get(key: string): Promise<string | null> {
    const value = await this.command("GET", key);
    return typeof value === "string" ? value : null;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return Number(await this.command("HDEL", key, ...fields));
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const data = await this.command("HGETALL", key);
    const values = Array.isArray(data) ? data : [];
    const result: Record<string, string> = {};
    for (let i = 0; i < values.length; i += 2) {
      const field = values[i];
      const value = values[i + 1];
      if (typeof field === "string" && typeof value === "string") {
        result[field] = value;
      }
    }

    return result;
  }

  async hset(
    key: string,
    fieldOrValues: string | Record<string, string>,
    value?: string,
  ): Promise<number> {
    if (typeof fieldOrValues === "string") {
      return Number(
        await this.command("HSET", key, fieldOrValues, value ?? ""),
      );
    }

    return Number(
      await this.command(
        "HSET",
        key,
        ...Object.entries(fieldOrValues).flatMap(([field, fieldValue]) => [
          field,
          fieldValue,
        ]),
      ),
    );
  }

  async incr(key: string): Promise<number> {
    return Number(await this.command("INCR", key));
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const data = await this.command("LRANGE", key, start, stop);
    return Array.isArray(data) ? data.map(String) : [];
  }

  multi(): RedisPipeline {
    return new RespRedisPipeline(this);
  }

  async quit(): Promise<void> {
    return;
  }

  async set(
    key: string,
    value: string,
    mode?: string,
    duration?: number,
  ): Promise<string | null> {
    const args = [key, value];
    if (mode && duration !== undefined) args.push(mode, String(duration));
    const result = await this.command("SET", ...args);
    return typeof result === "string" ? result : null;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return Number(await this.command("ZADD", key, score, member));
  }

  async zcard(key: string): Promise<number> {
    return Number(await this.command("ZCARD", key));
  }

  async zrange(
    key: string,
    start: number,
    stop: number,
    withScores?: "WITHSCORES",
  ): Promise<string[]> {
    const data = await this.command(
      "ZRANGE",
      key,
      start,
      stop,
      ...(withScores ? [withScores] : []),
    );
    return Array.isArray(data) ? data.map(String) : [];
  }

  async zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<string[]> {
    const data = await this.command("ZRANGEBYSCORE", key, min, max);
    return Array.isArray(data) ? data.map(String) : [];
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return Number(await this.command("ZREM", key, ...members));
  }

  async zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<number> {
    return Number(await this.command("ZREMRANGEBYSCORE", key, min, max));
  }
}

class RespRedisPipeline implements RedisPipeline {
  private readonly commands: string[][] = [];

  constructor(private readonly redis: RespRedisClient) {}

  del(...keys: string[]): RedisPipeline {
    this.commands.push(["DEL", ...keys]);
    return this;
  }

  expire(key: string, seconds: number): RedisPipeline {
    this.commands.push(["EXPIRE", key, String(seconds)]);
    return this;
  }

  hset(key: string, values: Record<string, string>): RedisPipeline {
    this.commands.push([
      "HSET",
      key,
      ...Object.entries(values).flatMap(([field, value]) => [field, value]),
    ]);
    return this;
  }

  lpush(key: string, value: string): RedisPipeline {
    this.commands.push(["LPUSH", key, value]);
    return this;
  }

  ltrim(key: string, start: number, stop: number): RedisPipeline {
    this.commands.push(["LTRIM", key, String(start), String(stop)]);
    return this;
  }

  zadd(key: string, score: number, member: string): RedisPipeline {
    this.commands.push(["ZADD", key, String(score), member]);
    return this;
  }

  zcard(key: string): RedisPipeline {
    this.commands.push(["ZCARD", key]);
    return this;
  }

  zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): RedisPipeline {
    this.commands.push(["ZREMRANGEBYSCORE", key, String(min), String(max)]);
    return this;
  }

  async exec(): Promise<Array<[Error | null, unknown]>> {
    const results: Array<[Error | null, unknown]> = [];
    for (const command of this.commands) {
      try {
        const [name, ...args] = command;
        results.push([null, await this.redis.command(name!, ...args)]);
      } catch (error) {
        results.push([
          error instanceof Error ? error : new Error(String(error)),
          null,
        ]);
      }
    }

    return results;
  }
}

function sendRedisCommand(
  host: string,
  port: number,
  command: string[],
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks: Buffer[] = [];

    socket.once("connect", () => socket.write(encodeResp(command)));
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      try {
        const parser = new RespParser(Buffer.concat(chunks));
        const value = parser.parse();
        socket.end();
        resolve(value);
      } catch (error) {
        if (!(error instanceof IncompleteRespError)) {
          socket.destroy();
          reject(error);
        }
      }
    });
    socket.once("error", reject);
    socket.setTimeout(5000, () => {
      socket.destroy();
      reject(new Error("Redis command timed out."));
    });
  });
}

function encodeResp(parts: string[]): string {
  return `*${parts.length}\r\n${parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join("")}`;
}

class IncompleteRespError extends Error {}

class RespParser {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  parse(): unknown {
    return this.parseValue();
  }

  private parseValue(): unknown {
    const prefix = this.readByte();
    if (prefix === "+") return this.readLine();
    if (prefix === "-") throw new Error(this.readLine());
    if (prefix === ":") return Number(this.readLine());
    if (prefix === "$") return this.readBulkString();
    if (prefix === "*") return this.readArray();
    throw new Error(`Unsupported Redis response prefix: ${prefix}`);
  }

  private readArray(): unknown[] | null {
    const length = Number(this.readLine());
    if (length === -1) return null;

    const items: unknown[] = [];
    for (let i = 0; i < length; i += 1) {
      items.push(this.parseValue());
    }

    return items;
  }

  private readBulkString(): string | null {
    const length = Number(this.readLine());
    if (length === -1) return null;
    this.ensure(length + 2);
    const value = this.buffer.toString(
      "utf8",
      this.offset,
      this.offset + length,
    );
    this.offset += length + 2;
    return value;
  }

  private readByte(): string {
    this.ensure(1);
    const value = this.buffer.toString("utf8", this.offset, this.offset + 1);
    this.offset += 1;
    return value;
  }

  private readLine(): string {
    const end = this.buffer.indexOf("\r\n", this.offset);
    if (end === -1) throw new IncompleteRespError();
    const value = this.buffer.toString("utf8", this.offset, end);
    this.offset = end + 2;
    return value;
  }

  private ensure(length: number): void {
    if (this.offset + length > this.buffer.length) {
      throw new IncompleteRespError();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

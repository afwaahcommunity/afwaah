import { createServer, type Server as HttpServer } from "node:http";

import { createAdapter } from "@socket.io/redis-adapter";
import { Server } from "socket.io";

import type { RealtimeClients } from "../clients";
import type { RealtimeEnv } from "../env";
import { createHealthHandler, sendJson } from "../http/health";
import type { RealtimeServer as TypedRealtimeServer } from "../types/socket";
import { createAuthMiddleware } from "./auth";
import { registerAllHandlers } from "./handlers";
import { PresenceManager } from "./presence";

export interface RealtimeServer {
  close(): Promise<void>;
  httpServer: HttpServer;
  io: TypedRealtimeServer;
}

export function createRealtimeServer(
  env: RealtimeEnv,
  clients: RealtimeClients,
): RealtimeServer {
  const startedAt = new Date();
  const handleHealth = createHealthHandler(clients, startedAt);
  const httpServer = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      handleHealth(req, res).catch((error) => {
        console.error("Realtime health check failed", error);
        sendJson(res, 503, { status: "error" });
      });
      return;
    }

    sendJson(res, 404, { error: "Not Found" });
  });
  const io = createSocketServer(httpServer, env);
  const presenceManager = new PresenceManager(clients, env);

  io.adapter(
    createAdapter(clients.redisConnection.pub, clients.redisConnection.sub),
  );
  io.use(createAuthMiddleware(clients.db, clients.redis, env));

  io.on("connection", (socket) => {
    presenceManager.startHeartbeat(socket);
    registerAllHandlers(io, socket, clients, presenceManager);

    socket.on("disconnect", async (reason) => {
      try {
        presenceManager.stopHeartbeat(socket);
        await presenceManager.removeFromAllRooms(io, socket);
      } catch (error) {
        console.error("Presence cleanup failed", {
          error,
          reason,
          socketId: socket.id,
        });
      }
    });
  });

  return {
    async close() {
      await closeSocketServer(io);
      await closeHttpServer(httpServer);
    },
    httpServer,
    io,
  };
}

function createSocketServer(
  httpServer: HttpServer,
  env: RealtimeEnv,
): TypedRealtimeServer {
  const allowedOrigins = env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Server(httpServer, {
    cors: {
      allowedHeaders: ["authorization", "content-type", "x-session-token"],
      credentials: true,
      methods: ["GET", "POST"],
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes("*")) {
          callback(null, true);
          return;
        }

        callback(null, allowedOrigins.includes(origin));
      },
    },
    transports: ["websocket", "polling"],
  });
}

function closeSocketServer(io: TypedRealtimeServer): Promise<void> {
  return new Promise((resolve, reject) => {
    io.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function closeHttpServer(httpServer: HttpServer): Promise<void> {
  if (!httpServer.listening) return Promise.resolve();

  return new Promise((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

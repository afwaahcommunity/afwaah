import cors from "cors";
import express, { type Express } from "express";

import type { ApiClients } from "./clients";
import type { ApiEnv } from "./env";
import { createCorsOptions } from "./http/cors";
import { requestIdMiddleware } from "./http/request-id";
import { createHealthRouter } from "./routes/health";
import { createOpenApiRouter } from "./routes/openapi";
import { createTrpcRouter } from "./routes/trpc";

export interface CreateAppOptions {
  clients: ApiClients;
  env: ApiEnv;
  startedAt?: Date;
}

export function createApp({
  clients,
  env,
  startedAt,
}: CreateAppOptions): Express {
  const app = express();
  const startTime = startedAt ?? new Date();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(requestIdMiddleware);
  app.use(cors(createCorsOptions(env)));

  app.get("/", (_req, res) => {
    res.json({
      docs: "/docs",
      health: "/health",
      name: "campus-chat-api",
      openapi: "/openapi.json",
      trpc: "/trpc",
    });
  });

  app.use(createHealthRouter(clients, startTime));
  app.use(createOpenApiRouter());
  app.use("/trpc", createTrpcRouter(env, clients));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  return app;
}

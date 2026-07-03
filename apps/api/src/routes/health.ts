import { type Router, Router as createRouter } from "express";

import type { ApiClients } from "../clients";

export function createHealthRouter(
  clients: ApiClients,
  startedAt: Date,
): Router {
  const router = createRouter();

  router.get("/health", async (_req, res) => {
    const checks = await Promise.allSettled([
      clients.postgres.healthCheck(),
      clients.redisConnection.healthCheck(),
    ]);
    const postgresHealthy = checks[0]?.status === "fulfilled";
    const redisHealthy = checks[1]?.status === "fulfilled";
    const healthy = postgresHealthy && redisHealthy;

    res.status(healthy ? 200 : 503).json({
      checks: {
        postgres: postgresHealthy ? "ok" : "error",
        redis: redisHealthy ? "ok" : "error",
      },
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
    });
  });

  return router;
}

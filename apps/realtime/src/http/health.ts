import type { IncomingMessage, ServerResponse } from "node:http";

import type { RealtimeClients } from "../clients";

export function createHealthHandler(clients: RealtimeClients, startedAt: Date) {
  return async function handleHealth(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const checks = await Promise.allSettled([
      clients.postgres.healthCheck(),
      clients.redisConnection.healthCheck(),
    ]);
    const postgresHealthy = checks[0]?.status === "fulfilled";
    const redisHealthy = checks[1]?.status === "fulfilled";
    const healthy = postgresHealthy && redisHealthy;

    sendJson(
      res,
      healthy ? 200 : 503,
      {
        checks: {
          postgres: postgresHealthy ? "ok" : "error",
          redis: redisHealthy ? "ok" : "error",
        },
        status: healthy ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
      },
      { sendBody: req.method !== "HEAD" },
    );
  };
}

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  options: { sendBody?: boolean } = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Length": Buffer.byteLength(payload),
    "Content-Type": "application/json",
  });
  res.end(options.sendBody === false ? undefined : payload);
}

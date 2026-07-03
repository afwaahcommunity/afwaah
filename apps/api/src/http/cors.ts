import type { CorsOptions } from "cors";

import type { ApiEnv } from "../env";

export function createCorsOptions(env: ApiEnv): CorsOptions {
  const allowedOrigins = env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    allowedHeaders: [
      "authorization",
      "content-type",
      "x-admin-token",
      "x-request-id",
      "x-session-token",
    ],
    credentials: true,
    exposedHeaders: ["x-request-id"],
    methods: ["GET", "POST", "OPTIONS"],
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes("*")) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.includes(origin));
    },
  };
}

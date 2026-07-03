import { z } from "zod";

const envSchema = z.object({
  CORS_ORIGINS: z
    .string()
    .min(1)
    .default("http://localhost:3000,http://127.0.0.1:3000"),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgres://postgres:postgres@127.0.0.1:5433/campus_chat"),
  HOST: z.string().min(1).default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  PRESENCE_HEARTBEAT_SECONDS: z.coerce
    .number()
    .int()
    .min(5)
    .max(120)
    .default(20),
  REDIS_URL: z.string().url().default("redis://127.0.0.1:6379"),
  SESSION_COOKIE_NAME: z.string().min(1).default("campus_session"),
});

export type RealtimeEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): RealtimeEnv {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;

  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid realtime environment: ${details}`);
}

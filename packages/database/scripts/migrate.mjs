import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "../../..");
const migrationsDir = path.resolve(scriptDir, "../migrations");

loadDotenv(path.join(rootDir, ".env"));

const databaseUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const filename of migrationFiles) {
    const alreadyApplied = await client.query(
      "SELECT 1 FROM public.schema_migrations WHERE filename = $1;",
      [filename],
    );

    if (alreadyApplied.rowCount) {
      console.log(`Already applied: ${filename}`);
      continue;
    }

    console.log(`Applying: ${filename}`);
    const migrationSql = await readFile(
      path.join(migrationsDir, filename),
      "utf8",
    );

    await client.query(migrationSql);
    await client.query(
      "INSERT INTO public.schema_migrations (filename) VALUES ($1);",
      [filename],
    );
  }

  console.log("Database migrations complete.");
} finally {
  await client.end();
}

function loadDotenv(envPath) {
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

function shouldUseSsl(connectionString) {
  try {
    const url = new URL(connectionString);
    return (
      url.searchParams.get("sslmode") === "require" ||
      url.hostname.endsWith(".neon.tech")
    );
  } catch {
    return connectionString.includes("sslmode=require");
  }
}

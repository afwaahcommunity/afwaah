import { createServer } from "node:http";

import { createApp } from "./app";
import { closeApiClients, createApiClients } from "./clients";
import { loadEnv } from "./env";

const env = loadEnv();
const clients = createApiClients(env);
const app = createApp({ clients, env });
const server = createServer(app);
let shutdownStarted = false;

server.listen(env.PORT, env.HOST, () => {
  const address = `http://${env.HOST}:${env.PORT}`;

  console.log(`Campus Chat API listening on ${address}`);
  console.log(`Health: ${address}/health`);
  console.log(`Docs: ${address}/docs`);
  console.log(`OpenAPI: ${address}/openapi.json`);
  console.log(`tRPC: ${address}/trpc`);
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shutdownStarted) return;
  shutdownStarted = true;

  console.log(`Received ${signal}; shutting down API server.`);

  try {
    await closeServer();
    await closeApiClients(clients);
  } catch (error) {
    console.error("API shutdown failed", error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

function closeServer(): Promise<void> {
  if (!server.listening) return Promise.resolve();

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

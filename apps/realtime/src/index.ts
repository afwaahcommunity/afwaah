import { closeRealtimeClients, createRealtimeClients } from "./clients";
import { loadEnv } from "./env";
import { createRealtimeServer } from "./socket/server";

const env = loadEnv();
const clients = createRealtimeClients(env);
const realtimeServer = createRealtimeServer(env, clients);
let shutdownStarted = false;

realtimeServer.httpServer.listen(env.PORT, env.HOST, () => {
  const address = `http://${env.HOST}:${env.PORT}`;
  console.log(`Campus Chat Realtime listening on ${address}`);
  console.log(`Health: ${address}/health`);
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shutdownStarted) return;
  shutdownStarted = true;

  console.log(`Received ${signal}; shutting down realtime server.`);

  try {
    await realtimeServer.close();
    await closeRealtimeClients(clients);
  } catch (error) {
    console.error("Realtime shutdown failed", error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

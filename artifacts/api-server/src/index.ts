import { createServer } from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { setupWebSocket } from "./lib/notify.js";
import { setupUnityWebSocket } from "./lib/unityWs.js";
import { tickAllWorlds } from "./routes/worldSimulation.js";

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
setupWebSocket(server);
setupUnityWebSocket(server);

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

// World Simulation Heartbeat — tick all worlds every 60 minutes
setTimeout(() => {
  tickAllWorlds().catch((e) => logger.error({ err: e }, "[Simulation] heartbeat error"));
  setInterval(() => {
    tickAllWorlds().catch((e) => logger.error({ err: e }, "[Simulation] heartbeat error"));
  }, 60 * 60 * 1000);
}, 15_000); // wait 15s after server start for DB to be ready

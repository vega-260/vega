import "dotenv/config";
import { createServer } from "http";
import path from "path";
import express from "express";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { createApp } from "./server/app/createApp.ts";
import { env, assertProductionEnvironment } from "./server/config/env.ts";
import { initializeRuntimeDatabase } from "./server/database/runtimeStartup.ts";
import { getAllowedOrigins } from "./server/middleware/security.ts";
import { installSocketAuthentication } from "./server/sockets/socketAuth.ts";
import { setupInterviewSocket } from "./server/sockets/interview.ts";
import { setupWebRTCInterviewSocket } from "./server/sockets/webrtc-interview.ts";
import { errorHandler, notFoundHandler } from "./server/middleware/errorHandler.ts";
import logger from "./server/services/logger.ts";
import db from "./server/db.ts";
import { closeQueueConnections } from "./server/services/queueService.ts";
import { closeCacheConnection } from "./server/services/cacheService.ts";
import { serviceState } from "./server/runtime/serviceState.ts";
import { clearDependencyHealthCache } from "./server/health/dependencyHealth.ts";

async function configureFrontend(app: ReturnType<typeof createApp>) {
  if (!env.isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa", optimizeDeps: { force: true } });
    app.use(vite.middlewares);
    return;
  }

  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath, { maxAge: "1y", immutable: true, index: false }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/internal") || req.path.startsWith("/health") || req.path.startsWith("/assets") || req.path.includes(".")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

async function startServer() {
  assertProductionEnvironment();
  await initializeRuntimeDatabase();

  const app = createApp();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: env.isProduction ? getAllowedOrigins() : true,
      methods: ["GET", "POST"],
      credentials: true,
    },
    maxHttpBufferSize: 2_000_000,
    transports: ["websocket", "polling"],
    pingInterval: env.socket.pingIntervalMs,
    pingTimeout: env.socket.pingTimeoutMs,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: false,
    },
  });

  installSocketAuthentication(io);
  setupInterviewSocket(io);
  setupWebRTCInterviewSocket(io);

  await configureFrontend(app);
  app.use(notFoundHandler);
  app.use(errorHandler);

  httpServer.requestTimeout = env.http.requestTimeoutMs;
  httpServer.headersTimeout = env.http.headersTimeoutMs;
  httpServer.keepAliveTimeout = env.http.keepAliveTimeoutMs;
  httpServer.maxRequestsPerSocket = env.http.maxRequestsPerSocket;

  httpServer.listen(env.port, "0.0.0.0", () => {
    serviceState.markReady();
    clearDependencyHealthCache();
    logger.info("VEGA API started", {
      port: env.port,
      environment: env.nodeEnv,
      requestTimeoutMs: env.http.requestTimeoutMs,
      keepAliveTimeoutMs: env.http.keepAliveTimeoutMs,
    });
  });

  const shutdown = (signal: string) => {
    serviceState.beginShutdown();
    clearDependencyHealthCache();
    logger.info("Shutdown requested", { signal });
    io.close();
    httpServer.close(async (error) => {
      if (error) {
        logger.error("HTTP shutdown error", { signal, error });
        process.exit(1);
      }
      await Promise.allSettled([db.close(), closeQueueConnections(), closeCacheConnection()]);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), env.shutdownGraceMs).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((error) => {
  console.error("❌ VEGA startup failed:", error);

  logger.error("VEGA startup failed", {
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
  });

  process.exit(1);
});

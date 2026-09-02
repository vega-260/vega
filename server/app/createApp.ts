import express from "express";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { authenticate } from "../middleware/auth.ts";
import { apiLimiter, aiServiceLimiter, configureCors, detectPromptInjection, sanitizeInput, secureHeadersConfig, strictAuthLimiter } from "../middleware/security.ts";
import { env } from "../config/env.ts";
import { requestContext } from "../observability/requestContext.ts";
import { metricsHandler, metricsMiddleware } from "../observability/metrics.ts";
import { registerApiRoutes } from "./registerRoutes.ts";
import { getDependencyHealth } from "../health/dependencyHealth.ts";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.trustProxyHops);

  app.use(requestContext);
  app.use(metricsMiddleware);
  app.use(env.isProduction ? helmet(secureHeadersConfig()) : helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(configureCors());
  app.use(express.json({ limit: env.requestBodyLimit }));
  app.use(express.urlencoded({ limit: env.requestBodyLimit, extended: true }));
  app.use(sanitizeInput);

  app.get("/health/live", (_req, res) => res.status(200).json({ status: "ok", service: env.observability.serviceName }));
  app.get("/health/ready", async (_req, res) => {
    const health = await getDependencyHealth();
    return res.status(health.status === "ready" ? 200 : 503).json(health);
  });
  app.get("/internal/metrics", metricsHandler);

  app.use("/api", apiLimiter);
  app.use(["/api/auth/login", "/api/auth/register", "/api/auth/send-otp", "/api/auth/verify-otp", "/api/auth/forgot-password", "/api/auth/reset-password"], strictAuthLimiter);
  app.use("/api/ai", authenticate, aiServiceLimiter, detectPromptInjection);
  app.use("/api/chatbot", authenticate, aiServiceLimiter, detectPromptInjection);

  app.use("/uploads", (req, res, next) => {
    if (req.path.startsWith("/drops") || req.path.startsWith("drops")) {
      return res.status(403).json({ error: "Access denied. Drop media must be accessed through secure media endpoints." });
    }
    const ext = path.extname(req.path).toLowerCase();
    const banned = new Set([".js", ".jsx", ".ts", ".tsx", ".sh", ".bash", ".php", ".exe", ".bat", ".cmd", ".py", ".pl", ".html", ".htm", ".jsp", ".asp", ".aspx", ".json"]);
    if (banned.has(ext)) return res.status(403).json({ error: "Access denied by upload safety policy." });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox;");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  }, express.static("uploads"));

  if (!fs.existsSync("./uploads")) {
    fs.mkdirSync("./uploads", { recursive: true });
  }
  registerApiRoutes(app);
  return app;
}

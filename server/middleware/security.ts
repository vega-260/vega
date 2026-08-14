import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import IORedis from "ioredis";
import crypto from "crypto";

export function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}


/**
 * Cookie-authenticated mutations (refresh/logout) must reject cross-site browser
 * requests. Bearer-token APIs are not CSRF-sensitive because credentials are not
 * attached automatically by the browser.
 */
export const requireTrustedBrowserOrigin = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== "production") return next();
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite === "cross-site") {
    return res.status(403).json({ success: false, message: "Cross-site request rejected" });
  }
  const origin = req.headers.origin;
  if (!origin) return next(); // CLI/native clients do not necessarily send Origin.
  if (!getAllowedOrigins().includes(origin)) {
    return res.status(403).json({ success: false, message: "Untrusted request origin" });
  }
  return next();
};

/** Strict production CORS: no wildcard domains and no implicit Render/local exceptions. */
export const configureCors = () => {
  const allowedOrigins = getAllowedOrigins();
  return cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // non-browser clients
      if (process.env.NODE_ENV !== "production" || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token", "Idempotency-Key"],
    credentials: true,
    maxAge: 86400,
  });
};

/**
 * Minimal Redis-backed express-rate-limit store. It keeps counters consistent across
 * horizontally scaled API instances without introducing another rate-limit package.
 */
class RedisRateLimitStore {
  private windowMs = 60_000;
  private client: IORedis;
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
    this.client = new IORedis(process.env.REDIS_URL!, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
      enableOfflineQueue: false,
    });
    this.client.on("error", () => undefined);
  }

  init(options: { windowMs: number }) {
    this.windowMs = options.windowMs;
  }

  async increment(key: string) {
    if (this.client.status === "wait") await this.client.connect();
    const redisKey = `${this.prefix}:${key}`;
    const count = await this.client.incr(redisKey);
    if (count === 1) await this.client.pexpire(redisKey, this.windowMs);
    let ttl = await this.client.pttl(redisKey);
    if (ttl < 0) {
      await this.client.pexpire(redisKey, this.windowMs);
      ttl = this.windowMs;
    }
    return { totalHits: count, resetTime: new Date(Date.now() + ttl) };
  }

  async decrement(key: string) {
    if (this.client.status === "wait") await this.client.connect();
    const redisKey = `${this.prefix}:${key}`;
    const current = Number(await this.client.get(redisKey) || 0);
    if (current > 0) await this.client.decr(redisKey);
  }

  async resetKey(key: string) {
    if (this.client.status === "wait") await this.client.connect();
    await this.client.del(`${this.prefix}:${key}`);
  }
}

function distributedStore(prefix: string) {
  if (!process.env.REDIS_URL) return undefined;
  return new RedisRateLimitStore(prefix) as any;
}

const ipKey = (req: Request) => `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
const digestKey = (value: string) => crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);

const userAwareKey = (req: Request) => {
  const authUserId = (req as any).user?.userId;
  if (authUserId) return `user:${authUserId}`;
  const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return `session:${digestKey(bearer)}`;
  return ipKey(req);
};

const authIdentityKey = (req: Request) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return email ? `account:${digestKey(email)}` : ipKey(req);
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1500,
  keyGenerator: userAwareKey,
  store: distributedStore("vega:rl:api"),
  passOnStoreError: true,
  message: { success: false, message: "Rate limit exceeded. Please try again shortly." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: authIdentityKey,
  store: distributedStore("vega:rl:auth"),
  passOnStoreError: process.env.NODE_ENV !== "production",
  message: { success: false, message: "Too many authentication attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const aiServiceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 100,
  keyGenerator: userAwareKey,
  store: distributedStore("vega:rl:ai"),
  passOnStoreError: process.env.NODE_ENV !== "production",
  message: { success: false, message: "Hourly AI usage limit exceeded. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Conservative normalization only. SQL safety must come from parameterized queries. */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  const sanitizeValue = (val: any): any => {
    if (typeof val === "string") {
      return val.replace(/\u0000/g, "").trim();
    }
    if (Array.isArray(val)) return val.map(sanitizeValue);
    if (val !== null && typeof val === "object") {
      return Object.fromEntries(Object.entries(val).map(([key, value]) => [key, sanitizeValue(value)]));
    }
    return val;
  };

  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);
  next();
};

export const secureHeadersConfig = (): any => ({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://checkout.razorpay.com", "https://cdn.razorpay.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "wss:", "https://api.razorpay.com", "https://checkout.razorpay.com", "https://lumberjack-cx.razorpay.com"],
      frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com", "https://custom-analytics.razorpay.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

export const detectPromptInjection = (req: Request, res: Response, next: NextFunction) => {
  const bodyString = JSON.stringify(req.body) || "";
  if (bodyString.length > 200_000) {
    return res.status(413).json({ success: false, message: "AI request payload is too large." });
  }
  next();
};

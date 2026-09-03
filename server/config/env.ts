const isProduction = process.env.NODE_ENV === "production";

function required(name: string, minLength = 1): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < minLength) {
    throw new Error(`${name} is required${minLength > 1 ? ` and must be at least ${minLength} characters` : ""}.`);
  }
  return value;
}

function integer(name: string, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}


function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (["true", "1", "yes", "on"].includes(raw.toLowerCase())) return true;
  if (["false", "0", "no", "off"].includes(raw.toLowerCase())) return false;
  throw new Error(`${name} must be true or false.`);
}

function requireAny(names: string[]) {
  if (!names.some((name) => Boolean(process.env[name]?.trim()))) {
    throw new Error(`One of ${names.join(", ")} is required.`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  trustProxyHops: integer("TRUST_PROXY_HOPS", 1, 0, 10),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || "15mb",
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  redisUrl: process.env.REDIS_URL || "",
  shutdownGraceMs: integer("SHUTDOWN_GRACE_MS", 15_000, 5_000, 120_000),
  http: {
    requestTimeoutMs: integer("HTTP_REQUEST_TIMEOUT_MS", 30_000, 5_000, 120_000),
    headersTimeoutMs: integer("HTTP_HEADERS_TIMEOUT_MS", 15_000, 5_000, 60_000),
    keepAliveTimeoutMs: integer("HTTP_KEEP_ALIVE_TIMEOUT_MS", 5_000, 1_000, 30_000),
    maxRequestsPerSocket: integer("HTTP_MAX_REQUESTS_PER_SOCKET", 1000, 10, 100_000),
  },
  socket: {
    pingIntervalMs: integer("SOCKET_PING_INTERVAL_MS", 25_000, 5_000, 60_000),
    pingTimeoutMs: integer("SOCKET_PING_TIMEOUT_MS", 20_000, 5_000, 60_000),
  },
  features: {
    requireAI: bool("REQUIRE_AI", false),
    requireEmail: bool("REQUIRE_EMAIL", false),
    requireObjectStorage: bool("REQUIRE_OBJECT_STORAGE", false),
    requireTurn: bool("REQUIRE_TURN", false),
  },
  cookie: {
    name: process.env.REFRESH_COOKIE_NAME || "vega_refresh",
    secure: isProduction,
    sameSite: (process.env.REFRESH_COOKIE_SAMESITE || "lax") as "lax" | "strict" | "none",
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/api/auth",
    maxAgeMs: integer("REFRESH_COOKIE_MAX_AGE_MS", 7 * 24 * 60 * 60 * 1000, 60_000),
  },
  observability: {
    metricsEnabled: process.env.METRICS_ENABLED !== "false",
    metricsToken: process.env.METRICS_TOKEN || "",
    serviceName: process.env.SERVICE_NAME || "vega-api",
  },
  turn: {
    urls: (process.env.TURN_URLS || "").split(",").map((v) => v.trim()).filter(Boolean),
    sharedSecret: process.env.TURN_SHARED_SECRET || "",
    ttlSeconds: integer("TURN_CREDENTIAL_TTL_SECONDS", 3600, 300, 86400),
    staticUsername: process.env.TURN_USERNAME || "",
    staticCredential: process.env.TURN_CREDENTIAL || "",
  },
};
export function assertProductionEnvironment() {
  if (!isProduction) return;

  required("JWT_SECRET", 32);
  required("REFRESH_SECRET", 32);
  required("ALLOWED_ORIGINS");

  const redisEnabled =
    String(process.env.REDIS_ENABLED ?? "true")
      .trim()
      .toLowerCase() !== "false";

  if (redisEnabled) {
    required("REDIS_URL");
  }

  if ((process.env.DB_TYPE || "mysql").toLowerCase() !== "mysql") {
    throw new Error("Production requires DB_TYPE=mysql.");
  }

  if (!process.env.DATABASE_URL && !process.env.MYSQL_URL) {
    required("DB_HOST");
    required("DB_USER");
    required("DB_PASSWORD");
    required("DB_NAME");
  }

  if (env.features.requireObjectStorage) {
    required("AWS_S3_BUCKET_NAME");
    required("AWS_REGION");
    requireAny(["AWS_ACCESS_KEY_ID"]);
    required("AWS_SECRET_ACCESS_KEY");
  }

  if (env.features.requireAI) {
    required("GEMINI_API_KEY");
  }

  if (env.features.requireEmail) {
    required("SMTP_HOST");
    required("SMTP_USER");
    required("SMTP_PASS");
  }

  if (env.features.requireTurn) {
    if (env.turn.urls.length === 0) {
      throw new Error(
        "TURN_URLS is required for production interviews."
      );
    }

    if (
      !env.turn.sharedSecret &&
      !(env.turn.staticUsername && env.turn.staticCredential)
    ) {
      throw new Error(
        "TURN_SHARED_SECRET or TURN_USERNAME/TURN_CREDENTIAL is required."
      );
    }
  }

  if (env.observability.metricsEnabled) {
    required("METRICS_TOKEN", 24);
  }

  if (
    env.cookie.sameSite === "none" &&
    !env.cookie.secure
  ) {
    throw new Error(
      "SameSite=None refresh cookies require Secure cookies."
    );
  }
}
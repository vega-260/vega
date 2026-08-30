import jwt from "jsonwebtoken";
import crypto from "crypto";

function requiredSecret(name: "JWT_SECRET" | "REFRESH_SECRET"): string {
  const value = process.env[name]?.trim();
  if (value && value.length >= 32) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be configured in production and must contain at least 32 characters.`);
  }

  // Development-only fallback. Production can never start with this value.
  return name === "JWT_SECRET"
    ? "dev-only-jwt-secret-change-before-production-0001"
    : "dev-only-refresh-secret-change-before-production-0002";
}

export const JWT_SECRET = requiredSecret("JWT_SECRET");
export const REFRESH_SECRET = requiredSecret("REFRESH_SECRET");

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "1h";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "7d";

export function generateToken(payload: { userId: number; role: string; email: string }) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"],
    algorithm: "HS256",
    issuer: "vega-api",
    audience: "vega-web",
  });
}

export function generateRefreshToken(payload: { userId: number }) {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL as jwt.SignOptions["expiresIn"],
    algorithm: "HS256",
    issuer: "vega-api",
    audience: "vega-refresh",
    jwtid: crypto.randomUUID(),
  });
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "vega-api",
      audience: "vega-web",
    });
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string) {
  try {
    return jwt.verify(token, REFRESH_SECRET, {
      algorithms: ["HS256"],
      issuer: "vega-api",
      audience: "vega-refresh",
    });
  } catch {
    return null;
  }
}

import crypto from "node:crypto";
import IORedis from "ioredis";
import { env } from "../config/env.ts";
import logger from "./logger.ts";
import { recordCacheOperation } from "../observability/metrics.ts";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

let client: IORedis | null = null;
let ready = false;

function getClient(): IORedis | null {
  if (!env.redisUrl) return null;
  if (client) return client;
  client = new IORedis(env.redisUrl, {
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    commandTimeout: 1_500,
  });
  client.on("ready", () => { ready = true; });
  client.on("close", () => { ready = false; });
  client.on("error", (error) => {
    ready = false;
    logger.warn("Redis cache unavailable; requests will bypass cache", { error: error.message });
  });
  client.connect().catch(() => undefined);
  return client;
}

function safeSegment(value: string | number | undefined | null) {
  return String(value ?? "_").replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 120);
}

export function stableCacheKey(namespace: string, parts: unknown[]): string {
  const payload = JSON.stringify(parts);
  const digest = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
  return `vega:cache:${safeSegment(namespace)}:${digest}`;
}

async function namespaceVersion(namespace: string): Promise<number> {
  const redis = getClient();
  if (!redis || !ready) return 0;
  const key = `vega:cache-version:${safeSegment(namespace)}`;
  try {
    const raw = await redis.get(key);
    return Number(raw || 0);
  } catch {
    return 0;
  }
}

export async function invalidateCacheNamespace(namespace: string) {
  const redis = getClient();
  if (!redis || !ready) return;
  try {
    await redis.incr(`vega:cache-version:${safeSegment(namespace)}`);
    recordCacheOperation("invalidate");
  } catch (error: any) {
    logger.warn("Cache namespace invalidation failed", { namespace, error: error?.message });
  }
}

export async function cacheGetOrLoad<T extends Json>(
  namespace: string,
  keyParts: unknown[],
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const redis = getClient();
  if (!redis || !ready || ttlSeconds <= 0) {
    recordCacheOperation("bypass");
    return loader();
  }

  const version = await namespaceVersion(namespace);
  const key = stableCacheKey(`${namespace}:v${version}`, keyParts);
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      recordCacheOperation("hit");
      return JSON.parse(cached) as T;
    }
    recordCacheOperation("miss");
  } catch {
    recordCacheOperation("error");
    return loader();
  }

  const value = await loader();
  try {
    await redis.set(key, JSON.stringify(value), "EX", Math.max(1, Math.min(ttlSeconds, 86_400)));
    recordCacheOperation("write");
  } catch {
    recordCacheOperation("error");
  }
  return value;
}

export async function closeCacheConnection() {
  if (!client) return;
  await client.quit().catch(() => client?.disconnect());
  client = null;
  ready = false;
}

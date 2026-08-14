import db from "../db.ts";
import { env } from "../config/env.ts";
import { getQueueHealth } from "../services/queueService.ts";
import { serviceState } from "../runtime/serviceState.ts";

export type DependencyHealth = {
  status: "ready" | "not_ready";
  acceptingTraffic: boolean;
  database: { ok: boolean; latencyMs?: number; error?: string; readReplica?: { configured: boolean; ok: boolean; latencyMs?: number; error?: string } };
  queue: ReturnType<typeof getQueueHealth>;
  objectStorage: { configured: boolean; required: boolean };
  turn: { configured: boolean; required: boolean };
  checkedAt: string;
};

let cache: { expiresAt: number; value: DependencyHealth } | null = null;
const CACHE_MS = 1_500;

export async function getDependencyHealth(force = false): Promise<DependencyHealth> {
  const now = Date.now();
  if (!force && cache && cache.expiresAt > now) return cache.value;

  const database: DependencyHealth["database"] = { ok: false, latencyMs: undefined, error: undefined };
  const started = performance.now();
  try {
    await db.pingPrimary();
    database.ok = true;
    database.latencyMs = Math.round((performance.now() - started) * 10) / 10;
  } catch (error) {
    database.error = error instanceof Error ? error.message : "Primary database health check failed";
  }
  if (db.hasReadReplica) {
    const replicaStarted = performance.now();
    database.readReplica = { configured: true, ok: false };
    try {
      await db.pingReadReplica();
      database.readReplica.ok = true;
      database.readReplica.latencyMs = Math.round((performance.now() - replicaStarted) * 10) / 10;
    } catch (error) {
      database.readReplica.error = error instanceof Error ? error.message : "Read replica health check failed";
    }
  } else {
    database.readReplica = { configured: false, ok: true };
  }

  const queue = getQueueHealth();
  const objectStorageConfigured = Boolean(process.env.AWS_S3_BUCKET_NAME && process.env.AWS_REGION);
  const turnConfigured = env.turn.urls.length > 0 && Boolean(env.turn.sharedSecret || (env.turn.staticUsername && env.turn.staticCredential));
  const dependenciesReady = database.ok && (database.readReplica?.ok ?? true)
    && (!env.isProduction || !env.features.requireObjectStorage || objectStorageConfigured)
    && (!env.isProduction || !env.features.requireTurn || turnConfigured)
    && (!env.isProduction || (queue.configured && queue.available));

  const value: DependencyHealth = {
    status: dependenciesReady && serviceState.acceptingTraffic ? "ready" : "not_ready",
    acceptingTraffic: serviceState.acceptingTraffic,
    database,
    queue,
    objectStorage: { configured: objectStorageConfigured, required: env.features.requireObjectStorage },
    turn: { configured: turnConfigured, required: env.features.requireTurn },
    checkedAt: new Date().toISOString(),
  };
  cache = { expiresAt: now + CACHE_MS, value };
  return value;
}

export function clearDependencyHealthCache() {
  cache = null;
}

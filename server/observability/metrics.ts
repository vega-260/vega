import type { Request, Response, NextFunction } from "express";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { env } from "../config/env.ts";

const startedAt = Date.now();
const eventLoop = monitorEventLoopDelay({ resolution: 20 });
eventLoop.enable();
let inFlight = 0;
let totalRequests = 0;
let total2xx = 0;
let total4xx = 0;
let total5xx = 0;
let totalLatencyMs = 0;
const latencyBuckets = { le100: 0, le300: 0, le1000: 0, inf: 0 };

let dbQueries = 0;
let dbErrors = 0;
let dbSlowQueries = 0;
let dbTotalLatencyMs = 0;
let dbInFlight = 0;

let queueEnqueueSuccess = 0;
let queueEnqueueFailure = 0;
let queryBudgetExceeded = 0;
const cacheOps = { hit: 0, miss: 0, write: 0, invalidate: 0, bypass: 0, error: 0 };

export function recordDbQuery(durationMs: number, options: { error?: boolean; slow?: boolean } = {}) {
  dbQueries += 1;
  dbTotalLatencyMs += durationMs;
  if (options.error) dbErrors += 1;
  if (options.slow) dbSlowQueries += 1;
}

export function changeDbInFlight(delta: number) {
  dbInFlight = Math.max(0, dbInFlight + delta);
}

export function recordQueryBudgetExceeded() { queryBudgetExceeded += 1; }

export function recordCacheOperation(kind: keyof typeof cacheOps) {
  cacheOps[kind] += 1;
}

export function recordQueueEnqueue(ok: boolean) {
  if (ok) queueEnqueueSuccess += 1;
  else queueEnqueueFailure += 1;
}

export function metricsMiddleware(_req: Request, res: Response, next: NextFunction) {
  if (!env.observability.metricsEnabled) return next();
  const start = process.hrtime.bigint();
  inFlight += 1;
  totalRequests += 1;
  res.once("finish", () => {
    inFlight = Math.max(0, inFlight - 1);
    if (res.statusCode >= 500) total5xx += 1;
    else if (res.statusCode >= 400) total4xx += 1;
    else if (res.statusCode >= 200) total2xx += 1;
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    totalLatencyMs += ms;
    if (ms <= 100) latencyBuckets.le100 += 1;
    if (ms <= 300) latencyBuckets.le300 += 1;
    if (ms <= 1000) latencyBuckets.le1000 += 1;
    latencyBuckets.inf += 1;
  });
  next();
}

export function metricsHandler(req: Request, res: Response) {
  if (!env.observability.metricsEnabled) return res.status(404).end();
  if (env.isProduction && env.observability.metricsToken) {
    const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (token !== env.observability.metricsToken) return res.status(401).end();
  }
  const uptime = Math.floor((Date.now() - startedAt) / 1000);
  const memory = process.memoryUsage();
  const eventLoopP95Seconds = Number(eventLoop.percentile(95)) / 1_000_000_000;
  const eventLoopMaxSeconds = Number(eventLoop.max) / 1_000_000_000;
  const avgLatencySeconds = totalRequests > 0 ? totalLatencyMs / totalRequests / 1000 : 0;
  const dbAverageSeconds = dbQueries > 0 ? dbTotalLatencyMs / dbQueries / 1000 : 0;
  res.type("text/plain; version=0.0.4").send([
    `vega_process_uptime_seconds ${uptime}`,
    `vega_process_resident_memory_bytes ${memory.rss}`,
    `vega_process_heap_used_bytes ${memory.heapUsed}`,
    `vega_node_event_loop_delay_p95_seconds ${eventLoopP95Seconds}`,
    `vega_node_event_loop_delay_max_seconds ${eventLoopMaxSeconds}`,
    `vega_http_requests_total ${totalRequests}`,
    `vega_http_responses_total{class="2xx"} ${total2xx}`,
    `vega_http_responses_total{class="4xx"} ${total4xx}`,
    `vega_http_responses_total{class="5xx"} ${total5xx}`,
    `vega_http_in_flight ${inFlight}`,
    `vega_http_average_duration_seconds ${avgLatencySeconds}`,
    `vega_http_latency_bucket{le="0.1"} ${latencyBuckets.le100}`,
    `vega_http_latency_bucket{le="0.3"} ${latencyBuckets.le300}`,
    `vega_http_latency_bucket{le="1"} ${latencyBuckets.le1000}`,
    `vega_http_latency_bucket{le="+Inf"} ${latencyBuckets.inf}`,
    `vega_db_queries_total ${dbQueries}`,
    `vega_db_query_errors_total ${dbErrors}`,
    `vega_db_slow_queries_total ${dbSlowQueries}`,
    `vega_db_queries_in_flight ${dbInFlight}`,
    `vega_db_query_average_duration_seconds ${dbAverageSeconds}`,
    `vega_db_query_budget_exceeded_total ${queryBudgetExceeded}`,
    `vega_queue_enqueue_total{result="success"} ${queueEnqueueSuccess}`,
    `vega_queue_enqueue_total{result="failure"} ${queueEnqueueFailure}`,
    `vega_cache_operations_total{result="hit"} ${cacheOps.hit}`,
    `vega_cache_operations_total{result="miss"} ${cacheOps.miss}`,
    `vega_cache_operations_total{result="write"} ${cacheOps.write}`,
    `vega_cache_operations_total{result="invalidate"} ${cacheOps.invalidate}`,
    `vega_cache_operations_total{result="bypass"} ${cacheOps.bypass}`,
    `vega_cache_operations_total{result="error"} ${cacheOps.error}`,
    `vega_cache_hit_ratio ${cacheOps.hit + cacheOps.miss > 0 ? cacheOps.hit / (cacheOps.hit + cacheOps.miss) : 0}`,
    "",
  ].join("\n"));
}

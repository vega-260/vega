import { AsyncLocalStorage } from "node:async_hooks";
import logger from "../services/logger.ts";
import { recordQueryBudgetExceeded } from "./metrics.ts";

type QueryContext = { requestId: string; route: string; count: number; slowCount: number };
const storage = new AsyncLocalStorage<QueryContext>();

export function runWithQueryBudget<T>(requestId: string, route: string, fn: () => T): T {
  return storage.run({ requestId, route, count: 0, slowCount: 0 }, fn);
}

export function recordRequestQuery(slow = false) {
  const ctx = storage.getStore();
  if (!ctx) return;
  ctx.count += 1;
  if (slow) ctx.slowCount += 1;
}

export function currentQueryCount() { return storage.getStore()?.count || 0; }

export function finishQueryBudget(method: string, path: string) {
  const ctx = storage.getStore();
  if (!ctx) return;
  const max = Math.max(5, Number(process.env.DB_MAX_QUERIES_PER_REQUEST || 30));
  if (ctx.count > max) {
    recordQueryBudgetExceeded();
    logger.warn("Database query budget exceeded; possible N+1 query pattern", {
      requestId: ctx.requestId, method, path, queryCount: ctx.count, slowQueryCount: ctx.slowCount, threshold: max,
    });
  }
}

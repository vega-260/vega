import crypto from "node:crypto";

/**
 * Normalizes SQL so high-cardinality literal values never become metric/log labels.
 * The short hash is safe for aggregation in logs and APM systems.
 */
export function normalizeSqlShape(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/'(?:''|[^'])*'/g, "?")
    .replace(/\b\d+(?:\.\d+)?\b/g, "?")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
}

export function queryFingerprint(sql: string): string {
  return crypto.createHash("sha256").update(normalizeSqlShape(sql)).digest("hex").slice(0, 16);
}

import mysql from "mysql2/promise";
import Database from "better-sqlite3";
import path from "path";
import logger from "./services/logger.ts";
import { changeDbInFlight, recordDbQuery } from "./observability/metrics.ts";
import { queryFingerprint } from "./observability/queryFingerprint.ts";
import { recordRequestQuery } from "./observability/queryBudget.ts";

const dbType = (process.env.DB_TYPE || "").toLowerCase();
const databaseUrl = process.env.MYSQL_URL || process.env.DATABASE_URL || "";
let mysqlHost = process.env.MYSQL_HOST || process.env.DB_HOST || "";
let mysqlUser = process.env.MYSQL_USER || process.env.DB_USER || "";
let mysqlPassword = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "";
let mysqlDatabase = process.env.MYSQL_DATABASE || process.env.DB_NAME || "";
let mysqlPort = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);

if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  mysqlHost = parsed.hostname || mysqlHost;
  mysqlPort = Number(parsed.port || mysqlPort || 3306);
  mysqlUser = decodeURIComponent(parsed.username || mysqlUser);
  mysqlPassword = decodeURIComponent(parsed.password || mysqlPassword);
  mysqlDatabase = decodeURIComponent(parsed.pathname.replace(/^\//, "") || mysqlDatabase);
}

const mysqlConfigured = dbType === "mysql" || (!dbType && Boolean(mysqlHost || databaseUrl));
const useMySQL = dbType === "sqlite" ? false : mysqlConfigured;

let pool: mysql.Pool | null = null;
let readPool: mysql.Pool | null = null;
let sqlite: Database.Database | null = null;

const readDatabaseUrl = process.env.MYSQL_READ_URL || process.env.DATABASE_READ_URL || "";
const readHost = process.env.MYSQL_READ_HOST || process.env.DB_READ_HOST || "";

function intEnv(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(Math.trunc(value), max));
}

function configureMySqlPoolSessions(targetPool: mysql.Pool, role: "primary" | "replica") {
  const rawPool: any = (targetPool as any).pool;
  if (!rawPool?.on) return;
  const lockWaitSeconds = intEnv("DB_LOCK_WAIT_TIMEOUT_SECONDS", 15, 1, 120);
  const maxExecutionMs = intEnv(role === "replica" ? "DB_READ_MAX_EXECUTION_MS" : "DB_MAX_EXECUTION_MS", role === "replica" ? 3000 : 5000, 250, 60000);
  rawPool.on("connection", (connection: any) => {
    connection.query("SET SESSION time_zone = '+00:00'");
    connection.query(`SET SESSION innodb_lock_wait_timeout = ${lockWaitSeconds}`);
    connection.query(`SET SESSION max_execution_time = ${maxExecutionMs}`);
    connection.query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
  });
}

function createPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: mysqlHost || "localhost",
      user: mysqlUser || "root",
      password: mysqlPassword || "",
      database: mysqlDatabase || "talentbridge01",
      port: mysqlPort,
      waitForConnections: true,
      connectionLimit: intEnv("DB_POOL_SIZE", 30, 5, 100),
      maxIdle: intEnv("DB_POOL_MAX_IDLE", 15, 2, 50),
      idleTimeout: intEnv("DB_POOL_IDLE_TIMEOUT_MS", 30_000, 5_000, 300_000),
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      queueLimit: intEnv("DB_POOL_QUEUE_LIMIT", 500, 50, 5000),
      connectTimeout: intEnv("DB_CONNECT_TIMEOUT_MS", 10_000, 2_000, 30_000),
      timezone: "Z",
      decimalNumbers: true,
      supportBigNumbers: true,
      bigNumberStrings: false,
    });
    configureMySqlPoolSessions(pool, "primary");
  }
  return pool;
}


function createReadPool(): mysql.Pool {
  if (!useMySQL) throw new Error("Read replica pool is only available for MySQL");
  if (!readPool) {
    let host = readHost;
    let user = process.env.MYSQL_READ_USER || process.env.DB_READ_USER || mysqlUser;
    let password = process.env.MYSQL_READ_PASSWORD || process.env.DB_READ_PASSWORD || mysqlPassword;
    let database = process.env.MYSQL_READ_DATABASE || process.env.DB_READ_NAME || mysqlDatabase;
    let port = Number(process.env.MYSQL_READ_PORT || process.env.DB_READ_PORT || mysqlPort);
    if (readDatabaseUrl) {
      const parsed = new URL(readDatabaseUrl);
      host = parsed.hostname || host;
      port = Number(parsed.port || port || 3306);
      user = decodeURIComponent(parsed.username || user);
      password = decodeURIComponent(parsed.password || password);
      database = decodeURIComponent(parsed.pathname.replace(/^\//, "") || database);
    }
    readPool = mysql.createPool({
      host, user, password, database, port, waitForConnections: true,
      connectionLimit: intEnv("DB_READ_POOL_SIZE", 20, 5, 100),
      maxIdle: intEnv("DB_READ_POOL_MAX_IDLE", 10, 2, 50),
      idleTimeout: intEnv("DB_POOL_IDLE_TIMEOUT_MS", 30_000, 5_000, 300_000),
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      queueLimit: intEnv("DB_READ_POOL_QUEUE_LIMIT", 500, 50, 5000),
      connectTimeout: intEnv("DB_CONNECT_TIMEOUT_MS", 10_000, 2_000, 30_000),
      timezone: "Z",
      decimalNumbers: true,
      supportBigNumbers: true,
      bigNumberStrings: false,
    });
    configureMySqlPoolSessions(readPool, "replica");
  }
  return readPool;
}

function hasReadReplica() {
  return useMySQL && process.env.RUN_DB_MIGRATIONS !== "true" && Boolean(readDatabaseUrl || readHost);
}

function createSqlite(): Database.Database {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SQLite is disabled in production");
  }
  if (!sqlite) {
    sqlite = new Database(path.join(process.cwd(), process.env.SQLITE_FILE || process.env.SQLITE_DB_PATH || "vega.db"));
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("synchronous = NORMAL");
    sqlite.pragma("busy_timeout = 10000");
    sqlite.pragma("foreign_keys = ON");
  }
  return sqlite;
}

function normalizeParams(params: any[] = []) {
  return params.map((value) => value instanceof Date ? (useMySQL ? value.toISOString().slice(0, 19).replace("T", " ") : value.toISOString()) : value);
}

function isReadQuery(sql: string) {
  const normalized = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "").trim().toLowerCase();
  return ["select", "with", "show", "pragma", "explain", "describe", "("].some((prefix) => normalized.startsWith(prefix));
}

async function query(sql: string, params: any[] = []) {
  const started = performance.now();
  const slowThresholdMs = Number(process.env.SLOW_QUERY_MS || 500);
  let failed = false;
  changeDbInFlight(1);
  try {
    const values = normalizeParams(params);
    if (useMySQL) {
      const [result] = await createPool().execute(sql, values);
      return [result];
    }
    const database = createSqlite();
    const stmt = database.prepare(sql);
    if (isReadQuery(sql)) return [stmt.all(...values)];
    const result = stmt.run(...values);
    return [{ insertId: result.lastInsertRowid, affectedRows: result.changes }];
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    changeDbInFlight(-1);
    const durationMs = performance.now() - started;
    const slow = durationMs >= slowThresholdMs;
    recordDbQuery(durationMs, { error: failed, slow });
    recordRequestQuery(slow);
    if (slow) {
      logger.warn("Slow database query", {
        durationMs: Math.round(durationMs),
        fingerprint: queryFingerprint(sql),
        statement: sql.trim().replace(/\s+/g, " ").slice(0, 180),
      });
    }
  }
}

/** Explicit eventually-consistent read. Security/ownership/session reads stay on db.query (primary). */
async function migrationRawQuery(sql: string) {
  if (!useMySQL) return query(sql);
  if (process.env.RUN_DB_MIGRATIONS !== "true") {
    throw new Error("Raw DDL query channel is migration-only");
  }
  const [result] = await createPool().query(sql);
  return [result];
}

async function readQuery(sql: string, params: any[] = []) {
  if (!hasReadReplica()) return query(sql, params);
  if (!isReadQuery(sql)) throw new Error("db.readQuery only accepts read-only SQL");
  const started = performance.now();
  const slowThresholdMs = Number(process.env.SLOW_QUERY_MS || 500);
  let failed = false;
  changeDbInFlight(1);
  try {
    const [result] = await createReadPool().execute(sql, normalizeParams(params));
    return [result];
  } catch (error) {
    failed = true; throw error;
  } finally {
    changeDbInFlight(-1);
    const durationMs = performance.now() - started;
    const slow = durationMs >= slowThresholdMs;
    recordDbQuery(durationMs, { error: failed, slow });
    recordRequestQuery(slow);
    if (slow) logger.warn("Slow read-replica query", { durationMs: Math.round(durationMs), fingerprint: queryFingerprint(sql), statement: sql.trim().replace(/\s+/g, " ").slice(0, 180) });
  }
}

export async function runTransaction<T>(work: (tx: { query: typeof query; execute: typeof query }) => Promise<T>): Promise<T> {
  if (useMySQL) {
    const connection = await createPool().getConnection();
    try {
      await connection.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
      await connection.beginTransaction();
      const txQuery = async (sql: string, params: any[] = []) => {
        const [result] = await connection.execute(sql, normalizeParams(params));
        return [result];
      };
      const result = await work({ query: txQuery as typeof query, execute: txQuery as typeof query });
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  const database = createSqlite();
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = await work({ query, execute: query });
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export const db = {
  query,
  readQuery,
  migrationRawQuery,
  execute: query,
  transaction: runTransaction,
  get useMySQL() { return useMySQL; },
  get hasReadReplica() { return hasReadReplica(); },
  async ping() { await query("SELECT 1 AS ok"); return true; },
  async pingPrimary() { if (useMySQL) { await createPool().execute("SELECT 1 AS ok"); return true; } await query("SELECT 1 AS ok"); return true; },
  async pingReadReplica() { if (!hasReadReplica()) return true; await createReadPool().execute("SELECT 1 AS ok"); return true; },
  async close() {
    if (pool) { await pool.end(); pool = null; }
    if (readPool) { await readPool.end(); readPool = null; }
    if (sqlite) { sqlite.close(); sqlite = null; }
  },
};

export const queryLogger = async (_queryText: string, execution: () => Promise<any>) => execution();

async function tableExists(table: string): Promise<boolean> {
  if (useMySQL) {
    const [rows]: any = await query("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1", [table]);
    return rows.length > 0;
  }
  const [rows]: any = await query("SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1", [table]);
  return rows.length > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  if (useMySQL) {
    const [rows]: any = await query("SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1", [table, column]);
    return rows.length > 0;
  }
  const [rows]: any = await query(`PRAGMA table_info(${table})`);
  return rows.some((row: any) => row.name === column);
}

async function verifySchema(spec: Record<string, string[]>): Promise<{ ready: boolean; missing: string[] }> {
  const missing: string[] = [];
  for (const [table, columns] of Object.entries(spec)) {
    if (!(await tableExists(table))) { missing.push(`table:${table}`); continue; }
    for (const column of columns) if (!(await columnExists(table, column))) missing.push(`column:${table}.${column}`);
  }
  return { ready: missing.length === 0, missing };
}

export function ensureAssessmentSchema() {
  return verifySchema({
    company_assessment_definitions: ["company_id", "title", "questions_json", "duration_minutes", "cutoff_score", "total_marks", "status", "version"],
    company_assessment_assignments: ["company_id", "definition_version_id", "job_id", "stage_id", "cutoff_score", "status"],
    test_submissions: ["questions_json", "cutoff_score", "total_marks", "duration", "assignment_id"],
    test_submission_events: ["attempt_id"],
    assessment_idempotency_requests: ["company_id", "operation", "idempotency_key", "request_hash", "status"],
  });
}

export function ensureTPOAssessmentSchema() {
  return verifySchema({
    assessment_tests: [], assessment_questions: [], assessment_attempts: [], assessment_answers: [], assessment_violations: [], assessment_reports: [],
  });
}

/**
 * Compatibility bootstrap. Production API containers never perform DDL; the dedicated
 * migration command invokes the isolated legacy bootstrap. Development keeps the old
 * bootstrap behavior so existing local setups continue to work.
 */
export async function initDb() {
  if (process.env.NODE_ENV === "production" && process.env.RUN_DB_MIGRATIONS !== "true") {
    if (!useMySQL) throw new Error("Production requires MySQL");
    await db.ping();
    return;
  }
  const legacy = await import("./database/legacyDbBootstrap.ts");
  await legacy.initDb();
  await db.ping();
}

export default db;

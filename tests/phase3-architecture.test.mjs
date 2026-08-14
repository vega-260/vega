import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(file, "utf8");
const lines = (file) => read(file).split(/\r?\n/).length;

const featureFiles = [
  "server/features/company/index.ts",
  "server/features/tpo/index.ts",
  "server/features/assessments/index.ts",
  "server/features/admin/index.ts",
  "server/features/student/index.ts",
];

test("legacy mega routers are compatibility exports over feature modules", () => {
  for (const file of featureFiles) assert.ok(fs.existsSync(file), `${file} missing`);
  for (const file of ["company", "tpo", "assessments", "admin", "student"]) {
    assert.ok(lines(`server/routes/${file}.ts`) <= 4, `${file} compatibility route grew unexpectedly`);
  }
  assert.ok(lines("server/routes/job.ts") < 1200, "job router should remain decomposed");
});

test("production database facade is small and DDL is migration-only", () => {
  const db = read("server/db.ts");
  assert.ok(lines("server/db.ts") < 350);
  assert.doesNotMatch(db, /CREATE TABLE/i);
  assert.match(db, /RUN_DB_MIGRATIONS/);
  assert.ok(fs.existsSync("server/database/legacyDbBootstrap.ts"));
});

test("student uploads use memory buffers and encrypted object storage", () => {
  const config = read("server/features/student/uploadConfig.ts");
  const routes = read("server/features/student/uploadRoutes.ts");
  const storage = read("server/services/storageService.ts");
  assert.match(config, /memoryStorage\(\)/);
  assert.doesNotMatch(config, /diskStorage\(/);
  assert.match(routes, /req\.file\.buffer/);
  assert.match(routes, /uploadBufferToCloudBucket/);
  assert.match(storage, /ServerSideEncryption:\s*["']AES256["']/);
  assert.doesNotMatch(config, /svg\+xml/i);
});

test("feature routers establish role boundaries at their parent", () => {
  assert.match(read("server/features/tpo/index.ts"), /authorize\(\["TPO"\]\)/);
  assert.match(read("server/features/company/index.ts"), /authorize\(\["COMPANY",\s*"ADMIN",\s*"SUPER_ADMIN"\]\)/);
  assert.match(read("server/features/admin/index.ts"), /isAdmin/);
});

test("migrations are serialized and versioned", () => {
  const migration = read("migrate.ts");
  assert.match(migration, /GET_LOCK/);
  assert.match(migration, /RELEASE_LOCK/);
  assert.match(migration, /schema_migrations/);
  assert.match(migration, /20260808_phase3_query_indexes/);
});

test("workers use distributed maintenance locks and idempotent AI jobs", () => {
  const worker = read("worker.ts");
  const queue = read("server/services/queueService.ts");
  assert.match(worker, /withDistributedLock/);
  assert.match(queue, /set\(lockKey,\s*token,\s*["']PX["']/);
  assert.match(queue, /jobId:/);
  assert.match(queue, /sha256/);
});

test("development data seed cannot run in production", () => {
  const route = read("server/features/admin/ecosystemAnalyticsRoutes.ts");
  assert.match(route, /seed-tpo-data-v2/);
  assert.match(route, /NODE_ENV === "production"[\s\S]{0,200}status\(404\)/);
});

test("frontend resume templates are feature modules", () => {
  assert.ok(fs.existsSync("src/features/resume-builder/templates/ResumeTemplates.tsx"));
  assert.ok(lines("src/pages/ai/ResumeBuilder.tsx") < 1600);
});

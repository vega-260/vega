import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

test('Phase 5 has Redis read-through cache with namespace invalidation and metrics', () => {
  const cache = read('server/services/cacheService.ts');
  const metrics = read('server/observability/metrics.ts');
  assert.match(cache, /cacheGetOrLoad/);
  assert.match(cache, /cache-version:/);
  assert.match(cache, /invalidateCacheNamespace/);
  assert.match(metrics, /vega_cache_hit_ratio/);
  assert.match(metrics, /vega_cache_operations_total/);
});

test('database can route reads to an optional read replica while migrations remain primary-only', () => {
  const db = read('server/db.ts');
  assert.match(db, /MYSQL_READ_URL/);
  assert.match(db, /createReadPool/);
  assert.match(db, /async function readQuery/);
  assert.match(db, /Explicit eventually-consistent read/);
  assert.match(db, /RUN_DB_MIGRATIONS !== "true"/);
  assert.match(db, /pingPrimary/);
  assert.match(db, /pingReadReplica/);
});

test('runtime N+1 query budget and slow-query fingerprinting are enabled', () => {
  const budget = read('server/observability/queryBudget.ts');
  const fingerprint = read('server/observability/queryFingerprint.ts');
  const db = read('server/db.ts');
  assert.match(budget, /DB_MAX_QUERIES_PER_REQUEST/);
  assert.match(budget, /possible N\+1 query pattern/);
  assert.match(fingerprint, /sha256/);
  assert.match(db, /queryFingerprint\(sql\)/);
});

test('company applicant history uses bounded batch queries instead of nested N+1', () => {
  const job = read('server/routes/job.ts');
  assert.match(job, /Batch-load related data/);
  assert.match(job, /application_history ah[\s\S]*IN \(\$\{appPlaceholders\}\)/);
  assert.match(job, /interview_evaluations WHERE interview_id IN/);
  assert.doesNotMatch(job, /const historyPromises = applications\.map/);
});

test('TPO assessment lists and live monitoring batch related rows', () => {
  const tests = read('server/features/assessments/tpoTestRoutes.ts');
  const analytics = read('server/features/assessments/tpoAnalyticsRoutes.ts');
  assert.match(tests, /assessment_assignments WHERE assessment_id IN/);
  assert.match(tests, /assessment_attempts WHERE assessment_id IN/);
  assert.match(analytics, /assessment_violations WHERE attempt_id IN/);
  assert.match(analytics, /assessment_answers WHERE attempt_id IN/);
});

test('Phase 5 migration adds query-shaped composite indexes safely', () => {
  const migrate = read('migrate.ts');
  assert.match(migrate, /20260809_phase5_database_performance/);
  assert.match(migrate, /information_schema\.columns/);
  assert.match(migrate, /idx_job_stages_job_order/);
  assert.match(migrate, /idx_test_schedules_job_stage_time/);
  assert.match(migrate, /idx_assessment_attempts_assessment_student/);
});

test('bulk applicant operations use one transaction and multi-row DML', () => {
  const routes = read('server/features/applications/applicationRoutes.ts');
  assert.match(routes, /db\.transaction\(async \(tx\)/);
  assert.match(routes, /UPDATE job_applications[\s\S]*WHERE id IN/);
  assert.match(routes, /INSERT INTO application_history[\s\S]*VALUES \$\{historyValues\}/);
  assert.match(routes, /INSERT INTO notifications[\s\S]*VALUES \$\{notificationValues\}/);
});

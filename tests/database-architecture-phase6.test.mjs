import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');

test('Phase 6 installs production SQL views, procedures and guardrail triggers', () => {
  const source = read('server/database/phase6/sqlObjects.ts');
  assert.match(source, /vw_company_job_pipeline_summary/);
  assert.match(source, /vw_student_application_overview/);
  assert.match(source, /vw_tpo_assessment_summary/);
  assert.match(source, /sp_refresh_company_job_pipeline_metrics/);
  assert.match(source, /sp_purge_expired_refresh_tokens/);
  assert.match(source, /sp_purge_expired_otps/);
  assert.match(source, /trg_company_audit_logs_no_update/);
  assert.match(source, /trg_admin_logs_no_update/);
});

test('Phase 6 uses a persisted dashboard summary instead of pretending MySQL views are materialized', () => {
  const source = read('server/database/phase6/sqlObjects.ts');
  assert.match(source, /CREATE TABLE IF NOT EXISTS company_job_pipeline_metrics/);
  assert.match(source, /ON DUPLICATE KEY UPDATE/);
  assert.match(source, /metrics_refreshed_at/);
});

test('database pools are bounded and configure production session safety', () => {
  const source = read('server/db.ts');
  assert.match(source, /DB_POOL_QUEUE_LIMIT/);
  assert.match(source, /DB_READ_POOL_QUEUE_LIMIT/);
  assert.match(source, /innodb_lock_wait_timeout/);
  assert.match(source, /max_execution_time/);
  assert.match(source, /READ COMMITTED/);
  assert.doesNotMatch(source, /queueLimit:\s*0/);
});

test('worker executes bounded database maintenance under the existing distributed maintenance lock', () => {
  const worker = read('worker.ts');
  const maintenance = read('server/database/phase6/maintenance.ts');
  assert.match(worker, /runDatabaseMaintenance/);
  assert.match(worker, /withDistributedLock\("worker-maintenance"/);
  assert.match(maintenance, /DB_MAINTENANCE_BATCH_SIZE/);
  assert.match(maintenance, /DB_PIPELINE_SUMMARY_REFRESH_MINUTES/);
});

test('Phase 6 removes a company tests-history N+1 pattern', () => {
  const source = read('server/features/company/testRoutes.ts');
  assert.match(source, /Batch all per-job aggregates once/);
  assert.match(source, /GROUP BY job_id/);
  assert.match(source, /submissionByJob/);
});

test('production MySQL tuning and least-privilege templates are packaged', () => {
  const mysql = read('config/mysql/mysql8-production.cnf.example');
  const grants = read('config/mysql/least-privilege-users.sql.example');
  assert.match(mysql, /innodb_buffer_pool_size/);
  assert.match(mysql, /slow_query_log=ON/);
  assert.match(mysql, /max_connections=300/);
  assert.match(grants, /vega_app/);
  assert.match(grants, /vega_migrator/);
  assert.match(grants, /CREATE ROUTINE/);
});

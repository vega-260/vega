# VEGA Production Database Architecture – Phase 6 Implementation Report

## Implemented

- Production SQL-object installer integrated into the serialized migration job.
- Migration-only raw DDL channel; API/worker runtime cannot use it.
- Persisted `company_job_pipeline_metrics` summary table for expensive dashboard counts.
- `vw_company_job_pipeline_summary`, `vw_student_application_overview`, `vw_tpo_assessment_summary` reporting views using `SQL SECURITY INVOKER`.
- `sp_refresh_company_job_pipeline_metrics` set-based summary refresh procedure.
- `sp_purge_expired_refresh_tokens` and `sp_purge_expired_otps` bounded cleanup procedures.
- Update-blocking audit guard triggers for `company_audit_logs` and `admin_logs`.
- Additional query-shaped indexes for expiry cleanup, application history, assessments, interviews, audit and profile-view hot paths.
- Bounded primary/read-replica connection queues; unlimited pool queues removed.
- MySQL session UTC timezone, `READ COMMITTED`, lock-wait timeout and SELECT execution timeout.
- Dedicated database maintenance routine integrated with the existing Redis distributed worker lock.
- Pipeline summary refresh frequency is bounded/configurable and does not execute on every API request.
- Remaining Company tests-history N+1 pattern converted to three grouped batch reads.
- Recommendation job counts converted from correlated subqueries to grouped derived joins.
- Production MySQL 8 tuning template and least-privilege runtime/readonly/migration account SQL.
- `db:schema-health` and `db:explain-critical` operational commands.

## Why triggers/procedures are intentionally limited

Triggers are not used for notifications, AI, workflow transitions or analytics fan-out because hidden per-row work creates write amplification and makes deadlocks harder to reason about. Procedures are limited to set-based, database-local operations. Business orchestration remains observable/testable in Node services and BullMQ.

## Validation in this environment

- 47/47 architecture/security/performance regression tests passed.
- 264 TS/TSX production-source files parsed with zero syntax diagnostics.
- Relative-import validation passed for production source roots.
- Docker Compose YAML parses successfully.

The environment does not provide the project's full npm dependency tree or a running production MySQL instance, so the stored routine/view/trigger DDL must still be executed by `npm run migrate:prod` against staging MySQL 8 before release. After migration, run `SHOW WARNINGS`, `npm run db:schema-health`, `npm run db:explain-critical`, and the k6 DB load suite.

## Production release requirement

Do not claim a 100k-concurrent-user database SLA until staging contains production-like row volumes and passes load tests with real MySQL CPU/RAM/IOPS, replica lag, Redis, API replicas and workers. The architecture is designed to scale toward that load; measured capacity is an infrastructure result, not a source-code promise.

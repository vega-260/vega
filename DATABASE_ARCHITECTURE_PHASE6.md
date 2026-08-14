# VEGA Database Architecture – Phase 6

## Production topology

- **MySQL primary**: source of truth for writes, authentication, authorization, ownership and read-after-write flows.
- **Optional MySQL read replica**: explicitly selected eventually-consistent reads only (`db.readQuery`).
- **Redis**: read-through cache, BullMQ, distributed locks, rate limiting and realtime coordination. Redis is never the source of truth.
- **Migration identity**: separate from the runtime application identity. API/worker containers should not receive DDL/TRIGGER privileges.

## SQL objects introduced

### Persisted aggregate table
`company_job_pipeline_metrics` stores expensive hiring-pipeline counts per job. MySQL views are not materialized, therefore the aggregate is deliberately persisted and refreshed set-wise.

### Views
- `vw_company_job_pipeline_summary`: stable reporting contract over jobs + persisted pipeline metrics.
- `vw_student_application_overview`: reusable application/job/company/stage read model.
- `vw_tpo_assessment_summary`: normalized TPO assessment reporting view.

Views are `SQL SECURITY INVOKER`; callers cannot gain privileges by selecting through a view.

### Stored procedures
- `sp_refresh_company_job_pipeline_metrics(company_id)`: refresh one company or all companies using one grouped INSERT…SELECT / UPSERT.
- `sp_purge_expired_refresh_tokens(batch_size)`: bounded session cleanup.
- `sp_purge_expired_otps(batch_size)`: bounded OTP cleanup.

Procedures intentionally contain only database-local, set-based operations. Emails, AI work, notifications and complex business orchestration remain in Node/BullMQ.

### Guardrail triggers
- `trg_company_audit_logs_no_update`
- `trg_admin_logs_no_update`

These fire only on attempts to rewrite immutable audit evidence. No trigger is placed on ordinary job/application/assessment writes, avoiding hidden write amplification and lock contention. Deletion is controlled through database permissions/retention policy rather than an irreversible delete trigger.

## Connection management

Application pools are bounded by both `connectionLimit` and `queueLimit`. Default primary pool is 30 connections; replica pool is 20. Do not multiply these defaults blindly across replicas. For example 10 API replicas × 30 plus workers can exceed a 300-connection MySQL server.

Recommended capacity rule:

`sum(all app pools + all worker pools + migrations + monitoring) <= 65-75% of max_connections`

The remaining headroom is for failover, admin access and traffic spikes.

## Transaction/session defaults

- UTC session timezone.
- `READ COMMITTED` transaction isolation to reduce unnecessary gap/next-key contention for this OLTP workload.
- bounded `innodb_lock_wait_timeout`.
- bounded MySQL `max_execution_time` for SELECTs.
- durable server settings remain `innodb_flush_log_at_trx_commit=1` and `sync_binlog=1` in the supplied production template.

## Index strategy

Indexes are query-shaped, not column-by-column. Phase 6 adds indexes for session expiry, OTP expiry, application job/status/id, student application chronology, application history, assessment submissions, interview scheduling, audit retrieval and profile views.

Before deleting or adding further indexes, run:

- `npm run db:audit`
- `npm run db:schema-health`
- `npm run db:explain-critical`

Then validate hot endpoints using `EXPLAIN ANALYZE` on staging with production-like data.

## Partitioning

Phase 6 does **not** blindly partition core relational tables. MySQL partitioning complicates foreign-key design and is not automatically faster. Consider time partitioning only after high-volume append tables reach tens/hundreds of millions of rows and retention queries dominate. At the 100k-user target, correct indexes, caching, replicas and bounded retention are higher-value optimizations.

## Production MySQL parameters

See `config/mysql/mysql8-production.cnf.example`. The file is an 8 GiB dedicated-host baseline, not a universal copy/paste profile. On managed MySQL, apply the equivalent parameter group. The most important parameters to size from actual infrastructure are buffer pool, redo capacity, max connections and IO capacity.

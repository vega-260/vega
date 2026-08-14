# VEGA Database & Performance Optimization — Phase 5

Date: 2026-08-09
Base: VEGA Production Hardened Phase 4

## Goal
Harden the data path for high-volume production traffic without changing business functionality. The work targets query round trips, N+1 patterns, index coverage, repeated read load, DB observability, and horizontal read scaling.

## Implemented

### 1. Explicit read-replica architecture
- `db.query()` remains primary-only for strong-consistency/security-sensitive reads and all writes.
- `db.readQuery()` can use an optional MySQL read replica for explicitly selected eventually-consistent hot reads.
- Migration mode disables replica routing.
- Readiness checks primary and configured read replica independently.
- New envs: `MYSQL_READ_URL`, `DB_READ_POOL_SIZE`, `DB_READ_POOL_MAX_IDLE`.

### 2. Redis application caching
- Added `server/services/cacheService.ts`.
- Read-through JSON cache with bounded TTL.
- Namespace version invalidation avoids expensive Redis `KEYS`/wildcard deletion.
- Cache failures bypass safely to MySQL.
- Public job-list hot path is cached and invalidated on create/update/end/expiry.
- Admin global college analytics uses a short dashboard cache.
- Cache hit/miss/write/invalidation/error metrics are exported.

### 3. N+1 elimination on high-value paths
- Company applicant history: nested application/history/interview/evaluation/submission queries replaced with bounded batch queries and in-memory grouping.
- TPO assessment test listing: assignments and student attempts batch-loaded.
- TPO live assessment monitoring: violations, locations and answer counts batch-loaded.
- Company Drops listing: media batch-loaded for all returned drops.
- Admin company verification queue: documents batch-loaded for all companies.
- Company assessment history: event counts aggregated in SQL rather than queried per attempt.
- Company candidate assignment/auto-distribution: application scope fetched once and assignments written in a transaction.
- Bulk application actions/test scheduling: set-based updates and multi-row inserts replace row-by-row DML.
- Company test question/notification writes use batch inserts.

### 4. Runtime N+1 regression detector
- AsyncLocalStorage tracks DB queries per HTTP request.
- `DB_MAX_QUERIES_PER_REQUEST` defines the warning budget (default 30).
- Exceeding the budget logs request ID, route, query count, and slow-query count.
- Prometheus metric: `vega_db_query_budget_exceeded_total`.

### 5. Query fingerprints & slow-query observability
- Slow SQL is normalized and SHA-256 fingerprinted.
- Logs avoid raw high-cardinality literal values as identifiers.
- Existing DB latency/error metrics remain and are extended with cache/query-budget metrics.

### 6. Query-shaped indexes
Phase 5 migration `20260809_phase5_database_performance` adds indexes only when the table/columns exist. Added/validated index coverage for:
- users role/status/created
- student college/batch
- company status/created
- job stage order
- test questions by stage
- test schedules by job/stage/time
- interview evaluation lookup
- event registration student/status
- talent score user/score
- student-batch relationships
- college batch/status
- company HR job/application assignment scope
- drops and drop media status/time
- assessment assignment/test/attempt/answer/violation/location hot paths

Existing Phase 3 indexes remain for jobs, job applications, notifications, history, submissions, interviews, audit logs, refresh sessions and assessment attempts.

### 7. Job expiry worker scan optimized
The recurring worker no longer scans every OPEN job. It reads only jobs whose deadlines can enter the current expiry/reminder window, and invalidates the job-list cache when a job closes.

### 8. DB performance audit command
Added:

`npm run db:audit`

It reports:
- largest tables by data+index size
- installed indexes/cardinality
- tables without primary keys
- top query digests from MySQL Performance Schema when available

### 9. Database hot-path load test
Added:

`npm run loadtest:db`

with p95/p99/error thresholds for the public jobs/readiness hot path.

## Views / stored procedures / triggers decision
No generic stored procedures or row-level business triggers were added in Phase 5. This is intentional:
- MySQL views are not materialized and do not automatically improve latency.
- triggers add hidden write amplification, lock coupling and harder deployment/debugging under heavy writes.
- stored procedures duplicate application-domain logic and complicate versioned releases unless there is a measured round-trip bottleneck.

The current design uses explicit transactions, set-based DML, Redis, read replicas, query-shaped indexes, and existing precomputed analytics tables. These are better defaults for VEGA's workload. A materialized-summary table should only be added after staging query-digest evidence proves a dashboard aggregate is still a bottleneck.

## Validation
- 41/41 architecture/security/performance regression tests passing.
- 299 TS/TSX files syntax-transpiled: 0 syntax diagnostics.
- Relative import scan: 0 broken imports.
- `npm ci` could not complete in the sandbox because its private registry returns 404 for Sharp's transitive `@img/colour` package. No dependency was removed or weakened to bypass this environment issue.

## Capacity statement
This phase materially reduces MySQL round trips and repeated reads and makes horizontal read scaling possible. It does not mathematically guarantee 100,000 simultaneous active users. That number must be proven on staging with production-sized MySQL/Redis/S3/TURN/API/worker infrastructure and realistic data volumes using k6 plus MySQL query-digest/slow-query telemetry.

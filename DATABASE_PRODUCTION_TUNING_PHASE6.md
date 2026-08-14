# MySQL Production Tuning Checklist – Phase 6

1. Keep InnoDB buffer pool near 60–70% of RAM on a dedicated DB host; reduce when MySQL shares the host.
2. Keep `max_connections` bounded. Scale API instances with smaller pools rather than opening hundreds of connections per process.
3. Keep application queue limits finite so an overloaded DB causes backpressure instead of unbounded memory growth.
4. Use `READ COMMITTED` for the OLTP workload unless a specific transaction requires stronger semantics.
5. Keep `innodb_flush_log_at_trx_commit=1` and `sync_binlog=1` for durable production writes.
6. Enable Performance Schema and slow-query logging. Start `long_query_time` around 500 ms, then lower it after noise is understood.
7. Size `innodb_io_capacity` from measured storage, not CPU count.
8. Avoid large per-connection sort/join buffers; they multiply with concurrency.
9. Use a read replica only for explicitly eventual reads. Authentication/RBAC/ownership always remain on primary.
10. Keep Redis cache TTLs short for frequently changing hiring state, and invalidate by namespace on writes.
11. Use summary tables for genuinely expensive aggregates; normal MySQL views are not materialized caches.
12. Prefer set-based stored procedures only for database-local maintenance/aggregation. Avoid putting external side effects in triggers/procedures.
13. Use separate DB users for runtime, readonly replica access and migrations.
14. Test backup restore and point-in-time recovery before production launch.
15. Load test with production-like row counts; 100k users can generate millions of applications, notifications and audit rows.

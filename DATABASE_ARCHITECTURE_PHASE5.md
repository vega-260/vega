# VEGA Phase 5 Data Architecture

```text
Clients
  |
Nginx / API replicas
  |
  +---- Redis ----------------------------------+
  |      | cache (versioned namespaces)         |
  |      | queues / locks / signaling           |
  |      +---------------------------------------+
  |
  +---- MySQL Primary
  |      | writes
  |      | auth/ownership/session reads
  |      | transactions
  |      +---- replication ----> MySQL Read Replica (optional)
  |                              | explicitly selected hot reads only
  |
  +---- S3/object storage
```

## Consistency rules
1. MySQL Primary is the source of truth.
2. Authentication, authorization, ownership and session reads never depend on replica freshness.
3. Redis cache is disposable and never authoritative.
4. Read replica is opt-in per query via `db.readQuery()`.
5. Cache namespaces are invalidated on business mutations.
6. Migrations run on the primary under a MySQL advisory lock.
7. Expensive repeated analytics should use precomputed tables/worker refresh only after measurement shows a need.

## Recommended production DB topology for high traffic
- Managed MySQL primary: Multi-AZ, automated backups, PITR.
- 1 read replica initially; add replicas only when read pressure justifies it.
- Proxy/pooler if infrastructure supports it.
- API pool: start ~20–30 connections per replica and tune from actual DB wait/CPU metrics.
- Read pool: start ~10–20 per API replica.
- Redis managed HA with persistence/failover.
- Performance Schema enabled for query digest analysis.

## Required release process
1. Backup / snapshot.
2. Run `npm run migrate:prod` once.
3. Run `npm run db:audit`.
4. Deploy API + worker replicas.
5. Verify `/health/ready` and `/internal/metrics`.
6. Run `npm run loadtest:db` and full production-readiness k6 suite.
7. Inspect MySQL top query digests and slow query fingerprints.
8. Add/change indexes only from observed query plans; avoid speculative index sprawl.

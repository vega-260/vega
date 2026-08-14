# VEGA Talent Platform — Production Hardened Phase 3

React + Node/Express + MySQL + Redis/BullMQ platform for Student, Company, TPO and Admin workflows.

## Local development

```bash
cp .env.example .env
npm ci
npm run dev
```

## Production validation

```bash
npm ci
npm run lint
npm test
npm run build
```

Production requires MySQL, Redis, object storage, strong JWT/refresh secrets, approved CORS origins, SMTP, AI credentials and TURN configuration according to `.env.example` and `server/config/env.ts`.

Normal API/worker containers do not perform schema DDL. Run the migration artifact as a deployment step before starting application replicas.

See `PRODUCTION_HARDENING_PHASE3_REPORT_2026-08-08.md` and `PRODUCTION_FILE_STRUCTURE_PHASE3.md`.

## Production Hardening Phase 4

Phase 4 adds dependency-aware readiness/draining, explicit HTTP/Socket.IO runtime controls, DB/queue operational metrics, durable outbound email workers, extracted application ownership policies, stricter intelligence/admin RBAC, refresh/logout origin protection, corrected Nginx Socket.IO/SPA routing, MySQL backup/restore tooling, a staging production-readiness k6 gate, and pre-publish container vulnerability scanning.

See `PRODUCTION_HARDENING_PHASE4_REPORT_2026-08-08.md` and `PRODUCTION_RELEASE_CHECKLIST_PHASE4.md` before staging or production deployment.

## Phase 6 database architecture

Phase 6 adds production MySQL SQL objects, persisted pipeline aggregates, bounded maintenance procedures, audit guardrails, least-privilege DB identities, bounded connection queues, session-level DB safety parameters and DB health/EXPLAIN tooling. See `DATABASE_ARCHITECTURE_PHASE6.md` and `DATABASE_PRODUCTION_PHASE6_REPORT_2026-08-09.md`.

Useful commands:

```bash
npm run build
npm run migrate:prod
npm run db:audit
npm run db:schema-health
npm run db:explain-critical
npm run loadtest:db
```

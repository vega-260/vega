# VEGA Production Hardening — Phase 3

Date: 2026-08-08
Base: VEGA Production Hardened Phase 2

## Phase 3 outcome

Phase 3 converts the largest security/business backend routers into feature modules, separates the production database runtime from schema bootstrap, strengthens worker/migration concurrency behavior, hardens student media uploads, introduces reusable RBAC/error/repository boundaries, improves frontend feature decomposition, and adds measurable staging load profiles.

This is a **production-candidate code baseline**, not proof that a specific infrastructure deployment can sustain 100,000 concurrent users. Capacity requires a successful clean dependency install/build, integration/security tests against real infrastructure, and staged load tests.

## Backend modularization

The following legacy route files are now compatibility exports over focused feature routers:

- `server/routes/company.ts` → `server/features/company/*`
- `server/routes/tpo.ts` → `server/features/tpo/*`
- `server/routes/assessments.ts` → `server/features/assessments/*`
- `server/routes/admin.ts` → `server/features/admin/*`
- `server/routes/student.ts` → `server/features/student/*`

`server/routes/job.ts` was reduced to under ~1,000 lines after Applications/Drops extraction completed across Phase 2/3.

Assessment duplicate Student start/submit route registrations were removed so one canonical handler owns each endpoint.

## Database runtime and migrations

- `server/db.ts` is now a small connection/query/transaction/schema-preflight facade (~200 lines).
- Production API/worker startup does not run DDL.
- Existing schema bootstrap compatibility is isolated under `server/database/legacyDbBootstrap.ts` and only loaded by development/migration flow.
- Production migrations acquire MySQL `GET_LOCK` and record an ID in `schema_migrations`.
- Phase-3 composite indexes cover common notification, job/application, submission, interview, audit and assessment access paths.
- Index migration failures are fatal; failed DDL is not silently recorded as successfully applied.

## Authorization and domain boundaries

- Parent role guards are centralized for Company/TPO/Admin assessment and feature routers.
- Shared RBAC capability helpers were added in `server/security/rbac.ts`.
- Shared typed HTTP/domain errors were added and centralized error handling respects 401/403/404 semantics.
- Company resource ownership/audit access now uses a repository instead of duplicating SQL in authorization helpers.
- Development mock-data seed endpoint returns 404 in production.

## Student media

Student resume/avatar/certificate upload flow now uses:

`Multer memory buffer -> validated type/size -> S3 object -> AES-256 server-side encryption`

Persistent uploads no longer depend on the API container filesystem. SVG avatars were removed from accepted types to avoid unnecessary active-content risk.

## Workers and queues

- API and worker processes remain separated.
- AI evaluation jobs use deterministic SHA-256-based job IDs and BullMQ retries/backoff/retention.
- Singleton maintenance/recovery work uses a Redis distributed lock so multiple worker replicas do not run the same maintenance task concurrently.
- API/worker shutdown closes Redis/queue and DB resources.

## Observability

`/internal/metrics` remains token-protected in production and now exposes:

- uptime
- resident/heap memory
- event-loop p95/max delay
- request totals by 2xx/4xx/5xx class
- in-flight requests
- average request latency
- latency buckets

Request IDs and centralized error handling remain in the Express pipeline.

## Deployment hardening

- Nginx upstream service names are aligned with Docker Compose (`app-service-1/2`).
- App/Compose health checks use Node `fetch`, avoiding external curl/wget assumptions.
- `.dockerignore` excludes secrets, Git data, tests, docs, local databases, uploads and legacy dev utilities from the production image context.
- Root-level one-off developer scripts were moved under `scripts/dev/legacy`.
- Main TypeScript config targets only application/runtime sources; legacy verification utilities no longer pollute application linting.

## Frontend decomposition

- Resume Builder templates were extracted into `src/features/resume-builder/templates/*`; the route page is now primarily editor/state orchestration.
- Company Pipeline reusable UI/utility pieces were extracted under `src/features/company/pipeline/*`.
- Existing auth hardening from Phase 2 remains: access token in memory, refresh token HttpOnly/Secure cookie, session restoration through refresh endpoint.

Several older visual route coordinators are still large. They are not on the backend request/security hot path, and Phase 3 deliberately avoids unsafe mechanical JSX splitting that could change state behavior. They should continue to be decomposed with UI/E2E regression coverage rather than line-count-only edits.

## Load-test assets

- `load-tests/smoke.js`
- `load-tests/api-journey.js`
- `load-tests/company-pipeline.js`

Profiles contain p95/p99/error-rate gates and are intended for an isolated production-like staging environment.

## Validation completed in this environment

- Architecture/security Node tests: **22/22 passed**.
- TS/TSX independent syntax transpilation: **252 files, 0 parse diagnostics**.
- Relative TS/TSX import resolution: **0 broken relative imports**.
- Docker Compose YAML parse: passed.
- package.json/package-lock root dependency parity: passed.
- fallback JWT-secret scan: passed.
- browser `localStorage` token persistence scan: passed.
- Student disk-upload scan: passed.
- Nginx/Compose service naming checked and corrected.

## Environment limitation

A clean `npm ci` / full `npm run build` could not be completed inside this execution environment because its internal npm mirror returns 404 for `@img/colour`, an upstream Sharp package dependency. The project intentionally retains Sharp because removing it would weaken the media pipeline. `node_modules` was therefore not available for a dependency-resolved TypeScript/build run here.

On a machine with the normal npm registry, the release gate is:

```bash
npm ci
npm run lint
npm test
npm run build
```

Then deploy to staging, apply migrations once, run integration/E2E tests, and execute the k6 profiles while observing MySQL, Redis, queue depth, API p95/p99, memory and event-loop lag.

## Production capacity statement

The codebase is now structured much closer to a production modular monolith and is suitable for serious staging/production-candidate validation. It is reasonable to target 100,000 registered/active users with appropriate infrastructure. No responsible engineer should certify **100,000 simultaneous active users** until the exact workload has been load-tested against the actual database, Redis, object storage, TURN and AI-provider limits.

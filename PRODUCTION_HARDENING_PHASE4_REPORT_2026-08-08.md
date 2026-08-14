# VEGA Production Hardening Phase 4

Date: 2026-08-08

## Scope

Phase 4 converts the Phase 3 production candidate into a stronger release candidate focused on operational correctness, graceful deployment behavior, distributed background delivery, security regression gates, edge routing, measurable capacity testing, and recovery operations.

## Implemented

### Runtime lifecycle and readiness
- Added `server/runtime/serviceState.ts` to distinguish liveness from traffic readiness.
- API marks itself ready only after runtime initialization and successful listen.
- API becomes not-ready before HTTP shutdown begins, allowing load balancers/orchestrators to drain it.
- Added dependency-aware readiness under `server/health/dependencyHealth.ts`.
- Readiness checks database, Redis/BullMQ availability, required object-storage configuration, TURN configuration, and drain state.
- Added a short readiness cache to avoid turning health probes into database load.
- Docker/Compose health checks use `/health/ready` rather than only process liveness.

### HTTP and Socket.IO runtime controls
- Explicit Node HTTP request/header/keep-alive timeouts.
- Configurable max requests per socket.
- Configurable Socket.IO ping interval and timeout.
- Socket.IO connection-state recovery enabled while retaining authentication middleware.

### Observability
- Database query count, errors, slow-query count, in-flight queries, and average DB latency are exported on the protected Prometheus endpoint.
- Queue enqueue success/failure counters added.
- Slow database queries are structured through Winston instead of raw console warnings.

### Application authorization structure
- Extracted application/company/student recruiting ownership policies from `server/routes/job.ts` into `server/features/applications/applicationAccessPolicy.ts`.
- `job.ts` is now roughly 800 lines and delegates ownership decisions to a dedicated policy module.
- Fixed `/api/intelligence/admin/questions/*` so Admin/Super Admin authorization is enforced by middleware on every administrative question-management endpoint.
- Fixed analytics profile-view logging so `companyUserId` is derived from the authenticated Company JWT rather than accepted from the request body.

### Session / CSRF hardening
- Added trusted-origin checks for cookie-authenticated `/refresh-token` and `/logout` mutations.
- Production rejects cross-site browser requests using `Sec-Fetch-Site` and allowed-origin validation.
- Authentication and AI distributed rate limits now fail closed in production if the Redis rate-limit store is unavailable. General API limiting remains availability-oriented.

### Durable outbound email
- Added BullMQ `outbound-email` queue.
- Added deterministic SHA-256 email job IDs for idempotency.
- Added retries and exponential backoff.
- Added a dedicated email worker alongside the AI assessment worker.
- Application status, decision-reversal, interview scheduling, and recommendation business emails use the durable queue instead of best-effort API-process sends.
- Development retains a direct-send fallback; production does not silently downgrade to in-process delivery.

### Nginx / edge correctness
- Added a dedicated `/socket.io/` reverse-proxy location with upgrade headers and disabled buffering.
- Fixed the edge SPA behavior: Nginx now proxies frontend/static requests to the application pool that actually contains `dist`, instead of pointing at an empty Nginx filesystem.
- API upstream traffic uses HTTP keep-alive without forcing `Connection: upgrade` on normal requests.
- Request IDs are propagated from Nginx.
- Health/internal routes are separated for clearer operations.

### Frontend structure
- Extracted Student Profile pure UI components, institution autocomplete, shared types, and predefined data into `src/features/student/profile/profilePrimitives.tsx`.
- Reduced `StudentProfile.tsx` from ~2,469 lines to ~2,022 lines without moving its stateful persistence workflows.

### Capacity gates
- Added `load-tests/production-readiness.js` with a mixed Student/Company/public/interview-readiness journey.
- Corrected stale endpoint paths in the earlier API and Company load tests.
- Added `npm run loadtest:production`.
- Added manual GitHub Actions staging load-gate workflow using k6 and staging secrets.

### Backup / restore
- Added transaction-consistent MySQL backup script with compression, integrity verification, and retention.
- Added validated restore script.
- Added operations notes under `scripts/ops/`.
- Managed production MySQL should still enable provider snapshots and point-in-time recovery in addition to these scripts.

### Release security
- CI validates TypeScript, architecture/security tests, production build, Compose rendering, npm high/critical audit, and secret scanning.
- Release candidate Docker image is built locally first.
- Trivy scans the exact release candidate image for HIGH/CRITICAL findings before image publication.
- The image is pushed to GHCR only after the scan passes.

## Validation performed in this environment

- Architecture/security regression tests: **34 / 34 passed**.
- TypeScript/TSX syntax transpilation: **295 files, 0 syntax diagnostics**.
- Relative TypeScript imports: **256 files, 0 missing imports**.
- Docker Compose YAML parse: passed.
- No real `.env` is included in the release ZIP.

## Environment limitation

A full `npm ci` could not complete inside the OpenAI execution environment because its internal npm mirror returns HTTP 404 for `@img/colour`, a transitive dependency used by Sharp. This is an environment registry limitation, not a source-code syntax failure. Sharp was intentionally retained because the media pipeline uses it.

On a normal npm registry, the mandatory release commands remain:

```bash
npm ci
npm run lint
npm test
npm run build
```

Then deploy to staging and run:

```bash
BASE_URL=https://staging.example.com \
STUDENT_TOKEN=... STUDENT_USER_ID=... \
COMPANY_TOKEN=... COMPANY_USER_ID=... \
JOB_ID=... INTERVIEW_ID=... \
npm run loadtest:production
```

## Production claim

Phase 4 is a substantially stronger production release candidate. It is not mathematically possible to certify “100,000 simultaneous active users” from source code alone. That claim must be based on staging load tests against the intended MySQL/Redis/S3/TURN/network topology and measured p95/p99/error-rate/resource saturation results.

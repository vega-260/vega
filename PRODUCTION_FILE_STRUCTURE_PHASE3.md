# VEGA Phase 3 production structure

```text
server/
  app/                 Express composition and route registration
  config/              Validated environment/runtime configuration
  database/            Runtime startup + isolated legacy/bootstrap compatibility
  features/
    admin/              Admin capabilities by business domain
    applications/       Application lifecycle
    assessments/        TPO/Student/Company assessment capabilities
    company/            Company profile, tests, HR, recommendations, settings
    drops/              Company media/drop workflow
    student/            Profile, uploads, privacy, notifications, activity
    tpo/                Dashboard, students, tests, reports, verification, notices
  middleware/           Authentication, authorization, security, error handling
  observability/        Request correlation and Prometheus-format process/API metrics
  realtime/             TURN credentials and realtime infrastructure helpers
  repositories/         Incrementally extracted data-access boundaries
  security/             RBAC capability model
  services/             Cross-feature domain/integration services
  shared/               Errors, validation, cookies and common primitives
  sockets/              Authenticated Socket.IO handlers

src/
  context/              Application/auth context
  features/             Extracted feature-specific UI modules
    company/pipeline/   Pipeline reusable UI + utilities
    resume-builder/     Resume template modules
  pages/                Route-level coordinators and remaining legacy screens
  services/             API/client integrations

scripts/
  dev/legacy/           One-off legacy developer utilities, excluded from prod image/typecheck

load-tests/             k6 staging traffic profiles
tests/                  Architecture/security regression gates
```

## Boundary rules

1. Route compatibility files should only mount/export feature routers.
2. Authentication/role boundaries are applied at feature-router entry points and ownership is rechecked for resource-level access.
3. Reusable database access should move into repositories; business decisions stay in services/controllers/routes.
4. Production API and worker runtimes never create/alter schema. DDL runs through the migration artifact under a MySQL advisory lock.
5. Persistent user media is object-storage backed; API container disks are ephemeral.
6. Workers must use idempotent queue jobs/distributed locks for singleton maintenance work.
7. Route-level React files should coordinate state and compose feature components; large reusable sections belong under `src/features`.

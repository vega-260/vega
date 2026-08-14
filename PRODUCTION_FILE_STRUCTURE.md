# VEGA production-oriented structure

```text
server.ts                         # process bootstrap only
worker.ts                         # background worker process
migrate.ts                        # deployment-time schema/index migration process

server/
  app/
    createApp.ts                  # Express middleware, probes, metrics
    registerRoutes.ts             # one API route registry
  config/
    env.ts                        # validated runtime configuration
  database/
    runtimeStartup.ts             # production connectivity/schema preflight
    sqliteBootstrap.ts            # development-only SQLite bootstrap
  features/
    applications/
      applicationRoutes.ts
      applicationLifecycleRoutes.ts
    drops/
      dropRoutes.ts
      dropMediaService.ts
  middleware/
    auth.ts
    security.ts
    errorHandler.ts
  observability/
    requestContext.ts
    metrics.ts
  realtime/
    turnCredentials.ts
  routes/                         # legacy route entry points; migrate feature-by-feature
  services/                       # reusable domain/infrastructure services
  sockets/                        # authenticated Socket.IO/WebRTC signaling
  shared/
    httpCookies.ts

src/
  context/                        # React state/context
  services/
    api.ts                        # authenticated Axios client + refresh coordination
    tokenStore.ts                 # in-memory access token only
  components/
  pages/

load-tests/
  smoke.js                        # k6 baseline
```

## Refactoring rule
Do not split files only by line count. Extract a module when it has a clear ownership boundary, such as Applications, Drops, Assessments, TPO management, authentication, database migrations, or analytics. Each extraction should preserve authorization and transaction boundaries and should add regression tests before the old code is removed.

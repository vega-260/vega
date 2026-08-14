import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const lines = (file) => read(file).split(/\r?\n/).length;

test("readiness drains before graceful shutdown and server timeouts are explicit", () => {
  const server = read("server.ts");
  const state = read("server/runtime/serviceState.ts");
  assert.match(server, /serviceState\.markReady\(\)/);
  assert.match(server, /serviceState\.beginShutdown\(\)/);
  assert.ok(server.indexOf("serviceState.beginShutdown()") < server.indexOf("httpServer.close"));
  assert.match(server, /httpServer\.requestTimeout = env\.http\.requestTimeoutMs/);
  assert.match(server, /httpServer\.headersTimeout = env\.http\.headersTimeoutMs/);
  assert.match(state, /acceptingTraffic/);
});

test("readiness verifies production dependencies and is used by compose health checks", () => {
  const health = read("server/health/dependencyHealth.ts");
  const compose = read("docker-compose.yml");
  assert.match(health, /db\.pingPrimary\(\)/);
  assert.match(health, /pingReadReplica/);
  assert.match(health, /getQueueHealth\(\)/);
  assert.match(health, /requireObjectStorage/);
  assert.match(health, /requireTurn/);
  assert.match(compose, /health\/ready/);
});

test("database and queue operational metrics are exported", () => {
  const metrics = read("server/observability/metrics.ts");
  const db = read("server/db.ts");
  assert.match(metrics, /vega_db_queries_total/);
  assert.match(metrics, /vega_db_query_errors_total/);
  assert.match(metrics, /vega_queue_enqueue_total/);
  assert.match(db, /recordDbQuery/);
  assert.match(db, /changeDbInFlight/);
});

test("application ownership policy is extracted from the job router", () => {
  const job = read("server/routes/job.ts");
  const policy = read("server/features/applications/applicationAccessPolicy.ts");
  assert.ok(lines("server/routes/job.ts") < 900);
  assert.match(job, /applicationAccessPolicy/);
  assert.match(policy, /requireApplicationAccess/);
  assert.match(policy, /requireCompanyJobAccess/);
  assert.match(policy, /requireStudentRecruitingDataAccess/);
});

test("outbound business emails are durable queued jobs", () => {
  const queue = read("server/services/queueService.ts");
  const worker = read("worker.ts");
  const lifecycle = read("server/features/applications/applicationLifecycleRoutes.ts");
  assert.match(queue, /new Queue\("outbound-email"/);
  assert.match(queue, /createEmailWorker/);
  assert.match(queue, /attempts: 5/);
  assert.match(queue, /jobId: `email-/);
  assert.match(worker, /createEmailWorker\(\)/);
  assert.match(lifecycle, /enqueueEmail/);
});

test("nginx explicitly proxies Socket.IO and proxies the SPA to app nodes", () => {
  const nginx = read("server/config/nginx.conf");
  assert.match(nginx, /location \/socket\.io\//);
  assert.match(nginx, /proxy_set_header Upgrade \$http_upgrade/);
  assert.match(nginx, /location \/ \{/);
  assert.match(nginx, /proxy_pass http:\/\/vega_api_servers/);
  assert.doesNotMatch(nginx, /root \/usr\/share\/nginx\/html/);
});

test("intelligence administration is role-restricted and profile-view identity is server-derived", () => {
  const intelligence = read("server/routes/intelligence.ts");
  const analytics = read("server/routes/analytics.ts");
  const adminRoutes = intelligence.match(/router\.(get|post|put|delete)\("\/admin\/questions[^\n]+/g) || [];
  assert.ok(adminRoutes.length >= 5);
  for (const route of adminRoutes) assert.match(route, /authorize\(\["ADMIN", "SUPER_ADMIN"\]\)/);
  assert.match(analytics, /router\.post\("\/profile-view", authenticate, authorize\(\["COMPANY"\]\)/);
  assert.match(analytics, /companyUserId = Number\(req\.user\.userId\)/);
});

test("student profile route page delegates pure UI primitives to a feature module", () => {
  assert.ok(fs.existsSync("src/features/student/profile/profilePrimitives.tsx"));
  assert.match(read("src/pages/StudentProfile.tsx"), /profilePrimitives/);
  assert.ok(lines("src/pages/StudentProfile.tsx") < 2100);
});

test("production load gate and backup/restore operations are included", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["loadtest:production"], "k6 run load-tests/production-readiness.js");
  assert.ok(fs.existsSync("scripts/ops/backup-mysql.sh"));
  assert.ok(fs.existsSync("scripts/ops/restore-mysql.sh"));
  assert.match(read("scripts/ops/backup-mysql.sh"), /--single-transaction/);
  assert.match(read("scripts/ops/restore-mysql.sh"), /gzip -t/);
});

test("cookie-authenticated session mutations reject untrusted browser origins", () => {
  const security = read("server/middleware/security.ts");
  const auth = read("server/routes/auth.ts");
  assert.match(security, /requireTrustedBrowserOrigin/);
  assert.match(security, /sec-fetch-site/);
  assert.match(auth, /router\.post\("\/refresh-token", requireTrustedBrowserOrigin/);
  assert.match(auth, /router\.post\("\/logout", requireTrustedBrowserOrigin/);
});

test("security-sensitive distributed rate limits fail closed in production", () => {
  const security = read("server/middleware/security.ts");
  const matches = security.match(/passOnStoreError: process\.env\.NODE_ENV !== "production"/g) || [];
  assert.ok(matches.length >= 2, "auth and AI limits should fail closed when Redis is unavailable in production");
});

test("release CI scans the exact container before publishing and exposes a staging load gate", () => {
  const ci = read(".github/workflows/devsecops.yml");
  const load = read(".github/workflows/staging-load-gate.yml");
  assert.match(ci, /trivy-action/);
  assert.match(ci, /exit-code: '1'/);
  assert.ok(ci.indexOf("Scan release candidate image") < ci.indexOf("Push scanned image"));
  assert.match(load, /production-readiness\.js/);
});

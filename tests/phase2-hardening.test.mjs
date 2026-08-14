import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

test("refresh tokens use HttpOnly cookie and are not returned by production auth responses", () => {
  const auth = read("server/routes/auth.ts");
  const cookies = read("server/shared/httpCookies.ts");
  assert.match(cookies, /httpOnly:\s*true/);
  assert.match(cookies, /secure:\s*env\.cookie\.secure/);
  assert.match(auth, /setRefreshCookie\(res, refreshToken\)/);
  assert.doesNotMatch(auth, /data:\s*\{[\s\S]{0,200}refreshToken/);
});

test("React no longer persists access or refresh tokens in localStorage", () => {
  const authContext = read("src/context/AuthContext.tsx");
  const api = read("src/services/api.ts");
  assert.doesNotMatch(authContext, /localStorage\.setItem\(["']token["']/);
  assert.doesNotMatch(authContext, /refreshToken/);
  assert.match(api, /getAccessToken\(\)/);
  assert.match(api, /withCredentials:\s*true/);
});

test("TURN credentials are generated behind authenticated interview API", () => {
  const interview = read("server/routes/interview.ts");
  const turn = read("server/realtime/turnCredentials.ts");
  assert.match(interview, /router\.get\("\/ice-config", authenticate/);
  assert.match(turn, /createHmac\("sha1"/);
  assert.match(turn, /TURN_SHARED_SECRET|turn\.sharedSecret/);
});

test("server bootstrap is modularized", () => {
  const server = read("server.ts");
  assert.ok(fs.existsSync("server/app/createApp.ts"));
  assert.ok(fs.existsSync("server/app/registerRoutes.ts"));
  assert.ok(fs.existsSync("server/observability/metrics.ts"));
  assert.match(server, /createApp\(\)/);
  assert.match(server, /assertProductionEnvironment\(\)/);
});

test("drops are isolated from the job router and cloud-approved in production", () => {
  const job = read("server/routes/job.ts");
  const drops = read("server/features/drops/dropMediaService.ts");
  const dropRoutes = read("server/features/drops/dropRoutes.ts");
  assert.match(job, /registerDropRoutes\(router/);
  assert.match(drops, /uploadToCloudBucket/);
  assert.match(dropRoutes, /getCloudObjectByUrl/);
  assert.doesNotMatch(dropRoutes, /fallback_secret/);
});

test("database bootstrap is isolated from the production runtime", () => {
  assert.ok(fs.existsSync("server/database/sqliteBootstrap.ts"));
  assert.ok(fs.existsSync("server/database/legacyDbBootstrap.ts"));
  const db = read("server/db.ts");
  assert.match(db, /NODE_ENV === "production"[\s\S]*RUN_DB_MIGRATIONS/);
  assert.match(db, /await db\.ping\(\)/);
  assert.match(db, /import\("\.\/database\/legacyDbBootstrap\.ts"\)/);
  assert.doesNotMatch(db, /CREATE TABLE/i);
});

test("metrics and request correlation are available", () => {
  const app = read("server/app/createApp.ts");
  assert.match(app, /requestContext/);
  assert.match(app, /metricsMiddleware/);
  assert.match(app, /\/internal\/metrics/);
});

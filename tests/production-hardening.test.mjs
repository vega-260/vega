import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

test("production auth has no hard-coded production fallback secret", () => {
  const source = read("server/services/authService.ts");
  assert.match(source, /NODE_ENV === "production"/);
  assert.doesNotMatch(source, /vega_secure_prod_secret|vega_refresh_prod_secret/);
});

test("production server runs compiled output", () => {
  const dockerfile = read("Dockerfile");
  assert.match(dockerfile, /CMD \["node", "dist\/server\.cjs"\]/);
  assert.doesNotMatch(dockerfile, /npx.*tsx.*server\.ts/);
});

test("background worker is a separate compiled process", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["start:worker"], "node dist/worker.cjs");
  assert.ok(fs.existsSync("worker.ts"));
});

test("production object storage does not silently fall back to local disk", () => {
  const source = read("server/services/storageService.ts");
  assert.match(source, /AWS S3 storage configuration is required in production/);
  assert.match(source, /Development-only local fallback/);
});

test("student job application identity is derived from JWT", () => {
  const source = read("server/features/applications/applicationRoutes.ts");
  assert.match(source, /SELECT id FROM student_profiles WHERE user_id = \? LIMIT 1/);
  assert.match(source, /router\.post\("\/apply", authenticate, authorize\(\["STUDENT"\]\)/);
});

test("websocket authentication is installed before interview handlers", () => {
  const source = read("server.ts");
  const authIndex = source.indexOf("installSocketAuthentication(io)");
  const interviewIndex = source.indexOf("setupInterviewSocket(io)");
  assert.ok(authIndex >= 0 && interviewIndex > authIndex);
});

test("public registration cannot create privileged roles", () => {
  const source = read("server/routes/auth.ts");
  assert.match(source, /\["STUDENT", "COMPANY"\]\.includes\(role\)/);
  assert.match(source, /cannot be created through public registration/);
});

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500", "p(99)<1000"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const live = http.get(`${BASE_URL}/health/live`);
  check(live, { "liveness 200": (r) => r.status === 200 });
  const jobs = http.get(`${BASE_URL}/api/jobs`);
  check(jobs, { "public jobs is non-5xx": (r) => r.status < 500 });
  sleep(1);
}

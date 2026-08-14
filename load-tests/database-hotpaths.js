import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const errors = new Rate('db_hotpath_errors');
const latency = new Trend('db_hotpath_latency', true);

export const options = {
  scenarios: {
    read_hotpaths: {
      executor: 'ramping-vus',
      startVUs: 20,
      stages: [
        { duration: '1m', target: Number(__ENV.DB_TEST_VUS || 200) },
        { duration: '3m', target: Number(__ENV.DB_TEST_VUS || 200) },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    db_hotpath_errors: ['rate<0.01'],
    db_hotpath_latency: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/jobs?status=OPEN&limit=100`],
    ['GET', `${BASE_URL}/health/ready`],
  ]);
  for (const response of responses) {
    latency.add(response.timings.duration);
    const ok = check(response, { 'hotpath status is healthy': (r) => r.status >= 200 && r.status < 500 });
    errors.add(!ok || response.status >= 500);
  }
  sleep(0.2);
}

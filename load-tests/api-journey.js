import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || '';
const STUDENT_USER_ID = __ENV.STUDENT_USER_ID || '';
const failures = new Rate('journey_failures');
const duration = new Trend('journey_duration', true);

export const options = {
  scenarios: {
    authenticated_journey: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Number(__ENV.VUS_1 || 100) },
        { duration: '3m', target: Number(__ENV.VUS_2 || 500) },
        { duration: '3m', target: Number(__ENV.VUS_3 || 1000) },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    journey_failures: ['rate<0.01'],
    http_req_duration: ['p(95)<750', 'p(99)<1500'],
  },
};

const headers = ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : {};

export default function () {
  const started = Date.now();
  const calls = [
    http.get(`${BASE_URL}/health/live`),
    http.get(`${BASE_URL}/api/jobs`, { headers }),
    ...(STUDENT_USER_ID ? [http.get(`${BASE_URL}/api/students/profile/${STUDENT_USER_ID}`, { headers })] : []),
    http.get(`${BASE_URL}/api/students/notifications`, { headers }),
  ];
  const ok = calls.every((res) => check(res, { 'status below 500': (r) => r.status < 500 }));
  failures.add(!ok);
  duration.add(Date.now() - started);
  sleep(Math.random() * 2 + 0.5);
}

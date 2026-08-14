import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.COMPANY_TOKEN || '';
const JOB_ID = __ENV.JOB_ID || '';
const COMPANY_USER_ID = __ENV.COMPANY_USER_ID || '';

export const options = {
  scenarios: {
    company_dashboard: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: Number(__ENV.MAX_VUS || 1000),
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 150 },
        { duration: '2m', target: 300 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1600'],
  },
};

export default function () {
  if (!TOKEN || !COMPANY_USER_ID) throw new Error('COMPANY_TOKEN and COMPANY_USER_ID are required');
  const headers = { Authorization: `Bearer ${TOKEN}` };
  const responses = [
    http.get(`${BASE_URL}/api/company/profile/${COMPANY_USER_ID}`, { headers }),
  ];
  if (JOB_ID) responses.push(http.get(`${BASE_URL}/api/jobs/applicants/${JOB_ID}`, { headers }));
  responses.forEach((r) => check(r, { 'request succeeded': (x) => x.status >= 200 && x.status < 500 }));
  sleep(1);
}

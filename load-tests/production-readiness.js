import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const STUDENT_TOKEN = __ENV.STUDENT_TOKEN || '';
const STUDENT_USER_ID = __ENV.STUDENT_USER_ID || '';
const COMPANY_TOKEN = __ENV.COMPANY_TOKEN || '';
const COMPANY_USER_ID = __ENV.COMPANY_USER_ID || '';
const JOB_ID = __ENV.JOB_ID || '';
const INTERVIEW_ID = __ENV.INTERVIEW_ID || '';

const journeyErrors = new Rate('vega_journey_errors');
const journeyMs = new Trend('vega_journey_ms', true);

export const options = {
  scenarios: {
    mixed_read_traffic: {
      executor: 'ramping-arrival-rate',
      startRate: Number(__ENV.START_RPS || 10),
      timeUnit: '1s',
      preAllocatedVUs: Number(__ENV.PRE_VUS || 100),
      maxVUs: Number(__ENV.MAX_VUS || 2000),
      stages: [
        { duration: __ENV.STAGE_1 || '1m', target: Number(__ENV.RPS_1 || 50) },
        { duration: __ENV.STAGE_2 || '3m', target: Number(__ENV.RPS_2 || 150) },
        { duration: __ENV.STAGE_3 || '3m', target: Number(__ENV.RPS_3 || 300) },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    vega_journey_errors: ['rate<0.01'],
    http_req_duration: ['p(95)<750', 'p(99)<1500'],
    checks: ['rate>0.99'],
  },
};

function auth(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

function successful(res) {
  return res.status >= 200 && res.status < 400;
}

export default function () {
  const started = Date.now();
  let failed = false;

  group('platform-readiness', () => {
    const live = http.get(`${BASE_URL}/health/live`);
    const ready = http.get(`${BASE_URL}/health/ready`);
    failed ||= !check(live, { 'live 200': (r) => r.status === 200 });
    failed ||= !check(ready, { 'ready 200': (r) => r.status === 200 });
  });

  group('public-jobs', () => {
    const jobs = http.get(`${BASE_URL}/api/jobs`);
    failed ||= !check(jobs, { 'jobs available': successful });
  });

  if (STUDENT_TOKEN && STUDENT_USER_ID) {
    group('student-read-path', () => {
      const profile = http.get(`${BASE_URL}/api/students/profile/${STUDENT_USER_ID}`, auth(STUDENT_TOKEN));
      const notifications = http.get(`${BASE_URL}/api/students/notifications`, auth(STUDENT_TOKEN));
      failed ||= !check(profile, { 'student profile ok': successful });
      failed ||= !check(notifications, { 'student notifications ok': successful });
    });
  }

  if (COMPANY_TOKEN && COMPANY_USER_ID) {
    group('company-read-path', () => {
      const profile = http.get(`${BASE_URL}/api/company/profile/${COMPANY_USER_ID}`, auth(COMPANY_TOKEN));
      failed ||= !check(profile, { 'company profile ok': successful });
      if (JOB_ID) {
        const applicants = http.get(`${BASE_URL}/api/jobs/applicants/${JOB_ID}`, auth(COMPANY_TOKEN));
        failed ||= !check(applicants, { 'company applicants ok': successful });
      }
    });
  }

  if (STUDENT_TOKEN && INTERVIEW_ID) {
    group('interview-readiness', () => {
      const ice = http.get(`${BASE_URL}/api/interviews/ice-config`, auth(STUDENT_TOKEN));
      failed ||= !check(ice, { 'ICE config ok': successful });
    });
  }

  journeyErrors.add(failed);
  journeyMs.add(Date.now() - started);
  sleep(Math.random() * 1.5 + 0.25);
}

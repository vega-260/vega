# VEGA staging load tests

Run these only against an isolated staging environment with production-like MySQL, Redis, S3 and worker infrastructure. Do not point them at a developer laptop or production without an approved test window.

```bash
k6 run -e BASE_URL=https://staging.example.com -e ACCESS_TOKEN=... load-tests/api-journey.js
k6 run -e BASE_URL=https://staging.example.com -e COMPANY_TOKEN=... -e JOB_ID=123 load-tests/company-pipeline.js
```

Pass gates: HTTP failure rate <1%, p95 <750–800 ms for these read-heavy scenarios, p99 <1.5–1.6 s, stable DB/Redis connection counts, no sustained queue growth, and no unbounded memory/event-loop lag. Increase traffic in measured steps; "100k users" must be defined as registered, daily active, or concurrent before capacity claims are made.

# N+1 Query Audit — Phase 5

Phase 5 removes the major read-side N+1 patterns found in high-traffic recruiting, assessment, moderation and Drops endpoints. It also adds a runtime per-request query budget so newly introduced N+1 patterns are visible in logs/metrics.

## Fixed high-impact paths
- Company applicant history
- TPO assessment listing
- Student assessment attempt hydration
- TPO live assessment monitor
- Company Drops media hydration
- Admin pending-company documents
- Company assessment submission event counts
- Company candidate assignment/auto-distribution
- Bulk applicant lifecycle actions
- Bulk/single test notification fan-out

## Intentional loops that remain
Some loops perform bounded writes (question creation, profile child records, notification fan-out, maintenance cleanup). These are not automatically N+1 read bugs. Where volume can be large, Phase 5 converted them to set-based/multi-row DML. Remaining bounded business writes should be measured with the runtime query budget before additional complexity is introduced.

## Runtime guard
`DB_MAX_QUERIES_PER_REQUEST=30`

Requests exceeding the limit emit `vega_db_query_budget_exceeded_total` and a structured warning with request ID and route.

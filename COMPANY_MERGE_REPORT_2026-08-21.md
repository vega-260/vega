# VEGA Company Portal Merge Report — 2026-08-21

## Merge decision

Base project: `vega_app` (kept as the source of truth).
Company source: `TB-TPO-Company-Merged`.

This is **not a minimal/manual merge**. The Company update spans the Company UI plus shared application, assessment, analytics, interview, storage, authorization, and database code. Copying the friend's whole project over `vega_app` would regress newer Admin/TPO/Student and infrastructure work in the main project.

The merge therefore uses `vega_app` as the base, imports the friend's latest Company UI, and adapts the friend's Company backend behavior into the newer modular backend already present in `vega_app`.

## Friend updates incorporated

The merge includes the Company-side work represented by the friend's post-Aug-8 updates, including the large 2026-08-15 Company hardening update and the Aug-19/Aug-21 hired analytics, interview scheduling/status, dashboard null-safety, and dashboard empty-state fixes.

## Company frontend

The following Company frontend files in this merged project match the friend's latest files exactly:

- `src/pages/company/*`
- `src/components/company/*`
- `src/pages/CompanyProfile.tsx`
- `src/pages/dashboards/CompanyDashboard.tsx`

Only files that actually differ from the original `vega_app` appear in the changed-file list below. Company files that were already identical were left untouched.

The newer `vega_app` `src/pages/interview/LiveInterviewRoom.tsx` was intentionally preserved instead of replacing it with the friend's older transport variant, because the main project already has authenticated Socket.IO, ephemeral TURN credentials, and Redis interview bridging. The friend's stricter interview authorization/evaluation behavior was merged into the backend and socket authorization without removing this newer infrastructure.

## Important backend behavior merged

- Company verification document deletion, including storage deletion, completeness recalculation, and audit logging.
- Assessment bulk question import for CSV/JSON/TXT with parsing, validation, and size protection.
- Company/Sub-HR pipeline authorization and assignment-scope enforcement.
- Company bulk pipeline action and bulk test scheduling behavior while preserving the main project's Admin/SuperAdmin paths.
- Correct handling of missing/invalid talent scores (`Not available` instead of silently converting to zero).
- Application-bound candidate detail endpoint.
- Candidate full-detail/history access restricted to the assigned Sub-HR scope.
- `hired_at` tracking for SELECTED/HIRED, rejection, movement, and undo flows.
- Company analytics uses the real `hired_at` value.
- Interview scheduling now resolves candidate email from `users.email` rather than a profile email field.
- Interview authorization hardened for Company/Sub-HR access.
- Interview AI evaluation no longer fabricates a positive fallback in normal production when the AI/transcript is unavailable; failure is surfaced truthfully.
- WebRTC socket authorization now respects Company/Sub-HR assignment scope while retaining the main project's Redis bridge and authenticated socket architecture.
- Dashboard handling for null metrics and sparse/empty Active Jobs data is from the friend's latest Company dashboard.
- SQLite database path supports both `SQLITE_FILE` and `SQLITE_DB_PATH`.

## Key API additions / updates

- `DELETE /api/companies/profile/:userId/documents/:type`
- `POST /api/assessments/company/bulk-import-questions`
- `GET /api/jobs/applications/:applicationId/candidate-detail`
- Company behavior for `POST /api/jobs/bulk-action`
- Company behavior for `POST /api/jobs/schedule-test-bulk`
- Updated `POST /api/jobs/applications/schedule-interview`
- Updated Company analytics and interview APIs under `/api/analytics` and `/api/interviews`

## Files changed from the original vega_app

### Existing files modified

1. `server/database/sqliteBootstrap.ts`
2. `server/db.ts`
3. `server/features/applications/applicationAccessPolicy.ts`
4. `server/features/applications/applicationLifecycleRoutes.ts`
5. `server/features/applications/applicationRoutes.ts`
6. `server/features/assessments/companyDefinitionRoutes.ts`
7. `server/features/company/profileRoutes.ts`
8. `server/routes/analytics.ts`
9. `server/routes/interview.ts`
10. `server/routes/job.ts`
11. `server/services/companyAnalyticsMetricsService.ts`
12. `server/services/pipelineSnapshotService.ts`
13. `server/services/storageService.ts`
14. `server/sockets/webrtc-interview.ts`
15. `src/components/company/CandidateDetailModal.tsx`
16. `src/components/company/CandidateTable.tsx`
17. `src/components/company/CompanyLayout.tsx`
18. `src/pages/CompanyProfile.tsx`
19. `src/pages/company/ActiveJobsPage.tsx`
20. `src/pages/company/ApplicantsPage.tsx`
21. `src/pages/company/CompanyAssessments.tsx`
22. `src/pages/company/CompanySettingsPage.tsx`
23. `src/pages/company/HrManagement.tsx`
24. `src/pages/company/PipelineBoard.tsx`
25. `src/pages/dashboards/CompanyDashboard.tsx`

### New backend service files

1. `server/services/assessmentBulkImportService.ts`
2. `server/services/companyDocumentService.ts`
3. `server/services/companyPipelineAuthorizationService.ts`
4. `server/services/companyPipelineBulkActionService.ts`
5. `server/services/companyTalentScoreService.ts`
6. `server/services/interviewAuthorizationService.ts`
7. `server/services/interviewEvaluationService.ts`

## What was deliberately NOT copied from the friend's project

- The friend's whole `server.ts`, monolithic route architecture, or package files.
- The friend's database/runtime files.
- The friend's older shared Student/TPO/Admin code.
- The friend's WebRTC transport replacement that would remove the main project's newer authenticated socket/TURN/Redis implementation.
- Friend-side changes that weakened authentication on shared endpoints.

## Validation performed

- Compared the complete Company page/component folders against the friend's latest project: Company UI matches.
- Confirmed `CompanyProfile.tsx` and `CompanyDashboard.tsx` match the friend's latest versions.
- Confirmed the main project's `LiveInterviewRoom.tsx` remains preserved.
- Parsed all `server` and `src` TypeScript/TSX source files with TypeScript 5.8.3: **268 files parsed, 0 syntax errors**.
- Checked all relative TypeScript/TSX imports: **0 missing relative imports**.
- Checked for Git merge-conflict markers: none found.
- Confirmed MySQL already contains the `hired_at` migration and added the equivalent SQLite bootstrap migration.
- Confirmed the existing main `package.json` already contains required packages such as `papaparse`; no package replacement was required.

### Build limitation in this sandbox

A full `npm ci` / Vite build could not be completed because the sandbox could not reach the npm registry (`EAI_AGAIN` DNS/network failures). Therefore this report does **not** claim a completed dependency-backed production build. The source-level syntax/import validation above did complete successfully.

On your local machine, run:

```bash
npm install
npm run lint
npm run build
```

Then test the Company login and these flows in order: Dashboard → Active Jobs → Applicants/Pipeline → candidate details → stage move/select/reject/undo → assessments/bulk import → interview scheduling → Company profile document upload/delete → analytics.

## Recommendation

Use the provided merged project rather than performing this merge manually. If manual application is required, use the generated `COMPANY_MERGE_2026-08-21.patch` against the exact uploaded `vega_app` baseline, then run the validation commands above.

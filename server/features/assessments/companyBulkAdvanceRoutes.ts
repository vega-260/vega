import express from "express";
import db from "../../db.ts";
import { authenticate, authorize } from "../../middleware/auth.ts";
import { getCompanyContext } from "./assessmentContext.ts";
const router = express.Router();
router.use(authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]));
// POST /api/assessments/company/bulk-advance
router.post("/company/bulk-advance", authenticate, async (req: any, res) => {
  try {
    const { applications, applicationIds, expectedCurrentStageId, targetStageId, companyId, jobId } = req.body;
    const companyCtx = await getCompanyContext(req.user.userId || req.user.id);

    if (targetStageId !== undefined || companyId !== undefined || jobId !== undefined) {
      return res.status(400).json({
        success: false,
        message: "Legacy payload fields (targetStageId, companyId, jobId) are not allowed."
      });
    }

    if (expectedCurrentStageId !== undefined && Array.isArray(applicationIds) && applicationIds.length > 1) {
      return res.status(400).json({
        success: false,
        message: "Shared top-level expectedCurrentStageId for multi-job batch is rejected. Provide application-specific expectedCurrentStageId inside applications array."
      });
    }

    let itemsToProcess: { applicationId: number; expectedCurrentStageId?: number }[] = [];
    if (Array.isArray(applications) && applications.length > 0) {
      itemsToProcess = applications;
    } else if (Array.isArray(applicationIds) && applicationIds.length > 0) {
      itemsToProcess = applicationIds.map((id: number) => ({
        applicationId: id,
        expectedCurrentStageId: expectedCurrentStageId
      }));
    } else {
      return res.status(400).json({ success: false, message: "applications array is required" });
    }

    const results: any[] = [];

    for (const item of itemsToProcess) {
      const appId = item.applicationId;
      try {
        const [appRows]: any = await db.query(`
          SELECT a.id, a.job_id, a.current_stage_id, a.status as app_status, j.company_id, j.status as job_status
          FROM job_applications a
          JOIN jobs j ON a.job_id = j.id
          WHERE a.id = ?
        `, [appId]);

        if (appRows.length === 0) {
          results.push({ applicationId: appId, success: false, message: "Application not found" });
          continue;
        }

        const app = appRows[0];
        if (companyCtx && app.company_id !== companyCtx.companyId) {
          results.push({ applicationId: appId, success: false, message: "Company unauthorized" });
          continue;
        }

        if (String(app.job_status || '').toUpperCase() === 'ENDED' || String(app.job_status || '').toUpperCase() === 'CLOSED') {
          results.push({ applicationId: appId, success: false, code: "JOB_ENDED_READ_ONLY", message: "Candidates in an ended job are read-only." });
          continue;
        }

        if (app.app_status === 'REJECTED' || app.app_status === 'CANCELLED' || app.app_status === 'OFFERED' || app.app_status === 'SELECTED' || app.app_status === 'HIRED') {
          results.push({ applicationId: appId, success: false, message: "Cannot advance candidate in terminal status" });
          continue;
        }

        if (item.expectedCurrentStageId !== undefined && item.expectedCurrentStageId !== null && app.current_stage_id !== item.expectedCurrentStageId) {
          results.push({ applicationId: appId, success: false, message: `Stale stage detected: expected stage ${item.expectedCurrentStageId} but candidate is at stage ${app.current_stage_id}` });
          continue;
        }

        // Verify active assignment
        const [assns]: any = await db.query(`
          SELECT caa.id, caa.cutoff_score FROM company_assessment_assignments caa
          WHERE caa.job_id = ? AND caa.status = 'ACTIVE' AND (caa.stage_id IS NULL OR caa.stage_id = ?)
        `, [app.job_id, app.current_stage_id]);

        if (assns.length === 0) {
          results.push({ applicationId: appId, success: false, message: "No active assessment assignment found for candidate stage" });
          continue;
        }

        // Verify completed passing attempt in test_submissions
        const [subs]: any = await db.query(`
          SELECT * FROM test_submissions
          WHERE application_id = ? AND status = 'COMPLETED'
          ORDER BY id DESC LIMIT 1
        `, [appId]);

        if (subs.length === 0) {
          results.push({ applicationId: appId, success: false, message: "Candidate has not completed assessment" });
          continue;
        }

        const sub = subs[0];
        const requiredCutoff = assns[0]?.cutoff_score !== undefined ? Number(assns[0].cutoff_score) : Number(sub.cutoff_score || 0);
        if (sub.passed !== 1 && Number(sub.score) < requiredCutoff) {
          results.push({ applicationId: appId, success: false, message: "Candidate failed assessment cutoff score" });
          continue;
        }

        // Fetch stages and advance
        const [stages]: any = await db.query("SELECT id, stage_order FROM job_stages WHERE job_id = ? ORDER BY stage_order ASC, id ASC", [app.job_id]);
        const currentIdx = stages.findIndex((s: any) => Number(s.id) === Number(app.current_stage_id));

        if (currentIdx === -1 || currentIdx >= stages.length - 1) {
          results.push({ applicationId: appId, success: false, message: "No next stage available" });
          continue;
        }

        const nextStage = stages[currentIdx + 1];

        await db.query("UPDATE job_applications SET current_stage_id = ? WHERE id = ?", [nextStage.id, appId]);
        await db.query(`
          INSERT INTO application_history (application_id, stage_id, action, notes)
          VALUES (?, ?, 'BULK_ADVANCE', 'Advanced candidate via Bulk Assessment Advance')
        `, [appId, nextStage.id]);

        results.push({ applicationId: appId, success: true, previousStageId: app.current_stage_id, newStageId: nextStage.id });
      } catch (err: any) {
        results.push({ applicationId: appId, success: false, message: err.message });
      }
    }

    res.json({
      success: true,
      message: `Processed bulk advance for ${itemsToProcess.length} candidates.`,
      results
    });
  } catch (error: any) {
    console.error("Error in POST /api/assessments/company/bulk-advance:", error);
    res.status(500).json({ success: false, message: "Failed to perform bulk advance" });
  }
});

export default router;

import db from "../db.ts";
import { CompanyContext, canAccessApplication, isJobEnded } from "./companyPipelineAuthorizationService.ts";

export interface BulkActionResultItem {
  applicationId: number;
  success: boolean;
  code: string;
  message: string;
  previousStageId?: number | null;
  currentStageId?: number | null;
  previousStatus?: string | null;
  currentStatus?: string | null;
}

export interface BulkActionResultSummary {
  success: boolean;
  code?: string;
  message?: string;
  summary: {
    requested: number;
    succeeded: number;
    failed: number;
  };
  results: BulkActionResultItem[];
}

const ALLOWED_BULK_ACTIONS = new Set([
  'ADVANCE',
  'REJECT',
  'REJECTED',
  'SHORTLIST',
  'SHORTLISTED',
  'SELECT',
  'SELECTED',
  'HIRE',
  'HIRED',
  'MOVE_STAGE',
  'UNDO_STAGE',
  'UNDO_DECISION'
]);

export async function executeBulkPipelineAction(
  ctx: CompanyContext,
  params: {
    applicationIds: number[];
    action: string;
    stageId?: number | null;
    notes?: string;
    feedback?: string;
    expectedCurrentStageId?: number | null;
    notifyCandidate?: boolean;
  }
): Promise<BulkActionResultSummary> {
  const { applicationIds, action, stageId, notes, feedback, expectedCurrentStageId, notifyCandidate } = params;

  if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
    return {
      success: false,
      code: "INVALID_BULK_REQUEST",
      message: "applicationIds must be a non-empty array",
      summary: { requested: 0, succeeded: 0, failed: 0 },
      results: []
    };
  }

  if (applicationIds.length > 100) {
    return {
      success: false,
      code: "INVALID_BULK_REQUEST",
      message: "Maximum 100 applications allowed per bulk request",
      summary: { requested: applicationIds.length, succeeded: 0, failed: applicationIds.length },
      results: []
    };
  }

  const cleanAction = String(action || '').toUpperCase().trim();
  if (!ALLOWED_BULK_ACTIONS.has(cleanAction)) {
    return {
      success: false,
      code: "INVALID_ACTION",
      message: `Invalid action "${action}". Allowed actions: ${Array.from(ALLOWED_BULK_ACTIONS).join(', ')}`,
      summary: { requested: applicationIds.length, succeeded: 0, failed: applicationIds.length },
      results: []
    };
  }

  // Deduplicate application IDs
  const uniqueAppIds = Array.from(new Set(applicationIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0)));
  if (uniqueAppIds.length === 0) {
    return {
      success: false,
      code: "INVALID_BULK_REQUEST",
      message: "No valid application IDs provided",
      summary: { requested: applicationIds.length, succeeded: 0, failed: applicationIds.length },
      results: []
    };
  }

  const results: BulkActionResultItem[] = [];
  let succeededCount = 0;
  let failedCount = 0;

  for (const appId of uniqueAppIds) {
    try {
      const accessCheck = await canAccessApplication(ctx, appId);
      if (!accessCheck.canAccess || !accessCheck.app) {
        failedCount++;
        results.push({
          applicationId: appId,
          success: false,
          code: "APPLICATION_NOT_ACCESSIBLE",
          message: "Application not accessible or unauthorized"
        });
        continue;
      }

      const app = accessCheck.app;

      // Check job lifecycle
      if (isJobEnded(app.job_status, app.job_deadline, app.job_ended_at)) {
        failedCount++;
        results.push({
          applicationId: appId,
          success: false,
          code: "JOB_READ_ONLY",
          message: `The recruitment pipeline for position "${app.job_title}" has ended. Updates are read-only.`
        });
        continue;
      }

      // Check optimistic concurrency if expectedCurrentStageId is provided
      if (expectedCurrentStageId !== undefined && expectedCurrentStageId !== null) {
        if (Number(app.current_stage_id) !== Number(expectedCurrentStageId)) {
          failedCount++;
          results.push({
            applicationId: appId,
            success: false,
            code: "STALE_APPLICATION_STATE",
            message: "Application stage has changed concurrently."
          });
          continue;
        }
      }

      // Validate target stage belongs to job if stageId is passed
      let verifiedStageId = stageId ? Number(stageId) : null;
      if (verifiedStageId) {
        const [stageRows]: any = await db.query(
          "SELECT id FROM job_stages WHERE id = ? AND job_id = ?",
          [verifiedStageId, app.job_id]
        );
        if (!stageRows || stageRows.length === 0) {
          failedCount++;
          results.push({
            applicationId: appId,
            success: false,
            code: "INVALID_STAGE",
            message: "Specified stage does not belong to target job"
          });
          continue;
        }
      }

      // Determine new stage & status based on action
      let targetStatus = app.status || 'IN_PROGRESS';
      let targetStageId = verifiedStageId || app.current_stage_id;
      const prevStatus = app.status;
      const prevStageId = app.current_stage_id;

      const cleanNotes = notes ? String(notes).trim().slice(0, 1000) : null;
      const cleanFeedback = feedback ? String(feedback).trim().slice(0, 1000) : cleanNotes;

      if (cleanAction === 'REJECT' || cleanAction === 'REJECTED') {
        targetStatus = 'REJECTED';
        const rejStageId = targetStageId || app.current_stage_id;

        const [updRes]: any = await db.query(`
          UPDATE job_applications 
          SET status = 'REJECTED', 
              rejection_stage_id = ?, 
              rejection_feedback = ?, 
              rejected_at = CURRENT_TIMESTAMP, 
              rejected_by_user_id = ?,
              rejection_notification_status = ?,
              hired_at = NULL
          WHERE id = ? AND status NOT IN ('REJECTED', 'SELECTED', 'HIRED', 'WITHDRAWN')
        `, [
          rejStageId,
          cleanFeedback,
          ctx.userId,
          notifyCandidate === false ? 'PENDING_MANUAL' : 'PROCESSING',
          appId
        ]);

        if (!updRes || updRes.affectedRows === 0) {
          failedCount++;
          results.push({
            applicationId: appId,
            success: false,
            code: "STALE_APPLICATION_STATE",
            message: "Application has already been rejected or updated."
          });
          continue;
        }
      } else if (cleanAction === 'SHORTLIST' || cleanAction === 'SHORTLISTED') {
        targetStatus = 'IN_PROGRESS';
        await db.query(`
          UPDATE job_applications 
          SET current_stage_id = COALESCE(?, current_stage_id), status = 'IN_PROGRESS', hired_at = NULL
          WHERE id = ?
        `, [targetStageId, appId]);
      } else if (cleanAction === 'SELECT' || cleanAction === 'SELECTED') {
        targetStatus = 'SELECTED';
        await db.query(`
          UPDATE job_applications 
          SET current_stage_id = COALESCE(?, current_stage_id), status = 'SELECTED', hired_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [targetStageId, appId]);
      } else if (cleanAction === 'HIRE' || cleanAction === 'HIRED') {
        targetStatus = 'HIRED';
        await db.query(`
          UPDATE job_applications 
          SET current_stage_id = COALESCE(?, current_stage_id), status = 'HIRED', hired_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [targetStageId, appId]);
      } else if (cleanAction === 'MOVE_STAGE' || cleanAction === 'ADVANCE') {
        targetStatus = app.status === 'REJECTED' ? 'IN_PROGRESS' : (app.status || 'IN_PROGRESS');
        await db.query(`
          UPDATE job_applications 
          SET current_stage_id = ?, status = ?, hired_at = NULL
          WHERE id = ?
        `, [targetStageId, targetStatus, appId]);
      } else if (cleanAction === 'UNDO_STAGE') {
        // Fetch history
        const [historyRows]: any = await db.query(`
          SELECT stage_id FROM application_history 
          WHERE application_id = ? AND stage_id IS NOT NULL 
          ORDER BY created_at DESC LIMIT 5
        `, [appId]);

        let restoredStageId = prevStageId;
        if (historyRows && historyRows.length >= 2) {
          restoredStageId = historyRows[1].stage_id;
        }

        targetStageId = restoredStageId;
        targetStatus = app.status === 'REJECTED' ? 'IN_PROGRESS' : app.status;

        await db.query(`
          UPDATE job_applications 
          SET current_stage_id = ?, status = ?, rejection_stage_id = NULL, rejection_feedback = NULL, rejected_at = NULL, hired_at = NULL
          WHERE id = ?
        `, [targetStageId, targetStatus, appId]);
      } else if (cleanAction === 'UNDO_DECISION') {
        targetStatus = 'IN_PROGRESS';
        await db.query(`
          UPDATE job_applications 
          SET status = 'IN_PROGRESS', rejection_stage_id = NULL, rejection_feedback = NULL, rejected_at = NULL, hired_at = NULL
          WHERE id = ?
        `, [appId]);
      }

      // Record History
      await db.query(
        "INSERT INTO application_history (application_id, stage_id, action, notes) VALUES (?, ?, ?, ?)",
        [appId, targetStageId || null, cleanAction, cleanNotes || `Bulk action: ${cleanAction}`]
      );

      // Record Audit Log (sanitized)
      try {
        await db.query(`
          INSERT INTO company_audit_logs (
            company_id, actor_user_id, actor_name, actor_role, action_type, module, description, target_type, target_id, metadata_json
          ) VALUES (?, ?, ?, ?, ?, 'PIPELINE', ?, 'APPLICATION', ?, ?)
        `, [
          ctx.companyId,
          ctx.userId,
          ctx.designation || "Company Recruiter",
          ctx.role || "COMPANY",
          `BULK_${cleanAction}`,
          `Action ${cleanAction} performed on candidate application`,
          appId,
          JSON.stringify({ source: "COMPANY_BULK_ACTION" })
        ]);
      } catch (e) {}

      // Notify candidate if needed
      if (notifyCandidate !== false) {
        try {
          const [jobInfo]: any = await db.query(`
            SELECT J.title, JS.stage_name, SP.user_id
            FROM job_applications JA
            JOIN jobs J ON JA.job_id = J.id
            LEFT JOIN job_stages JS ON JA.current_stage_id = JS.id
            JOIN student_profiles SP ON JA.student_id = SP.id
            WHERE JA.id = ?
          `, [appId]);

          if (jobInfo && jobInfo.length > 0) {
            const info = jobInfo[0];
            let notifTitle = "Application Update";
            let notifMsg = `Your application for ${info.title} has been updated.`;
            let notifType = "INFO";

            if (cleanAction === 'REJECT' || cleanAction === 'REJECTED') {
              notifTitle = "Application Status";
              notifMsg = `Your application for ${info.title} was not selected.`;
              notifType = "REJECT";
            } else if (targetStageId) {
              notifMsg = `Your application for ${info.title} has moved to ${info.stage_name || 'next stage'}.`;
            }

            await db.query(
              "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
              [info.user_id, notifTitle, notifMsg, notifType]
            );
          }
        } catch (e) {}
      }

      succeededCount++;
      results.push({
        applicationId: appId,
        success: true,
        code: "SUCCESS",
        message: "Stage updated successfully",
        previousStageId: prevStageId,
        currentStageId: targetStageId,
        previousStatus: prevStatus,
        currentStatus: targetStatus
      });

    } catch (err: any) {
      console.error(`Error processing bulk action for application ${appId}:`, err);
      failedCount++;
      results.push({
        applicationId: appId,
        success: false,
        code: "INTERNAL_ERROR",
        message: "Failed to process application update"
      });
    }
  }

  return {
    success: succeededCount > 0,
    summary: {
      requested: uniqueAppIds.length,
      succeeded: succeededCount,
      failed: failedCount
    },
    results
  };
}

export async function executeBulkTestSchedule(
  ctx: CompanyContext,
  params: {
    applicationIds: number[];
    scheduledAt: string;
    durationMinutes?: number;
    cutoffScore?: number;
    assessmentId?: number;
  }
): Promise<BulkActionResultSummary> {
  const { applicationIds, scheduledAt, durationMinutes, cutoffScore, assessmentId } = params;

  if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
    return {
      success: false,
      code: "INVALID_BULK_REQUEST",
      message: "Invalid application list",
      summary: { requested: 0, succeeded: 0, failed: 0 },
      results: []
    };
  }

  const uniqueAppIds = Array.from(new Set(applicationIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0)));
  const results: BulkActionResultItem[] = [];
  let succeededCount = 0;
  let failedCount = 0;

  for (const appId of uniqueAppIds) {
    try {
      const accessCheck = await canAccessApplication(ctx, appId);
      if (!accessCheck.canAccess || !accessCheck.app) {
        failedCount++;
        results.push({
          applicationId: appId,
          success: false,
          code: "APPLICATION_NOT_ACCESSIBLE",
          message: "Application not accessible or unauthorized"
        });
        continue;
      }

      const app = accessCheck.app;

      if (isJobEnded(app.job_status, app.job_deadline, app.job_ended_at)) {
        failedCount++;
        results.push({
          applicationId: appId,
          success: false,
          code: "JOB_READ_ONLY",
          message: "Recruitment pipeline has ended. Cannot schedule tests on ended positions."
        });
        continue;
      }

      if (app.status === 'HIRED' || app.status === 'REJECTED') {
        failedCount++;
        results.push({
          applicationId: appId,
          success: false,
          code: "TERMINAL_STATE",
          message: `Application is in terminal state (${app.status}). Cannot schedule test.`
        });
        continue;
      }

      if (assessmentId) {
        try {
          const [assRows]: any = await db.query(
            "SELECT id, company_id, job_id, duration_minutes, passing_score FROM assessments WHERE id = ?",
            [assessmentId]
          );
          if (!assRows || assRows.length === 0 || Number(assRows[0].company_id) !== ctx.companyId) {
            failedCount++;
            results.push({
              applicationId: appId,
              success: false,
              code: "ASSESSMENT_NOT_FOUND",
              message: "Assessment not found or belongs to another company."
            });
            continue;
          }
          const ass = assRows[0];
          if (ass.job_id && Number(ass.job_id) !== Number(app.job_id)) {
            failedCount++;
            results.push({
              applicationId: appId,
              success: false,
              code: "JOB_MISMATCH",
              message: "Assessment is configured for a different job position."
            });
            continue;
          }
        } catch (e) {}
      }

      // Upsert schedule for stage
      const stageId = app.current_stage_id;
      const duration = durationMinutes || 60;
      const cutoff = cutoffScore || 40;

      if (stageId) {
        await db.query("DELETE FROM test_schedules WHERE job_id = ? AND stage_id = ?", [app.job_id, stageId]);
        await db.query(
          "INSERT INTO test_schedules (job_id, stage_id, scheduled_at, duration_minutes, cutoff_score) VALUES (?, ?, ?, ?, ?)",
          [app.job_id, stageId, scheduledAt, duration, cutoff]
        );
      }

      // Record History
      await db.query(
        "INSERT INTO application_history (application_id, stage_id, action, notes) VALUES (?, ?, ?, ?)",
        [appId, stageId || null, 'INFO', `Bulk Test Scheduled: ${duration} mins at ${String(scheduledAt).replace('T', ' ')}`]
      );

      // Notify candidate
      try {
        const [studentRows]: any = await db.query(
          "SELECT SP.user_id FROM student_profiles SP WHERE SP.id = ?",
          [app.student_id]
        );
        if (studentRows && studentRows.length > 0) {
          await db.query(
            "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
            [
              studentRows[0].user_id,
              "Test Scheduled",
              `Action Required: Technical assessment for ${app.job_title} scheduled on ${String(scheduledAt).replace('T', ' ')}.`,
              "WARNING"
            ]
          );
        }
      } catch (e) {}

      succeededCount++;
      results.push({
        applicationId: appId,
        success: true,
        code: "SUCCESS",
        message: "Test scheduled successfully"
      });

    } catch (err) {
      console.error(`Error scheduling test for application ${appId}:`, err);
      failedCount++;
      results.push({
        applicationId: appId,
        success: false,
        code: "INTERNAL_ERROR",
        message: "Failed to schedule test"
      });
    }
  }

  return {
    success: succeededCount > 0,
    summary: {
      requested: uniqueAppIds.length,
      succeeded: succeededCount,
      failed: failedCount
    },
    results
  };
}

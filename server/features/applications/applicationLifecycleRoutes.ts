import type { Router } from "express";
import db from "../../db.ts";
import { authenticate } from "../../middleware/auth.ts";
import { mapStageToCanonicalKey } from "../../services/pipelineSnapshotService.ts";

import { enqueueEmail } from "../../services/queueService.ts";

type Dependencies = {
  resolveCompanyContext: (req: any) => Promise<any>;
};

export function registerApplicationLifecycleRoutes(router: Router, deps: Dependencies) {
  const { resolveCompanyContext } = deps;
router.post("/update-stage", authenticate, async (req: any, res) => {
  let { applicationId, stageId, action, notes, feedback, notifyCandidate } = req.body;
  try {
    const ctx = await resolveCompanyContext(req);
    if (ctx.error) {
      return res.status(ctx.statusCode || 403).json({ success: false, message: ctx.error });
    }

    // Verify application and company ownership
    const [apps]: any = await db.query(`
      SELECT JA.*, J.company_id, J.title as job_title, J.status as job_status, J.deadline as job_deadline,
             C.company_name, SP.user_id as student_user_id, SP.full_name, U.email
      FROM job_applications JA
      JOIN jobs J ON JA.job_id = J.id
      LEFT JOIN company_profiles C ON J.company_id = C.id
      JOIN student_profiles SP ON JA.student_id = SP.id
      JOIN users U ON SP.user_id = U.id
      WHERE JA.id = ? AND J.company_id = ?
    `, [applicationId, ctx.companyId]);

    if (!apps || apps.length === 0) {
      return res.status(404).json({ success: false, message: "Application not found or unauthorized access." });
    }

    const app = apps[0];

    // Sub HR assignment check
    if (ctx.roleType === 'SUB_HR') {
      const [jobAssigns]: any = await db.query(
        "SELECT id FROM company_job_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND job_id = ?",
        [ctx.companyId, req.user.userId, app.job_id]
      );
      const [appAssigns]: any = await db.query(
        "SELECT id FROM company_application_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND application_id = ?",
        [ctx.companyId, req.user.userId, applicationId]
      );
      if (jobAssigns.length === 0 && appAssigns.length === 0) {
        return res.status(403).json({ success: false, message: "Forbidden: You are not assigned to manage this job or application." });
      }
    }

    // Check if the pipeline/job has ended
    const isJobClosed = app.job_status === 'CLOSED';
    let isDeadlinePassed = false;
    if (app.job_deadline) {
      const dl = new Date(app.job_deadline);
      dl.setHours(23, 59, 59, 999);
      if (dl < new Date()) {
        isDeadlinePassed = true;
      }
    }

    if (isJobClosed || isDeadlinePassed) {
      return res.status(400).json({ success: false, message: "This recruitment pipeline has ended. You cannot move candidates or perform stage updates on ended positions." });
    }

    const userId = req.user.userId;
    const shouldNotify = notifyCandidate === undefined ? true : Boolean(notifyCandidate);

    if (action === 'REJECTED') {
      const rejStageId = stageId || app.current_stage_id;
      const cleanFeedback = (feedback !== undefined && feedback !== null) ? String(feedback).trim().slice(0, 1000) : null;
      const initialNotifStatus = shouldNotify ? 'PROCESSING' : 'PENDING_MANUAL';

      // Current-state guard: update only if not already terminal
      const [updateRes]: any = await db.query(`
        UPDATE job_applications 
        SET status = 'REJECTED', 
            rejection_stage_id = ?, 
            rejection_feedback = ?, 
            rejected_at = CURRENT_TIMESTAMP, 
            rejected_by_user_id = ?,
            rejection_notification_status = ?,
            hired_at = NULL
        WHERE id = ? AND status NOT IN ('REJECTED', 'SELECTED', 'HIRED', 'WITHDRAWN')
      `, [rejStageId, cleanFeedback, userId, initialNotifStatus, applicationId]);

      if (!updateRes || updateRes.affectedRows === 0) {
        return res.status(409).json({ success: false, message: "Application has already been rejected or terminal state updated." });
      }

      // Application History
      await db.query("INSERT INTO application_history (application_id, stage_id, action, notes) VALUES (?, ?, ?, ?)", [
        applicationId, rejStageId, 'REJECTED', cleanFeedback || 'Candidate rejected'
      ]);

      // Company Audit Record
      try {
        await db.query(`
          INSERT INTO company_audit_logs (company_id, user_id, action_type, target_type, target_id, description)
          VALUES (?, ?, 'REJECT_CANDIDATE', 'APPLICATION', ?, ?)
        `, [ctx.companyId, userId, applicationId, `Rejected candidate for position ${app.job_title}`]);
      } catch (e) {}

      // Handle platform notification & email if auto notify is ON
      if (shouldNotify) {
        const title = "Application update: Not selected";
        const message = cleanFeedback && cleanFeedback.length > 0
          ? `HR feedback for your ${app.job_title} application: "${cleanFeedback}"`
          : `Your application for ${app.job_title} has been rejected.`;
        const idempotencyKey = `APPLICATION_REJECTED:${applicationId}`;

        let notifSuccess = false;
        try {
          await db.query(
            "INSERT INTO notifications (user_id, title, message, type, idempotency_key) VALUES (?, ?, ?, ?, ?)",
            [app.student_user_id, title, message, 'REJECT', idempotencyKey]
          );
          notifSuccess = true;
        } catch (e: any) {
          if (e.message && (e.message.includes('UNIQUE') || e.message.includes('duplicate') || e.message.includes('1062'))) {
            notifSuccess = true;
          } else {
            console.error("Platform notification insert error:", e.message);
            notifSuccess = false;
          }
        }

        if (notifSuccess) {
          await db.query(`
            UPDATE job_applications 
            SET rejection_notification_status = 'SENT', rejection_notified_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `, [applicationId]);

          if (app.email) {
            const companyLabel = app.company_name || 'VEGA Partner';
            const emailSubject = `Application Status Update: ${app.job_title} at ${companyLabel}`;
            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #e53e3e; margin-bottom: 20px;">VEGA Application Status Update</h2>
                <p>Hello ${app.full_name || 'Student'},</p>
                <p>We regret to inform you that your application for the position of <strong>${app.job_title}</strong> at <strong>${companyLabel}</strong> has been updated to <strong>REJECTED</strong>.</p>
                ${cleanFeedback ? `
                <div style="background-color: #fffaf0; border-left: 4px solid #dd6b20; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <h4 style="margin: 0 0 10px 0; color: #dd6b20; font-size: 14px;">HR Feedback / Note:</h4>
                  <p style="margin: 0; color: #4a5568; font-size: 14px; font-style: italic; white-space: pre-wrap;">"${cleanFeedback}"</p>
                </div>
                ` : ''}
                <p>Thank you for your interest in ${companyLabel} and for taking the time to apply and participate in our process. We wish you the best of luck in your job search.</p>
                <div style="margin: 30px 0; text-align: center;">
                  <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Student Portal</a>
                </div>
                <p style="color: #718096; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                  This is an automated message from VEGA. Please do not reply to this email.
                </p>
              </div>
            `;
            enqueueEmail({ to: app.email, subject: emailSubject, html: emailHtml, dedupeKey: `application-rejected:${applicationId}` }).catch(err => {
              console.error("Failed to enqueue rejection email:", err.message);
            });
          }
        } else {
          await db.query(`
            UPDATE job_applications 
            SET rejection_notification_status = 'FAILED' 
            WHERE id = ?
          `, [applicationId]);
        }
      }

      // Re-query committed application state for authoritative response
      const [committedRejApps]: any = await db.query(`
        SELECT JA.*, JS.stage_name, JS.stage_type
        FROM job_applications JA
        LEFT JOIN job_stages JS ON JA.current_stage_id = JS.id
        WHERE JA.id = ?
      `, [applicationId]);
      const committedRejApp = committedRejApps[0] || {};
      const rejMapped = mapStageToCanonicalKey({
        status: committedRejApp.status || 'REJECTED',
        stage_type: committedRejApp.stage_type,
        stage_name: committedRejApp.stage_name
      });

      return res.json({
        success: true,
        message: "Application rejected successfully.",
        application: committedRejApp,
        canonicalStageKey: rejMapped.key,
        legacyCanonicalKey: rejMapped.legacyKey
      });
    }

    let status = 'IN_PROGRESS';
    if (action === 'SELECTED') {
      status = 'SELECTED';
    } else if (action === 'HIRED') {
      status = 'HIRED';
    }

    // Verify stage belongs to candidate's job & ordered stage progression
    if (stageId) {
      const [stageRows]: any = await db.query(
        "SELECT id, stage_name, stage_type, stage_order FROM job_stages WHERE id = ? AND job_id = ?",
        [stageId, app.job_id]
      );
      if (!stageRows || stageRows.length === 0) {
        return res.status(400).json({ success: false, message: "Target stage does not belong to this job's pipeline." });
      }

      const targetTypeUpper = String(stageRows[0]?.stage_type || '').toUpperCase();
      const targetNameUpper = String(stageRows[0]?.stage_name || '').toUpperCase();
      if (
        action === 'HIRED' ||
        targetTypeUpper === 'HIRED' ||
        (targetNameUpper.includes('HIRE') && !targetNameUpper.includes('INTERVIEW'))
      ) {
        status = 'HIRED';
        action = 'HIRED';
      } else if (
        action === 'SELECTED' ||
        ['SELECTED', 'OFFER', 'SHORTLISTED'].includes(targetTypeUpper) ||
        targetNameUpper.includes('SELECT') ||
        targetNameUpper.includes('SHORTLIST') ||
        targetNameUpper.includes('OFFER')
      ) {
        status = 'SELECTED';
        action = 'SELECTED';
      }

      // Enforce valid next stage progression or stage undo for non-terminal moves
      if (action !== 'SELECTED' && action !== 'REJECTED') {
        const [jobStages]: any = await db.query(
          "SELECT id, stage_name, stage_type, stage_order FROM job_stages WHERE job_id = ? ORDER BY stage_order ASC, id ASC",
          [app.job_id]
        );
        const curIdx = jobStages.findIndex((s: any) => Number(s.id) === Number(app.current_stage_id));
        if (curIdx !== -1) {
          if (action === 'UNDO_STAGE' || action === 'PREVIOUS' || action === 'STAGE_REVERSED') {
            const expectedPrev = jobStages[curIdx - 1];
            if (!expectedPrev) {
              return res.status(400).json({ success: false, message: "Candidate is already in the first stage." });
            }
            if (Number(stageId) !== Number(expectedPrev.id)) {
              return res.status(400).json({ success: false, message: "Invalid stage regression: Target stage is not the previous stage." });
            }
            const prevType = String(expectedPrev.stage_type || '').toUpperCase();
            if (prevType === 'APPLICATION' || prevType === 'APPLIED' || Number(expectedPrev.stage_order || 1) === 1) {
              status = 'APPLIED';
            } else {
              status = 'IN_PROGRESS';
            }
          } else {
            const expectedNext = jobStages[curIdx + 1];
            if (!expectedNext) {
              return res.status(400).json({ success: false, message: "Candidate is already at the final stage." });
            }
            if (Number(stageId) !== Number(expectedNext.id)) {
              return res.status(400).json({ success: false, message: "Invalid stage progression: Target stage is not the valid next stage." });
            }
          }
        }
      }
    }

    const isHiredOrSelected = status === 'SELECTED' || status === 'HIRED';
    const [updateRes]: any = await db.query(`
      UPDATE job_applications 
      SET current_stage_id = ?, status = ?, hired_at = ${isHiredOrSelected ? 'CURRENT_TIMESTAMP' : 'NULL'}
      WHERE id = ? AND status NOT IN ('REJECTED', 'CANCELLED', 'WITHDRAWN')
    `, [stageId, status, applicationId]);

    if (!updateRes || updateRes.affectedRows === 0) {
      return res.status(409).json({ success: false, message: "Application could not be updated or is in a terminal state." });
    }

    const historyNotes = feedback !== undefined && feedback !== null ? feedback : notes;

    await db.query("INSERT INTO application_history (application_id, stage_id, action, notes) VALUES (?, ?, ?, ?)", [
      applicationId, stageId, action, historyNotes
    ]);

    // Stage update / shortlisting notification
    const [stageInfo]: any = await db.query(`
      SELECT JS.stage_name FROM job_stages JS WHERE JS.id = ?
    `, [stageId]);
    const stageName = stageInfo[0]?.stage_name || "Assessment/Next Phase";
    let title = "Application Update";
    let message = `Your application for ${app.job_title} has been moved to ${stageName}.`;
    const hasFeedback = feedback && typeof feedback === 'string' && feedback.trim().length > 0;

    if (status === 'SELECTED') {
      title = "You have been shortlisted";
      message = hasFeedback
        ? `HR feedback for your ${app.job_title} application: "${feedback}"`
        : `Your application for ${app.job_title} has been moved to Selected.`;
    }

    let notificationType = status === 'SELECTED' ? 'SUCCESS' : 'INFO';
    let testScheds: any[] = [];
    try {
      const [tsRes]: any = await db.query("SELECT id FROM test_schedules WHERE job_id = ? AND stage_id = ?", [app.job_id || 0, stageId]);
      testScheds = tsRes || [];
    } catch (e) {}
    if (testScheds.length > 0) {
      title = "Action Required: Test Scheduled";
      message = `Your application for "${app.job_title}" is now at stage "${stageName}". A test assessment is scheduled. Please go to Applied Jobs to complete it.`;
      notificationType = 'WARNING';
    }

    try {
      await db.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
        [app.student_user_id, title, message, notificationType]
      );
    } catch (e: any) {
      console.warn("Notification insert note:", e.message);
    }

    if (app.email) {
      let emailSubject = `Application Update: Moved to ${stageName}`;
      let emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #2b6cb0; margin-bottom: 20px;">VEGA Application Update</h2>
          <p>Hello ${app.full_name || 'Student'},</p>
          <p>Your application for the position of <strong>${app.job_title}</strong> has been updated.</p>
          <p>Current Stage: <strong>${stageName}</strong></p>
          <p>Please log in to the VEGA student portal to check your updated status.</p>
        </div>
      `;

      if (status === 'SELECTED') {
        const companyLabel = app.company_name || 'VEGA Partner';
        emailSubject = `Congratulations! Selected for ${app.job_title} at ${companyLabel}`;
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #38a169; margin-bottom: 20px;">Congratulations!</h2>
            <p>Hello ${app.full_name || 'Student'},</p>
            <p>We are thrilled to inform you that you have been <strong>SELECTED / SHORTLISTED</strong> for the position of <strong>${app.job_title}</strong> at <strong>${companyLabel}</strong>!</p>
            ${hasFeedback ? `
            <div style="background-color: #f0fff4; border-left: 4px solid #38a169; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h4 style="margin: 0 0 10px 0; color: #276749; font-size: 14px;">HR Feedback / Note:</h4>
              <p style="margin: 0; color: #2f855a; font-size: 14px; font-style: italic; white-space: pre-wrap;">"${feedback}"</p>
            </div>
            ` : ''}
            <p>Our team will reach out to you shortly with details regarding onboarding.</p>
          </div>
        `;
      }

      enqueueEmail({ to: app.email, subject: emailSubject, html: emailHtml, dedupeKey: `application-stage:${applicationId}:${stageId || action || "update"}` }).catch(err => {
        console.error("Failed to enqueue application update email:", err.message);
      });
    }

    // Re-query committed application state for authoritative response
    const [committedApps]: any = await db.query(`
      SELECT JA.*, JS.stage_name, JS.stage_type
      FROM job_applications JA
      LEFT JOIN job_stages JS ON JA.current_stage_id = JS.id
      WHERE JA.id = ?
    `, [applicationId]);
    const committedApp = committedApps[0] || {};
    const mapped = mapStageToCanonicalKey({
      status: committedApp.status,
      stage_type: committedApp.stage_type,
      stage_name: committedApp.stage_name
    });

    res.json({
      success: true,
      message: "Stage updated successfully.",
      application: committedApp,
      canonicalStageKey: mapped.key,
      legacyCanonicalKey: mapped.legacyKey
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update stage" });
  }
});

// Undo decision endpoint for reversing SELECTED or REJECTED state
const handleUndoDecision = async (req: any, res: any) => {
  const applicationId = req.params.applicationId || req.body.applicationId;
  const { reason, notifyCandidate } = req.body;

  try {
    const ctx = await resolveCompanyContext(req);
    if (ctx.error) {
      return res.status(ctx.statusCode || 403).json({ success: false, message: ctx.error });
    }

    const appId = Number(applicationId);
    if (isNaN(appId) || !Number.isFinite(appId)) {
      return res.status(400).json({ success: false, message: "Invalid application ID." });
    }

    // 1. Fetch application with company verification
    const [apps]: any = await db.query(`
      SELECT JA.*, J.company_id, J.title as job_title, J.status as job_status,
             C.company_name, SP.user_id as student_user_id, SP.full_name, U.email
      FROM job_applications JA
      JOIN jobs J ON JA.job_id = J.id
      LEFT JOIN company_profiles C ON J.company_id = C.id
      JOIN student_profiles SP ON JA.student_id = SP.id
      JOIN users U ON SP.user_id = U.id
      WHERE JA.id = ? AND J.company_id = ?
    `, [appId, ctx.companyId]);

    if (!apps || apps.length === 0) {
      return res.status(404).json({ success: false, message: "Application not found or unauthorized access." });
    }

    const app = apps[0];

    // Sub HR assignment check
    if (ctx.roleType === 'SUB_HR') {
      const [jobAssigns]: any = await db.query(
        "SELECT id FROM company_job_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND job_id = ?",
        [ctx.companyId, req.user.userId, app.job_id]
      );
      const [appAssigns]: any = await db.query(
        "SELECT id FROM company_application_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND application_id = ?",
        [ctx.companyId, req.user.userId, appId]
      );
      if (jobAssigns.length === 0 && appAssigns.length === 0) {
        return res.status(403).json({ success: false, message: "Forbidden: You are not assigned to manage this job or application." });
      }
    }

    // 2. Validate state: MUST be SELECTED or REJECTED
    const currentStatus = String(app.status || "").toUpperCase();
    if (currentStatus === 'HIRED') {
      return res.status(400).json({ success: false, message: "Cannot undo decision for candidates marked as HIRED." });
    }
    if (currentStatus !== 'SELECTED' && currentStatus !== 'REJECTED') {
      return res.status(400).json({ success: false, message: "Candidate is not currently in Selected or Rejected state." });
    }

    // Helper to check if a stage is non-terminal
    const isNonTerminalStage = (stage: any): boolean => {
      if (!stage) return false;
      const st = String(stage.stage_type || "").toUpperCase();
      const sn = String(stage.stage_name || "").toUpperCase();
      if (["SELECTED", "SHORTLISTED", "REJECTED", "HIRED", "OFFER", "REJECT"].includes(st)) {
        return false;
      }
      if (sn.includes("HIRED") || sn.includes("REJECT") || sn === "SELECTED" || sn === "SHORTLISTED") {
        return false;
      }
      return true;
    };

    // Query all stages for this job
    const [allJobStages]: any = await db.query(
      "SELECT id, stage_name, stage_type, stage_order FROM job_stages WHERE job_id = ? ORDER BY stage_order ASC, id ASC",
      [app.job_id]
    );

    const nonTerminalJobStages = (allJobStages || []).filter(isNonTerminalStage);

    // Query latest decision event (REJECTED or SELECTED) from application_history
    const [decisionRows]: any = await db.query(`
      SELECT id, stage_id, action, created_at
      FROM application_history
      WHERE application_id = ? AND action IN ('REJECTED', 'SELECTED')
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `, [appId]);

    const latestDecision = decisionRows && decisionRows.length > 0 ? decisionRows[0] : null;

    // 3. Determine restored stage according to strict restoration precedence
    let restoredStageId: number | null = null;

    if (currentStatus === 'REJECTED') {
      // Precedence 1: rejection_stage_id when it belongs to the same job and is non-terminal
      if (app.rejection_stage_id) {
        const matchingStage = (allJobStages || []).find((s: any) => Number(s.id) === Number(app.rejection_stage_id));
        if (matchingStage && isNonTerminalStage(matchingStage)) {
          restoredStageId = Number(matchingStage.id);
        }
      }

      // Precedence 2: Stage on REJECTED event only when it represents the stage where rejection occurred and is non-terminal
      if (!restoredStageId && latestDecision && latestDecision.action === 'REJECTED' && latestDecision.stage_id) {
        const matchingStage = (allJobStages || []).find((s: any) => Number(s.id) === Number(latestDecision.stage_id));
        if (matchingStage && isNonTerminalStage(matchingStage)) {
          restoredStageId = Number(matchingStage.id);
        }
      }

      // Precedence 3: Latest non-terminal history event before rejection
      if (!restoredStageId) {
        let sql = `
          SELECT ah.stage_id, js.id as valid_stage_id, js.stage_type, js.stage_name
          FROM application_history ah
          JOIN job_stages js ON (ah.stage_id = js.id AND js.job_id = ?)
          WHERE ah.application_id = ?
            AND ah.action NOT IN ('SELECTED', 'REJECTED', 'DECISION_UNDONE', 'REJECTION_REVERSED', 'SELECTION_REVERSED')
        `;
        const params: any[] = [app.job_id, appId];
        if (latestDecision) {
          sql += ` AND (ah.created_at < ? OR (ah.created_at = ? AND ah.id < ?))`;
          params.push(latestDecision.created_at, latestDecision.created_at, latestDecision.id);
        }
        sql += ` ORDER BY ah.created_at DESC, ah.id DESC`;
        const [histRows]: any = await db.query(sql, params);
        if (histRows && histRows.length > 0) {
          for (const row of histRows) {
            if (isNonTerminalStage(row)) {
              restoredStageId = Number(row.valid_stage_id);
              break;
            }
          }
        }
      }

      // Precedence 4: Valid current_stage_id when non-terminal
      if (!restoredStageId && app.current_stage_id) {
        const matchingStage = (allJobStages || []).find((s: any) => Number(s.id) === Number(app.current_stage_id));
        if (matchingStage && isNonTerminalStage(matchingStage)) {
          restoredStageId = Number(matchingStage.id);
        }
      }

      // Precedence 5: First valid non-terminal job stage (or first stage)
      if (!restoredStageId) {
        if (nonTerminalJobStages.length > 0) {
          restoredStageId = Number(nonTerminalJobStages[0].id);
        } else if (allJobStages && allJobStages.length > 0) {
          restoredStageId = Number(allJobStages[0].id);
        }
      }
    } else { // currentStatus === 'SELECTED'
      // Precedence 1: Find latest SELECTED decision history row (latestDecision)
      // Precedence 2: Find latest valid NON-TERMINAL stage-changing history row strictly before that SELECTED event
      let sql = `
        SELECT ah.stage_id, js.id as valid_stage_id, js.stage_type, js.stage_name
        FROM application_history ah
        JOIN job_stages js ON (ah.stage_id = js.id AND js.job_id = ?)
        WHERE ah.application_id = ?
          AND ah.action NOT IN ('SELECTED', 'REJECTED', 'DECISION_UNDONE', 'REJECTION_REVERSED', 'SELECTION_REVERSED')
      `;
      const params: any[] = [app.job_id, appId];
      if (latestDecision) {
        sql += ` AND (ah.created_at < ? OR (ah.created_at = ? AND ah.id < ?))`;
        params.push(latestDecision.created_at, latestDecision.created_at, latestDecision.id);
      }
      sql += ` ORDER BY ah.created_at DESC, ah.id DESC`;
      const [histRows]: any = await db.query(sql, params);
      if (histRows && histRows.length > 0) {
        for (const row of histRows) {
          if (isNonTerminalStage(row)) {
            restoredStageId = Number(row.valid_stage_id);
            break;
          }
        }
      }

      // Precedence 3: Verify stage belongs to same job and is non-terminal via current_stage_id
      if (!restoredStageId && app.current_stage_id) {
        const matchingStage = (allJobStages || []).find((s: any) => Number(s.id) === Number(app.current_stage_id));
        if (matchingStage && isNonTerminalStage(matchingStage)) {
          restoredStageId = Number(matchingStage.id);
        }
      }

      // Precedence 4: First job stage (preferring non-terminal)
      if (!restoredStageId) {
        if (nonTerminalJobStages.length > 0) {
          restoredStageId = Number(nonTerminalJobStages[0].id);
        } else if (allJobStages && allJobStages.length > 0) {
          restoredStageId = Number(allJobStages[0].id);
        }
      }
    }

    if (!restoredStageId) {
      return res.status(400).json({ success: false, message: "No valid stage found for this job pipeline." });
    }

    // Determine restored stage details & restored status
    const [targetStageRows]: any = await db.query(
      "SELECT stage_name, stage_type, stage_order FROM job_stages WHERE id = ?",
      [restoredStageId]
    );
    const restoredStageObj = targetStageRows && targetStageRows.length > 0 ? targetStageRows[0] : null;
    const restoredStageName = restoredStageObj?.stage_name || "Applied";
    const restoredStageType = String(restoredStageObj?.stage_type || "").toUpperCase();
    const restoredStageOrder = Number(restoredStageObj?.stage_order || 1);

    const newStatus = (restoredStageType === 'APPLICATION' || restoredStageType === 'APPLIED' || restoredStageOrder === 1) ? 'APPLIED' : 'IN_PROGRESS';
    const reversalAction = currentStatus === 'REJECTED' ? 'REJECTION_REVERSED' : 'SELECTION_REVERSED';

    const shouldNotify = notifyCandidate === undefined ? true : Boolean(notifyCandidate);
    const initialNotificationStatus = shouldNotify ? 'PROCESSING' : 'NOT_REQUESTED';

    // Build structured immutable original decision snapshot JSON
    const originalSnapshot = {
      previous_terminal_status: currentStatus,
      terminal_decision_history_id: latestDecision ? latestDecision.id : null,
      decision_timestamp: latestDecision ? latestDecision.created_at : (app.rejected_at || null),
      previous_stage_id: app.current_stage_id || null,
      rejection_feedback: app.rejection_feedback || null,
      rejecting_selecting_hr_user_id: app.rejected_by_user_id || null,
      notification_status: initialNotificationStatus,
      undo_reason: reason ? String(reason).trim() : null,
      restored_stage_id: restoredStageId,
      restored_stage_name: restoredStageName,
      undoing_hr_user_id: req.user.userId,
      undo_timestamp: new Date().toISOString()
    };
    const notesJson = JSON.stringify(originalSnapshot);

    // 4. Perform atomic transaction using pinned connection
    let historyInsertId = Date.now();
    await db.transaction(async (tx) => {
      // Guard: UPDATE only if status is still SELECTED or REJECTED and clear current terminal fields
      const [updateRes]: any = await tx.query(`
        UPDATE job_applications
        SET status = ?,
            current_stage_id = ?,
            rejection_stage_id = NULL,
            rejection_feedback = NULL,
            rejected_at = NULL,
            rejected_by_user_id = NULL,
            rejection_notification_status = ?,
            rejection_notified_at = NULL,
            hired_at = NULL
        WHERE id = ? AND status IN ('SELECTED', 'REJECTED')
      `, [newStatus, restoredStageId, initialNotificationStatus, appId]);

      const affected = updateRes?.changes ?? updateRes?.affectedRows ?? (Array.isArray(updateRes) && updateRes[0] ? (updateRes[0].changes ?? updateRes[0].affectedRows) : 0);
      if (!affected || affected === 0) {
        throw new Error("Candidate status was modified or is no longer in Selected/Rejected state.");
      }

      // Insert reversal event in application_history with immutable original decision JSON snapshot
      const [historyRes]: any = await tx.query(`
        INSERT INTO application_history (application_id, stage_id, action, notes)
        VALUES (?, ?, ?, ?)
      `, [appId, restoredStageId, reversalAction, notesJson]);

      if (historyRes) {
        const insId = historyRes.insertId || (Array.isArray(historyRes) && historyRes[0] ? historyRes[0].insertId : null);
        if (insId) historyInsertId = insId;
      }

      // Insert audit log
      try {
        await tx.query(`
          INSERT INTO company_audit_logs (company_id, user_id, action_type, target_type, target_id, description)
          VALUES (?, ?, 'UNDO_DECISION', 'APPLICATION', ?, ?)
        `, [ctx.companyId, req.user.userId, appId, `Reversed ${currentStatus} decision for candidate in job ${app.job_title}`]);
      } catch (e) {}
    });

    // Handle correction notification if notifyCandidate is ON
    if (shouldNotify) {
      const title = "Application Status Updated";
      const message = `A previous decision regarding your application for "${app.job_title}" has been updated. Your application has been restored to the "${restoredStageName}" stage.`;
      const idempotencyKey = `APPLICATION_DECISION_REVERSED:${appId}:${historyInsertId}`;

      try {
        await db.query(`
          INSERT INTO notifications (user_id, title, message, type, idempotency_key)
          VALUES (?, ?, ?, 'INFO', ?)
        `, [app.student_user_id, title, message, idempotencyKey]);

        try {
          await db.query(`
            UPDATE job_applications
            SET rejection_notification_status = 'SENT',
                rejection_notified_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [appId]);
        } catch (e) {}
      } catch (e: any) {
        try {
          const isDup = e.code === 'ER_DUP_ENTRY' || String(e.message || '').includes('UNIQUE') || String(e.message || '').includes('duplicate');
          if (isDup) {
            await db.query(`
              UPDATE job_applications
              SET rejection_notification_status = 'SENT',
                  rejection_notified_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [appId]);
          } else {
            await db.query(`
              UPDATE job_applications
              SET rejection_notification_status = 'FAILED'
              WHERE id = ?
            `, [appId]);
          }
        } catch (e2) {}
      }

      if (app.email) {
        const companyLabel = app.company_name || 'VEGA Partner';
        const emailSubject = `Application Status Updated: ${app.job_title} at ${companyLabel}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2b6cb0; margin-bottom: 20px;">VEGA Application Status Update</h2>
            <p>Hello ${app.full_name || 'Student'},</p>
            <p>A previous decision regarding your application for the position of <strong>${app.job_title}</strong> at <strong>${companyLabel}</strong> has been updated.</p>
            <p>Your application status has been restored to the <strong>${restoredStageName}</strong> stage.</p>
            <p>Please log in to your VEGA student portal to view your progress.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Student Portal</a>
            </div>
          </div>
        `;
        enqueueEmail({ to: app.email, subject: emailSubject, html: emailHtml, dedupeKey: `application-decision-reversed:${appId}:${historyInsertId}` }).catch(err => {
          console.error("Failed to enqueue correction email:", err.message);
        });
      }
    }

    return res.json({
      success: true,
      message: `Decision successfully reversed. Candidate restored to ${restoredStageName}.`,
      restoredStageName,
      restoredStatus: newStatus,
      restoredStageId
    });

  } catch (err: any) {
    console.error("Error in handleUndoDecision:", err.message || err);
    return res.status(500).json({ success: false, message: err.message || "Failed to reverse decision." });
  }
};

router.post("/applications/undo-decision", authenticate, handleUndoDecision);
router.post("/applications/:applicationId/undo-decision", authenticate, handleUndoDecision);
router.post("/undo-decision", authenticate, handleUndoDecision);

// Server-authoritative nonterminal Undo endpoint for stage regression
const handleUndoStage = async (req: any, res: any) => {
  const applicationId = req.params.applicationId || req.body.applicationId;
  const { expectedCurrentStageId } = req.body;

  try {
    const ctx = await resolveCompanyContext(req);
    if (ctx.error) {
      return res.status(ctx.statusCode || 403).json({ success: false, message: ctx.error });
    }

    const appId = Number(applicationId);
    if (isNaN(appId) || !Number.isFinite(appId)) {
      return res.status(400).json({ success: false, message: "Invalid application ID." });
    }

    // 1. Fetch application with company verification
    const [apps]: any = await db.query(`
      SELECT JA.*, J.company_id, J.title as job_title, J.status as job_status, J.deadline as job_deadline
      FROM job_applications JA
      JOIN jobs J ON JA.job_id = J.id
      WHERE JA.id = ? AND J.company_id = ?
    `, [appId, ctx.companyId]);

    if (!apps || apps.length === 0) {
      return res.status(404).json({ success: false, message: "Application not found or unauthorized access." });
    }

    const app = apps[0];

    // Sub HR assignment check
    if (ctx.roleType === 'SUB_HR') {
      const [jobAssigns]: any = await db.query(
        "SELECT id FROM company_job_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND job_id = ?",
        [ctx.companyId, req.user.userId, app.job_id]
      );
      const [appAssigns]: any = await db.query(
        "SELECT id FROM company_application_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND application_id = ?",
        [ctx.companyId, req.user.userId, appId]
      );
      if (jobAssigns.length === 0 && appAssigns.length === 0) {
        return res.status(403).json({ success: false, message: "Forbidden: You are not assigned to manage this job or application." });
      }
    }

    // 2. Check if job post has ended
    const isJobClosed = app.job_status === 'CLOSED';
    let isDeadlinePassed = false;
    if (app.job_deadline) {
      const dl = new Date(app.job_deadline);
      dl.setHours(23, 59, 59, 999);
      if (dl < new Date()) {
        isDeadlinePassed = true;
      }
    }
    if (isJobClosed || isDeadlinePassed) {
      return res.status(400).json({ success: false, message: "This recruitment pipeline has ended. You cannot undo stages on ended positions." });
    }

    // 3. Block terminal DB status
    const currentRawStatus = String(app.status || "").toUpperCase();
    const terminalStatuses = ['SELECTED', 'REJECTED', 'HIRED', 'OFFER_ACCEPTED', 'WITHDRAWN', 'CANCELLED', 'VERIFIED_SELECTION'];
    if (terminalStatuses.includes(currentRawStatus)) {
      return res.status(400).json({
        success: false,
        message: "Cannot undo stage for terminal applications. Use undo decision endpoint."
      });
    }

    // 4. Verify expectedCurrentStageId
    if (expectedCurrentStageId !== undefined && expectedCurrentStageId !== null) {
      const expectedIdNum = Number(expectedCurrentStageId);
      const actualIdNum = Number(app.current_stage_id);
      if (expectedIdNum !== actualIdNum) {
        return res.status(409).json({
          success: false,
          message: `Application state has changed. Expected current stage ID ${expectedIdNum} but current stage ID is ${actualIdNum}.`
        });
      }
    }

    // 5. Query ordered job stages
    const [jobStages]: any = await db.query(
      "SELECT id, stage_name, stage_type, stage_order FROM job_stages WHERE job_id = ? ORDER BY stage_order ASC, id ASC",
      [app.job_id]
    );

    if (!jobStages || jobStages.length === 0) {
      return res.status(400).json({ success: false, message: "No stages found for this job pipeline." });
    }

    const curIdx = jobStages.findIndex((s: any) => Number(s.id) === Number(app.current_stage_id));
    if (curIdx === -1) {
      return res.status(400).json({ success: false, message: "Current stage not found in job pipeline." });
    }

    // First stage constraint
    if (curIdx === 0) {
      return res.status(400).json({ success: false, message: "Cannot undo stage for candidate at the initial stage." });
    }

    const targetStage = jobStages[curIdx - 1];
    const previousStageId = Number(app.current_stage_id);
    const targetStageId = Number(targetStage.id);

    const targetTypeUpper = String(targetStage.stage_type || "").toUpperCase();
    const targetOrderNum = Number(targetStage.stage_order || 1);
    const newStatus = (targetTypeUpper === 'APPLICATION' || targetTypeUpper === 'APPLIED' || targetOrderNum === 1) ? 'APPLIED' : 'IN_PROGRESS';

    // 6. Execute pinned transaction
    await db.transaction(async (tx) => {
      // Re-verify and lock application row in transaction
      const [lockedApps]: any = await tx.query(
        "SELECT id, current_stage_id, status FROM job_applications WHERE id = ?",
        [appId]
      );
      if (!lockedApps || lockedApps.length === 0) {
        const err: any = new Error("Application not found.");
        err.statusCode = 404;
        throw err;
      }
      const lockedApp = lockedApps[0];

      if (terminalStatuses.includes(String(lockedApp.status).toUpperCase())) {
        const err: any = new Error("Cannot undo stage for terminal applications. Use undo decision endpoint.");
        err.statusCode = 400;
        throw err;
      }

      if (expectedCurrentStageId !== undefined && expectedCurrentStageId !== null) {
        if (Number(lockedApp.current_stage_id) !== Number(expectedCurrentStageId)) {
          const err: any = new Error(`Application state has changed. Expected current stage ID ${expectedCurrentStageId} but current stage ID is ${lockedApp.current_stage_id}.`);
          err.statusCode = 409;
          throw err;
        }
      }

      const [updateRes]: any = await tx.query(
        `UPDATE job_applications
         SET current_stage_id = ?, status = ?, hired_at = NULL
         WHERE id = ? AND current_stage_id = ? AND status NOT IN ('SELECTED', 'REJECTED', 'HIRED', 'OFFER_ACCEPTED', 'WITHDRAWN', 'CANCELLED')`,
        [targetStageId, newStatus, appId, lockedApp.current_stage_id]
      );

      const affected = updateRes?.changes ?? updateRes?.affectedRows ?? (Array.isArray(updateRes) && updateRes[0] ? (updateRes[0].changes ?? updateRes[0].affectedRows) : 0);
      if (!affected || affected === 0) {
        const err: any = new Error("Application state changed concurrently.");
        err.statusCode = 409;
        throw err;
      }

      // Record in history
      await tx.query(
        "INSERT INTO application_history (application_id, stage_id, action, notes) VALUES (?, ?, ?, ?)",
        [appId, targetStageId, 'UNDO_STAGE', `Reverted stage from ${previousStageId} to ${targetStageId}`]
      );

      // Record in audit log
      try {
        await tx.query(
          `INSERT INTO company_audit_logs (company_id, user_id, action_type, target_type, target_id, description)
           VALUES (?, ?, 'UNDO_STAGE', 'APPLICATION', ?, ?)`,
          [ctx.companyId, req.user.userId, appId, `Undid stage move for candidate in job ${app.job_title}`]
        );
      } catch (e) {}
    });

    // Map new canonical display bucket
    const mapped = mapStageToCanonicalKey({
      status: newStatus,
      stage_type: targetStage.stage_type,
      stage_name: targetStage.stage_name
    });

    return res.json({
      success: true,
      message: "Stage reverted successfully",
      data: {
        applicationId: appId,
        previousStageId,
        targetStageId,
        newCanonicalKey: mapped.key,
        status: newStatus
      }
    });

  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    if (statusCode === 409 || statusCode === 400 || statusCode === 404) {
      return res.status(statusCode).json({ success: false, message: err.message });
    }
    console.error("Error in handleUndoStage:", err.message || err);
    return res.status(500).json({ success: false, message: err.message || "Failed to undo stage." });
  }
};

router.post("/applications/undo-stage", authenticate, handleUndoStage);
router.post("/applications/:applicationId/undo-stage", authenticate, handleUndoStage);
router.post("/undo-stage", authenticate, handleUndoStage);

// Endpoint to retry failed reversal correction notification without running Undo again
router.post(["/applications/:id/retry-reversal-notification", "/company/applications/:id/retry-reversal-notification"], authenticate, async (req: any, res: any) => {
  try {
    const ctx = await resolveCompanyContext(req);
    if (ctx.error) {
      return res.status(ctx.statusCode || 403).json({ success: false, message: ctx.error });
    }

    const appId = Number(req.params.id);
    if (isNaN(appId) || !Number.isFinite(appId)) {
      return res.status(400).json({ success: false, message: "Invalid application ID." });
    }

    const [apps]: any = await db.query(`
      SELECT JA.*, J.title as job_title, J.company_id, CP.company_name, U.email, U.full_name, U.id as student_user_id
      FROM job_applications JA
      JOIN jobs J ON JA.job_id = J.id
      LEFT JOIN company_profiles CP ON J.company_id = CP.id
      JOIN student_profiles SP ON JA.student_id = SP.id
      JOIN users U ON SP.user_id = U.id
      WHERE JA.id = ? AND J.company_id = ?
    `, [appId, ctx.companyId]);

    if (!apps || apps.length === 0) {
      return res.status(404).json({ success: false, message: "Application not found or unauthorized access." });
    }

    const app = apps[0];

    // Sub HR assignment check
    if (ctx.roleType === 'SUB_HR') {
      const [jobAssigns]: any = await db.query(
        "SELECT id FROM company_job_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND job_id = ?",
        [ctx.companyId, req.user.userId, app.job_id]
      );
      const [appAssigns]: any = await db.query(
        "SELECT id FROM company_application_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND application_id = ?",
        [ctx.companyId, req.user.userId, appId]
      );
      if (jobAssigns.length === 0 && appAssigns.length === 0) {
        return res.status(403).json({ success: false, message: "Forbidden: You are not assigned to manage this job or application." });
      }
    }

    // Find latest reversal history row
    const [revHist]: any = await db.query(`
      SELECT id, stage_id, notes, created_at
      FROM application_history
      WHERE application_id = ? AND action IN ('REJECTION_REVERSED', 'SELECTION_REVERSED')
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `, [appId]);

    if (!revHist || revHist.length === 0) {
      return res.status(400).json({ success: false, message: "No reversal event found for this application." });
    }

    const reversalHistoryId = revHist[0].id;

    // Get current stage name
    const [stg]: any = await db.query("SELECT stage_name FROM job_stages WHERE id = ?", [app.current_stage_id]);
    const restoredStageName = stg && stg.length > 0 ? stg[0].stage_name : "current stage";

    // Atomically claim PROCESSING status
    const [claimRes]: any = await db.query(`
      UPDATE job_applications
      SET rejection_notification_status = 'PROCESSING'
      WHERE id = ? AND rejection_notification_status IN ('FAILED', 'PROCESSING')
    `, [appId]);

    const affected = claimRes?.affectedRows ?? (Array.isArray(claimRes) && claimRes[0] ? claimRes[0].affectedRows : 0);
    if (!affected || affected === 0) {
      return res.status(400).json({ success: false, message: "Notification is not in FAILED state or is already processing/sent." });
    }

    const title = "Application Status Updated";
    const message = `A previous decision regarding your application for "${app.job_title}" has been updated. Your application has been restored to the "${restoredStageName}" stage.`;
    const idempotencyKey = `APPLICATION_DECISION_REVERSED:${appId}:${reversalHistoryId}`;

    try {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type, idempotency_key)
        VALUES (?, ?, ?, 'INFO', ?)
      `, [app.student_user_id, title, message, idempotencyKey]);

      await db.query(`
        UPDATE job_applications
        SET rejection_notification_status = 'SENT',
            rejection_notified_at = NOW()
        WHERE id = ?
      `, [appId]);

      if (app.email) {
        const companyLabel = app.company_name || 'VEGA Partner';
        const emailSubject = `Application Status Updated: ${app.job_title} at ${companyLabel}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2b6cb0; margin-bottom: 20px;">VEGA Application Status Update</h2>
            <p>Hello ${app.full_name || 'Student'},</p>
            <p>A previous decision regarding your application for the position of <strong>${app.job_title}</strong> at <strong>${companyLabel}</strong> has been updated.</p>
            <p>Your application status has been restored to the <strong>${restoredStageName}</strong> stage.</p>
          </div>
        `;
        enqueueEmail({ to: app.email, subject: emailSubject, html: emailHtml, dedupeKey: `application-reversal-retry:${appId}` }).catch(err => console.error("Retry email enqueue failed:", err.message));
      }

      return res.json({ success: true, message: "Correction notification retried successfully.", notification_status: "SENT" });
    } catch (e: any) {
      const isDup = e.code === 'ER_DUP_ENTRY' || String(e.message || '').includes('UNIQUE') || String(e.message || '').includes('duplicate');
      if (isDup) {
        await db.query(`
          UPDATE job_applications
          SET rejection_notification_status = 'SENT',
              rejection_notified_at = NOW()
          WHERE id = ?
        `, [appId]);
        return res.json({ success: true, message: "Correction notification already sent.", notification_status: "SENT" });
      }

      await db.query(`
        UPDATE job_applications
        SET rejection_notification_status = 'FAILED'
        WHERE id = ?
      `, [appId]);

      return res.status(500).json({ success: false, message: "Failed to send correction notification.", notification_status: "FAILED" });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Failed to retry notification." });
  }
});

// Send manual rejection notification for a rejected application
const handleManualRejectionNotify = async (req: any, res: any) => {
  const { applicationId } = req.params;
  try {
    const ctx = await resolveCompanyContext(req);
    if (ctx.error) {
      return res.status(ctx.statusCode || 403).json({ success: false, message: ctx.error });
    }

    const [apps]: any = await db.query(`
      SELECT JA.*, J.title as job_title, C.company_name, SP.user_id as student_user_id, SP.full_name, U.email
      FROM job_applications JA
      JOIN jobs J ON JA.job_id = J.id
      LEFT JOIN company_profiles C ON J.company_id = C.id
      JOIN student_profiles SP ON JA.student_id = SP.id
      JOIN users U ON SP.user_id = U.id
      WHERE JA.id = ? AND J.company_id = ?
    `, [applicationId, ctx.companyId]);

    if (!apps || apps.length === 0) {
      return res.status(404).json({ success: false, message: "Rejected application not found for this company." });
    }

    const app = apps[0];

    // Sub HR assignment check
    if (ctx.roleType === 'SUB_HR') {
      const [jobAssigns]: any = await db.query(
        "SELECT id FROM company_job_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND job_id = ?",
        [ctx.companyId, req.user.userId, app.job_id]
      );
      const [appAssigns]: any = await db.query(
        "SELECT id FROM company_application_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND application_id = ?",
        [ctx.companyId, req.user.userId, applicationId]
      );
      if (jobAssigns.length === 0 && appAssigns.length === 0) {
        return res.status(403).json({ success: false, message: "Forbidden: You are not assigned to manage this job or application." });
      }
    }

    if (app.status !== 'REJECTED') {
      return res.status(400).json({ success: false, message: "Application is not in REJECTED status." });
    }

    if (app.rejection_notification_status === 'SENT') {
      return res.status(400).json({ success: false, message: "Candidate has already been notified of rejection." });
    }

    // Atomic transition to PROCESSING
    const [updateResult]: any = await db.query(`
      UPDATE job_applications 
      SET rejection_notification_status = 'PROCESSING'
      WHERE id = ? AND status = 'REJECTED' AND rejection_notification_status IN ('PENDING_MANUAL', 'FAILED', 'NOT_REQUIRED', '')
    `, [applicationId]);

    if (!updateResult || updateResult.affectedRows === 0) {
      return res.status(409).json({ success: false, message: "Notification is currently processing or already sent." });
    }

    const customMsg = req.body?.message || app.rejection_feedback;
    const hasFeedback = customMsg && String(customMsg).trim().length > 0;
    const title = "Application update: Not selected";
    const message = hasFeedback
      ? `HR feedback for your ${app.job_title} application: "${customMsg}"`
      : `Your application for ${app.job_title} has been rejected.`;

    const idempotencyKey = `APPLICATION_REJECTED:${applicationId}`;

    let notifCreated = false;
    try {
      await db.query(
        "INSERT INTO notifications (user_id, title, message, type, idempotency_key) VALUES (?, ?, ?, ?, ?)",
        [app.student_user_id, title, message, 'REJECT', idempotencyKey]
      );
      notifCreated = true;
    } catch (e: any) {
      if (e.message && (e.message.includes('UNIQUE') || e.message.includes('duplicate') || e.message.includes('1062'))) {
        notifCreated = true;
      } else {
        console.warn("Notification insert warning:", e.message);
        notifCreated = false;
      }
    }

    if (notifCreated) {
      if (app.email) {
        const companyLabel = app.company_name || 'VEGA Partner';
        const emailSubject = `Application Status Update: ${app.job_title} at ${companyLabel}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #e53e3e; margin-bottom: 20px;">VEGA Application Status Update</h2>
            <p>Hello ${app.full_name || 'Student'},</p>
            <p>We regret to inform you that your application for the position of <strong>${app.job_title}</strong> at <strong>${companyLabel}</strong> has been updated to <strong>REJECTED</strong>.</p>
            ${hasFeedback ? `
            <div style="background-color: #fffaf0; border-left: 4px solid #dd6b20; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h4 style="margin: 0 0 10px 0; color: #dd6b20; font-size: 14px;">HR Feedback / Note:</h4>
              <p style="margin: 0; color: #4a5568; font-size: 14px; font-style: italic; white-space: pre-wrap;">"${customMsg}"</p>
            </div>
            ` : ''}
            <p>Thank you for your interest in ${companyLabel} and for taking the time to apply and participate in our process. We wish you the best of luck in your job search.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Student Portal</a>
            </div>
            <p style="color: #718096; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
              This is an automated message from VEGA. Please do not reply to this email.
            </p>
          </div>
        `;

        enqueueEmail({ to: app.email, subject: emailSubject, html: emailHtml, dedupeKey: `application-rejection-manual:${applicationId}` }).catch(err => {
          console.error("Failed to enqueue manual rejection email:", err.message);
        });
      }

      await db.query(`
        UPDATE job_applications 
        SET rejection_notification_status = 'SENT', rejection_notified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [applicationId]);

      return res.json({ success: true, message: "Candidate notified successfully!" });
    } else {
      await db.query(`
        UPDATE job_applications 
        SET rejection_notification_status = 'FAILED'
        WHERE id = ?
      `, [applicationId]);

      return res.status(500).json({ success: false, message: "Failed to create platform notification." });
    }
  } catch (err: any) {
    console.error("Manual rejection notification error:", err);
    await db.query(`
      UPDATE job_applications 
      SET rejection_notification_status = 'FAILED'
      WHERE id = ?
    `, [applicationId]).catch(() => {});
    res.status(500).json({ success: false, message: "Failed to send rejection notification." });
  }
};

router.post("/applications/:applicationId/send-rejection-notification", authenticate, handleManualRejectionNotify);
router.post("/company/applications/:applicationId/notify-decision", authenticate, handleManualRejectionNotify);

// Get full student details for an application

}

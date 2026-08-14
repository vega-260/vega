import type { Router } from "express";
import db from "../../db.ts";
import { sendInterviewInvitationToAttendee } from "../../services/emailService.ts";
import { authenticate, authorize } from "../../middleware/auth.ts";
import { mapStageToCanonicalKey } from "../../services/pipelineSnapshotService.ts";
import { checkAndProcessJobExpirations } from "../../services/jobExpiryService.ts";
import { registerApplicationLifecycleRoutes } from "./applicationLifecycleRoutes.ts";

import { enqueueEmail } from "../../services/queueService.ts";

type Middleware = (req: any, res: any, next: any) => any;
type Dependencies = {
  resolveCompanyContext: (req: any) => Promise<any>;
  requireApplicationAccess: Middleware;
  requireCompanyJobAccess: Middleware;
  requireCompanyApplicationsAccess: Middleware;
  requireStudentRecruitingDataAccess: Middleware;
};

export function registerJobApplicationRoutes(router: Router, deps: Dependencies) {
  const { resolveCompanyContext, requireApplicationAccess, requireCompanyJobAccess, requireCompanyApplicationsAccess, requireStudentRecruitingDataAccess } = deps;
router.get("/application-status/:appId", authenticate, requireApplicationAccess, async (req: any, res) => {
  try {
     const [apps]: any = await db.query(`
       SELECT JA.*, JS.stage_name, JS.stage_type, JS.config_json, JS.stage_order, JS.job_id
       FROM job_applications JA
       JOIN job_stages JS ON JA.current_stage_id = JS.id
       WHERE JA.id = ?
     `, [req.params.appId]);

     if (apps.length === 0) return res.status(404).json({ success: false, message: "Application not found" });
     const app = apps[0];

     let content: any = {};

     if (app.stage_type === 'TEST') {
        const [questions] = await db.query("SELECT id, question_text, options_json FROM test_questions WHERE stage_id = ?", [app.current_stage_id]);
        content.questions = questions;

        const testScheduleQuery = db.useMySQL ? `
          SELECT id, job_id, stage_id, DATE_FORMAT(scheduled_at, '%Y-%m-%d %H:%i:%s') as scheduled_at, duration_minutes, cutoff_score, status
          FROM test_schedules 
          WHERE job_id = ? AND stage_id = ?
        ` : `
          SELECT id, job_id, stage_id, scheduled_at, duration_minutes, cutoff_score, status
          FROM test_schedules 
          WHERE job_id = ? AND stage_id = ?
        `;
        const [schedules]: any = await db.query(testScheduleQuery, [app.job_id, app.current_stage_id]);
        content.schedule = schedules[0] || null;
     } else if (app.stage_type.startsWith('INTERVIEW')) {
        const interviewScheduleQuery = db.useMySQL ? `
          SELECT id, application_id, stage_id, interview_type, location_or_link, DATE_FORMAT(scheduled_at, '%Y-%m-%d %H:%i:%s') as scheduled_at, notes
          FROM interview_schedules 
          WHERE application_id = ? AND stage_id = ?
        ` : `
          SELECT id, application_id, stage_id, interview_type, location_or_link, scheduled_at, notes
          FROM interview_schedules 
          WHERE application_id = ? AND stage_id = ?
        `;
        const [schedules]: any = await db.query(interviewScheduleQuery, [app.id, app.current_stage_id]);
        content.schedule = schedules[0] || null;
     }

     res.json({ success: true, data: { ...app, content } });
  } catch (error) {
     res.status(500).json({ success: false, message: "Error fetching status" });
  }
});

// Bulk Actions for Applicants
router.post("/bulk-action", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireCompanyApplicationsAccess, async (req: any, res) => {
  const { applicationIds, action, stageId, notes } = req.body;
  try {
    const ids = Array.isArray(applicationIds) ? [...new Set(applicationIds.map(Number).filter(Number.isInteger))] : [];
    if (ids.length === 0 || ids.length > 1000) return res.status(400).json({ success: false, message: "applicationIds must contain 1-1000 valid IDs" });
    const placeholders = ids.map(() => '?').join(',');

    const [apps]: any = await db.query(`
      SELECT JA.id, J.title, J.status AS job_status, J.deadline AS job_deadline
      FROM job_applications JA JOIN jobs J ON JA.job_id = J.id
      WHERE JA.id IN (${placeholders})
    `, ids);
    if (apps.length !== ids.length) return res.status(404).json({ success: false, message: "One or more applications were not found" });
    for (const app of apps) {
      const deadline = app.job_deadline ? new Date(app.job_deadline) : null;
      if (deadline) deadline.setHours(23, 59, 59, 999);
      if (app.job_status === 'CLOSED' || (deadline && deadline < new Date())) {
        return res.status(400).json({ success: false, message: `The recruitment pipeline for "${app.title}" has ended.` });
      }
    }

    const status = action === 'REJECTED' ? 'REJECTED' : action === 'SELECTED' ? 'SELECTED' : 'IN_PROGRESS';
    await db.transaction(async (tx) => {
      await tx.query(`UPDATE job_applications SET current_stage_id = COALESCE(?, current_stage_id), status = ? WHERE id IN (${placeholders})`, [stageId || null, status, ...ids]);

      const historyValues = ids.map(() => '(?, ?, ?, ?)').join(',');
      const historyParams = ids.flatMap((id) => [id, stageId || null, action, notes || `Bulk action: ${action}`]);
      await tx.query(`INSERT INTO application_history (application_id, stage_id, action, notes) VALUES ${historyValues}`, historyParams);

      const [recipients]: any = await tx.query(`
        SELECT JA.id, J.title, JS.stage_name, SP.user_id
        FROM job_applications JA
        JOIN jobs J ON JA.job_id = J.id
        LEFT JOIN job_stages JS ON JA.current_stage_id = JS.id
        JOIN student_profiles SP ON JA.student_id = SP.id
        WHERE JA.id IN (${placeholders})
      `, ids);
      if (recipients.length) {
        const notificationValues = recipients.map(() => '(?, ?, ?, ?)').join(',');
        const notificationParams = recipients.flatMap((info: any) => {
          const title = action === 'REJECTED' ? 'Application Status' : 'Application Update';
          const message = action === 'REJECTED'
            ? `Your application for ${info.title} has been rejected.`
            : stageId ? `Your application for ${info.title} has been moved to ${info.stage_name || 'next stage'}.` : `Your application for ${info.title} has an update.`;
          return [info.user_id, title, message, action === 'REJECTED' ? 'REJECT' : 'INFO'];
        });
        await tx.query(`INSERT INTO notifications (user_id, title, message, type) VALUES ${notificationValues}`, notificationParams);
      }
    });

    res.json({ success: true, message: `Bulk action ${action} completed for ${ids.length} applicants` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Bulk action failed" });
  }
});

// Schedule Bulk Test for Selected Candidates
router.post("/schedule-test-bulk", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireCompanyApplicationsAccess, async (req: any, res) => {
  const { applicationIds, scheduledAt, durationMinutes, cutoffScore } = req.body;
  try {
    const ids = Array.isArray(applicationIds) ? [...new Set(applicationIds.map(Number).filter(Number.isInteger))] : [];
    if (ids.length === 0 || ids.length > 1000) return res.status(400).json({ success: false, message: "Invalid application list" });
    const placeholders = ids.map(() => '?').join(',');
    const [appsInfo]: any = await db.query(`SELECT id, job_id, current_stage_id FROM job_applications WHERE id IN (${placeholders})`, ids);
    if (appsInfo.length !== ids.length) return res.status(404).json({ success: false, message: "One or more applications were not found" });
    const jobId = Number(appsInfo[0].job_id); const stageId = Number(appsInfo[0].current_stage_id);
    if (appsInfo.some((a: any) => Number(a.job_id) !== jobId || Number(a.current_stage_id) !== stageId)) {
      return res.status(400).json({ success: false, message: "Bulk test scheduling requires applications in the same job and stage" });
    }

    await db.transaction(async (tx) => {
      await tx.query("DELETE FROM test_schedules WHERE job_id = ? AND stage_id = ?", [jobId, stageId]);
      await tx.query(`INSERT INTO test_schedules (job_id, stage_id, scheduled_at, duration_minutes, cutoff_score) VALUES (?, ?, ?, ?, ?)`, [jobId, stageId, scheduledAt, durationMinutes, cutoffScore]);
      const [applicants]: any = await tx.query(`SELECT SP.user_id, J.title FROM job_applications JA JOIN student_profiles SP ON JA.student_id = SP.id JOIN jobs J ON JA.job_id = J.id WHERE JA.id IN (${placeholders})`, ids);
      if (applicants.length) {
        const values = applicants.map(() => '(?, ?, ?, ?)').join(',');
        const params = applicants.flatMap((a: any) => [a.user_id, 'Test Scheduled', `Action Required: Official technical assessment for ${a.title} scheduled on ${String(scheduledAt).replace('T', ' ')}.`, 'WARNING']);
        await tx.query(`INSERT INTO notifications (user_id, title, message, type) VALUES ${values}`, params);
      }
      const historyValues = ids.map(() => '(?, ?, ?, ?)').join(',');
      const historyParams = ids.flatMap((id) => [id, stageId, 'INFO', `Bulk Test Scheduled: ${durationMinutes} mins at ${String(scheduledAt).replace('T', ' ')}`]);
      await tx.query(`INSERT INTO application_history (application_id, stage_id, action, notes) VALUES ${historyValues}`, historyParams);
    });
    res.json({ success: true, message: "Tests scheduled successfully for all selected applicants." });
  } catch (error) {
    console.error("Bulk schedule error:", error);
    res.status(500).json({ success: false, message: "Failed to schedule test" });
  }
});

// Schedule Automated Test
router.post("/schedule-test", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireCompanyJobAccess, async (req: any, res) => {
  const { jobId, stageId, scheduledAt, durationMinutes, cutoffScore } = req.body;
  try {
    // Delete existing schedule for this stage if any
    await db.query("DELETE FROM test_schedules WHERE job_id = ? AND stage_id = ?", [jobId, stageId]);
    
    const [result]: any = await db.query(`
      INSERT INTO test_schedules (job_id, stage_id, scheduled_at, duration_minutes, cutoff_score)
      VALUES (?, ?, ?, ?, ?)
    `, [jobId, stageId, scheduledAt, durationMinutes, cutoffScore]);

    // Notify ALL applicants in this stage
    const [applicants]: any = await db.query(`
      SELECT SP.user_id, J.title 
      FROM job_applications JA
      JOIN student_profiles SP ON JA.student_id = SP.id
      JOIN jobs J ON JA.job_id = J.id
      WHERE JA.job_id = ? AND JA.current_stage_id = ?
    `, [jobId, stageId]);

    if (applicants.length > 0) {
      const values = applicants.map(() => '(?, ?, ?, ?)').join(',');
      const params = applicants.flatMap((applicant: any) => [
        applicant.user_id, "Test Scheduled",
        `An automated test for ${applicant.title} has been scheduled for ${String(scheduledAt).replace('T', ' ')}.`, "WARNING"
      ]);
      await db.query(`INSERT INTO notifications (user_id, title, message, type) VALUES ${values}`, params);
    }

    res.json({ success: true, message: "Test scheduled successfully", scheduleId: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to schedule test" });
  }
});

// Get test schedule for job
router.get("/test-schedules/:jobId", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireCompanyJobAccess, async (req: any, res) => {
  try {
    const testSchedulesQuery = db.useMySQL ? `
      SELECT id, job_id, stage_id, DATE_FORMAT(scheduled_at, '%Y-%m-%d %H:%i:%s') as scheduled_at, duration_minutes, cutoff_score, status, created_at
      FROM test_schedules 
      WHERE job_id = ?
    ` : `
      SELECT id, job_id, stage_id, scheduled_at, duration_minutes, cutoff_score, status, created_at
      FROM test_schedules 
      WHERE job_id = ?
    `;
    const [schedules] = await db.query(testSchedulesQuery, [req.params.jobId]);
    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching schedules" });
  }
});

// Get active/upcoming tests for student
router.get("/student/active-tests/:studentId", authenticate, authorize(["STUDENT", "ADMIN", "SUPER_ADMIN"]), async (req: any, res) => {
  try {
    const activeTestsQuery = db.useMySQL ? `
      SELECT TS.id, TS.job_id, TS.stage_id, DATE_FORMAT(TS.scheduled_at, '%Y-%m-%d %H:%i:%s') as scheduled_at, 
             TS.duration_minutes, TS.cutoff_score, TS.status, J.title as job_title, JS.stage_name
      FROM test_schedules TS
      JOIN jobs J ON TS.job_id = J.id
      JOIN job_stages JS ON TS.stage_id = JS.id
      JOIN job_applications JA ON JA.job_id = J.id AND JA.current_stage_id = TS.stage_id
      WHERE JA.student_id = ? AND TS.status != 'COMPLETED'
    ` : `
      SELECT TS.id, TS.job_id, TS.stage_id, TS.scheduled_at, 
             TS.duration_minutes, TS.cutoff_score, TS.status, J.title as job_title, JS.stage_name
      FROM test_schedules TS
      JOIN jobs J ON TS.job_id = J.id
      JOIN job_stages JS ON TS.stage_id = JS.id
      JOIN job_applications JA ON JA.job_id = J.id AND JA.current_stage_id = TS.stage_id
      WHERE JA.student_id = ? AND TS.status != 'COMPLETED'
    `;
    const [tests] = await db.query(activeTestsQuery, [req.params.studentId]);
    res.json({ success: true, data: tests });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching active tests" });
  }
});

// Submit Test with Anti-cheating
router.post("/applications/submit-test", authenticate, authorize(["STUDENT"]), async (req: any, res) => {
  const { applicationId, stageId, answers, tabSwitches, violationCount, isAutoSubmitted } = req.body;
  try {
     const [questions]: any = await db.query("SELECT * FROM test_questions WHERE stage_id = ?", [stageId]);
     let correctCount = 0;
     
     questions.forEach((q: any) => {
        if (answers[q.id] === q.correct_answer) correctCount++;
     });

     const score = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
     
     // Get applicant info
     const [apps]: any = await db.query("SELECT * FROM job_applications WHERE id = ?", [applicationId]);
     if (apps.length === 0) throw new Error("Application not found");
     const app = apps[0];

     // Record submission
     await db.query(`
       INSERT INTO test_submissions (application_id, student_id, stage_id, answers_json, score, tab_switches, violation_count, is_auto_submitted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     `, [applicationId, app.student_id, stageId, JSON.stringify(answers), score, tabSwitches || 0, violationCount || 0, isAutoSubmitted ? 1 : 0]);

     // Auto progress logic
     const [schedules]: any = await db.query("SELECT cutoff_score FROM test_schedules WHERE job_id = ? AND stage_id = ?", [app.job_id, stageId]);
     const [jobStages]: any = await db.query("SELECT config_json FROM job_stages WHERE id = ?", [stageId]);
     const config = jobStages[0].config_json ? (typeof jobStages[0].config_json === 'string' ? JSON.parse(jobStages[0].config_json) : jobStages[0].config_json) : {};
     
     const passScore = schedules.length > 0 ? schedules[0].cutoff_score : (config.passScore || 60);

     if (score >= passScore && (violationCount || 0) < 5) {
        // Move to next stage
        const [nextStages]: any = await db.query(`
          SELECT id, stage_name FROM job_stages 
          WHERE job_id = (SELECT job_id FROM job_stages WHERE id = ?) 
          AND stage_order > (SELECT stage_order FROM job_stages WHERE id = ?)
          ORDER BY stage_order ASC LIMIT 1
        `, [stageId, stageId]);

        if (nextStages.length > 0) {
           await db.query("UPDATE job_applications SET current_stage_id = ? WHERE id = ?", [nextStages[0].id, applicationId]);
           await db.query("INSERT INTO application_history (application_id, stage_id, action, notes) VALUES (?, ?, ?, ?)", [
              applicationId, nextStages[0].id, 'MOVED', `Auto-passed test with score ${Math.round(score)}%`
           ]);
        } else {
           await db.query("UPDATE job_applications SET status = 'SELECTED' WHERE id = ?", [applicationId]);
        }
     } else {
        await db.query("UPDATE job_applications SET status = 'REJECTED' WHERE id = ?", [applicationId]);
        const reason = (violationCount || 0) >= 5 ? 'Cheating detected' : `Failed test with score ${Math.round(score)}%`;
        await db.query("INSERT INTO application_history (application_id, stage_id, action, notes) VALUES (?, ?, ?, ?)", [
           applicationId, stageId, 'REJECTED', reason
        ]);
     }

     res.json({ success: true, score, passed: score >= passScore && (violationCount || 0) < 5 });
  } catch (error) {
     console.error(error);
     res.status(500).json({ success: false, message: "Error submitting test" });
  }
});

// Schedule Interview
router.post("/applications/schedule-interview", authenticate, async (req: any, res) => {
  let { jobId: submittedJobId, applicationId, stageId, interviewType, locationOrLink, scheduledAt, notes, attendees, schedulerHrName } = req.body;
  const appId = Number(applicationId);
  let stgId = Number(stageId);
  try {
     // 1. Authenticate user & resolve company context
     const ctx = await resolveCompanyContext(req);
     if (ctx.error) {
        return res.status(ctx.statusCode || 401).json({ success: false, message: ctx.error });
     }

     // 2. Verify application exists and get job, company, student, stage info
     const [apps]: any = await db.query(`
       SELECT 
         ja.id as application_id,
         ja.job_id, 
         ja.student_id,
         ja.status as app_status,
         ja.current_stage_id, 
         j.title as job_title, 
         j.company_id as job_company_id, 
         cp.company_name, 
         cp.contact_person, 
         sp.full_name as candidate_name, 
         sp.email as candidate_email, 
         sp.user_id as user_id,
         js.stage_name as current_stage_name,
         js.stage_type as current_stage_type
       FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.id
       LEFT JOIN company_profiles cp ON j.company_id = cp.id
       LEFT JOIN student_profiles sp ON ja.student_id = sp.id
       LEFT JOIN job_stages js ON ja.current_stage_id = js.id
       WHERE ja.id = ?
     `, [appId]);

     if (!apps || apps.length === 0) {
        return res.status(404).json({ success: false, message: "Application not found" });
     }
     const appData = apps[0];
     const authoritativeJobId = appData.job_id;

     // 3. Verify application belongs to submitted jobId (if provided)
     if (submittedJobId && Number(submittedJobId) !== Number(authoritativeJobId)) {
        return res.status(400).json({ success: false, message: "Application does not belong to the selected job requirement." });
     }

     // 4. Verify job belongs to authenticated company
     if (Number(appData.job_company_id) !== Number(ctx.companyId)) {
        return res.status(403).json({ success: false, message: "Forbidden: Application belongs to a different company." });
     }

     // 5. Sub HR access control
     if (ctx.roleType === 'SUB_HR') {
        const [jobAssigns]: any = await db.query(
          "SELECT id FROM company_job_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND job_id = ?",
          [ctx.companyId, req.user.userId, authoritativeJobId]
        );
        const [appAssigns]: any = await db.query(
          "SELECT id FROM company_application_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND application_id = ?",
          [ctx.companyId, req.user.userId, appId]
        );
        if (jobAssigns.length === 0 && appAssigns.length === 0) {
          return res.status(403).json({ success: false, message: "Forbidden: You are not assigned to manage this job or application." });
        }
     }

     // 6. Verify current canonical application phase is INTERVIEW or HR & not in terminal state
     const mapped = mapStageToCanonicalKey(appData);
     const isEligiblePhase = mapped.key === 'technicalInterview' || mapped.key === 'hrInterview' || mapped.legacyKey === 'interview' || mapped.legacyKey === 'hr';
     
     const statusUpper = String(appData.app_status || '').toUpperCase();
     const isTerminalStatus = ['SELECTED', 'REJECTED', 'HIRED', 'OFFER_ACCEPTED', 'OFFER', 'WITHDRAWN', 'CANCELLED', 'SHORTLISTED'].includes(statusUpper);

     if (!isEligiblePhase || isTerminalStatus) {
        return res.status(409).json({ success: false, message: "The selected candidate is no longer eligible for interview scheduling." });
     }

     // 7. Verify stageId if provided
     if (stgId) {
        const [stages]: any = await db.query("SELECT id, job_id FROM job_stages WHERE id = ?", [stgId]);
        if (stages.length === 0 || Number(stages[0].job_id) !== Number(authoritativeJobId)) {
           return res.status(400).json({ success: false, message: "Selected stage does not belong to this job requirement." });
        }
     } else {
        if (appData.current_stage_id) {
           stgId = Number(appData.current_stage_id);
        } else {
           const [jobStages]: any = await db.query("SELECT id FROM job_stages WHERE job_id = ? ORDER BY stage_order ASC LIMIT 1", [authoritativeJobId]);
           if (jobStages.length > 0) {
              stgId = Number(jobStages[0].id);
           } else {
              const [newStage]: any = await db.query(
                "INSERT INTO job_stages (job_id, stage_name, stage_type, stage_order) VALUES (?, 'Interview', 'INTERVIEW', 1)",
                [authoritativeJobId]
              );
              stgId = Number((newStage.insertId !== undefined) ? newStage.insertId : newStage[0]?.insertId);
              await db.query("UPDATE job_applications SET current_stage_id = ? WHERE id = ?", [stgId, appId]);
           }
        }
     }

     // In-person location validation
     if (interviewType === 'In-Person' || req.body.mode === 'Offline Interview' || locationOrLink === 'Offline Interview' || req.body.mode === 'In-Person Interview') {
        if (!req.body.location || req.body.location.trim() === '') {
           return res.status(400).json({ success: false, message: "Location is required for In-Person interviews." });
        }
        locationOrLink = req.body.location.trim();
     }

     let formattedScheduledAt = null;
     if (scheduledAt) {
        try {
           formattedScheduledAt = new Date(scheduledAt).toISOString().slice(0, 19).replace('T', ' ');
        } catch (e) {
           return res.status(400).json({ success: false, message: "Invalid scheduled date format" });
        }
     }

     const durationVal = req.body.duration ? Number(req.body.duration) : 30;
     const interviewerNameVal = req.body.interviewerName || "Staff Recruiter";
     const instructionsVal = req.body.instructions || notes || "Please join the room on time.";

     // Default scheduler HR name
     const finalSchedulerHrName = schedulerHrName || appData.contact_person || appData.company_name || "HR Team";

     const [existing]: any = await db.query("SELECT id FROM interview_schedules WHERE application_id = ? AND stage_id = ?", [appId, stgId]);
     
     let interviewId: number;
     if (existing.length > 0) {
        interviewId = existing[0].id;
        await db.query(`
          UPDATE interview_schedules 
          SET interview_type = ?, location_or_link = ?, scheduled_at = ?, notes = ?, duration = ?, interviewer_name = ?, instructions = ?, scheduler_hr_name = ?
          WHERE application_id = ? AND stage_id = ?
        `, [interviewType, locationOrLink, formattedScheduledAt, notes, durationVal, interviewerNameVal, instructionsVal, finalSchedulerHrName, appId, stgId]);
     } else {
        const [insertRes]: any = await db.query(`
          INSERT INTO interview_schedules (application_id, stage_id, interview_type, location_or_link, scheduled_at, notes, duration, interviewer_name, instructions, scheduler_hr_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [appId, stgId, interviewType, locationOrLink, formattedScheduledAt, notes, durationVal, interviewerNameVal, instructionsVal, finalSchedulerHrName]);
        interviewId = insertRes.insertId !== undefined ? insertRes.insertId : insertRes[0]?.insertId;
     }

     // Handle attendees
     if (attendees && Array.isArray(attendees)) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const seenEmails = new Set<string>();
        
        for (const att of attendees) {
           if (!att.email || !emailRegex.test(att.email.trim())) {
              return res.status(400).json({ success: false, message: `Invalid attendee email format: ${att.email}` });
           }
           const cleanEmail = att.email.trim().toLowerCase();
           if (seenEmails.has(cleanEmail)) {
              return res.status(400).json({ success: false, message: `Duplicate attendee email is not allowed: ${att.email}` });
           }
           seenEmails.add(cleanEmail);
        }

        // Clean up existing attendees for this interview first
        await db.query("DELETE FROM interview_attendees WHERE interview_id = ?", [interviewId]);

        // Insert new attendees
        for (const att of attendees) {
           await db.query(`
             INSERT INTO interview_attendees (interview_id, name, email, role)
             VALUES (?, ?, ?, ?)
           `, [interviewId, att.name || null, att.email.trim(), att.role || 'Panelist']);

           try {
              await sendInterviewInvitationToAttendee(
                 att.email.trim(),
                 att.name || 'Interviewer',
                 appData.candidate_name,
                 appData.job_title,
                 scheduledAt,
                 interviewType,
                 locationOrLink,
                 finalSchedulerHrName,
                 instructionsVal,
                 att.role || 'Panelist'
              );
           } catch (err) {
              console.error(`Error sending email to attendee ${att.email}:`, err);
           }
        }
     }

     // Automatically notify candidate
     try {
        const studentUserId = appData.user_id;
        const notificationMsg = `An interview of type: ${interviewType} has been scheduled for ${scheduledAt} with duration ${durationVal} mins. Interviewer: ${interviewerNameVal}. Instructions: ${instructionsVal}. Location/Link: ${locationOrLink}`;
        
        if (studentUserId) {
           await db.query("INSERT INTO notifications (user_id, title, message, is_read) VALUES (?, 'Interview Scheduled', ?, 0)", [studentUserId, notificationMsg]);
        }

        if (appData.candidate_email) {
          const candidateHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <h2 style="color: #4f46e5; text-align: center;">Your Interview is Scheduled!</h2>
              <p>Hello <strong>${appData.candidate_name}</strong>,</p>
              <p>We are pleased to inform you that your interview for <strong>${appData.job_title}</strong> has been scheduled.</p>
              
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                <p style="margin: 5px 0;"><strong>Company:</strong> ${appData.company_name}</p>
                <p style="margin: 5px 0;"><strong>Round:</strong> ${interviewType}</p>
                <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${scheduledAt}</p>
                <p style="margin: 5px 0;"><strong>Duration:</strong> ${durationVal} minutes</p>
                <p style="margin: 5px 0;"><strong>Location / link:</strong> ${locationOrLink}</p>
                <p style="margin: 5px 0;"><strong>Interviewer:</strong> ${interviewerNameVal}</p>
              </div>

              <p><strong>Instructions:</strong> ${instructionsVal}</p>

              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #6b7280; text-align: center;">VEGA - Bridging Talent with Opportunity</p>
            </div>
          `;
          await enqueueEmail({
            to: appData.candidate_email,
            subject: `Interview Scheduled: ${appData.job_title} - ${appData.company_name}`,
            html: candidateHtml,
            dedupeKey: `interview-scheduled:${applicationId}:${scheduledAt || interviewId || "scheduled"}`,
          });
        }
     } catch (e) {
        console.warn("Failed to notify student of scheduled interview:", e);
     }

     res.json({ success: true, message: "Interview scheduled" });
  } catch (error) {
     console.error("Schedule error:", error);
     res.status(500).json({ success: false, message: "Failed to schedule interview", error: (error as Error).message });
  }
});

// Apply to job
router.post("/apply", authenticate, authorize(["STUDENT"]), async (req: any, res) => {
  const { jobId } = req.body;
  try {
    if (!jobId) {
      return res.status(400).json({ success: false, message: "Missing required field: Job ID." });
    }

    const [studentRows]: any = await db.query("SELECT id FROM student_profiles WHERE user_id = ? LIMIT 1", [req.user.userId]);
    if (!studentRows?.length) {
      return res.status(404).json({ success: false, message: "Student profile record not found." });
    }
    const studentId = Number(studentRows[0].id);

    // Check job exists and its status
    const [jobs]: any = await db.query("SELECT deadline, status, title FROM jobs WHERE id = ?", [jobId]);
    if (jobs.length === 0) return res.status(404).json({ success: false, message: "Job position not found." });
    
    if (jobs[0].status !== 'OPEN') {
      return res.status(400).json({ success: false, message: "This hiring process is currently closed." });
    }

    // Check job deadline
    if (jobs[0].deadline) {
      const deadline = new Date(jobs[0].deadline);
      deadline.setHours(23, 59, 59, 999);
      if (deadline < new Date()) {
        return res.status(400).json({ success: false, message: "The application deadline for this position has passed." });
      }
    }

    // Check student profile completeness and resume
    const [profiles]: any = await db.query("SELECT completeness_score, resume_url, user_id FROM student_profiles WHERE id = ?", [studentId]);
    if (profiles.length === 0) {
       return res.status(404).json({ success: false, message: "Student profile record not found." });
    }
    
    const profile = profiles[0];

    // Mandatory Psychometric Check
    const [psychResults]: any = await db.query("SELECT id FROM psychometric_results WHERE user_id = ?", [profile.user_id]);
    if (psychResults.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: "Mandatory Assessment Required: Please complete the Psychometric Assessment on your dashboard before applying to jobs." 
      });
    }

    if ((profile.completeness_score || 0) < 70) {
      return res.status(403).json({ 
        success: false, 
        message: `Profile incomplete (${profile.completeness_score || 0}%). You need at least 70% completeness to enable "Apply Now".` 
      });
    }

    if (!profile.resume_url) {
      return res.status(403).json({ 
        success: false, 
        message: "No resume found. Please upload a PDF resume in your profile before applying." 
      });
    }

    // Get initial stage
    const [stages]: any = await db.query("SELECT id FROM job_stages WHERE job_id = ? ORDER BY stage_order ASC LIMIT 1", [jobId]);
    const firstStageId = stages.length > 0 ? stages[0].id : null;

    // Create application
    const [appResult]: any = await db.query(
      "INSERT INTO job_applications (student_id, job_id, current_stage_id, status) VALUES (?, ?, ?, ?)", 
      [studentId, jobId, firstStageId, 'APPLIED']
    );
    
    const applicationId = appResult.insertId;

    // Record in history
    await db.query(
      "INSERT INTO application_history (application_id, stage_id, action, notes) VALUES (?, ?, ?, ?)", 
      [applicationId, firstStageId, 'APPLIED', 'Application submitted via VEGA portal']
    );

    // Notify student
    await db.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)", 
      [profile.user_id, "Application Successful", `Your application for ${jobs[0].title} has been received.`, "INFO"]
    );

    res.json({ success: true, message: "Application submitted successfully", applicationId });
  } catch (error: any) {
    console.error("Apply error:", error);
    
    // Check for duplicate application
    const errorMsg = error.message || String(error);
    if (error.code === 'ER_DUP_ENTRY' || errorMsg.includes('UNIQUE') || error.code === 'SQLITE_CONSTRAINT') {
       return res.status(400).json({ success: false, message: "You have already applied for this position." });
    }
    
    res.status(500).json({ success: false, message: "A server error occurred while processing your application." });
  }
});

// Get full application timeline
router.get("/application/:appId/timeline", authenticate, requireApplicationAccess, async (req: any, res) => {
  try {
    const [apps]: any = await db.query(`
      SELECT JA.*, J.id as job_id
      FROM job_applications JA
      JOIN jobs J ON JA.job_id = J.id
      WHERE JA.id = ?
    `, [req.params.appId]);

    if (apps.length === 0) return res.status(404).json({ success: false, message: "Application not found" });
    const app = apps[0];

    const [stages]: any = await db.query(`
      SELECT id, stage_name, stage_order, stage_type
      FROM job_stages
      WHERE job_id = ?
      ORDER BY stage_order ASC
    `, [app.job_id]);

    const [history]: any = await db.query(`
      SELECT stage_id, action, created_at, notes
      FROM application_history
      WHERE application_id = ?
      ORDER BY created_at ASC
    `, [req.params.appId]);

    res.json({ success: true, data: { application: app, stages, history } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching timeline" });
  }
});

// Get application history
router.get("/applications/history/:appId", authenticate, requireApplicationAccess, async (req: any, res) => {
  try {
    const [history] = await db.query(`
      SELECT AH.*, JS.stage_name
      FROM application_history AH
      LEFT JOIN job_stages JS ON AH.stage_id = JS.id
      WHERE AH.application_id = ?
      ORDER BY AH.created_at DESC
    `, [req.params.appId]);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching history" });
  }
});

// Update applicant stage
registerApplicationLifecycleRoutes(router, { resolveCompanyContext });

router.get("/student-full-details/:studentId", authenticate, authorize(["COMPANY", "TPO", "ADMIN", "SUPER_ADMIN"]), requireStudentRecruitingDataAccess, async (req: any, res) => {
  const { studentId } = req.params;
  try {
    // Try to find by student_profile ID first, then by user_id
    const [profile]: any = await db.query(`
      SELECT sp.*, u.email, ts.overall_score as talent_score, ts.breakdown_json
      FROM student_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN talent_scores ts ON u.id = ts.user_id
      WHERE sp.id = ? OR sp.user_id = ?
    `, [studentId, studentId]);

    if (profile.length === 0) return res.status(404).json({ success: false, message: "Student profile not found" });

    const actualStudentId = profile[0].id;

    const [mockInterviews]: any = await db.query(`
      SELECT * 
      FROM interview_history 
      WHERE student_id = ? 
      ORDER BY created_at DESC
    `, [actualStudentId]);

    const [education]: any = await db.query("SELECT * FROM student_education WHERE student_id = ? ORDER BY start_date DESC", [actualStudentId]);
    const [experience]: any = await db.query("SELECT * FROM student_experience WHERE student_id = ? ORDER BY start_date DESC", [actualStudentId]);
    const [projects]: any = await db.query("SELECT * FROM student_projects WHERE student_id = ? ORDER BY created_at DESC", [actualStudentId]);
    const [extracurriculars]: any = await db.query("SELECT * FROM extracurricular_activities WHERE user_id = ? ORDER BY activity_date DESC", [profile[0].user_id]);

    res.json({
      success: true,
      data: {
        profile: profile[0],
        mockInterviews,
        education,
        experience,
        projects,
        extracurriculars
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error fetching student full details" });
  }
});

// Get applicants for a job (Kanban View Data)
router.get("/applicants/:jobId", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireCompanyJobAccess, async (req: any, res) => {
  try {
    await checkAndProcessJobExpirations();
    const [applicants]: any = await db.query(`
      SELECT 
        JA.id as application_id,
        JA.status,
        JA.applied_at,
        JA.current_stage_id,
        JA.rejection_stage_id,
        JA.rejection_feedback,
        JA.rejected_at,
        JA.job_id as job_id,
        J.title as job_title,
        J.status as job_status,
        J.ended_at as job_ended_at,
        J.deadline as job_deadline,
        SP.id as student_id,
        U.id as user_id,
        SP.full_name,
        U.email,
        SP.resume_url,
        SP.skills_json,
        SP.profile_photo_url,
        TS.overall_score as talent_score,
        PR.overall_score as psychometric_score,
        PR.traits_json as psychometric_traits,
        PR.personality_type as psychometric_personality,
        (SELECT score FROM test_submissions WHERE application_id = JA.id ORDER BY submitted_at DESC LIMIT 1) as latest_test_score,
        (SELECT violation_count FROM test_submissions WHERE application_id = JA.id ORDER BY submitted_at DESC LIMIT 1) as latest_test_violations,
        (SELECT is_auto_submitted FROM test_submissions WHERE application_id = JA.id ORDER BY submitted_at DESC LIMIT 1) as latest_test_auto_submitted,
        (SELECT answers_json FROM test_submissions WHERE application_id = JA.id ORDER BY submitted_at DESC LIMIT 1) as latest_test_answers,
        SPS.avg_interview_score
      FROM job_applications JA
      JOIN jobs J ON JA.job_id = J.id
      JOIN student_profiles SP ON JA.student_id = SP.id
      JOIN users U ON SP.user_id = U.id
      LEFT JOIN talent_scores TS ON U.id = TS.user_id
      LEFT JOIN psychometric_results PR ON U.id = PR.user_id
      LEFT JOIN student_performance_stats SPS ON U.id = SPS.user_id
      WHERE JA.job_id = ?
    `, [req.params.jobId]);

    const [stages] = await db.query("SELECT * FROM job_stages WHERE job_id = ? ORDER BY stage_order ASC", [req.params.jobId]);

    res.json({ success: true, data: { applicants, stages } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching applicants" });
  }
});

// Get student's applications
router.get("/student/:studentId", authenticate, async (req: any, res) => {
  try {
    const requestedStudentId = Number(req.params.studentId);
    const authUserId = req.user?.userId;

    if (!authUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    // Verify student ownership: requested ID must match authenticated user's profile ID or user ID
    const [profiles]: any = await db.query(
      "SELECT id, user_id FROM student_profiles WHERE user_id = ? OR id = ?",
      [authUserId, requestedStudentId]
    );

    const userProfile = profiles.find((p: any) => p.user_id === authUserId);
    if (!userProfile || (userProfile.id !== requestedStudentId && authUserId !== requestedStudentId)) {
      return res.status(403).json({ success: false, message: "Forbidden: You are not authorized to view this student's applications." });
    }

    const [applications]: any = await db.query(`
      SELECT 
        JA.id, JA.job_id, JA.student_id, JA.status, JA.current_stage_id, JA.rejection_stage_id,
        JA.rejection_feedback, JA.rejected_at, JA.rejection_notification_status, JA.rejection_notified_at,
        JA.applied_at, J.title, J.deadline, J.job_type,
        CP.company_name, CP.logo_url,
        JS.stage_name as current_stage_name
      FROM job_applications JA
      JOIN jobs J ON JA.job_id = J.id
      JOIN company_profiles CP ON J.company_id = CP.id
      LEFT JOIN job_stages JS ON JA.current_stage_id = JS.id
      WHERE JA.student_id = ?
      ORDER BY JA.applied_at DESC
    `, [userProfile.id]);

    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching applications" });
  }
});

// GET /api/jobs/company-managed/all - Fetch all jobs belonging to authenticated company (Super HR) or assigned jobs (Sub HR)

}

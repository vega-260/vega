import express from "express";
import db from "../../db.ts";
import { authenticate, authorize } from "../../middleware/auth.ts";
const router = express.Router();
router.use(authenticate, authorize(["STUDENT"]));
import { getTPOContext, getStudentContext, getCompanyContext, reverseGeocode, getIpLocation, parseUserAgent } from "./assessmentContext.ts";
router.get("/student/eligible", authenticate, async (req: any, res) => {
  try {
    const studentCtx = await getStudentContext(req.user.userId || req.user.id);
    if (!studentCtx) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }

    const [apps]: any = await db.query(`
      SELECT 
        a.id as application_id,
        a.job_id,
        a.current_stage_id,
        j.title as job_title,
        cp.company_name,
        caa.id as assignment_id,
        caa.cutoff_score as assignment_cutoff,
        cad.id as definition_id,
        cad.title as test_title,
        cad.questions_json,
        cad.duration_minutes,
        cad.total_marks,
        cad.version,
        ts.id as submission_id,
        ts.score,
        ts.passed,
        ts.submitted_at
      FROM job_applications a
      JOIN jobs j ON a.job_id = j.id
      JOIN company_profiles cp ON j.company_id = cp.id
      JOIN company_assessment_assignments caa ON caa.job_id = a.job_id AND caa.status = 'ACTIVE' AND (caa.stage_id IS NULL OR caa.stage_id = a.current_stage_id)
      JOIN company_assessment_definitions cad ON caa.definition_version_id = cad.id
      LEFT JOIN test_submissions ts ON ts.application_id = a.id AND ts.assignment_id = caa.id
      WHERE a.student_id = ? AND a.status = 'IN_PROGRESS'
    `, [studentCtx.id]);

    const eligibleList = (apps || []).map((app: any) => {
      const qs = typeof app.questions_json === "string" ? JSON.parse(app.questions_json) : (app.questions_json || []);

      return {
        applicationId: app.application_id,
        jobId: app.job_id,
        jobTitle: app.job_title,
        companyName: app.company_name,
        assignmentId: app.assignment_id,
        testId: app.definition_id,
        testTitle: app.test_title,
        questionsCount: qs.length,
        duration: app.duration_minutes || 30,
        totalMarks: app.total_marks || 100,
        cutoffScore: Number(app.assignment_cutoff || 40),
        isSubmitted: !!app.submission_id,
        score: app.score !== null ? app.score : null,
        passed: app.passed === 1,
        submittedAt: app.submitted_at
      };
    });

    res.json({ success: true, assessments: eligibleList });
  } catch (error: any) {
    console.error("Error in GET /api/assessments/student/eligible:", error);
    res.status(500).json({ success: false, message: "Failed to fetch student eligible assessments" });
  }
});

export async function handleCompanyStudentStart(req: any, res: any) {
  try {
    const { applicationId, assignmentId, testId } = req.body;
    const targetAppId = applicationId;
    const studentCtx = await getStudentContext(req.user.userId || req.user.id);

    if (!targetAppId) {
      return res.status(400).json({ success: false, message: "Application ID is required" });
    }

    const [apps]: any = await db.query(`
      SELECT a.id as application_id, a.job_id, a.student_id, a.current_stage_id,
             caa.id as assignment_id, caa.cutoff_score as assignment_cutoff,
             cad.id as definition_id, cad.questions_json, cad.duration_minutes, cad.total_marks, cad.version
      FROM job_applications a
      JOIN company_assessment_assignments caa ON caa.job_id = a.job_id AND caa.status = 'ACTIVE' AND (caa.stage_id IS NULL OR caa.stage_id = a.current_stage_id)
      JOIN company_assessment_definitions cad ON caa.definition_version_id = cad.id
      WHERE a.id = ?
    `, [targetAppId]);

    if (apps.length === 0) {
      return res.status(404).json({ success: false, message: "Active assessment assignment not found for this application" });
    }

    const appRow = apps[0];
    if (studentCtx && appRow.student_id !== studentCtx.id) {
      return res.status(403).json({ success: false, message: "Unauthorized attempt access" });
    }

    let attemptId;
    let fullQuestions: any[] = [];
    const cutoffScore = Number(appRow.assignment_cutoff || 40);

    const [existingSub]: any = await db.query(`
      SELECT * FROM test_submissions WHERE application_id = ? AND assignment_id = ?
    `, [targetAppId, appRow.assignment_id]);

    if (existingSub.length > 0) {
      attemptId = existingSub[0].id;
      fullQuestions = typeof existingSub[0].questions_json === "string" ? JSON.parse(existingSub[0].questions_json) : existingSub[0].questions_json;
    } else {
      fullQuestions = typeof appRow.questions_json === "string" ? JSON.parse(appRow.questions_json) : (appRow.questions_json || []);
      const totalMarks = appRow.total_marks || fullQuestions.reduce((sum: number, q: any) => sum + (Number(q.points) || 10), 0) || 100;

      const [insertRes]: any = await db.query(`
        INSERT INTO test_submissions (assignment_id, assessment_version_id, application_id, student_id, job_id, stage_id, score, total_marks, percentage, passed, cutoff_score, assessment_version, questions_json, status)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, 0, ?, ?, ?, 'IN_PROGRESS')
      `, [appRow.assignment_id, appRow.definition_id, targetAppId, appRow.student_id, appRow.job_id, appRow.current_stage_id, totalMarks, cutoffScore, appRow.version, JSON.stringify(fullQuestions)]);

      attemptId = insertRes.insertId;
    }

    // Sanitize questions for student: strip correct answers and explanations
    const sanitizedQuestions = fullQuestions.map((q: any, i: number) => ({
      id: q.id || `q-${i}`,
      type: q.type || 'MCQ',
      questionText: q.questionText || q.question || q.text || '',
      options: q.options || ['', '', '', ''],
      points: Number(q.points) || 10,
      sortOrder: i + 1
    }));

    res.json({
      success: true,
      attemptId: String(attemptId),
      applicationId: targetAppId,
      assignmentId: appRow.assignment_id,
      assessmentId: appRow.definition_id,
      assessmentVersion: appRow.version,
      durationMinutes: appRow.duration_minutes || 30,
      totalMarks: appRow.total_marks || 100,
      questions: sanitizedQuestions
    });
  } catch (error: any) {
    console.error("Error in POST /api/assessments/student/start:", error);
    res.status(500).json({ success: false, message: "Failed to start assessment attempt" });
  }
}

// POST /api/assessments/student/event
router.post("/student/event", authenticate, async (req: any, res) => {
  try {
    const { applicationId, attemptId, eventType, idempotencyKey } = req.body;
    const targetAttemptId = attemptId;
    const studentCtx = await getStudentContext(req.user.userId || req.user.id);

    if (!applicationId || !eventType) {
      return res.status(400).json({ success: false, message: "Application ID and eventType are required" });
    }

    const [apps]: any = await db.query("SELECT id, student_id FROM job_applications WHERE id = ?", [applicationId]);
    if (apps.length === 0) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    if (studentCtx && apps[0].student_id !== studentCtx.id) {
      return res.status(403).json({ success: false, message: "Unauthorized attempt access" });
    }

    let exactAttemptId = targetAttemptId || null;
    if (!exactAttemptId) {
      const [subRows]: any = await db.query("SELECT id FROM test_submissions WHERE application_id = ? ORDER BY id DESC LIMIT 1", [applicationId]);
      if (subRows.length > 0) exactAttemptId = subRows[0].id;
    }

    try {
      await db.query(`
        INSERT INTO test_submission_events (attempt_id, application_id, student_id, event_type, idempotency_key)
        VALUES (?, ?, ?, ?, ?)
      `, [exactAttemptId, applicationId, studentCtx ? studentCtx.id : apps[0].student_id, eventType, idempotencyKey || null]);
    } catch (e) {
      return res.status(409).json({ success: false, message: "Duplicate event key blocked" });
    }

    if (exactAttemptId) {
      await db.query(`
        UPDATE test_submissions
        SET violations_count = violations_count + 1
        WHERE id = ?
      `, [exactAttemptId]);
    }

    res.json({
      success: true,
      message: `Integrity event ${eventType} recorded successfully.`,
      applicationId,
      attemptId: exactAttemptId,
      eventType
    });
  } catch (error: any) {
    console.error("Error in POST /api/assessments/student/event:", error);
    res.status(500).json({ success: false, message: "Failed to log integrity event" });
  }
});

// Canonical submission handler
export async function submitAssessmentAttempt(attemptId: any, reqUser: any, answers: any) {
  const studentCtx = await getStudentContext(reqUser.userId || reqUser.id);

  const [subs]: any = await db.query("SELECT * FROM test_submissions WHERE id = ? OR application_id = ?", [attemptId, attemptId]);
  if (subs.length === 0) {
    return { status: 404, data: { success: false, message: "Attempt not found" } };
  }

  const sub = subs[0];
  if (studentCtx && sub.student_id !== studentCtx.id) {
    return { status: 403, data: { success: false, message: "Unauthorized submission" } };
  }

  if (sub.status === 'COMPLETED') {
    return {
      status: 200,
      data: {
        success: true,
        message: "Assessment submitted successfully!",
        earnedScore: Number(sub.score),
        totalMarks: Number(sub.total_marks),
        percentage: Number(sub.percentage),
        cutoffScore: Number(sub.cutoff_score),
        isPassed: sub.passed === 1,
        submittedAt: sub.submitted_at
      }
    };
  }

  const questions = typeof sub.questions_json === "string" ? JSON.parse(sub.questions_json) : (sub.questions_json || []);
  let earnedScore = 0;
  const totalMarks = sub.total_marks || 100;

  questions.forEach((q: any) => {
    const qPts = Number(q.points) || 10;
    const studentAns = answers ? answers[q.id] : undefined;
    if (studentAns !== undefined && Number(studentAns) === Number(q.correctOption)) {
      earnedScore += qPts;
    }
  });

  const cutoff = Number(sub.cutoff_score || 40);
  const percentage = totalMarks > 0 ? Math.round((earnedScore / totalMarks) * 100) : 0;
  const isPassed = earnedScore >= cutoff ? 1 : 0;

  let eventCount = sub.violations_count || 0;
  try {
    const [evRows]: any = await db.query("SELECT COUNT(*) as count FROM test_submission_events WHERE attempt_id = ?", [sub.id]);
    if (evRows.length > 0) eventCount = Math.max(eventCount, evRows[0].count);
  } catch (e) {}

  await db.query(`
    UPDATE test_submissions
    SET score = ?, total_marks = ?, percentage = ?, passed = ?, violations_count = ?, answers_json = ?, status = 'COMPLETED', submitted_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [earnedScore, totalMarks, percentage, isPassed, eventCount, JSON.stringify(answers || {}), sub.id]);

  return {
    status: 200,
    data: {
      success: true,
      message: "Assessment submitted successfully!",
      earnedScore,
      totalMarks,
      percentage,
      cutoffScore: cutoff,
      isPassed: isPassed === 1
    }
  };
}

// POST /api/assessments/student/submit
router.post("/student/submit", authenticate, async (req: any, res) => {
  try {
    const { applicationId, attemptId, answers } = req.body;
    const targetId = attemptId || applicationId;

    if (!targetId) {
      return res.status(400).json({ success: false, message: "Attempt ID or Application ID is required" });
    }

    const result = await submitAssessmentAttempt(targetId, req.user, answers);
    res.status(result.status).json(result.data);
  } catch (error: any) {
    console.error("Error in POST /api/assessments/student/submit:", error);
    res.status(500).json({ success: false, message: "Failed to process submission" });
  }
});


export default router;

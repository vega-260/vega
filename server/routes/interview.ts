import { Router } from "express";
import { db } from "../db.ts";
import { authenticate } from "../middleware/auth.ts";
import { createIceServers } from "../realtime/turnCredentials.ts";
import { canAccessApplication } from "../features/applications/applicationAccessPolicy.ts";
import { resolveInterviewAccess } from "../services/interviewAuthorizationService.ts";
import { processInterviewEvaluation } from "../services/interviewEvaluationService.ts";

const router = Router();

// Authenticated ICE configuration. TURN credentials remain ephemeral in the newer vega_app transport architecture.
router.get("/ice-config", authenticate, (req: any, res) => {
  return res.json({ success: true, iceServers: createIceServers(Number(req.user.userId)) });
});

async function requireApplicationInterviewAccess(req: any, res: any, next: any) {
  const applicationId = Number(req.params.applicationId);
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid application id" });
  }
  if (!(await canAccessApplication(req, applicationId))) {
    return res.status(403).json({ success: false, message: "Access denied for this application" });
  }
  return next();
}

// Get upcoming interviews for the logged-in student
router.get("/student", authenticate, async (req: any, res) => {
  const userId = req.user.userId;
  try {
    const [student]: any = await db.query("SELECT id FROM student_profiles WHERE user_id = ?", [userId]);
    if (!student || student.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const studentId = student[0].id;

    const interviewQuery = db.useMySQL ? `
      SELECT 
        i.id,
        i.application_id,
        i.interview_type as type,
        i.location_or_link,
        DATE_FORMAT(i.scheduled_at, '%Y-%m-%dT%H:%i:%s.000Z') as time,
        j.title as role,
        cp.company_name as company,
        cp.logo_url as company_logo,
        i.status,
        i.notes
      FROM interview_schedules i
      JOIN job_applications a ON i.application_id = a.id
      JOIN jobs j ON a.job_id = j.id
      JOIN company_profiles cp ON j.company_id = cp.id
      WHERE a.student_id = ?
      ORDER BY i.scheduled_at ASC
    ` : `
      SELECT 
        i.id,
        i.application_id,
        i.interview_type as type,
        i.location_or_link,
        i.scheduled_at as time,
        j.title as role,
        cp.company_name as company,
        cp.logo_url as company_logo,
        i.status,
        i.notes
      FROM interview_schedules i
      JOIN job_applications a ON i.application_id = a.id
      JOIN jobs j ON a.job_id = j.id
      JOIN company_profiles cp ON j.company_id = cp.id
      WHERE a.student_id = ?
      ORDER BY i.scheduled_at ASC
    `;

    const [interviews]: any = await db.query(interviewQuery, [studentId]);
    
    // Normalize status in JS if status is NULL
    const computed = interviews.map((i: any) => {
      let currentStatus = i.status || 'UPCOMING';
      return { ...i, status: currentStatus };
    });

    res.json({ success: true, data: computed });
  } catch (err) {
    console.error("Error loading student interviews:", err);
    res.status(500).json({ success: false, message: "Error loading interviews" });
  }
});

// Get interview schedules for a specific application (for recruiter tracking)
router.get("/application/:applicationId", authenticate, requireApplicationInterviewAccess, async (req: any, res) => {
  const { applicationId } = req.params;
  try {
    const [schedules]: any = await db.query(
      "SELECT id, application_id, stage_id, interview_type as type, location_or_link, scheduled_at, notes, status FROM interview_schedules WHERE application_id = ?",
      [applicationId]
    );
    res.json({ success: true, data: schedules });
  } catch (err) {
    console.error("Error loading application interview schedule:", err);
    res.status(500).json({ success: false, message: "Error loading application schedule" });
  }
});

// Validate and get canonical interview room details for authorized users
router.get("/:interviewId/room", authenticate, async (req: any, res) => {
  const { interviewId } = req.params;
  const access = await resolveInterviewAccess(interviewId, req.user);

  if (!access.canAccess || !access.schedule) {
    return res.status(access.statusCode || 404).json({
      success: false,
      code: access.code || "INTERVIEW_NOT_FOUND",
      message: access.error || "Interview not found or unauthorized access"
    });
  }

  const schedule = access.schedule;
  res.json({
    success: true,
    roomId: `interview_${interviewId}`,
    role: req.user.role,
    participantType: access.isStudent ? "STUDENT" : "COMPANY",
    interview: {
      id: schedule.id,
      applicationId: schedule.application_id,
      interviewType: schedule.interview_type,
      scheduledAt: schedule.scheduled_at,
      status: schedule.status || 'UPCOMING',
      jobTitle: schedule.job_title,
      studentName: schedule.student_name,
      companyName: schedule.company_name,
      notes: schedule.notes
    }
  });
});

// Update interview status to LIVE / start
router.post("/:interviewId/start", authenticate, async (req: any, res) => {
  const { interviewId } = req.params;
  const access = await resolveInterviewAccess(interviewId, req.user);

  if (!access.canAccess || !access.schedule) {
    return res.status(access.statusCode || 404).json({
      success: false,
      code: access.code || "INTERVIEW_NOT_FOUND",
      message: access.error || "Interview not found or unauthorized access"
    });
  }

  if (!access.isInterviewer) {
    return res.status(403).json({
      success: false,
      code: "STUDENT_CANNOT_START",
      message: "Students cannot start official interviews"
    });
  }

  const currentStatus = access.schedule.status || "SCHEDULED";
  if (currentStatus === "COMPLETED" || currentStatus === "CANCELLED") {
    return res.status(409).json({
      success: false,
      code: "INVALID_STATE_TRANSITION",
      message: `Cannot start an interview that is already ${currentStatus}`
    });
  }

  if (currentStatus === "LIVE") {
    // Idempotent start
    return res.json({ success: true, message: "Interview is already live" });
  }

  try {
    await db.query("UPDATE interview_schedules SET status = 'LIVE' WHERE id = ?", [Number(interviewId)]);

    await db.query(
      "INSERT INTO application_history (application_id, stage_id, action, notes) VALUES (?, ?, 'LIVE_INTERVIEW_STARTED', 'Live interview room was started by the interviewer.')", 
      [access.schedule.application_id, access.schedule.stage_id]
    );

    res.json({ success: true, message: "Interview started successfully" });
  } catch (err) {
    console.error("Error starting interview:", err);
    res.status(500).json({ success: false, message: "Error starting interview" });
  }
});

// End live interview and mark as COMPLETED
router.post("/:interviewId/end", authenticate, async (req: any, res) => {
  const { interviewId } = req.params;
  const access = await resolveInterviewAccess(interviewId, req.user);

  if (!access.canAccess || !access.schedule) {
    return res.status(access.statusCode || 404).json({
      success: false,
      code: access.code || "INTERVIEW_NOT_FOUND",
      message: access.error || "Interview not found or unauthorized access"
    });
  }

  if (!access.isInterviewer) {
    return res.status(403).json({
      success: false,
      code: "STUDENT_CANNOT_END",
      message: "Students cannot end official interviews"
    });
  }

  const currentStatus = access.schedule.status || "SCHEDULED";
  if (currentStatus === "CANCELLED") {
    return res.status(409).json({
      success: false,
      code: "INVALID_STATE_TRANSITION",
      message: "Cannot complete a cancelled interview"
    });
  }

  if (currentStatus === "COMPLETED") {
    // Idempotent end
    return res.json({ success: true, message: "Interview is already completed" });
  }

  try {
    await db.query("UPDATE interview_schedules SET status = 'COMPLETED' WHERE id = ?", [Number(interviewId)]);

    await db.query(
      "INSERT INTO application_history (application_id, stage_id, action, notes) VALUES (?, ?, 'LIVE_INTERVIEW_COMPLETED', 'Live interview was successfully conducted and completed.')", 
      [access.schedule.application_id, access.schedule.stage_id]
    );

    res.json({ success: true, message: "Interview concluded successfully" });
  } catch (err) {
    console.error("Error ending interview:", err);
    res.status(500).json({ success: false, message: "Error ending interview" });
  }
});

// SPEECH TO TEXT: Save Transcript Line
router.post("/:interviewId/transcribe", authenticate, async (req: any, res) => {
  const { interviewId } = req.params;
  const access = await resolveInterviewAccess(interviewId, req.user);

  if (!access.canAccess) {
    return res.status(access.statusCode || 404).json({
      success: false,
      code: access.code || "INTERVIEW_NOT_FOUND",
      message: access.error || "Interview not found"
    });
  }

  const rawMessage = req.body.message || "";
  if (typeof rawMessage !== "string" || rawMessage.length > 2000) {
    return res.status(400).json({
      success: false,
      code: "PAYLOAD_TOO_LARGE",
      message: "Transcript message exceeds length limit of 2000 characters"
    });
  }

  // Canonical speaker identity derived from authenticated role
  const canonicalSpeaker = access.isStudent ? "CANDIDATE" : "INTERVIEWER";

  try {
    await db.query(
      "INSERT INTO interview_transcripts (interview_id, speaker, message) VALUES (?, ?, ?)",
      [Number(interviewId), canonicalSpeaker, rawMessage]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error saving transcript line:", err);
    res.status(500).json({ success: false, message: "Failed to save transcript" });
  }
});

// Get all Transcripts
router.get("/:interviewId/transcripts", authenticate, async (req: any, res) => {
  const { interviewId } = req.params;
  const access = await resolveInterviewAccess(interviewId, req.user);

  if (!access.canAccess) {
    return res.status(access.statusCode || 404).json({
      success: false,
      code: access.code || "INTERVIEW_NOT_FOUND",
      message: access.error || "Interview not found"
    });
  }

  try {
    const [rows]: any = await db.query(
      "SELECT id, speaker, message, timestamp FROM interview_transcripts WHERE interview_id = ? ORDER BY id ASC",
      [Number(interviewId)]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching transcripts:", err);
    res.status(500).json({ success: false, message: "Failed to load transcripts" });
  }
});

// CHEATING/VIOLATION ENGINE: Log Warning
router.post("/:interviewId/warning", authenticate, async (req: any, res) => {
  const { interviewId } = req.params;
  const access = await resolveInterviewAccess(interviewId, req.user);

  if (!access.canAccess) {
    return res.status(access.statusCode || 404).json({
      success: false,
      code: access.code || "INTERVIEW_NOT_FOUND",
      message: access.error || "Interview not found"
    });
  }

  const { warningType, message } = req.body;

  try {
    await db.query(
      "INSERT INTO interview_warnings (interview_id, warning_type, message) VALUES (?, ?, ?)",
      [Number(interviewId), warningType || "GENERAL", message || ""]
    );

    await db.query(
      "INSERT INTO interview_events (interview_id, event_type, details) VALUES (?, 'WARNING', ?)",
      [Number(interviewId), `Violation: ${warningType} - ${message}`]
    );

    res.json({ success: true, message: "Warning recorded and logged" });
  } catch (err) {
    console.error("Error recording warning:", err);
    res.status(500).json({ success: false, message: "Failed to save warning" });
  }
});

// AUDIT ENGINE: Log Event
router.post("/:interviewId/log-event", authenticate, async (req: any, res) => {
  const { interviewId } = req.params;
  const access = await resolveInterviewAccess(interviewId, req.user);

  if (!access.canAccess) {
    return res.status(access.statusCode || 404).json({
      success: false,
      code: access.code || "INTERVIEW_NOT_FOUND",
      message: access.error || "Interview not found"
    });
  }

  const { eventType, details } = req.body;

  try {
    await db.query(
      "INSERT INTO interview_events (interview_id, event_type, details) VALUES (?, ?, ?)",
      [Number(interviewId), eventType || "GENERIC_EVENT", details || ""]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error logging event:", err);
    res.status(500).json({ success: false, message: "Failed to log event" });
  }
});

// Get Timeline Log
router.get("/:interviewId/timeline", authenticate, async (req: any, res) => {
  const { interviewId } = req.params;
  const access = await resolveInterviewAccess(interviewId, req.user);

  if (!access.canAccess) {
    return res.status(access.statusCode || 404).json({
      success: false,
      code: access.code || "INTERVIEW_NOT_FOUND",
      message: access.error || "Interview not found"
    });
  }

  try {
    const [events]: any = await db.query(
      "SELECT id, event_type, details, created_at FROM interview_events WHERE interview_id = ? ORDER BY id ASC",
      [Number(interviewId)]
    );
    const [warnings]: any = await db.query(
      "SELECT id, warning_type, message, created_at FROM interview_warnings WHERE interview_id = ? ORDER BY id ASC",
      [Number(interviewId)]
    );
    res.json({ success: true, data: { events, warnings } });
  } catch (err) {
    console.error("Error reading timeline:", err);
    res.status(500).json({ success: false, message: "Failed to read timeline log" });
  }
});

// EVALUATION PANEL: Save Ratings and Comments
router.post("/:interviewId/evaluate", authenticate, async (req: any, res) => {
  const { interviewId } = req.params;
  const access = await resolveInterviewAccess(interviewId, req.user);

  if (!access.canAccess) {
    return res.status(access.statusCode || 404).json({
      success: false,
      code: access.code || "INTERVIEW_NOT_FOUND",
      message: access.error || "Interview not found"
    });
  }

  if (!access.isInterviewer) {
    return res.status(403).json({
      success: false,
      code: "STUDENT_CANNOT_EVALUATE",
      message: "Students cannot submit manual interview evaluations"
    });
  }

  const { 
    technicalKnowledge, 
    communication, 
    confidence, 
    leadership, 
    problemSolving, 
    culturalFit, 
    comments 
  } = req.body;

  try {
    const [existing]: any = await db.query("SELECT id FROM interview_evaluations WHERE interview_id = ?", [Number(interviewId)]);
    if (existing && existing.length > 0) {
      await db.query(
        `UPDATE interview_evaluations 
         SET technical_knowledge = ?, communication = ?, confidence = ?, leadership = ?, problem_solving = ?, cultural_fit = ?, comments = ?, saved_at = CURRENT_TIMESTAMP
         WHERE interview_id = ?`,
        [Number(technicalKnowledge), Number(communication), Number(confidence), Number(leadership), Number(problemSolving), Number(culturalFit), comments, Number(interviewId)]
      );
    } else {
      await db.query(
        `INSERT INTO interview_evaluations (interview_id, technical_knowledge, communication, confidence, leadership, problem_solving, cultural_fit, comments)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [Number(interviewId), Number(technicalKnowledge), Number(communication), Number(confidence), Number(leadership), Number(problemSolving), Number(culturalFit), comments]
      );
    }
    res.json({ success: true, message: "Evaluations saved successfully" });
  } catch (err) {
    console.error("Error saving evaluation:", err);
    res.status(500).json({ success: false, message: "Failed to save evaluation ratings" });
  }
});

// Get Current Evaluation
router.get("/:interviewId/evaluation", authenticate, async (req: any, res) => {
  const { interviewId } = req.params;
  const access = await resolveInterviewAccess(interviewId, req.user);

  if (!access.canAccess) {
    return res.status(access.statusCode || 404).json({
      success: false,
      code: access.code || "INTERVIEW_NOT_FOUND",
      message: access.error || "Interview not found"
    });
  }

  try {
    const [rows]: any = await db.query("SELECT * FROM interview_evaluations WHERE interview_id = ?", [Number(interviewId)]);
    res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    console.error("Error fetching evaluation:", err);
    res.status(500).json({ success: false, message: "Failed to load evaluation" });
  }
});

// AI ENGINE: TRUTHFUL TRANSCRIPT ANALYSIS
router.post("/:interviewId/ai-analyze", authenticate, async (req: any, res) => {
  const { interviewId } = req.params;
  const access = await resolveInterviewAccess(interviewId, req.user);

  if (!access.canAccess) {
    return res.status(access.statusCode || 404).json({
      success: false,
      code: access.code || "INTERVIEW_NOT_FOUND",
      message: access.error || "Interview not found"
    });
  }

  if (!access.isInterviewer) {
    return res.status(403).json({
      success: false,
      code: "STUDENT_CANNOT_REQUEST_AI_ANALYSIS",
      message: "Students cannot request AI interview analysis"
    });
  }

  try {
    const evalRes = await processInterviewEvaluation(Number(interviewId));
    if (evalRes.evaluationStatus === "FAILED") {
      return res.status(200).json({
        success: false,
        evaluationStatus: "FAILED",
        evaluationScore: null,
        recommendation: null,
        failureCode: evalRes.failureCode || "AI_EVALUATION_FAILED",
        message: "AI transcript analysis failed or transcript was empty"
      });
    }

    res.json({
      success: true,
      evaluationStatus: evalRes.evaluationStatus,
      analysis: {
        communication_score: evalRes.communicationScore,
        confidence_score: evalRes.confidenceScore,
        technical_understanding_score: evalRes.technicalScore,
        problem_solving_score: evalRes.problemSolvingScore,
        leadership_score: evalRes.leadershipScore,
        overall_recommendation: evalRes.recommendation,
        hiring_recommendation: evalRes.hiringRecommendation,
        strengths: evalRes.strengths,
        weaknesses: evalRes.weaknesses
      }
    });
  } catch (err) {
    console.error("AI Analysis error:", err);
    res.status(500).json({ success: false, message: "AI Analysis system temporary error" });
  }
});

// GET COMPREHENSIVE COMBINED POST INTERVIEW REPORT JSON/DATA
router.get("/:interviewId/report", authenticate, async (req: any, res) => {
  const { interviewId } = req.params;
  const access = await resolveInterviewAccess(interviewId, req.user);

  if (!access.canAccess || !access.schedule) {
    return res.status(access.statusCode || 404).json({
      success: false,
      code: access.code || "INTERVIEW_NOT_FOUND",
      message: access.error || "Interview not found"
    });
  }

  try {
    const schedule = access.schedule;

    const [evalRows]: any = await db.query("SELECT * FROM interview_evaluations WHERE interview_id = ?", [Number(interviewId)]);
    const evaluation = evalRows?.[0] || null;

    const [aiRows]: any = await db.query("SELECT * FROM interview_ai_analysis WHERE interview_id = ?", [Number(interviewId)]);
    const aiAnalysis = aiRows?.[0] || null;

    const [warnings]: any = await db.query("SELECT * FROM interview_warnings WHERE interview_id = ?", [Number(interviewId)]);

    const [transcripts]: any = await db.query("SELECT * FROM interview_transcripts WHERE interview_id = ? ORDER BY id ASC", [Number(interviewId)]);

    res.json({
      success: true,
      data: {
        schedule,
        evaluation,
        aiAnalysis,
        warnings,
        transcriptsCount: (transcripts || []).length,
        transcripts: transcripts || []
      }
    });
  } catch (err) {
    console.error("Error creating compiled report:", err);
    res.status(500).json({ success: false, message: "Failed to load report" });
  }
});

export default router;

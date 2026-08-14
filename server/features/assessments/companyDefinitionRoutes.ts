import express from "express";
import db from "../../db.ts";
import { authenticate, authorize } from "../../middleware/auth.ts";
const router = express.Router();
router.use(authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]));
import crypto from "crypto";
// 4. Company & Student Assessment Workflow Endpoints
// -------------------------------------------------------------

// Helper to resolve company ID for user
async function resolveCompanyIdForUser(user: any) {
  if (!user) return null;
  if (user.role === "COMPANY" || user.role === "COMPANY_HR" || user.role === "COMPANY_SUB_HR" || user.role === "COMPANY_ADMIN") {
    const [profiles]: any = await db.query("SELECT id FROM company_profiles WHERE user_id = ?", [user.id || user.userId]);
    if (profiles.length > 0) return profiles[0].id;

    const [hrProfiles]: any = await db.query("SELECT company_id FROM company_hr_profiles WHERE user_id = ?", [user.id || user.userId]);
    if (hrProfiles.length > 0) return hrProfiles[0].company_id;
  }
  return null;
}

// GET /api/assessments/company/tests
router.get("/company/tests", authenticate, async (req: any, res) => {
  try {
    const companyId = await resolveCompanyIdForUser(req.user);
    if (!companyId) {
      return res.json({ success: true, data: [] });
    }

    const [profiles]: any = await db.query("SELECT company_name FROM company_profiles WHERE id = ?", [companyId]);
    const companyName = profiles[0]?.company_name || "Company";

    // Query definitions from company_assessment_definitions
    const [defs]: any = await db.query(`
      SELECT * FROM company_assessment_definitions
      WHERE company_id = ?
      ORDER BY id DESC
    `, [companyId]);

    const results: any[] = [];

    for (const def of defs) {
      const qs = typeof def.questions_json === "string" ? JSON.parse(def.questions_json) : (def.questions_json || []);

      // Find assignments
      const [assignments]: any = await db.query(`
        SELECT caa.*, j.title as job_title, js.stage_name
        FROM company_assessment_assignments caa
        JOIN jobs j ON caa.job_id = j.id
        LEFT JOIN job_stages js ON caa.stage_id = js.id
        WHERE caa.definition_version_id = ? AND caa.status = 'ACTIVE'
      `, [def.id]);

      let submissionsCount = 0;
      let avgScore = 0;
      let assignedCount = 0;

      if (assignments.length > 0) {
        const assignmentIds = assignments.map((a: any) => a.id);
        const placeholders = assignmentIds.map(() => "?").join(",");

        const [subStats]: any = await db.query(`
          SELECT COUNT(*) as count, AVG(score) as avg_score
          FROM test_submissions
          WHERE assignment_id IN (${placeholders})
        `, assignmentIds);
        submissionsCount = subStats[0]?.count || 0;
        avgScore = Math.round(subStats[0]?.avg_score || 0);

        const jobIds = [...new Set(assignments.map((a: any) => a.job_id))];
        const jobPlaceholders = jobIds.map(() => "?").join(",");
        const [appStats]: any = await db.query(`
          SELECT COUNT(*) as count FROM job_applications
          WHERE job_id IN (${jobPlaceholders}) AND status != 'REJECTED' AND status != 'CANCELLED'
        `, jobIds);
        assignedCount = appStats[0]?.count || 0;
      }

      const mappedQuestions = qs.map((q: any, i: number) => ({
        id: q.id || `q-${def.id}-${i}`,
        type: q.type || 'MCQ',
        questionText: q.questionText || q.question || q.text || '',
        options: Array.isArray(q.options) ? q.options : (q.options_json || ['', '', '', '']),
        correctOption: q.correctOption !== undefined ? Number(q.correctOption) : 0,
        points: Number(q.points || q.marks) || 10,
        difficulty: q.difficulty || 'MEDIUM'
      }));

      const totalMarks = def.total_marks || mappedQuestions.reduce((acc: number, q: any) => acc + (q.points || 10), 0) || 100;
      const primaryJobTitle = assignments.length > 0 ? assignments[0].job_title : "Unassigned";

      results.push({
        id: String(def.id),
        job_id: assignments.length > 0 ? assignments[0].job_id : null,
        job_title: primaryJobTitle,
        title: def.title,
        description: def.description || '',
        created_by: companyName,
        created_date: def.created_at ? new Date(def.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        questions_count: qs.length,
        duration: def.duration_minutes || 30,
        cutoff_score: def.cutoff_score !== undefined ? Number(def.cutoff_score) : 40,
        total_marks: totalMarks,
        status: def.status || 'DRAFT',
        version: def.version || 1,
        assigned_count: assignedCount,
        submissions_count: submissionsCount,
        average_score: avgScore,
        questions: mappedQuestions,
        instructions: "Please answer all questions carefully.",
        assignments: assignments.map((a: any) => ({
          id: a.id,
          jobId: a.job_id,
          jobTitle: a.job_title,
          stageId: a.stage_id,
          stageName: a.stage_name,
          cutoffScore: Number(a.cutoff_score)
        }))
      });
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error("Error in GET /api/assessments/company/tests:", error);
    res.status(500).json({ success: false, message: "Failed to fetch company tests" });
  }
});

// GET /api/assessments/company/history
router.get("/company/history", authenticate, async (req: any, res) => {
  try {
    const companyId = await resolveCompanyIdForUser(req.user);
    if (!companyId) {
      return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20 } });
    }

    const { jobId, searchQuery, status } = req.query;

    const rawPage = Number(req.query.page ?? 1);
    const rawLimit = Number(req.query.limit ?? 20);

    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
    const offset = (page - 1) * limit;

    const numericCompanyId = Number(companyId);
    if (!numericCompanyId || numericCompanyId <= 0 || isNaN(numericCompanyId)) {
      return res.status(400).json({ success: false, message: "Invalid company ID" });
    }

    let whereSql = ` WHERE (caa.company_id = ? OR j.company_id = ?)`;
    const whereParams: any[] = [numericCompanyId, numericCompanyId];

    if (jobId && jobId !== 'all') {
      whereSql += ` AND ts.job_id = ?`;
      whereParams.push(Number(jobId));
    }

    if (status && status !== 'all') {
      if (status === 'passed') {
        whereSql += ` AND (ts.passed = 1 OR ts.score >= ts.cutoff_score)`;
      } else if (status === 'failed') {
        whereSql += ` AND (ts.passed = 0 AND ts.score < ts.cutoff_score)`;
      }
    }

    if (searchQuery) {
      whereSql += ` AND (sp.full_name LIKE ? OR u.email LIKE ? OR j.title LIKE ?)`;
      const q = `%${searchQuery}%`;
      whereParams.push(q, q, q);
    }

    const countSql = `
      SELECT COUNT(*) as total
      FROM test_submissions ts
      LEFT JOIN company_assessment_assignments caa ON ts.assignment_id = caa.id
      LEFT JOIN company_assessment_definitions cad ON (ts.assessment_version_id = cad.id OR caa.definition_version_id = cad.id)
      LEFT JOIN job_applications a ON ts.application_id = a.id
      LEFT JOIN jobs j ON (ts.job_id = j.id OR caa.job_id = j.id)
      LEFT JOIN student_profiles sp ON ts.student_id = sp.id
      LEFT JOIN users u ON sp.user_id = u.id
      ${whereSql}
    `;

    const [countRows]: any = await db.query(countSql, whereParams);
    const total = Number(countRows[0]?.total || 0);

    const dataSql = `
      SELECT 
        ts.id as attempt_id,
        ts.job_id,
        ts.application_id,
        ts.student_id,
        ts.score,
        ts.total_marks,
        ts.percentage,
        ts.passed,
        ts.cutoff_score,
        ts.violations_count,
        COALESCE(ev.event_count, 0) as event_count,
        ts.status as submission_status,
        ts.submitted_at,
        ts.submitted_at as started_at,
        ts.assessment_version,
        sp.full_name as candidate_name,
        u.email as candidate_email,
        j.title as job_title,
        cad.id as definition_id,
        cad.title as test_title,
        ts.questions_json
      FROM test_submissions ts
      LEFT JOIN company_assessment_assignments caa ON ts.assignment_id = caa.id
      LEFT JOIN company_assessment_definitions cad ON (ts.assessment_version_id = cad.id OR caa.definition_version_id = cad.id)
      LEFT JOIN job_applications a ON ts.application_id = a.id
      LEFT JOIN jobs j ON (ts.job_id = j.id OR caa.job_id = j.id)
      LEFT JOIN student_profiles sp ON ts.student_id = sp.id
      LEFT JOIN users u ON sp.user_id = u.id
      LEFT JOIN (SELECT attempt_id, COUNT(*) AS event_count FROM test_submission_events GROUP BY attempt_id) ev ON ev.attempt_id = ts.id
      ${whereSql}
      ORDER BY ts.submitted_at DESC, ts.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [rows]: any = await db.query(dataSql, whereParams);

    const attemptsList = (rows || []).map((row: any) => {
      const qs = typeof row.questions_json === "string" ? JSON.parse(row.questions_json) : (row.questions_json || []);
      const testTitle = row.test_title || `${row.job_title} Assessment`;
      const totalScore = row.total_marks || (qs.length * 10) || 100;
      const cutoff = row.cutoff_score !== undefined ? Number(row.cutoff_score) : 40;
      const isPassed = row.passed === 1 || row.score >= cutoff;
      const eventCount = Number(row.event_count || row.violations_count || 0);

      return {
        id: String(row.attempt_id),
        attemptId: String(row.attempt_id),
        applicationId: row.application_id,
        jobId: row.job_id,
        jobTitle: row.job_title,
        candidateName: row.candidate_name,
        candidateEmail: row.candidate_email,
        assessmentTitle: testTitle,
        version: row.assessment_version || 1,
        score: Math.round(row.score || 0),
        totalMarks: totalScore,
        percentage: Math.round(row.percentage || ((row.score / totalScore) * 100) || 0),
        cutoffScore: cutoff,
        status: isPassed ? 'Passed' : 'Failed',
        isPassed,
        violationsCount: eventCount,
        integrityReviewFlag: eventCount > 2,
        startedAt: row.started_at ? new Date(row.started_at).toLocaleString() : new Date().toLocaleString(),
        completedAt: row.submitted_at ? new Date(row.submitted_at).toLocaleString() : new Date().toLocaleString()
      };
    });

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: attemptsList,
      attempts: attemptsList,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/assessments/company/history:", error);
    res.status(500).json({ success: false, message: "Failed to fetch assessment history" });
  }
});

// GET /api/assessments/company/attempts (Alias)
router.get("/company/attempts", authenticate, async (req: any, res) => {
  return res.redirect(307, "/api/assessments/company/history");
});

function computeAssessmentCreateHash(body: any): string {
  const normalizedQuestions = (Array.isArray(body.questions) ? body.questions : []).map((q: any) => ({
    questionText: (q.questionText || q.question || q.text || '').trim(),
    options: (Array.isArray(q.options) ? q.options : []).map((o: any) => String(o).trim()),
    correctOption: Number(q.correctOption),
    points: Number(q.points || q.marks) || 10
  }));

  const payload = {
    title: (body.title || '').trim(),
    description: (body.description || '').trim(),
    duration: Number(body.duration || body.duration_minutes) || 30,
    questions: normalizedQuestions
  };

  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

// POST /api/assessments/company/create
router.post("/company/create", authenticate, async (req: any, res) => {
  const companyId = await resolveCompanyIdForUser(req.user);
  if (!companyId) {
    return res.status(403).json({ success: false, message: "Company profile not found" });
  }

  try {
    const {
      jobId, job_id, stageId, stage_id, cutoffScore, cutoff_score,
      attemptsAllowed, availabilityStart, availabilityEnd,
      title, description, duration = 30, questions
    } = req.body;

    // Reject assignment fields in creation
    if (
      jobId !== undefined || job_id !== undefined ||
      stageId !== undefined || stage_id !== undefined ||
      cutoffScore !== undefined || cutoff_score !== undefined ||
      attemptsAllowed !== undefined ||
      availabilityStart !== undefined || availabilityEnd !== undefined
    ) {
      return res.status(400).json({
        success: false,
        code: "ASSIGNMENT_FIELDS_NOT_ALLOWED",
        message: "Job/stage assignment fields are not permitted during assessment creation. Create the Draft Assessment first, publish it, and assign it through the Assessment assignment endpoint."
      });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: "At least one question is required" });
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qText = q.questionText || q.question || q.text || '';
      if (!qText.trim()) {
        return res.status(400).json({ success: false, message: `Question ${i + 1} text cannot be empty` });
      }
      const opts = Array.isArray(q.options) ? q.options : [];
      if (opts.length !== 4 || opts.some((o: any) => typeof o !== 'string' || !o.trim())) {
        return res.status(400).json({ success: false, message: `Question ${i + 1} must have 4 non-empty options` });
      }
      if (q.correctOption === undefined || q.correctOption === null) {
        return res.status(400).json({ success: false, message: `Question ${i + 1} requires correctOption` });
      }
      const corr = Number(q.correctOption);
      if (isNaN(corr) || corr < 0 || corr > 3) {
        return res.status(400).json({ success: false, message: `Question ${i + 1} correctOption must be between 0 and 3` });
      }
      const pts = Number(q.points || q.marks || 10);
      if (isNaN(pts) || pts <= 0) {
        return res.status(400).json({ success: false, message: `Question ${i + 1} points must be greater than 0` });
      }
    }

    const totalScore = questions.reduce((sum: number, q: any) => sum + (Number(q.points || q.marks) || 10), 0);

    const idempotencyKey = req.headers['idempotency-key'] || req.body.clientRequestId || req.body.idempotencyKey;

    if (idempotencyKey) {
      const requestHash = computeAssessmentCreateHash(req.body);
      const [existingRows]: any = await db.query(
        "SELECT * FROM assessment_idempotency_requests WHERE company_id = ? AND operation = 'CREATE_ASSESSMENT' AND idempotency_key = ?",
        [companyId, idempotencyKey]
      );

      if (existingRows && existingRows.length > 0) {
        const existingRow = existingRows[0];
        if (existingRow.request_hash !== requestHash) {
          return res.status(409).json({
            success: false,
            code: "IDEMPOTENCY_KEY_REUSED",
            message: "Idempotency key reused with different request payload"
          });
        }
        if (existingRow.status === 'COMPLETED' && existingRow.response_json) {
          return res.status(201).json(typeof existingRow.response_json === 'string' ? JSON.parse(existingRow.response_json) : existingRow.response_json);
        }
      } else {
        try {
          await db.query(
            "INSERT INTO assessment_idempotency_requests (company_id, operation, idempotency_key, request_hash, status, locked_at) VALUES (?, 'CREATE_ASSESSMENT', ?, ?, 'PENDING', CURRENT_TIMESTAMP)",
            [companyId, idempotencyKey, requestHash]
          );
        } catch (err: any) {}
      }
    }

    const formattedQuestions = questions.map((q: any, i: number) => ({
      id: q.id || `q-${Date.now()}-${i}`,
      type: q.type || 'MCQ',
      questionText: (q.questionText || q.question || q.text || '').trim(),
      options: q.options.map((o: any) => String(o).trim()),
      correctOption: Number(q.correctOption),
      points: Number(q.points || q.marks) || 10,
      difficulty: q.difficulty || 'MEDIUM'
    }));

    const questionsJson = JSON.stringify(formattedQuestions);

    const responsePayload = await db.transaction(async (tx) => {
      const [insertRes]: any = await tx.query(`
        INSERT INTO company_assessment_definitions (company_id, title, description, questions_json, duration_minutes, cutoff_score, total_marks, version, status)
        VALUES (?, ?, ?, ?, ?, 40.00, ?, 1, 'DRAFT')
      `, [companyId, title || 'Draft Assessment', description || '', questionsJson, Number(duration), totalScore]);

      const newId = insertRes.insertId;

      return {
        success: true,
        message: "Assessment draft saved successfully!",
        data: {
          id: String(newId),
          title: title || 'Draft Assessment',
          description: description || '',
          questions_count: formattedQuestions.length,
          duration: Number(duration),
          cutoff_score: 40,
          total_marks: totalScore,
          status: 'DRAFT',
          version: 1,
          questions: formattedQuestions
        }
      };
    });

    if (idempotencyKey) {
      await db.query(
        "UPDATE assessment_idempotency_requests SET status = 'COMPLETED', assessment_id = ?, response_json = ?, completed_at = CURRENT_TIMESTAMP WHERE company_id = ? AND operation = 'CREATE_ASSESSMENT' AND idempotency_key = ?",
        [responsePayload.data.id, JSON.stringify(responsePayload), companyId, idempotencyKey]
      );
    }

    res.status(201).json(responsePayload);
  } catch (error: any) {
    console.error("Error in POST /api/assessments/company/create:", error);
    if (error.code === 'ER_NO_SUCH_TABLE' || error.message?.includes("doesn't exist") || error.message?.includes("no such table")) {
      return res.status(503).json({
        success: false,
        code: "ASSESSMENT_SCHEMA_NOT_READY",
        message: "Assessment system database table is missing or migration is pending."
      });
    }
    res.status(500).json({ success: false, message: error.message || "Failed to create assessment" });
  }
});

// PUT /api/assessments/company/tests/:id (Edit definition)
router.put("/company/tests/:id", authenticate, async (req: any, res) => {
  try {
    const companyId = await resolveCompanyIdForUser(req.user);
    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company profile not found" });
    }

    const definitionId = req.params.id;
    const { title, description, duration, questions } = req.body;

    const [defs]: any = await db.query("SELECT * FROM company_assessment_definitions WHERE id = ?", [definitionId]);
    if (defs.length === 0) {
      return res.status(404).json({ success: false, message: "Assessment definition not found" });
    }

    const def = defs[0];
    if (Number(def.company_id) !== Number(companyId)) {
      return res.status(403).json({ success: false, message: "Unauthorized: Assessment belongs to another company" });
    }

    const formattedQuestions = (questions || []).map((q: any, i: number) => ({
      id: q.id || `q-${Date.now()}-${i}`,
      type: q.type || 'MCQ',
      questionText: (q.questionText || q.question || q.text || '').trim(),
      options: (q.options || []).map((o: any) => String(o).trim()),
      correctOption: Number(q.correctOption),
      points: Number(q.points || q.marks) || 10,
      difficulty: q.difficulty || 'MEDIUM'
    }));

    const questionsJson = JSON.stringify(formattedQuestions);
    const totalScore = formattedQuestions.reduce((sum: number, q: any) => sum + (q.points || 10), 0) || 100;
    const durMinutes = Number(duration || def.duration_minutes) || 30;

    if (def.status === 'DRAFT') {
      // Update DRAFT in place
      await db.query(`
        UPDATE company_assessment_definitions
        SET title = ?, description = ?, questions_json = ?, duration_minutes = ?, total_marks = ?
        WHERE id = ?
      `, [title || def.title, description !== undefined ? description : def.description, questionsJson, durMinutes, totalScore, definitionId]);

      return res.json({
        success: true,
        message: "Draft assessment updated successfully",
        data: {
          id: String(definitionId),
          title: title || def.title,
          status: 'DRAFT',
          version: def.version,
          questions: formattedQuestions
        }
      });
    } else {
      // Create new DRAFT version when editing PUBLISHED definition
      const newVersion = def.version + 1;
      const [insertRes]: any = await db.query(`
        INSERT INTO company_assessment_definitions (company_id, title, description, questions_json, duration_minutes, cutoff_score, total_marks, version, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')
      `, [companyId, title || def.title, description !== undefined ? description : def.description, questionsJson, durMinutes, def.cutoff_score, totalScore, newVersion]);

      return res.status(201).json({
        success: true,
        message: `New draft version v${newVersion} created from published assessment`,
        data: {
          id: String(insertRes.insertId),
          title: title || def.title,
          status: 'DRAFT',
          version: newVersion,
          questions: formattedQuestions
        }
      });
    }
  } catch (error: any) {
    console.error("Error in PUT /api/assessments/company/tests/:id:", error);
    res.status(500).json({ success: false, message: "Failed to update assessment definition" });
  }
});

// POST /api/assessments/company/publish
router.post("/company/publish", authenticate, async (req: any, res) => {
  try {
    const companyId = await resolveCompanyIdForUser(req.user);
    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company profile not found" });
    }

    const { assessmentId, id, assessment_id } = req.body;
    const targetId = assessmentId || id || assessment_id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: "Assessment ID is required for publishing" });
    }

    const [defs]: any = await db.query("SELECT * FROM company_assessment_definitions WHERE id = ?", [targetId]);
    if (defs.length === 0) {
      return res.status(404).json({ success: false, message: "Assessment definition not found" });
    }

    const def = defs[0];
    if (Number(def.company_id) !== Number(companyId)) {
      return res.status(403).json({ success: false, message: "Unauthorized: Assessment belongs to another company" });
    }

    const qs = typeof def.questions_json === "string" ? JSON.parse(def.questions_json) : (def.questions_json || []);
    if (!Array.isArray(qs) || qs.length === 0) {
      return res.status(400).json({ success: false, message: "Cannot publish assessment with no questions" });
    }

    await db.query("UPDATE company_assessment_definitions SET status = 'PUBLISHED' WHERE id = ?", [targetId]);

    res.json({
      success: true,
      message: "Assessment published successfully",
      data: {
        id: String(targetId),
        title: def.title,
        version: def.version,
        status: 'PUBLISHED'
      }
    });
  } catch (error: any) {
    console.error("Error in POST /api/assessments/company/publish:", error);
    res.status(500).json({ success: false, message: "Failed to publish assessment" });
  }
});

// POST /api/assessments/company/assign
router.post("/company/assign", authenticate, async (req: any, res) => {
  try {
    const { assessmentId, jobId, stageId, cutoffScore } = req.body;
    const companyId = await resolveCompanyIdForUser(req.user);

    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company profile not found" });
    }

    if (!assessmentId || !jobId) {
      return res.status(400).json({ success: false, message: "Assessment ID and Job ID are required" });
    }

    // Verify definition is published
    const [defs]: any = await db.query("SELECT * FROM company_assessment_definitions WHERE id = ?", [assessmentId]);
    if (defs.length === 0) {
      return res.status(404).json({ success: false, message: "Assessment definition not found" });
    }

    const def = defs[0];
    if (Number(def.company_id) !== Number(companyId)) {
      return res.status(403).json({ success: false, message: "Unauthorized: Assessment belongs to another company" });
    }

    if (def.status === 'DRAFT') {
      return res.status(400).json({ success: false, message: "Draft assessment cannot be assigned until published" });
    }

    // Verify job belongs to company and is active
    const [jobs]: any = await db.query("SELECT * FROM jobs WHERE id = ?", [jobId]);
    if (jobs.length === 0) {
      return res.status(404).json({ success: false, message: "Target job not found" });
    }
    const job = jobs[0];
    if (Number(job.company_id) !== Number(companyId)) {
      return res.status(403).json({ success: false, message: "Unauthorized: Job belongs to another company" });
    }
    const isEnded = String(job.status || '').toUpperCase() === 'ENDED' || String(job.status || '').toUpperCase() === 'CLOSED';
    if (isEnded) {
      return res.status(400).json({ success: false, code: "JOB_ENDED_READ_ONLY", message: "Candidates in an ended job are read-only." });
    }

    // Verify stage belongs to job and is testing stage
    let verifiedStageId = stageId;
    if (stageId) {
      const [stages]: any = await db.query("SELECT * FROM job_stages WHERE id = ?", [stageId]);
      if (stages.length === 0 || Number(stages[0].job_id) !== Number(jobId)) {
        return res.status(400).json({ success: false, message: "Specified stage does not belong to target job" });
      }
      const stName = String(stages[0].stage_name || '').toUpperCase();
      const stType = String(stages[0].stage_type || '').toUpperCase();
      const isTesting = stType === 'TEST' || stType === 'TESTING' || stType === 'ASSESSMENT' || stName.includes('TEST') || stName.includes('ASSESS');
      if (!isTesting) {
        return res.status(400).json({ success: false, message: "Assessment can only be assigned to a TESTING stage" });
      }
    }

    const numCutoff = cutoffScore !== undefined ? Number(cutoffScore) : Number(def.cutoff_score || 40);
    const totalMarks = Number(def.total_marks || 100);
    if (isNaN(numCutoff) || numCutoff < 0 || numCutoff >= totalMarks) {
      return res.status(400).json({ success: false, message: "Cutoff score must be at least 0 and strictly less than total marks" });
    }

    // Upsert assignment in company_assessment_assignments
    const [existingAssn]: any = await db.query(`
      SELECT id FROM company_assessment_assignments
      WHERE job_id = ? AND status = 'ACTIVE'
    `, [jobId]);

    let assignmentId;
    if (existingAssn.length > 0) {
      assignmentId = existingAssn[0].id;
      await db.query(`
        UPDATE company_assessment_assignments
        SET definition_version_id = ?, stage_id = ?, cutoff_score = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [assessmentId, verifiedStageId || null, numCutoff, assignmentId]);
    } else {
      const [insertRes]: any = await db.query(`
        INSERT INTO company_assessment_assignments (company_id, definition_version_id, job_id, stage_id, cutoff_score, status)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE')
      `, [companyId, assessmentId, jobId, verifiedStageId || null, numCutoff]);
      assignmentId = insertRes.insertId;
    }

    res.json({
      success: true,
      message: `Assessment assigned to job ${job.title} successfully.`,
      assignment: {
        id: assignmentId,
        assessmentId,
        jobId,
        stageId: verifiedStageId || null,
        cutoffScore: numCutoff,
        version: def.version
      }
    });
  } catch (error: any) {
    console.error("Error in POST /api/assessments/company/assign:", error);
    res.status(500).json({ success: false, message: "Failed to assign assessment" });
  }
});

// GET /api/assessments/student/eligible

export default router;

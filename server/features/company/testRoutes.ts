import express from "express";
import db from "../../db.ts";
import { authenticate, authorize, requireSelfParam } from "../../middleware/auth.ts";
import { requireOwnedCompanyJob, requireOwnedCompanyTest } from "./companyAccess.ts";
const router = express.Router();
// Test management for companies
router.post("/tests", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireOwnedCompanyJob, async (req: any, res) => {
  const { jobId, stageId, questions } = req.body;
  try {
    // If stageId is provided, save in the stage-specific test tables
    if (stageId) {
      // 1. Delete old test questions for this stage
      await db.query("DELETE FROM test_questions WHERE stage_id = ?", [stageId]);
      
      // 2. Insert questions in one batch instead of one round trip per question.
      if (Array.isArray(questions) && questions.length > 0) {
        const values = questions.map(() => '(?, ?, ?, ?)').join(',');
        const params = questions.flatMap((q: any) => {
          const qText = q.questionText || q.text || q.question || "";
          const options = q.options || q.options_json || [];
          const correctAns = q.correctOption !== undefined ? (options[q.correctOption] || q.correct_answer) : (q.correctAnswer || q.correct_answer || "");
          return [stageId, qText, JSON.stringify(options), correctAns];
        });
        await db.query(`INSERT INTO test_questions (stage_id, question_text, options_json, correct_answer) VALUES ${values}`, params);
      }
      
      // 3. Insert or update the test schedules table so it becomes active for students
      const duration = (questions && questions[0]?.duration) || 30;
      await db.query("DELETE FROM test_schedules WHERE job_id = ? AND stage_id = ?", [jobId, stageId]);
      await db.query(`
        INSERT INTO test_schedules (job_id, stage_id, scheduled_at, duration_minutes, cutoff_score, status)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE')
      `, [jobId, stageId, new Date().toISOString().slice(0, 19).replace('T', ' '), duration, 60]);

      // 4. Notify students currently in this stage!
      const [applicants]: any = await db.query(`
        SELECT SP.user_id, J.title, JS.stage_name
        FROM job_applications JA
        JOIN student_profiles SP ON JA.student_id = SP.id
        JOIN jobs J ON JA.job_id = J.id
        JOIN job_stages JS ON JA.current_stage_id = JS.id
        WHERE JA.job_id = ? AND JA.current_stage_id = ?
      `, [jobId, stageId]);

      if (applicants.length > 0) {
        const values = applicants.map(() => '(?, ?, ?, ?)').join(',');
        const params = applicants.flatMap((applicant: any) => [
          applicant.user_id, "Action Required: Test Scheduled",
          `An assessment test for "${applicant.title}" stage "${applicant.stage_name}" is now available. Please complete it in Applied Jobs.`, "WARNING"
        ]);
        await db.query(`INSERT INTO notifications (user_id, title, message, type) VALUES ${values}`, params);
      }
    }

    // Always keep tests legacy table in sync as a fallback
    await db.query(`
      INSERT INTO tests (job_id, questions_json) VALUES (?, ?) 
      ON DUPLICATE KEY UPDATE questions_json = VALUES(questions_json)
    `, [jobId, JSON.stringify(questions)]);

    res.json({ success: true, message: "Test created and assigned successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to create test" });
  }
});

router.get("/tests/:jobId", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireOwnedCompanyJob, async (req: any, res) => {
  try {
    const jobId = req.params.jobId;
    console.log(`📡 Fetching tests for Job ID: ${jobId}`);

    const [questions]: any = await db.query(`
      SELECT TQ.*, JS.stage_name, JS.job_id
      FROM test_questions TQ
      JOIN job_stages JS ON TQ.stage_id = JS.id
      WHERE JS.job_id = ?
    `, [jobId]);
    
    if (questions.length > 0) {
       console.log(`✅ Found ${questions.length} stage-specific questions`);
       return res.json({ success: true, data: questions });
    }

    // Fallback to legacy tests table
    console.log(`🔍 No stage-specific questions, checking legacy tests table for job ${jobId}...`);
    const [legacyTests]: any = await db.query("SELECT * FROM tests WHERE job_id = ?", [jobId]);
    if (legacyTests.length > 0) {
       console.log(`✅ Found legacy test for job ${jobId}`);
       const qs = typeof legacyTests[0].questions_json === 'string' ? JSON.parse(legacyTests[0].questions_json) : legacyTests[0].questions_json;
       const mapped = qs.map((q: any, i: number) => ({
          id: `legacy-${i}`,
          question_text: q.text || q.question,
          options_json: q.options || q.options_json,
          correct_answer: q.correctAnswer || q.answer || q.correct_answer,
          stage_id: -1
       }));
       return res.json({ success: true, data: mapped });
    }

    console.log(`⚠️ No questions found at all for job ${jobId}`);
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching test questions" });
  }
});

// GET /api/company/:userId/tests-history
router.get("/:userId/tests-history", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireSelfParam("userId"), async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get company profile ID
    const [profiles]: any = await db.query("SELECT id, company_name FROM company_profiles WHERE user_id = ?", [userId]);
    if (profiles.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const companyId = profiles[0].id;
    const companyName = profiles[0].company_name;

    // Get all jobs for this company
    const [jobs]: any = await db.query("SELECT id, title FROM jobs WHERE company_id = ?", [companyId]);
    if (jobs.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const jobIds = jobs.map((j: any) => j.id);
    const jobMap = new Map(jobs.map((j: any) => [j.id, j.title]));
    
    // Now fetch legacy tests
    const placeholders = jobIds.map(() => "?").join(",");
    const [legacyTests]: any = await db.query(`
      SELECT * FROM tests WHERE job_id IN (${placeholders})
    `, [...jobIds]);

    const results: any[] = [];

    // Batch all per-job aggregates once. This prevents the historical tests screen from
    // degrading into 3*N database round trips as the company creates more assessments.
    const [submissionStats]: any = await db.readQuery(`
      SELECT job_id, COUNT(*) AS count, AVG(score) AS avg_score
      FROM test_submissions
      WHERE job_id IN (${placeholders})
      GROUP BY job_id
    `, jobIds);
    const [assignmentStats]: any = await db.readQuery(`
      SELECT job_id, COUNT(*) AS count
      FROM job_applications
      WHERE job_id IN (${placeholders}) AND status = 'IN_PROGRESS'
      GROUP BY job_id
    `, jobIds);
    const [scheduleStats]: any = await db.readQuery(`
      SELECT job_id, MIN(stage_id) AS stage_id
      FROM test_schedules
      WHERE job_id IN (${placeholders})
      GROUP BY job_id
    `, jobIds);

    const submissionByJob = new Map(submissionStats.map((row: any) => [Number(row.job_id), row]));
    const assignmentByJob = new Map(assignmentStats.map((row: any) => [Number(row.job_id), row]));
    const scheduleByJob = new Map(scheduleStats.map((row: any) => [Number(row.job_id), row]));

    for (const test of legacyTests) {
      const qs = typeof test.questions_json === "string" ? JSON.parse(test.questions_json) : (test.questions_json || []);
      const questionsCount = qs.length;
      const submission = submissionByJob.get(Number(test.job_id)) as any;
      const assigned = assignmentByJob.get(Number(test.job_id)) as any;
      const schedule = scheduleByJob.get(Number(test.job_id)) as any;
      const submissionsCount = Number(submission?.count || 0);
      const avgScore = Math.round(Number(submission?.avg_score || 0));
      const assignedCount = Number(assigned?.count || 0);

      const mappedQuestions = qs.map((q: any, i: number) => ({
        id: q.id || `q-${test.id}-${i}`,
        type: q.type || 'MCQ',
        questionText: q.questionText || q.question || q.text || '',
        options: q.options || q.options_json || ['', '', '', ''],
        correctOption: q.correctOption !== undefined ? q.correctOption : (q.options?.indexOf(q.correctAnswer) !== -1 ? q.options?.indexOf(q.correctAnswer) : 0),
        points: q.points || 10,
        difficulty: q.difficulty || 'MEDIUM'
      }));

      results.push({
        id: String(test.id),
        job_id: test.job_id,
        job_title: jobMap.get(test.job_id) || "Unknown Job",
        title: qs[0]?.testTitle || `${jobMap.get(test.job_id) || 'Job'} Assessment`,
        created_by: companyName,
        created_date: new Date().toISOString().split('T')[0],
        questions_count: questionsCount,
        duration: qs[0]?.duration || 30,
        status: 'Active',
        assigned_count: assignedCount,
        submissions_count: submissionsCount,
        average_score: avgScore,
        questions: mappedQuestions,
        instructions: qs[0]?.instructions || "Please answer all questions carefully.",
        stage_id: schedule?.stage_id || null
      });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Error in tests-history:", error);
    res.status(500).json({ success: false, message: "Failed to fetch tests history" });
  }
});

// PUT /api/company/tests/:id
router.put("/tests/:id", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireOwnedCompanyTest, async (req: any, res) => {
  const testId = req.params.id;
  const { questions } = req.body;
  try {
    // Fetch current test to find its job_id
    const [currentTests]: any = await db.query("SELECT job_id FROM tests WHERE id = ?", [testId]);
    if (currentTests.length === 0) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }
    const jobId = currentTests[0].job_id;

    // Update legacy tests table
    await db.query(`
      UPDATE tests SET questions_json = ? WHERE id = ?
    `, [JSON.stringify(questions), testId]);

    // Also update any stage-specific test_questions and test_schedules if they exist
    const [scheds]: any = await db.query("SELECT stage_id FROM test_schedules WHERE job_id = ? LIMIT 1", [jobId]);
    if (scheds.length > 0) {
      const stageId = scheds[0].stage_id;
      // Delete old questions
      await db.query("DELETE FROM test_questions WHERE stage_id = ?", [stageId]);
      // Insert updated questions
      if (Array.isArray(questions)) {
        for (const q of questions) {
          const qText = q.questionText || q.text || q.question || "";
          const options = q.options || q.options_json || [];
          const correctAns = q.correctOption !== undefined ? (options[q.correctOption] || q.correct_answer) : (q.correctAnswer || q.correct_answer || "");
          await db.query(`
            INSERT INTO test_questions (stage_id, question_text, options_json, correct_answer)
            VALUES (?, ?, ?, ?)
          `, [stageId, qText, JSON.stringify(options), correctAns]);
        }
      }
    }

    res.json({ success: true, message: "Test updated successfully" });
  } catch (error) {
    console.error("Error in updating test:", error);
    res.status(500).json({ success: false, message: "Failed to update test" });
  }
});


export default router;

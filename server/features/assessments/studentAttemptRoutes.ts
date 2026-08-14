import express from "express";
import db from "../../db.ts";
import { authenticate, authorize } from "../../middleware/auth.ts";
const router = express.Router();
import { Type } from "@google/genai";
import { getTPOContext, getStudentContext, getCompanyContext, reverseGeocode, getIpLocation, parseUserAgent } from "./assessmentContext.ts";
import { handleCompanyStudentStart, submitAssessmentAttempt } from "./companyStudentWorkflowRoutes.ts";
router.post("/student/start", authenticate, authorize(["STUDENT"]), async (req: any, res) => {
  try {
    if (req.body.applicationId) {
      return handleCompanyStudentStart(req, res);
    }
    const { latitude, longitude, accuracy, ip_address, browser, device } = req.body;
    const assessment_id = req.body.assessment_id || req.body.testId;

    if (!assessment_id) {
      return res.status(400).json({ success: false, message: "Assessment ID is required" });
    }

    const context = await getStudentContext(req.user.userId);
    if (!context) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }
    if (context.batch_status === 'INACTIVE') {
      return res.status(400).json({ success: false, message: "Interaction blocked. Your academic batch has been disabled by the administrator/TPO." });
    }

    // Fetch and sanitize questions for student
    const [questions]: any = await db.query(
      "SELECT id, question_text, question_type, options_json, marks, negative_marks, topic, difficulty FROM assessment_questions WHERE assessment_id = ?",
      [assessment_id]
    );

    questions.forEach((q: any) => {
      try {
        q.options = JSON.parse(q.options_json || "[]");
      } catch (e) {
        q.options = [];
      }
    });

    // Check if there is an active attempt
    const [existingAttempts]: any = await db.query(
      "SELECT * FROM assessment_attempts WHERE assessment_id = ? AND student_user_id = ?",
      [assessment_id, req.user.userId]
    );

    if (existingAttempts.length > 0) {
      const active = existingAttempts[0];
      if (active.status === "STARTED") {
        return res.json({
          success: true,
          attemptId: active.id,
          attempt: { id: active.id },
          questions,
          message: "Resuming existing active attempt session"
        });
      } else {
        return res.status(400).json({ success: false, message: "You have already completed or submitted this test" });
      }
    }

    // Start a fresh attempt
    const [result]: any = await db.query(`
      INSERT INTO assessment_attempts (assessment_id, student_user_id, status, started_at)
      VALUES (?, ?, 'STARTED', ?)
    `, [assessment_id, req.user.userId, new Date()]);

    const attemptId = result.insertId;

    // Resolve client metadata
    let reqIp = ip_address;
    if (!reqIp) {
      reqIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
      if (reqIp.startsWith('::ffff:')) {
        reqIp = reqIp.substring(7);
      }
    }

    let reqBrowser = browser;
    let reqDevice = device;
    if (!reqBrowser || !reqDevice) {
      const uaStr = req.headers['user-agent'] || '';
      const parsedUA = parseUserAgent(uaStr);
      if (!reqBrowser) reqBrowser = parsedUA.browser;
      if (!reqDevice) reqDevice = parsedUA.device;
    }

    let finalLat = latitude || null;
    let finalLon = longitude || null;
    let address = "Unknown Location";

    // If we have actual GPS coordinates, use them
    if (finalLat && finalLon && (finalLat !== 0 || finalLon !== 0)) {
      address = await reverseGeocode(finalLat, finalLon);
    } else {
      // Try IP-based location fallback
      const ipLoc = await getIpLocation(reqIp);
      if (ipLoc) {
        finalLat = ipLoc.latitude;
        finalLon = ipLoc.longitude;
        address = ipLoc.address;
      } else {
        address = "Captured (No coordinates)";
      }
    }

    // Save location capture details
    await db.query(`
      INSERT INTO assessment_location (attempt_id, latitude, longitude, accuracy, ip_address, browser, device, location_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [attemptId, finalLat, finalLon, accuracy || null, reqIp, reqBrowser, reqDevice, address]);

    res.json({
      success: true,
      attemptId,
      attempt: { id: attemptId },
      questions,
      message: "Test attempt session started"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/student/save-answer", authenticate, authorize(["STUDENT"]), async (req: any, res) => {
  try {
    const attempt_id = req.body.attempt_id || req.body.attemptId;
    const question_id = req.body.question_id || req.body.questionId;
    const student_answer = req.body.student_answer !== undefined ? req.body.student_answer : req.body.answerText;
    const time_spent_seconds = req.body.time_spent_seconds !== undefined ? req.body.time_spent_seconds : req.body.timeSpentSeconds;

    if (!attempt_id || !question_id) {
      return res.status(400).json({ success: false, message: "Attempt ID and Question ID are required" });
    }

    // Check if attempt is still active
    const [attempts]: any = await db.query("SELECT status FROM assessment_attempts WHERE id = ?", [attempt_id]);
    if (attempts.length === 0 || attempts[0].status !== "STARTED") {
      return res.status(400).json({ success: false, message: "Test attempt session is not active or already submitted" });
    }

    // Check if answer already exists
    const [existing]: any = await db.query(
      "SELECT id FROM assessment_answers WHERE attempt_id = ? AND question_id = ?",
      [attempt_id, question_id]
    );

    let answerArray = [];
    if (Array.isArray(student_answer)) {
      answerArray = student_answer;
    } else if (student_answer !== undefined && student_answer !== null) {
      answerArray = [student_answer];
    }
    const answerJson = JSON.stringify(answerArray);

    if (existing.length > 0) {
      await db.query(`
        UPDATE assessment_answers SET
          student_answer_json = ?,
          time_spent_seconds = time_spent_seconds + ?
        WHERE id = ?
      `, [answerJson, parseInt(time_spent_seconds || 0), existing[0].id]);
    } else {
      await db.query(`
        INSERT INTO assessment_answers (attempt_id, question_id, student_answer_json, time_spent_seconds)
        VALUES (?, ?, ?, ?)
      `, [attempt_id, question_id, answerJson, parseInt(time_spent_seconds || 0)]);
    }

    res.json({ success: true, message: "Answer saved successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/student/violation", authenticate, authorize(["STUDENT"]), async (req: any, res) => {
  try {
    const attempt_id = req.body.attempt_id || req.body.attemptId;
    const violation_type = req.body.violation_type || req.body.violationType;
    const details = req.body.details || req.body.description;

    if (!attempt_id || !violation_type) {
      return res.status(400).json({ success: false, message: "Attempt ID and Violation Type are required" });
    }

    // Log the violation
    const [existing]: any = await db.query(
      "SELECT id, warning_count FROM assessment_violations WHERE attempt_id = ? AND violation_type = ?",
      [attempt_id, violation_type]
    );

    let currentWarning = 1;

    if (existing.length > 0) {
      currentWarning = existing[0].warning_count + 1;
      await db.query(
        "UPDATE assessment_violations SET warning_count = ?, details = ? WHERE id = ?",
        [currentWarning, details || "", existing[0].id]
      );
    } else {
      await db.query(
        "INSERT INTO assessment_violations (attempt_id, violation_type, warning_count, details) VALUES (?, ?, 1, ?)",
        [attempt_id, violation_type, details || ""]
      );
    }

    // Fetch total warnings across all violations for this attempt
    const [totals]: any = await db.query(
      "SELECT SUM(warning_count) as total_warnings FROM assessment_violations WHERE attempt_id = ?",
      [attempt_id]
    );

    const totalWarnings = parseInt(totals[0].total_warnings || 0);

    // Auto submit if warnings exceed 3
    let autoSubmitted = false;
    if (totalWarnings >= 3) {
      await db.query(
        "UPDATE assessment_attempts SET status = 'VIOLATED', submitted_at = ? WHERE id = ?",
        [new Date(), attempt_id]
      );
      autoSubmitted = true;
    }

    res.json({
      success: true,
      warningCount: currentWarning,
      totalWarnings,
      autoSubmitted,
      message: autoSubmitted ? "Test auto-submitted due to security violation threshold." : "Violation warning logged"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/student/submit/:attemptId", authenticate, authorize(["STUDENT"]), async (req: any, res) => {
  try {
    const attemptId = req.params.attemptId;

    // Check if this is a Company Hiring submission in test_submissions
    const [subRows]: any = await db.query("SELECT id FROM test_submissions WHERE id = ? OR application_id = ?", [attemptId, attemptId]).catch(() => []);
    if (subRows && subRows.length > 0) {
      const companyResult = await submitAssessmentAttempt(attemptId, req.user, req.body.answers);
      return res.status(companyResult.status).json(companyResult.data);
    }

    // Check TPO attempt status
    const [attempts]: any = await db.query(`
      SELECT a.*, COALESCE(t.total_marks, 100) as max_marks
      FROM assessment_attempts a
      JOIN assessment_tests t ON a.assessment_id = t.id
      WHERE a.id = ?
    `, [attemptId]).catch(() => []);

    if (!attempts || attempts.length === 0) return res.status(404).json({ success: false, message: "Attempt not found" });

    const attempt = attempts[0];
    if (attempt.status === "COMPLETED") {
      return res.json({ success: true, message: "Attempt already finalized and evaluated" });
    }

    // Mark attempt as completed if it wasn't already force-violated
    const nextStatus = attempt.status === "VIOLATED" ? "VIOLATED" : "COMPLETED";

    // Evaluation Engine
    const [questions]: any = await db.query(
      "SELECT id, question_text, question_type, options_json, correct_answers_json, marks, negative_marks, explanation FROM assessment_questions WHERE assessment_id = ?",
      [attempt.assessment_id]
    );

    const [answers]: any = await db.query(
      "SELECT id, question_id, student_answer_json FROM assessment_answers WHERE attempt_id = ?",
      [attemptId]
    );

    const answersMap = new Map<number, any>();
    answers.forEach((ans: any) => {
      try {
        answersMap.set(ans.question_id, JSON.parse(ans.student_answer_json || "[]"));
      } catch (e) {
        answersMap.set(ans.question_id, []);
      }
    });

    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    const answersReview: any[] = [];

    for (const q of questions) {
      let correctAnswers: any[] = [];
      try {
        correctAnswers = JSON.parse(q.correct_answers_json || "[]");
      } catch (e) {}
      
      let options: string[] = [];
      try {
        options = JSON.parse(q.options_json || "[]");
      } catch (e) {}
      
      // If correct answers are numbers (indices), we need to map them to actual option text for MCQ/MULTIPLE_SELECT
      if (['MCQ', 'TRUE_FALSE', 'MULTIPLE_SELECT'].includes(q.question_type) && options.length > 0) {
        correctAnswers = correctAnswers.map(ans => {
          if (typeof ans === 'number' && options[ans] !== undefined) {
            return options[ans];
          } else if (typeof ans === 'string' && !isNaN(parseInt(ans)) && options[parseInt(ans)] !== undefined) {
            // It might be stored as a string number "0" instead of 0
            // But we should be careful not to match an option that happens to be a number string if they didn't mean index
            // Since our system saves index as number [0] mostly, we handle string numbers as indices if they map to options and are typical
            return options[parseInt(ans)];
          }
          return ans;
        });
      }

      const studentAns = answersMap.get(q.id);

      if (!studentAns || studentAns.length === 0) {
        skippedCount++;
        answersReview.push({
          question_text: q.question_text,
          is_correct: false,
          student_answer: "Skipped",
          correct_answer: correctAnswers.join(", "),
          explanation: q.explanation || ""
        });
        continue;
      }

      // Check correctness
      let isCorrect = false;

      if (q.question_type === "MCQ" || q.question_type === "TRUE_FALSE") {
        isCorrect = studentAns[0] === correctAnswers[0];
      } else if (q.question_type === "MULTIPLE_SELECT") {
        const setCorrect = new Set(correctAnswers);
        const setStudent = new Set(studentAns);
        isCorrect = setCorrect.size === setStudent.size && [...setCorrect].every(val => setStudent.has(val));
      } else {
        // Text/Short answer checks (trim and ignore case)
        const studentClean = studentAns[0]?.toString().trim().toLowerCase();
        const correctClean = correctAnswers.map((ans: any) => ans?.toString().trim().toLowerCase());
        isCorrect = correctClean.includes(studentClean);
      }

      const qMarks = parseInt(q.marks || 1);
      const qNeg = parseFloat(q.negative_marks || 0.0);

      let obtained = 0;
      if (isCorrect) {
        obtained = qMarks;
        totalScore += qMarks;
        correctCount++;
      } else {
        obtained = -qNeg;
        totalScore -= qNeg;
        wrongCount++;
      }

      answersReview.push({
        question_text: q.question_text,
        is_correct: isCorrect,
        student_answer: studentAns.join(", "),
        correct_answer: correctAnswers.join(", "),
        explanation: q.explanation || ""
      });

      // Save marks obtained for the answer record
      await db.query(`
        UPDATE assessment_answers SET
          is_correct = ?,
          marks_obtained = ?
        WHERE attempt_id = ? AND question_id = ?
      `, [isCorrect ? 1 : 0, obtained, attemptId, q.id]);
    }

    if (totalScore < 0) totalScore = 0;

    const percentage = attempt.max_marks > 0 ? (totalScore / attempt.max_marks) * 100 : 0;
    const isPassed = totalScore >= attempt.passing_marks ? 1 : 0;

    // Calculate time taken
    const startTime = new Date(attempt.started_at);
    const endTime = new Date();
    const timeTakenSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

    // Update attempt metrics
    await db.query(`
      UPDATE assessment_attempts SET
        status = ?,
        score = ?,
        percentage = ?,
        is_passed = ?,
        submitted_at = ?,
        total_time_taken_seconds = ?
      WHERE id = ?
    `, [nextStatus, totalScore, percentage, isPassed, endTime, timeTakenSeconds, attemptId]);

    // Construct a custom report
    const accuracy = (correctCount + wrongCount) > 0 ? (correctCount / (correctCount + wrongCount)) * 100 : 0;
    const reportData = {
      score: totalScore,
      max_marks: attempt.max_marks,
      percentage: Math.round(percentage),
      correctCount,
      correct_count: correctCount, // Frontend compatibility
      wrongCount,
      skippedCount,
      accuracy: Math.round(accuracy),
      timeTakenSeconds,
      status: nextStatus,
      isPassed,
      passed: isPassed === 1, // Frontend compatibility
      answers_review: answersReview
    };

    await db.query(`
      INSERT INTO assessment_reports (assessment_id, student_user_id, report_json)
      VALUES (?, ?, ?)
    `, [attempt.assessment_id, req.user.userId, JSON.stringify(reportData)]);

    res.json({
      success: true,
      message: "Assessment evaluation complete",
      report: reportData
    });
  } catch (error: any) {
    console.error("Submission Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/student/report/:testId", authenticate, authorize(["STUDENT"]), async (req: any, res) => {
  try {
    const testId = req.params.testId;
    const [reports]: any = await db.query(
      "SELECT report_json FROM assessment_reports WHERE assessment_id = ? AND student_user_id = ? ORDER BY id DESC LIMIT 1",
      [testId, req.user.userId]
    );

    if (reports.length === 0) {
      return res.status(404).json({ success: false, message: "No scorecard report was found for this assessment." });
    }

    const reportData = JSON.parse(reports[0].report_json || "{}");
    res.json({
      success: true,
      report: reportData
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------

export default router;

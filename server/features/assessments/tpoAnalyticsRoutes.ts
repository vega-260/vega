import express from "express";
import db from "../../db.ts";
import { authenticate, authorize } from "../../middleware/auth.ts";
const router = express.Router();
import { GoogleGenAI, Type } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
import { getTPOContext, getStudentContext, getCompanyContext, reverseGeocode, getIpLocation, parseUserAgent } from "./assessmentContext.ts";
router.get("/monitor/:testId", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const testId = req.params.testId;

    const [testInfo]: any = await db.query(
      "SELECT title FROM assessment_tests WHERE id = ?",
      [testId]
    );
    const testTitle = testInfo[0]?.title || "Assessment Test";

    const [totalQResult]: any = await db.query(
      "SELECT COUNT(*) as count FROM assessment_questions WHERE assessment_id = ?",
      [testId]
    );
    const totalQuestions = totalQResult[0]?.count || 0;

    const [attempts]: any = await db.query(`
      SELECT a.id, a.status, a.started_at, a.submitted_at, a.score, a.percentage, a.total_time_taken_seconds,
             u.email, sp.full_name, sp.batch,
             t.max_marks
      FROM assessment_attempts a
      JOIN users u ON a.student_user_id = u.id
      JOIN student_profiles sp ON u.id = sp.user_id
      JOIN assessment_tests t ON a.assessment_id = t.id
      WHERE a.assessment_id = ?
      ORDER BY a.started_at DESC
    `, [testId]);

    const attemptIds = attempts.map((a: any) => Number(a.id)).filter(Number.isFinite);
    const violationsByAttempt = new Map<number, any[]>();
    const locationByAttempt = new Map<number, any>();
    const answersByAttempt = new Map<number, number>();
    if (attemptIds.length > 0) {
      const placeholders = attemptIds.map(() => '?').join(',');
      const [[violations], [locations], [answerCounts]]: any = await Promise.all([
        db.query(`SELECT attempt_id, violation_type, warning_count FROM assessment_violations WHERE attempt_id IN (${placeholders})`, attemptIds),
        db.query(`SELECT attempt_id, ip_address, browser, device, latitude, longitude, location_address, captured_at FROM assessment_location WHERE attempt_id IN (${placeholders})`, attemptIds),
        db.query(`SELECT attempt_id, COUNT(*) AS count FROM assessment_answers WHERE attempt_id IN (${placeholders}) GROUP BY attempt_id`, attemptIds),
      ]);
      for (const row of violations || []) { const id = Number(row.attempt_id); if (!violationsByAttempt.has(id)) violationsByAttempt.set(id, []); violationsByAttempt.get(id)!.push(row); }
      for (const row of locations || []) if (!locationByAttempt.has(Number(row.attempt_id))) locationByAttempt.set(Number(row.attempt_id), row);
      for (const row of answerCounts || []) answersByAttempt.set(Number(row.attempt_id), Number(row.count || 0));
    }

    for (const a of attempts) {
      const id = Number(a.id);
      const violations = violationsByAttempt.get(id) || [];
      a.violations = violations;
      a.warning_count = violations.reduce((sum: number, row: any) => sum + Number(row.warning_count || 0), 0);
      a.location = locationByAttempt.get(id) || null;
      const answeredCount = answersByAttempt.get(id) || 0;
      a.total_questions = totalQuestions;
      a.answered_questions = answeredCount;
      a.progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
    }

    res.json({
      success: true,
      title: testTitle,
      students: attempts
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// 8. TPO Reports and Analytics
// -------------------------------------------------------------
router.get("/analytics", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context) return res.status(404).json({ success: false, message: "TPO not found" });

    // Summary of metrics
    const [metrics]: any = await db.query(`
      SELECT 
        COUNT(DISTINCT t.id) as totalTests,
        SUM(CASE WHEN t.status = 'PUBLISHED' THEN 1 ELSE 0 END) as liveTests,
        SUM(CASE WHEN t.status = 'COMPLETED' THEN 1 ELSE 0 END) as completedTests,
        SUM(CASE WHEN t.status = 'DRAFT' THEN 1 ELSE 0 END) as draftTests
      FROM assessment_tests t
      WHERE t.tpo_id = ?
    `, [context.tpoId]);

    const [attemptsMetrics]: any = await db.query(`
      SELECT 
        COUNT(DISTINCT a.id) as studentsAppeared,
        AVG(a.score) as avgScore,
        MAX(a.score) as highestScore,
        MIN(a.score) as lowestScore,
        AVG(a.percentage) as avgPercentage
      FROM assessment_attempts a
      JOIN assessment_tests t ON a.assessment_id = t.id
      WHERE t.tpo_id = ? AND a.status != 'STARTED'
    `, [context.tpoId]);

    const [qBankSize]: any = await db.query(
      "SELECT COUNT(*) as qBankSize FROM question_bank WHERE tpo_id = ?",
      [context.tpoId]
    );

    // Batch Wise Performance Comparison
    const [batchPerf]: any = await db.query(`
      SELECT sp.batch, AVG(a.score) as avgScore, COUNT(a.id) as totalAppeared
      FROM assessment_attempts a
      JOIN users u ON a.student_user_id = u.id
      JOIN student_profiles sp ON u.id = sp.user_id
      JOIN assessment_tests t ON a.assessment_id = t.id
      WHERE t.tpo_id = ? AND a.status != 'STARTED'
      GROUP BY sp.batch
    `, [context.tpoId]);

    // Recent Activites
    const [recentLogs]: any = await db.query(`
      SELECT a.id, a.status, a.score, a.percentage, a.submitted_at, sp.full_name, t.title
      FROM assessment_attempts a
      JOIN users u ON a.student_user_id = u.id
      JOIN student_profiles sp ON u.id = sp.user_id
      JOIN assessment_tests t ON a.assessment_id = t.id
      WHERE t.tpo_id = ?
      ORDER BY a.submitted_at DESC, a.started_at DESC
      LIMIT 10
    `, [context.tpoId]);

    // Top performers
    const [topPerformers]: any = await db.query(`
      SELECT sp.full_name, sp.batch, AVG(a.percentage) as avgPercentage, SUM(a.score) as totalScore
      FROM assessment_attempts a
      JOIN users u ON a.student_user_id = u.id
      JOIN student_profiles sp ON u.id = sp.user_id
      JOIN assessment_tests t ON a.assessment_id = t.id
      WHERE t.tpo_id = ? AND a.status != 'STARTED'
      GROUP BY u.id, sp.full_name, sp.batch
      ORDER BY avgPercentage DESC, totalScore DESC
      LIMIT 10
    `, [context.tpoId]);

    // Low Performers (At Risk)
    const [weakStudents]: any = await db.query(`
      SELECT sp.full_name, sp.batch, AVG(a.percentage) as avgPercentage, SUM(a.score) as totalScore
      FROM assessment_attempts a
      JOIN users u ON a.student_user_id = u.id
      JOIN student_profiles sp ON u.id = sp.user_id
      JOIN assessment_tests t ON a.assessment_id = t.id
      WHERE t.tpo_id = ? AND a.status != 'STARTED'
      GROUP BY u.id, sp.full_name, sp.batch
      ORDER BY avgPercentage ASC
      LIMIT 10
    `, [context.tpoId]);

    res.json({
      success: true,
      metrics: {
        totalTests: metrics[0]?.totalTests || 0,
        liveTests: metrics[0]?.liveTests || 0,
        completedTests: metrics[0]?.completedTests || 0,
        draftTests: metrics[0]?.draftTests || 0,
        studentsAppeared: attemptsMetrics[0]?.studentsAppeared || 0,
        avgScore: parseFloat((attemptsMetrics[0]?.avgScore || 0).toFixed(2)),
        highestScore: attemptsMetrics[0]?.highestScore || 0,
        lowestScore: attemptsMetrics[0]?.lowestScore || 0,
        avgPercentage: parseFloat((attemptsMetrics[0]?.avgPercentage || 0).toFixed(2)),
        qBankSize: qBankSize[0]?.qBankSize || 0
      },
      batchPerformance: batchPerf,
      recentLogs,
      topPerformers,
      weakStudents
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// 9. AI Smart Recommendations & Insights using Gemini
// -------------------------------------------------------------
router.get("/ai-insights", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context) return res.status(404).json({ success: false, message: "TPO not found" });

    // Fetch summaries of student performance
    const [avgScores]: any = await db.query(`
      SELECT q.topic, AVG(CASE WHEN ans.is_correct = 1 THEN 1 ELSE 0 END) * 100 as accuracy
      FROM assessment_answers ans
      JOIN assessment_questions q ON ans.question_id = q.id
      JOIN assessment_tests t ON q.assessment_id = t.id
      WHERE t.tpo_id = ?
      GROUP BY q.topic
    `, [context.tpoId]);

    const [violStats]: any = await db.query(`
      SELECT v.violation_type, COUNT(v.id) as count
      FROM assessment_violations v
      JOIN assessment_attempts a ON v.attempt_id = a.id
      JOIN assessment_tests t ON a.assessment_id = t.id
      WHERE t.tpo_id = ?
      GROUP BY v.violation_type
    `, [context.tpoId]);

    const topicAccuracyText = avgScores.map((s: any) => `${s.topic}: ${parseFloat(s.accuracy || 0).toFixed(1)}% accuracy`).join(", ");
    const violationText = violStats.map((v: any) => `${v.violation_type}: ${v.count} total occurrences`).join(", ");

    const prompt = `Analyze this college placement training performance overview and provide strategic placement training insights:
- Performance by Topic: ${topicAccuracyText || "No data yet"}
- Test Security Violations: ${violationText || "No security logs recorded"}

Format the response strictly as a JSON object with these fields:
- weakTopics: array of strings (topics with low accuracy)
- commonMistakes: array of strings (conceptual hurdles or issues)
- studentRiskAnalysis: string (strategic insight on students at risk of underperforming)
- recommendedTraining: array of strings (workshops, practice schedules, or interventions)
- suggestedPracticeTests: array of strings (specific test focus areas)
Do not include any formatting other than pure JSON.`;

    const modelName = "gemini-2.5-flash";
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const parsed = JSON.parse((response.text || "{}").trim());
    res.json({
      success: true,
      insights: parsed
    });
  } catch (error: any) {
    console.error("AI Insights Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate AI insights: " + error.message });
  }
});

// -------------------------------------------------------------
// 10. TPO Detailed Test Reports
// -------------------------------------------------------------
router.get("/tpo/test-report/:testId", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const testId = req.params.testId;

    // 1. Fetch test info
    const [testInfo]: any = await db.query(
      "SELECT id, title, category, max_marks, passing_marks, duration_minutes, status, created_at FROM assessment_tests WHERE id = ?",
      [testId]
    );

    if (testInfo.length === 0) {
      return res.status(404).json({ success: false, message: "Assessment test not found" });
    }
    const test = testInfo[0];

    // 2. Fetch assigned batches
    const [batches]: any = await db.query(
      "SELECT batch_name FROM assessment_assignments WHERE assessment_id = ?",
      [testId]
    );

    // 3. Fetch all attempts for this test
    const [attempts]: any = await db.query(`
      SELECT a.id as attempt_id, a.status, a.started_at, a.submitted_at, a.score, a.percentage, a.total_time_taken_seconds,
             u.id as student_user_id, u.email, sp.full_name, sp.batch, sp.aadhar_or_college_id as roll_no,
             (CASE WHEN a.score >= ? THEN 1 ELSE 0 END) as passed
      FROM assessment_attempts a
      JOIN users u ON a.student_user_id = u.id
      JOIN student_profiles sp ON u.id = sp.user_id
      WHERE a.assessment_id = ?
      ORDER BY a.score DESC, sp.full_name ASC
    `, [test.passing_marks, testId]);

    // 4. Fetch warnings count for each attempt in one go
    const [violationsResult]: any = await db.query(`
      SELECT a.id as attempt_id, COALESCE(SUM(v.warning_count), 0) as warning_count
      FROM assessment_attempts a
      LEFT JOIN assessment_violations v ON a.id = v.attempt_id
      WHERE a.assessment_id = ?
      GROUP BY a.id
    `, [testId]);

    const violationsMap = new Map();
    violationsResult.forEach((v: any) => {
      violationsMap.set(v.attempt_id, Number(v.warning_count));
    });

    // 5. Compile collective metrics
    let totalAppeared = 0;
    let passedCount = 0;
    let highestScore = 0;
    let lowestScore = attempts.length > 0 ? 1000000 : 0;
    let sumScore = 0;
    let sumPercentage = 0;
    let sumTimeTaken = 0;
    let totalWarnings = 0;

    const completedAttempts = attempts.filter((a: any) => a.status === "COMPLETED" || a.status === "VIOLATED" || a.status === "SUBMITTED");

    completedAttempts.forEach((a: any) => {
      totalAppeared++;
      const score = Number(a.score || 0);
      const pct = Number(a.percentage || 0);
      sumScore += score;
      sumPercentage += pct;
      sumTimeTaken += Number(a.total_time_taken_seconds || 0);

      if (score >= Number(test.passing_marks)) {
        passedCount++;
      }
      if (score > highestScore) highestScore = score;
      if (score < lowestScore) lowestScore = score;

      const warns = violationsMap.get(a.attempt_id) || 0;
      a.warning_count = warns;
      totalWarnings += warns;
    });

    if (lowestScore === 1000000) lowestScore = 0;

    const avgScore = totalAppeared > 0 ? parseFloat((sumScore / totalAppeared).toFixed(2)) : 0;
    const avgPercentage = totalAppeared > 0 ? parseFloat((sumPercentage / totalAppeared).toFixed(2)) : 0;
    const passRate = totalAppeared > 0 ? parseFloat(((passedCount / totalAppeared) * 100).toFixed(2)) : 0;
    const avgTimeTakenSeconds = totalAppeared > 0 ? Math.round(sumTimeTaken / totalAppeared) : 0;

    // Compile Score Distribution for charts
    let range_0_20 = 0;
    let range_21_40 = 0;
    let range_41_60 = 0;
    let range_61_80 = 0;
    let range_81_100 = 0;

    completedAttempts.forEach((a: any) => {
      const pct = Number(a.percentage || 0);
      if (pct >= 0 && pct <= 20) range_0_20++;
      else if (pct > 20 && pct <= 40) range_21_40++;
      else if (pct > 40 && pct <= 60) range_41_60++;
      else if (pct > 60 && pct <= 80) range_61_80++;
      else if (pct > 80 && pct <= 100) range_81_100++;
    });

    const scoreDistribution = [
      { range: "0-20%", count: range_0_20 },
      { range: "21-40%", count: range_21_40 },
      { range: "41-60%", count: range_41_60 },
      { range: "61-80%", count: range_61_80 },
      { range: "81-100%", count: range_81_100 },
    ];

    // Compile Batch-wise Comparison
    const batchStatsMap = new Map();
    completedAttempts.forEach((a: any) => {
      const bName = a.batch || "Unknown";
      if (!batchStatsMap.has(bName)) {
        batchStatsMap.set(bName, { batch: bName, sumScore: 0, count: 0 });
      }
      const current = batchStatsMap.get(bName);
      current.sumScore += Number(a.score || 0);
      current.count += 1;
    });

    const batchPerformance = Array.from(batchStatsMap.values()).map((b: any) => ({
      batch: b.batch,
      avgScore: parseFloat((b.sumScore / b.count).toFixed(2)),
      totalAppeared: b.count
    }));

    // Attach warning count to remaining/ongoing students
    attempts.forEach((a: any) => {
      if (a.warning_count === undefined) {
        a.warning_count = violationsMap.get(a.attempt_id) || 0;
      }
    });

    res.json({
      success: true,
      test,
      batches: batches.map((b: any) => b.batch_name),
      stats: {
        totalAppeared,
        passedCount,
        failedCount: totalAppeared - passedCount,
        passRate,
        avgScore,
        avgPercentage,
        highestScore,
        lowestScore,
        avgTimeTakenSeconds,
        totalWarnings
      },
      scoreDistribution,
      batchPerformance,
      students: attempts
    });
  } catch (error: any) {
    console.error("Error fetching TPO test report:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/tpo/student-attempt-report/:attemptId", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const attemptId = req.params.attemptId;

    // 1. Fetch attempt and test metadata
    const [attempts]: any = await db.query(`
      SELECT a.id as attempt_id, a.assessment_id, a.status, a.started_at, a.submitted_at, a.score, a.percentage, a.total_time_taken_seconds,
             t.title as test_title, t.max_marks, t.passing_marks, t.category, t.duration_minutes,
             u.id as student_user_id, u.email, sp.full_name, sp.batch, sp.aadhar_or_college_id as roll_no
      FROM assessment_attempts a
      JOIN users u ON a.student_user_id = u.id
      JOIN student_profiles sp ON u.id = sp.user_id
      JOIN assessment_tests t ON a.assessment_id = t.id
      WHERE a.id = ?
    `, [attemptId]);

    if (attempts.length === 0) {
      return res.status(404).json({ success: false, message: "Attempt details not found" });
    }
    const attempt = attempts[0];

    // 2. Fetch proctor violations
    const [violations]: any = await db.query(
      "SELECT violation_type, warning_count, created_at as captured_at FROM assessment_violations WHERE attempt_id = ?",
      [attemptId]
    );

    // 3. Fetch location diagnostics
    const [locResult]: any = await db.query(
      "SELECT ip_address, browser, device, latitude, longitude, location_address, captured_at FROM assessment_location WHERE attempt_id = ?",
      [attemptId]
    );
    const location = locResult[0] || null;

    // 4. Fetch or construct scorecard answers review
    const [reports]: any = await db.query(
      "SELECT report_json FROM assessment_reports WHERE assessment_id = ? AND student_user_id = ? ORDER BY id DESC LIMIT 1",
      [attempt.assessment_id, attempt.student_user_id]
    );

    let answersReview: any[] = [];
    if (reports.length > 0) {
      try {
        const reportData = JSON.parse(reports[0].report_json || "{}");
        answersReview = reportData.answers_review || [];
      } catch (e) {}
    }

    // Dynamic reconstruction fallback if report doesn't exist or is empty
    if (answersReview.length === 0) {
      const [questions]: any = await db.query(`
        SELECT id, question_text, question_type, correct_answers_json, marks, explanation, topic 
        FROM assessment_questions 
        WHERE assessment_id = ?
      `, [attempt.assessment_id]);

      const [answers]: any = await db.query(`
        SELECT question_id, student_answer_json, is_correct 
        FROM assessment_answers 
        WHERE attempt_id = ?
      `, [attemptId]);

      const answersMap = new Map();
      answers.forEach((ans: any) => {
        try {
          answersMap.set(ans.question_id, {
            student_answer: JSON.parse(ans.student_answer_json || "[]"),
            is_correct: ans.is_correct === 1
          });
        } catch (e) {
          answersMap.set(ans.question_id, { student_answer: [], is_correct: false });
        }
      });

      answersReview = questions.map((q: any) => {
        let correctAnswers: string[] = [];
        try {
          correctAnswers = JSON.parse(q.correct_answers_json || "[]");
        } catch (e) {}

        const ansData = answersMap.get(q.id);
        const hasAnswered = ansData !== undefined;
        const studentAnsArray = hasAnswered ? ansData.student_answer : [];
        const isCorrect = hasAnswered ? ansData.is_correct : false;

        return {
          question_text: q.question_text,
          topic: q.topic || "General Concepts",
          marks: q.marks,
          is_correct: isCorrect,
          student_answer: studentAnsArray.length > 0 ? studentAnsArray.join(", ") : "Skipped",
          correct_answer: correctAnswers.join(", "),
          explanation: q.explanation || "No explanation provided."
        };
      });
    }

    // 5. Generate dynamic strategic feedback using Gemini AI
    let aiFeedback = {
      strength: "The candidate shows basic comprehension but would benefit from deep-diving into practical problem solving.",
      areaOfImprovement: "Improve accuracy under timed constraints and focus on core syntax or structural concepts.",
      actionPlan: [
        "Revise the underlying theory for questions missed in this test.",
        "Take daily focused topic-wise micro-quizzes.",
        "Practice building small proof-of-concept projects to consolidate learning."
      ]
    };

    try {
      const topicStats: any = {};
      answersReview.forEach((item: any) => {
        const top = item.topic || "General Concepts";
        if (!topicStats[top]) {
          topicStats[top] = { correct: 0, total: 0 };
        }
        topicStats[top].total++;
        if (item.is_correct) {
          topicStats[top].correct++;
        }
      });

      const topicPerfText = Object.entries(topicStats).map(([topic, stat]: any) => {
        const pct = ((stat.correct / stat.total) * 100).toFixed(1);
        return `${topic}: ${stat.correct}/${stat.total} (${pct}%)`;
      }).join(", ");

      const prompt = `Analyze this student's assessment attempt:
Test Title: "${attempt.test_title}" (${attempt.category})
Score: ${attempt.score} / ${attempt.max_marks} (${attempt.percentage}%)
Passing Marks: ${attempt.passing_marks}
Time Taken: ${Math.round(attempt.total_time_taken_seconds / 60)} minutes
Proctoring Warnings: ${violations.length} total warnings
Topic Performance Breakdown: ${topicPerfText || "N/A"}

Please generate personalized strategic tutoring feedback for this student. Format your response STRICTLY as a JSON object with these fields:
- strength: string (1-2 encouraging sentences outlining what topics they excelled in or what they did right)
- areaOfImprovement: string (1-2 actionable sentences focusing on topics they struggled with or speed/accuracy concerns)
- actionPlan: array of strings (exactly 3 short actionable milestones/recommendations to help this student excel)

No extra characters, no markdown codeblock tags (like \`\`\`json), just the raw JSON object itself.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      if (response && response.text) {
        const parsed = JSON.parse(response.text.trim());
        if (parsed.strength && parsed.areaOfImprovement && parsed.actionPlan) {
          aiFeedback = parsed;
        }
      }
    } catch (e) {
      console.error("Failed to generate AI feedback for individual student:", e);
    }

    res.json({
      success: true,
      attempt,
      violations,
      location,
      answersReview,
      aiFeedback
    });
  } catch (error: any) {
    console.error("Error fetching student detailed report:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------

export default router;

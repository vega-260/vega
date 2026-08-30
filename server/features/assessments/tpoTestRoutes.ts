import express from "express";
import db from "../../db.ts";
import { authenticate, authorize } from "../../middleware/auth.ts";
const router = express.Router();
import { getTPOContext, getStudentContext, getCompanyContext, reverseGeocode, getIpLocation, parseUserAgent, getTestStatus } from "./assessmentContext.ts";
router.get("/tests", authenticate, async (req: any, res) => {
  try {
    const isTPO = req.user.role === "TPO";
    const isStudent = req.user.role === "STUDENT";

    if (isTPO) {
      const context = await getTPOContext(req.user.userId);
      if (!context) return res.status(404).json({ success: false, message: "TPO profile not found" });

      const [tests]: any = await db.query(
        "SELECT * FROM assessment_tests WHERE tpo_id = ? ORDER BY created_at DESC",
        [context.tpoId]
      );

      // Batch-load assignments to avoid one query per assessment.
      const testIds = tests.map((t: any) => Number(t.id)).filter(Number.isFinite);
      const assignmentMap = new Map<number, string[]>();
      if (testIds.length > 0) {
        const placeholders = testIds.map(() => '?').join(',');
        const [assignments]: any = await db.query(
          `SELECT assessment_id, batch_name FROM assessment_assignments WHERE assessment_id IN (${placeholders})`,
          testIds
        );
        for (const row of assignments) {
          const id = Number(row.assessment_id);
          if (!assignmentMap.has(id)) assignmentMap.set(id, []);
          assignmentMap.get(id)!.push(row.batch_name);
        }
      }
      for (const t of tests) {
        t.batches = assignmentMap.get(Number(t.id)) || [];
        t.status = getTestStatus(t);
      }

      res.json({ success: true, tests });
    } else if (isStudent) {
      const context = await getStudentContext(req.user.userId);
      if (!context) return res.status(404).json({ success: false, message: "Student profile not found" });

      if (context.batch_status === 'INACTIVE') {
        return res.json({ success: true, tests: [], isBatchInactive: true });
      }

      // Fetch assessments that are assigned to this student's batch
      const [tests]: any = await db.query(`
        SELECT DISTINCT t.* 
        FROM assessment_tests t
        JOIN assessment_assignments a ON t.id = a.assessment_id
        WHERE a.batch_name = ? AND t.status != 'DRAFT'
        ORDER BY t.test_date DESC, t.start_time DESC
      `, [context.batch]);

      // Batch-load this student's attempts for every visible test.
      const testIds = tests.map((t: any) => Number(t.id)).filter(Number.isFinite);
      const attemptMap = new Map<number, any>();
      if (testIds.length > 0) {
        const placeholders = testIds.map(() => '?').join(',');
        const [attempts]: any = await db.query(
          `SELECT assessment_id, id, status, score, percentage, submitted_at FROM assessment_attempts WHERE assessment_id IN (${placeholders}) AND student_user_id = ? ORDER BY submitted_at DESC`,
          [...testIds, req.user.userId]
        );
        for (const attempt of attempts) if (!attemptMap.has(Number(attempt.assessment_id))) attemptMap.set(Number(attempt.assessment_id), attempt);
      }
      for (const t of tests) {
        t.attempt = attemptMap.get(Number(t.id)) || null;
        t.status = getTestStatus(t);
      }

      res.json({ success: true, tests });
    } else {
      const [tests]: any = await db.query("SELECT * FROM assessment_tests ORDER BY created_at DESC");
      for (const t of tests) {
        t.status = getTestStatus(t);
      }
      res.json({ success: true, tests });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/tests", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context) return res.status(404).json({ success: false, message: "TPO not found" });

    const {
      title, description, instructions, category, difficulty, language, department,
      max_marks, passing_marks, negative_marking, randomize_questions, randomize_options,
      calculator_allowed, test_date, start_time, end_time, late_join_window, duration_minutes,
      webcam_monitoring, camera_required, microphone_required, location_mandatory, batches, questions,
      college_id
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Assessment title is required" });
    }

    const numDuration = parseInt(duration_minutes, 10);
    const numMaxMarks = parseInt(max_marks, 10);
    const numPassingMarks = parseInt(passing_marks, 10);
    const numLateJoin = late_join_window !== undefined && late_join_window !== '' ? parseInt(late_join_window, 10) : 10;

    if (isNaN(numDuration) || numDuration <= 0) {
      return res.status(400).json({ success: false, message: "Duration must be a positive number (minimum 1 minute)" });
    }
    if (isNaN(numMaxMarks) || numMaxMarks <= 0) {
      return res.status(400).json({ success: false, message: "Max Marks must be a positive number (minimum 1)" });
    }
    if (isNaN(numPassingMarks) || numPassingMarks < 0) {
      return res.status(400).json({ success: false, message: "Pass Marks cannot be negative" });
    }
    if (numPassingMarks > numMaxMarks) {
      return res.status(400).json({ success: false, message: "Pass Marks cannot exceed Max Marks" });
    }
    if (isNaN(numLateJoin) || numLateJoin < 0) {
      return res.status(400).json({ success: false, message: "Late Entry Window cannot be negative" });
    }

    if (test_date) {
      const selectedDate = new Date(test_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        return res.status(400).json({ success: false, message: "Test Date cannot be in the past. Please select today or a future date." });
      }
    }

    const targetCollegeId = college_id ? Number(college_id) : context.collegeId;

    // Insert basic info
    const [testResult]: any = await db.query(`
      INSERT INTO assessment_tests (
        tpo_id, college_id, title, description, instructions, category, difficulty, language, department,
        max_marks, passing_marks, negative_marking, randomize_questions, randomize_options, calculator_allowed,
        status, test_date, start_time, end_time, late_join_window, duration_minutes,
        webcam_monitoring, camera_required, microphone_required, location_mandatory
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      context.tpoId, targetCollegeId, title.trim(), description || "", instructions || "", category || "Aptitude",
      difficulty || "Medium", language || "English", department || "", numMaxMarks, numPassingMarks,
      negative_marking ? 1 : 0, randomize_questions ? 1 : 0, randomize_options ? 1 : 0, calculator_allowed ? 1 : 0,
      test_date || null, start_time || null, end_time || null, numLateJoin, numDuration,
      webcam_monitoring ? 1 : 0, camera_required ? 1 : 0, microphone_required ? 1 : 0, location_mandatory ? 1 : 0
    ]);

    const testId = testResult.insertId;

    // Assign Batches
    if (batches && Array.isArray(batches)) {
      for (const batchName of batches) {
        await db.query(
          "INSERT INTO assessment_assignments (assessment_id, batch_name) VALUES (?, ?)",
          [testId, batchName]
        );
      }
    }

    // Add Questions if specified
    if (questions && Array.isArray(questions)) {
      for (const q of questions) {
        await db.query(`
          INSERT INTO assessment_questions (
            assessment_id, question_text, question_type, options_json, correct_answers_json, marks, negative_marks, explanation, topic, difficulty
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          testId,
          q.question_text,
          q.question_type,
          JSON.stringify(q.options || []),
          JSON.stringify(q.correct_answers || []),
          parseInt(q.marks || 1),
          parseFloat(q.negative_marks || 0.0),
          q.explanation || "",
          q.topic || "General",
          q.difficulty || "Medium"
        ]);
      }
    }

    res.json({ success: true, testId, message: "Assessment created successfully as DRAFT" });
  } catch (error: any) {
    console.error("Test creation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/tests/:id", authenticate, async (req: any, res) => {
  try {
    const isTPO = req.user.role === "TPO";
    const isStudent = req.user.role === "STUDENT";
    const testId = req.params.id;

    const [tests]: any = await db.query("SELECT * FROM assessment_tests WHERE id = ?", [testId]);
    if (tests.length === 0) return res.status(404).json({ success: false, message: "Test not found" });

    const test = tests[0];

    // Fetch batch assignments
    const [batches]: any = await db.query("SELECT batch_name FROM assessment_assignments WHERE assessment_id = ?", [testId]);
    test.batches = batches.map((b: any) => b.batch_name);

    // Fetch questions
    const [questions]: any = await db.query("SELECT * FROM assessment_questions WHERE assessment_id = ?", [testId]);
    
    // Parse JSON safely
    questions.forEach((q: any) => {
      try {
        q.options = JSON.parse(q.options_json || "[]");
      } catch (e) {
        q.options = [];
      }

      // SECURITY: If student is fetching test BEFORE completion, do NOT return correct answers!
      if (isStudent && test.status !== "COMPLETED") {
        q.correct_answers = [];
        delete q.correct_answers_json;
        delete q.explanation;
      } else {
        try {
          q.correct_answers = JSON.parse(q.correct_answers_json || "[]");
        } catch (e) {
          q.correct_answers = [];
        }
      }
    });

    test.questions = questions;

    res.json({ success: true, test });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/tests/:id", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const testId = req.params.id;
    const {
      title, description, instructions, category, difficulty, language, department,
      max_marks, passing_marks, negative_marking, randomize_questions, randomize_options,
      calculator_allowed, test_date, start_time, end_time, late_join_window, duration_minutes,
      webcam_monitoring, camera_required, microphone_required, location_mandatory, batches, status, questions,
      college_id
    } = req.body;

    const targetCollegeId = college_id ? Number(college_id) : null;

    if (title !== undefined && (!title || !title.trim())) {
      return res.status(400).json({ success: false, message: "Assessment title is required" });
    }

    const numDuration = parseInt(duration_minutes, 10);
    const numMaxMarks = parseInt(max_marks, 10);
    const numPassingMarks = parseInt(passing_marks, 10);
    const numLateJoin = late_join_window !== undefined && late_join_window !== '' ? parseInt(late_join_window, 10) : 10;

    if (isNaN(numDuration) || numDuration <= 0) {
      return res.status(400).json({ success: false, message: "Duration must be a positive number (minimum 1 minute)" });
    }
    if (isNaN(numMaxMarks) || numMaxMarks <= 0) {
      return res.status(400).json({ success: false, message: "Max Marks must be a positive number (minimum 1)" });
    }
    if (isNaN(numPassingMarks) || numPassingMarks < 0) {
      return res.status(400).json({ success: false, message: "Pass Marks cannot be negative" });
    }
    if (numPassingMarks > numMaxMarks) {
      return res.status(400).json({ success: false, message: "Pass Marks cannot exceed Max Marks" });
    }
    if (isNaN(numLateJoin) || numLateJoin < 0) {
      return res.status(400).json({ success: false, message: "Late Entry Window cannot be negative" });
    }

    if (test_date) {
      const selectedDate = new Date(test_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        return res.status(400).json({ success: false, message: "Test Date cannot be in the past. Please select today or a future date." });
      }
    }

    // Fetch the existing test details to preserve the current status
    const [existingTests]: any = await db.query("SELECT status FROM assessment_tests WHERE id = ?", [testId]);
    if (existingTests.length === 0) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }
    const currentStatus = existingTests[0].status;

    await db.query(`
      UPDATE assessment_tests SET
        title = ?, description = ?, instructions = ?, category = ?, difficulty = ?, language = ?, department = ?,
        max_marks = ?, passing_marks = ?, negative_marking = ?, randomize_questions = ?, randomize_options = ?, calculator_allowed = ?,
        status = ?, test_date = ?, start_time = ?, end_time = ?, late_join_window = ?, duration_minutes = ?,
        webcam_monitoring = ?, camera_required = ?, microphone_required = ?, location_mandatory = ?,
        college_id = COALESCE(?, college_id)
      WHERE id = ?
    `, [
      title ? title.trim() : "",
      description || "",
      instructions || "",
      category || "Aptitude",
      difficulty || "Medium",
      language || "English",
      department || "",
      numMaxMarks,
      numPassingMarks,
      negative_marking ? 1 : 0,
      randomize_questions ? 1 : 0,
      randomize_options ? 1 : 0,
      calculator_allowed ? 1 : 0,
      status || currentStatus || "UPCOMING",
      test_date || null,
      start_time || null,
      end_time || null,
      numLateJoin,
      numDuration,
      webcam_monitoring ? 1 : 0,
      camera_required ? 1 : 0,
      microphone_required ? 1 : 0,
      location_mandatory ? 1 : 0,
      targetCollegeId,
      testId
    ]);

    // Update Batches (Clear & Reinsert)
    await db.query("DELETE FROM assessment_assignments WHERE assessment_id = ?", [testId]);
    if (batches && Array.isArray(batches)) {
      for (const batchName of batches) {
        await db.query(
          "INSERT INTO assessment_assignments (assessment_id, batch_name) VALUES (?, ?)",
          [testId, batchName]
        );
      }
    }

    // Update Questions (Clear & Reinsert for simplicity in Wizard PUT editing)
    if (questions && Array.isArray(questions)) {
      await db.query("DELETE FROM assessment_questions WHERE assessment_id = ?", [testId]);
      for (const q of questions) {
        await db.query(`
          INSERT INTO assessment_questions (
            assessment_id, question_text, question_type, options_json, correct_answers_json, marks, negative_marks, explanation, topic, difficulty
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          testId,
          q.question_text || "",
          q.question_type || "MCQ",
          JSON.stringify(q.options || []),
          JSON.stringify(q.correct_answers || []),
          parseInt(q.marks || 1),
          parseFloat(q.negative_marks || 0.0),
          q.explanation || "",
          q.topic || "General",
          q.difficulty || "Medium"
        ]);
      }
    }

    res.json({ success: true, message: "Assessment updated successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/tests/:id", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const testId = req.params.id;
    await db.query("DELETE FROM assessment_tests WHERE id = ?", [testId]);
    res.json({ success: true, message: "Assessment deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// 5. Test Publishing and Notifications
// -------------------------------------------------------------
router.post("/tests/:id/publish", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const testId = req.params.id;

    // Fetch the test details
    const [tests]: any = await db.query("SELECT title, college_id FROM assessment_tests WHERE id = ?", [testId]);
    if (tests.length === 0) return res.status(404).json({ success: false, message: "Test not found" });
    const test = tests[0];

    // Change status to PUBLISHED
    await db.query("UPDATE assessment_tests SET status = 'PUBLISHED' WHERE id = ?", [testId]);

    // Fetch assigned batch names
    const [assignments]: any = await db.query("SELECT batch_name FROM assessment_assignments WHERE assessment_id = ?", [testId]);
    const batchNames = assignments.map((a: any) => a.batch_name);

    if (batchNames.length > 0) {
      // Find students belonging to these batches and college
      const placeholders = batchNames.map(() => "?").join(",");
      const [students]: any = await db.query(`
        SELECT user_id FROM student_profiles 
        WHERE college_id = ? AND batch IN (${placeholders})
      `, [test.college_id, ...batchNames]);

      // Create internal notifications
      for (const s of students) {
        await db.query(`
          INSERT INTO assessment_notifications (user_id, title, message)
          VALUES (?, ?, ?)
        `, [
          s.user_id,
          "New College Assessment Published",
          `The assessment "${test.title}" is now available for your batch. Please schedule/attempt it accordingly.`
        ]);
      }

      console.log(`📡 SMTP/Email System Stubs: Sent ${students.length} notification emails for published test: ${test.title}`);
    }

    res.json({ success: true, message: "Assessment published successfully! Notifications sent." });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------

export default router;

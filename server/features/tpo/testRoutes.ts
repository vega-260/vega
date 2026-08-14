import express from "express";
import db from "../../db.ts";
import { getTPOContext } from "./tpoContext.ts";
const router = express.Router();
// --- ASSESSMENT ENGINE ---

router.post("/tests", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context) return res.status(403).json({ success: false, message: "Unauthorized" });

    const { 
      title, description, category, difficulty, duration_minutes, max_marks, passing_marks, 
      negative_marking, webcam_monitoring, randomize_questions, test_date, start_time, 
      late_join_window, college_id, batch_name, questions
    } = req.body;
    
    // Set status based on test_date
    let status = 'UPCOMING';
    
    const [result]: any = await db.query(`
      INSERT INTO assessment_tests (
        tpo_id, college_id, title, description, category, difficulty, duration_minutes, 
        max_marks, passing_marks, negative_marking, webcam_monitoring, randomize_questions, 
        test_date, start_time, late_join_window, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      context.tpoId, college_id, title, description || '', category || 'Aptitude', difficulty || 'Medium', duration_minutes || 60,
      max_marks || 100, passing_marks || 40, negative_marking || 0, webcam_monitoring ? 1 : 0, randomize_questions ? 1 : 0,
      test_date || null, start_time || null, late_join_window || 10, status
    ]);

    const testId = result.insertId;

    if (batch_name) {
      await db.query(`
        INSERT INTO assessment_assignments (assessment_id, batch_name)
        VALUES (?, ?)
      `, [testId, batch_name]);
    }

    if (questions && Array.isArray(questions) && questions.length > 0) {
      for (const q of questions) {
        await db.query(`
          INSERT INTO assessment_questions (
            assessment_id, question_text, question_type, options_json, correct_answers_json, marks, difficulty, topic
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          testId, q.question_text, q.question_type || 'MCQ', JSON.stringify(q.options || []), JSON.stringify(q.correct_answers || []), q.marks || 1, q.difficulty || 'Medium', q.topic || ''
        ]);
      }
    }

    res.json({ success: true, message: "Assessment created successfully", testId });
  } catch (error) {
    console.error("Error creating assessment:", error);
    res.status(500).json({ success: false, message: "Error creating assessment" });
  }
});

function getTestStatus(test: any): string {
  if (test.status === 'DRAFT') {
    return 'DRAFT';
  }
  if (!test.test_date || !test.start_time) {
    return test.status || 'UPCOMING';
  }
  try {
    const now = new Date();
    let dateStr = "";
    if (test.test_date instanceof Date) {
      const year = test.test_date.getFullYear();
      const month = String(test.test_date.getMonth() + 1).padStart(2, '0');
      const day = String(test.test_date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else if (typeof test.test_date === 'string') {
      dateStr = test.test_date.split('T')[0];
    } else {
      dateStr = String(test.test_date).split('T')[0];
    }

    const startStr = `${dateStr}T${test.start_time}:00`;
    const startDt = new Date(startStr);
    
    let endDt: Date;
    if (test.end_time) {
      const endStr = `${dateStr}T${test.end_time}:00`;
      endDt = new Date(endStr);
    } else {
      const duration = parseInt(test.duration_minutes || 60);
      endDt = new Date(startDt.getTime() + duration * 60 * 1000);
    }

    if (now >= startDt && now <= endDt) {
      return 'ONGOING';
    } else if (now > endDt) {
      return 'COMPLETED';
    } else {
      return 'UPCOMING';
    }
  } catch (err) {
    return test.status || 'UPCOMING';
  }
}

router.get("/tests", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) return res.json({ success: true, data: [] });

    const placeholders = context.collegeIds.map(() => '?').join(',');

    const [tests]: any = await db.query(`
      SELECT t.*, cm.college_name
      FROM assessment_tests t
      JOIN college_master cm ON t.college_id = cm.id
      WHERE t.college_id IN (${placeholders})
      ORDER BY t.created_at DESC
    `, [...context.collegeIds]);

    const updatedTests = tests.map((t: any) => {
      t.status = getTestStatus(t);
      return t;
    });

    res.json({ success: true, data: updatedTests });
  } catch (error) {
    console.error("Error fetching tests:", error);
    res.status(500).json({ success: false, message: "Error fetching tests" });
  }
});

router.get("/colleges", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) return res.json({ success: true, data: [] });

    const placeholders = context.collegeIds.map(() => '?').join(',');
    const [colleges]: any = await db.query(`
      SELECT id, college_name, college_code, district, state 
      FROM college_master 
      WHERE id IN (${placeholders}) AND status = 'ACTIVE'
    `, [...context.collegeIds]);

    res.json({ success: true, data: colleges });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching assigned colleges" });
  }
});


export default router;

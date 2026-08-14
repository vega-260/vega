import express from "express";
import db from "../../db.ts";
import { authenticate, authorize } from "../../middleware/auth.ts";
const router = express.Router();
import { GoogleGenAI, Type } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
import { getTPOContext, getStudentContext, getCompanyContext, reverseGeocode, getIpLocation, parseUserAgent } from "./assessmentContext.ts";
router.get("/batches", authenticate, async (req: any, res) => {
  try {
    const isTPO = req.user.role === "TPO";
    let collegeId = null;

    if (isTPO) {
      const context = await getTPOContext(req.user.userId);
      if (!context) return res.status(404).json({ success: false, message: "TPO profile not found" });
      collegeId = context.collegeId;
    } else if (req.user.role === "STUDENT") {
      const context = await getStudentContext(req.user.userId);
      if (!context) return res.status(404).json({ success: false, message: "Student profile not found" });
      collegeId = context.collegeId;
    } else {
      // Admin or others
      const [colleges]: any = await db.query("SELECT id FROM college_master LIMIT 1");
      collegeId = colleges[0]?.id;
    }

    if (!collegeId) {
      return res.json({ success: true, batches: [] });
    }

    // 1. Academic batches from admin batches table
    const [academicBatches]: any = await db.query(
      "SELECT DISTINCT batch_name as batch FROM batches WHERE college_id = ?",
      [collegeId]
    );

    // 2. Dynamic batches from student profiles
    const [studentBatches]: any = await db.query(`
      SELECT DISTINCT COALESCE(b.batch_name, sp.batch) as batch 
      FROM student_profiles sp
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      WHERE COALESCE(sp.college_id, b.college_id) = ? AND COALESCE(b.batch_name, sp.batch) IS NOT NULL AND COALESCE(b.batch_name, sp.batch) != ''
    `, [collegeId]);

    // 3. Explicit assessment batches
    const [definedBatches]: any = await db.query(
      "SELECT DISTINCT batch_name as batch FROM assessment_batches WHERE college_id = ?",
      [collegeId]
    );

    const allBatchesSet = new Set<string>();
    academicBatches.forEach((b: any) => b.batch && allBatchesSet.add(b.batch));
    studentBatches.forEach((b: any) => b.batch && allBatchesSet.add(b.batch));
    definedBatches.forEach((b: any) => b.batch && allBatchesSet.add(b.batch));

    res.json({
      success: true,
      batches: Array.from(allBatchesSet).sort(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/batches", authenticate, authorize(["TPO", "SUPER_ADMIN"]), async (req: any, res) => {
  try {
    const { department, academic_year, batch_name } = req.body;
    if (!department || !academic_year || !batch_name) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const context = await getTPOContext(req.user.userId);
    if (!context) return res.status(404).json({ success: false, message: "TPO context not found" });

    await db.query(
      "INSERT INTO assessment_batches (college_id, tpo_id, department, academic_year, batch_name) VALUES (?, ?, ?, ?, ?)",
      [context.collegeId, context.tpoId, department, academic_year, batch_name]
    );

    res.json({ success: true, message: "Batch registered successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// 2. Question Bank CRUD
// -------------------------------------------------------------
router.get("/question-bank", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context) return res.status(404).json({ success: false, message: "TPO not found" });

    const [questions]: any = await db.query(
      "SELECT * FROM question_bank WHERE tpo_id = ? ORDER BY created_at DESC",
      [context.tpoId]
    );
    res.json({ success: true, questions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/question-bank", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const { topic, question_text, question_type, difficulty, options, correct_answers, explanation } = req.body;
    const context = await getTPOContext(req.user.userId);
    if (!context) return res.status(404).json({ success: false, message: "TPO not found" });

    await db.query(`
      INSERT INTO question_bank (tpo_id, topic, question_text, question_type, difficulty, options_json, correct_answers_json, explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      context.tpoId,
      topic || "General",
      question_text,
      question_type,
      difficulty || "Medium",
      JSON.stringify(options || []),
      JSON.stringify(correct_answers || []),
      explanation || ""
    ]);

    res.json({ success: true, message: "Question saved to bank successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// 3. AI Question Generator using Gemini
// -------------------------------------------------------------
router.post("/ai-generate-questions", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const { topic, difficulty, questionCount, type } = req.body;
    const count = parseInt(questionCount || 5);
    const qType = type || "MCQ"; // MCQ, True/False, Short Answer, etc.

    const prompt = `Generate exactly ${count} educational questions on the topic "${topic}" with difficulty level "${difficulty}" and question type "${qType}".
Format the response strictly as a JSON array of objects. Each object must have these exact fields:
- question_text: string
- question_type: string (value must be '${qType}')
- options: array of strings (provide 4 option strings if MCQ or 2 strings ["True", "False"] if True/False, otherwise empty array)
- correct_answers: array of strings (for MCQ, provide the exact matching string of the correct option from the options array. For True/False, provide either ["True"] or ["False"]. For fill-in-blank or short-answer, provide acceptable text answer strings)
- explanation: string (a short detailed conceptual explanation)
- topic: string (use "${topic}")
- difficulty: string (use "${difficulty}")
Do not include any wrapper or markdown formatting other than pure valid JSON.`;

    const modelName = "gemini-2.5-flash";
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "[]";
    const parsedQuestions = JSON.parse(text.trim());

    res.json({
      success: true,
      questions: parsedQuestions
    });
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate questions. " + error.message });
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

// -------------------------------------------------------------

export default router;

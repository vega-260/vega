import express from "express";
import db from "../../db.ts";
import { getTPOContext } from "./tpoContext.ts";
const router = express.Router();
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
// Get Students for Assigned Colleges
router.get("/students", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const { collegeIds } = context;
    const placeholders = collegeIds.map(() => '?').join(',');

    const [students]: any = await db.query(`
      SELECT sp.*, 
             COALESCE(NULLIF(sp.department, ''), b.department) as department,
             u.email, ts.overall_score as talent_score, cm.college_name,
             COALESCE(b.status, 'ACTIVE') as batch_status, COALESCE(b.batch_name, sp.batch) as batch_name
      FROM student_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      LEFT JOIN college_master cm ON COALESCE(sp.college_id, b.college_id) = cm.id
      LEFT JOIN talent_scores ts ON sp.user_id = ts.user_id
      WHERE COALESCE(sp.college_id, b.college_id) IN (${placeholders})
      ORDER BY ts.overall_score DESC
    `, [...collegeIds]);

    res.json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching students" });
  }
});

// AI Skill Gap Analysis
router.get("/ai-skill-gap", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) {
      return res.status(400).json({ success: false, message: "No colleges assigned" });
    }

    const { collegeIds } = context;
    const placeholders = collegeIds.map(() => '?').join(',');

    // Get aggregated skills and scores from students
    const [studentData]: any = await db.query(`
      SELECT sp.skills_json, ts.overall_score, ts.breakdown_json, cs.topics_json
      FROM student_profiles sp
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      LEFT JOIN talent_scores ts ON sp.user_id = ts.user_id
      LEFT JOIN coding_profiles cp ON sp.user_id = cp.user_id
      LEFT JOIN coding_stats cs ON cp.id = cs.profile_id
      WHERE COALESCE(sp.college_id, b.college_id) IN (${placeholders})
    `, [...collegeIds]);

    const allSkills = studentData.flatMap((s: any) => {
      try {
        return typeof s.skills_json === 'string' ? JSON.parse(s.skills_json) : (s.skills_json || []);
      } catch (e) { return []; }
    });

    // Aggregate skills frequency
    const skillFrequency: Record<string, number> = {};
    allSkills.forEach((s: string) => {
      skillFrequency[s] = (skillFrequency[s] || 0) + 1;
    });

    const avgScore = studentData.reduce((acc: number, curr: any) => acc + (curr.overall_score || 0), 0) / (studentData.length || 1);
    
    // Get latest job requirements
    const [jobs]: any = await db.query("SELECT title, skills_json FROM jobs WHERE status = 'OPEN' LIMIT 20");
    const jobReqs = jobs.map((j: any) => {
      const skills = typeof j.skills_json === 'string' ? JSON.parse(j.skills_json) : (j.skills_json || []);
      return `${j.title}: ${skills.join(', ')}`;
    }).join('\n');

    const prompt = `
      As an EdTech Placement Expert and AI Career Architect, analyze this college's talent pool data:
      
      COLLEGE DATA:
      - Total Students Analyzed: ${studentData.length}
      - Average Talent Score: ${avgScore.toFixed(2)}/100
      - Student Skill Frequency: ${JSON.stringify(skillFrequency)}
      
      CURRENT MARKET JOB REQUIREMENTS (OPEN POSITIONS):
      ${jobReqs}

      Generate a comprehensive Placement Intelligence Report in JSON format:
      {
        "placement_readiness": number (0-100),
        "top_missing_skills": string[],
        "college_strengths": string[],
        "college_weaknesses": string[],
        "branch_recommendations": string[],
        "training_roadmap": [
          { "phase": "string", "focus": "string", "duration": "string" }
        ],
        "market_fit_analysis": "string"
      }
    `;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const text = result.text;
    
    // Production-grade JSON extraction
    let jsonReport;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      jsonReport = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("AI JSON Parse Error:", parseError, "Original Text:", text);
      return res.status(500).json({ 
        success: false, 
        message: "AI generated an invalid report format. Please try again.",
        retryable: true 
      });
    }

    res.json({ success: true, data: jsonReport });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error generating AI analysis" });
  }
});

// Batches
router.get("/batches", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context) return res.status(403).json({ success: false, message: "Unauthorized" });
    
    const { college_id } = req.query;
    
    // 1. Fetch Admin academic batches
    let adminBatchesQuery = `SELECT * FROM batches WHERE 1=1`;
    let adminBatchesParams: any[] = [];
    if (college_id) {
      adminBatchesQuery += ` AND college_id = ?`;
      adminBatchesParams.push(Number(college_id));
    } else {
      if (context.collegeIds.length > 0) {
        adminBatchesQuery += ` AND college_id IN (${context.collegeIds.map(() => '?').join(',')})`;
        adminBatchesParams.push(...context.collegeIds);
      }
    }
    const [adminBatches]: any = await db.query(adminBatchesQuery, adminBatchesParams);

    // 2. Fetch TPO assessment batches
    let abQuery = `SELECT * FROM assessment_batches WHERE 1=1`;
    let abParams: any[] = [];
    if (college_id) {
      abQuery += ` AND college_id = ?`;
      abParams.push(Number(college_id));
    } else {
      if (context.collegeIds.length > 0) {
        abQuery += ` AND college_id IN (${context.collegeIds.map(() => '?').join(',')})`;
        abParams.push(...context.collegeIds);
      }
    }
    const [assessmentBatches]: any = await db.query(abQuery, abParams);
    
    // 3. Fetch dynamic batches from student profiles
    let spQuery = `
      SELECT DISTINCT COALESCE(b.batch_name, sp.batch) as batch_name, COALESCE(b.department, 'Unknown') as department, COALESCE(b.academic_year, '2024') as academic_year 
      FROM student_profiles sp
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      WHERE COALESCE(b.batch_name, sp.batch) IS NOT NULL AND COALESCE(b.batch_name, sp.batch) != ''
    `;
    let spParams: any[] = [];
    if (college_id) {
      spQuery += ` AND sp.college_id = ?`;
      spParams.push(Number(college_id));
    } else {
      if (context.collegeIds.length > 0) {
        spQuery += ` AND sp.college_id IN (${context.collegeIds.map(() => '?').join(',')})`;
        spParams.push(...context.collegeIds);
      }
    }
    const [spBatches]: any = await db.query(spQuery, spParams);
    
    // Merge all batches, keyed by unique batch_name to avoid duplicates
    const mergedBatchesMap = new Map<string, any>();

    // Add admin batches (Academic Batches created by Admin)
    for (const b of adminBatches) {
      mergedBatchesMap.set(b.batch_name, {
        id: b.id,
        college_id: b.college_id,
        tpo_id: b.assigned_tpo_id || context.tpoId,
        department: b.department || 'General',
        academic_year: b.academic_year || '2024',
        batch_name: b.batch_name,
        semester: b.semester || 'N/A',
        strength: b.strength || 0,
        status: b.status || 'ACTIVE'
      });
    }

    // Add assessment batches
    for (const b of assessmentBatches) {
      if (!mergedBatchesMap.has(b.batch_name)) {
        mergedBatchesMap.set(b.batch_name, {
          id: b.id,
          college_id: b.college_id,
          tpo_id: b.tpo_id,
          department: b.department || 'General',
          academic_year: b.academic_year || '2024',
          batch_name: b.batch_name,
          semester: 'N/A',
          strength: 0,
          status: 'ACTIVE'
        });
      }
    }

    // Add dynamic student batches
    for (const spb of spBatches) {
      if (!mergedBatchesMap.has(spb.batch_name)) {
        mergedBatchesMap.set(spb.batch_name, {
          id: `sp_${spb.batch_name}`,
          college_id: Number(college_id) || (context.collegeIds[0] || 1),
          tpo_id: context.tpoId,
          department: spb.department || 'General',
          academic_year: spb.academic_year || '2024',
          batch_name: spb.batch_name,
          semester: 'N/A',
          strength: 0,
          status: 'ACTIVE'
        });
      }
    }
    
    const mergedBatches = Array.from(mergedBatchesMap.values());
    
    res.json({ success: true, data: mergedBatches });
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({ success: false, message: "Error fetching batches" });
  }
});

// Mark Batch as Passout (Alumni)
router.post("/batches/passout", async (req: any, res) => {
  try {
    const { batch_name } = req.body;
    if (!batch_name) {
      return res.status(400).json({ success: false, message: "Batch name is required" });
    }

    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const collegeId = context.collegeIds[0] || 1;

    // Check if batch exists in `batches` table
    const [existing]: any = await db.query(
      "SELECT id FROM batches WHERE batch_name = ?",
      [batch_name]
    );

    if (existing.length > 0) {
      await db.query(
        "UPDATE batches SET status = 'PASSOUT' WHERE batch_name = ?",
        [batch_name]
      );
    } else {
      await db.query(`
        INSERT INTO batches (college_id, assigned_tpo_id, department, academic_year, batch_name, status)
        VALUES (?, ?, 'General', YEAR(CURDATE()), ?, 'PASSOUT')
      `, [collegeId, context.tpoId, batch_name]);
    }

    // Also attempt updating assessment_batches if applicable
    try {
      await db.query("UPDATE assessment_batches SET status = 'PASSOUT' WHERE batch_name = ?", [batch_name]);
    } catch (_) {}

    res.json({ success: true, message: `Batch ${batch_name} marked as PASSOUT and moved to Alumni.` });
  } catch (error) {
    console.error("Error marking batch as passout:", error);
    res.status(500).json({ success: false, message: "Error updating batch status" });
  }
});

// Reactivate Batch
router.post("/batches/reactivate", async (req: any, res) => {
  try {
    const { batch_name } = req.body;
    if (!batch_name) {
      return res.status(400).json({ success: false, message: "Batch name is required" });
    }

    await db.query(
      "UPDATE batches SET status = 'ACTIVE' WHERE batch_name = ?",
      [batch_name]
    );

    try {
      await db.query("UPDATE assessment_batches SET status = 'ACTIVE' WHERE batch_name = ?", [batch_name]);
    } catch (_) {}

    res.json({ success: true, message: `Batch ${batch_name} reactivated.` });
  } catch (error) {
    console.error("Error reactivating batch:", error);
    res.status(500).json({ success: false, message: "Error reactivating batch" });
  }
});

// Question Bank

export default router;

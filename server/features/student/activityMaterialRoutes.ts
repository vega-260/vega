import express from "express";
import db from "../../db.ts";
import { authenticate, authorize, requireSelfParam } from "../../middleware/auth.ts";
const router = express.Router();
import path from "path";
router.post("/activity", authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { path, action, duration } = req.body;
    
    // Only track if valid numeric duration (or 0)
    const durSecs = Math.max(0, parseInt(duration) || 0);

    await db.query(`
      INSERT INTO student_activity_logs (student_id, path, action, duration_seconds)
      VALUES (?, ?, ?, ?)
    `, [userId, path, action || 'page_view', durSecs]);

    res.json({ success: true });
  } catch (err: any) {
    console.error("Activity tracking error:", err);
    res.status(500).json({ success: false });
  }
});

router.get("/college-updates", authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    console.log("Fetching college updates for user:", userId);

    const [profiles]: any = await db.query(`
      SELECT sp.id, sp.college_id, sp.batch, sp.batch_id,
             COALESCE(sp.college_id, b.college_id, 1) as resolved_college_id, 
             COALESCE(b.batch_name, sp.batch, 'ALL') as resolved_batch_name
      FROM student_profiles sp
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      WHERE sp.user_id = ?
    `, [userId]);

    let collegeId = 1;
    let batchName = 'ALL';

    if (profiles && profiles.length > 0) {
      collegeId = profiles[0].resolved_college_id || profiles[0].college_id || 1;
      batchName = (profiles[0].resolved_batch_name || profiles[0].batch || 'ALL').trim();
    }

    console.log(`Student ${userId} -> resolved collegeId: ${collegeId}, batchName: "${batchName}"`);

    const [events]: any = await db.query(
      `SELECT * FROM events 
       WHERE (college_id = ? OR college_id IS NULL) 
         AND (status IS NULL OR status NOT IN ('INACTIVE', 'DEACTIVE', 'CANCELLED'))
       ORDER BY created_at DESC LIMIT 30`,
      [collegeId]
    );

    const [tests]: any = await db.query(
      `SELECT * FROM assessment_tests 
       WHERE (college_id = ? OR college_id IS NULL) 
         AND status IN ('UPCOMING', 'ONGOING', 'PUBLISHED') 
       ORDER BY created_at DESC LIMIT 30`,
      [collegeId]
    );

    const [notices]: any = await db.query(
      `SELECT cn.*, 'Campus TPO Office' as college_name
       FROM campus_notices cn
       WHERE (cn.is_public = 1 OR cn.is_public IS NULL)
         AND (
           cn.batch_name = 'ALL' 
           OR cn.batch_name IS NULL
           OR ? = 'ALL'
           OR TRIM(UPPER(cn.batch_name)) = TRIM(UPPER(?))
           OR LOWER(cn.batch_name) LIKE LOWER(CONCAT('%', ?, '%'))
           OR LOWER(?) LIKE LOWER(CONCAT('%', cn.batch_name, '%'))
         ) 
       ORDER BY cn.created_at DESC LIMIT 50`,
      [batchName, batchName, batchName, batchName]
    );

    const [materials]: any = await db.query(
      `SELECT sm.* 
       FROM study_materials sm
       WHERE (sm.college_id = ? OR sm.college_id IS NULL)
         AND (
           sm.batch_name = 'ALL' 
           OR sm.batch_name IS NULL
           OR ? = 'ALL'
           OR TRIM(UPPER(sm.batch_name)) = TRIM(UPPER(?))
           OR LOWER(sm.batch_name) LIKE LOWER(CONCAT('%', ?, '%'))
           OR LOWER(?) LIKE LOWER(CONCAT('%', sm.batch_name, '%'))
         )
       ORDER BY sm.created_at DESC LIMIT 50`,
      [collegeId, batchName, batchName, batchName, batchName]
    );

    console.log(`Updates fetched -> Events: ${events.length}, Tests: ${tests.length}, Notices: ${notices.length}, Materials: ${materials.length}`);
    res.json({ success: true, data: { events: events || [], tests: tests || [], notices: notices || [], materials: materials || [] } });
  } catch (error) {
    console.error("Error fetching college updates:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// GET Student Study Materials Endpoint
router.get("/study-materials", authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const [profiles]: any = await db.query(`
      SELECT sp.college_id, sp.batch,
             COALESCE(sp.college_id, b.college_id, 1) as resolved_college_id, 
             COALESCE(b.batch_name, sp.batch, 'ALL') as resolved_batch_name
      FROM student_profiles sp
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      WHERE sp.user_id = ?
    `, [userId]);

    let collegeId = 1;
    let batchName = 'ALL';
    if (profiles && profiles.length > 0) {
      collegeId = profiles[0].resolved_college_id || 1;
      batchName = (profiles[0].resolved_batch_name || 'ALL').trim();
    }

    const [materials]: any = await db.query(
      `SELECT sm.* 
       FROM study_materials sm
       WHERE (sm.college_id = ? OR sm.college_id IS NULL)
         AND (
           sm.batch_name = 'ALL' 
           OR sm.batch_name IS NULL
           OR ? = 'ALL'
           OR TRIM(UPPER(sm.batch_name)) = TRIM(UPPER(?))
           OR LOWER(sm.batch_name) LIKE LOWER(CONCAT('%', ?, '%'))
           OR LOWER(?) LIKE LOWER(CONCAT('%', sm.batch_name, '%'))
         )
       ORDER BY sm.created_at DESC`,
      [collegeId, batchName, batchName, batchName, batchName]
    );

    res.json({ success: true, data: materials || [] });
  } catch (error) {
    console.error("Error fetching student study materials:", error);
    res.status(500).json({ success: false, message: "Error fetching study materials" });
  }
});

// Track Study Material Download Count
router.post("/study-materials/:id/download", authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    await db.query(`UPDATE study_materials SET download_count = download_count + 1 WHERE id = ?`, [id]);
    res.json({ success: true, message: "Download recorded" });
  } catch (error) {
    console.error("Error updating download count:", error);
    res.status(500).json({ success: false, message: "Error recording download" });
  }
});


export default router;

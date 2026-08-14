import express from "express";
import db from "../../db.ts";
import { getTPOContext } from "./tpoContext.ts";
const router = express.Router();
import { authenticate, authorize } from "../../middleware/auth.ts";
// -------------------------------------------------------------
// 10. Campus Notices & Batches
// -------------------------------------------------------------

router.get("/batches", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const tpoId = req.user.userId;
    const context = await getTPOContext(tpoId);
    if (!context || context.collegeIds.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const placeholders = context.collegeIds.map(() => '?').join(',');
    const [batches]: any = await db.query(`
      SELECT DISTINCT b.id, b.batch_name, COALESCE(b.department, 'General') as department,
             (SELECT COUNT(*) FROM student_profiles sp WHERE sp.batch = b.batch_name OR sp.batch_id = b.id) as student_count
      FROM batches b
      WHERE b.college_id IN (${placeholders})
      ORDER BY b.batch_name ASC
    `, [...context.collegeIds]);
    res.json({ success: true, data: batches || [] });
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({ success: false, message: "Error fetching batches" });
  }
});

router.get("/notices", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const tpoId = req.user.userId;
    const [notices]: any = await db.query(
      `SELECT cn.*, 
        (SELECT COUNT(*) FROM notifications n WHERE n.title LIKE CONCAT('%', cn.title, '%')) as reach_count
       FROM campus_notices cn 
       WHERE cn.tpo_id = ? 
       ORDER BY cn.created_at DESC`,
      [tpoId]
    );
    res.json({ success: true, data: notices });
  } catch (error) {
    console.error("Error fetching notices:", error);
    res.status(500).json({ success: false, message: "Error fetching notices" });
  }
});

router.post("/notices", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const tpoId = req.user.userId;
    const { batch_name, title, message, category, priority, is_public, attachment_type, attachment_url, attachment_name, attachment_size } = req.body;
    
    // Get college_id
    const [tpoCollege]: any = await db.query(
      "SELECT college_id FROM tpo_colleges WHERE tpo_id = ? LIMIT 1",
      [tpoId]
    );
    
    const collegeId = tpoCollege[0]?.college_id || 1;
    const targetBatch = batch_name || 'ALL';
    const noticeCategory = category || 'GENERAL';
    const noticePriority = priority || 'NORMAL';
    const attachType = attachment_type || 'NONE';

    await db.query(`
      INSERT INTO campus_notices (tpo_id, college_id, batch_name, title, message, category, priority, attachment_type, attachment_url, attachment_name, attachment_size, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tpoId, collegeId, targetBatch, title, message, noticeCategory, noticePriority, 
      attachType, attachment_url || null, attachment_name || null, attachment_size || null, 
      is_public !== false ? 1 : 0
    ]);

    // If document/link was attached, also register it in study_materials table
    if (attachType !== 'NONE' && attachment_url) {
      try {
        await db.query(`
          INSERT INTO study_materials (tpo_id, college_id, batch_name, title, description, category, attachment_type, attachment_url, file_name, file_size)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tpoId, collegeId, targetBatch, title, message, noticeCategory, 
          attachType, attachment_url, attachment_name || title, attachment_size || 'N/A'
        ]);
      } catch (matErr) {
        console.error("Error auto-indexing notice attachment to study_materials:", matErr);
      }
    }

    // Dispatch instant notifications to all targeted students in that college
    let dispatchedCount = 0;
    try {
      let studentQuery = `
        SELECT DISTINCT u.id as user_id
        FROM users u
        JOIN student_profiles sp ON u.id = sp.user_id
        LEFT JOIN student_batch sb ON sp.id = sb.student_id
        LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
        WHERE u.role = 'STUDENT'
      `;
      let params: any[] = [];

      if (targetBatch !== 'ALL') {
        studentQuery += ` AND (sp.batch = ? OR b.batch_name = ?)`;
        params.push(targetBatch, targetBatch);
      }

      const [targetStudents]: any = await db.query(studentQuery, params);
      
      if (targetStudents && targetStudents.length > 0) {
        const notifMsg = attachType !== 'NONE' 
          ? `${message} (Document attached: ${attachment_name || 'View in Campus Portal'})`
          : message;
          
        for (const student of targetStudents) {
          if (student.user_id) {
            await db.query(
              `INSERT INTO notifications (user_id, title, message, type, is_read) VALUES (?, ?, ?, 'NOTICE', 0)`,
              [student.user_id, `Campus Notice: ${title}`, notifMsg]
            );
            dispatchedCount++;
          }
        }
      }
    } catch (dispatchErr) {
      console.error("Error dispatching in-app notifications for notice:", dispatchErr);
    }

    res.json({ 
      success: true, 
      message: `Notice posted successfully and broadcasted to ${dispatchedCount} student(s).`,
      dispatchedCount 
    });
  } catch (error) {
    console.error("Error posting notice:", error);
    res.status(500).json({ success: false, message: "Error posting notice" });
  }
});

router.delete("/notices/:id", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const tpoId = req.user.userId;
    const { id } = req.params;

    await db.query("DELETE FROM campus_notices WHERE id = ? AND tpo_id = ?", [id, tpoId]);
    res.json({ success: true, message: "Notice removed successfully" });
  } catch (error) {
    console.error("Error deleting notice:", error);
    res.status(500).json({ success: false, message: "Error removing notice" });
  }
});

// GET Study Materials & Documents for TPO
router.get("/study-materials", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const tpoId = req.user.userId;
    const [materials]: any = await db.query(
      `SELECT sm.* FROM study_materials sm WHERE sm.tpo_id = ? ORDER BY sm.created_at DESC`,
      [tpoId]
    );
    res.json({ success: true, data: materials || [] });
  } catch (error) {
    console.error("Error fetching study materials:", error);
    res.status(500).json({ success: false, message: "Failed to load study materials" });
  }
});

// POST New Study Material / Document
router.post("/study-materials", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const tpoId = req.user.userId;
    const { title, description, category, batch_name, attachment_type, attachment_url, file_name, file_size } = req.body;

    if (!title || !attachment_url) {
      return res.status(400).json({ success: false, message: "Title and document/link attachment are required" });
    }

    const [tpoCollege]: any = await db.query(
      "SELECT college_id FROM tpo_colleges WHERE tpo_id = ? LIMIT 1",
      [tpoId]
    );
    const collegeId = tpoCollege[0]?.college_id || 1;
    const targetBatch = batch_name || 'ALL';
    const matCategory = category || 'General';
    const attachType = attachment_type || 'LOCAL';

    const [result]: any = await db.query(`
      INSERT INTO study_materials (tpo_id, college_id, batch_name, title, description, category, attachment_type, attachment_url, file_name, file_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tpoId, collegeId, targetBatch, title, description || '', matCategory,
      attachType, attachment_url, file_name || 'Document', file_size || 'N/A'
    ]);

    // Send direct notification to target students
    let dispatchedCount = 0;
    try {
      let studentQuery = `
        SELECT DISTINCT u.id as user_id
        FROM users u
        JOIN student_profiles sp ON u.id = sp.user_id
        LEFT JOIN student_batch sb ON sp.id = sb.student_id
        LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
        WHERE u.role = 'STUDENT'
      `;
      let params: any[] = [];

      if (targetBatch !== 'ALL') {
        studentQuery += ` AND (sp.batch = ? OR b.batch_name = ?)`;
        params.push(targetBatch, targetBatch);
      }

      const [targetStudents]: any = await db.query(studentQuery, params);

      if (targetStudents && targetStudents.length > 0) {
        const notifMsg = `New Study Material Posted: "${title}" (${file_name || 'Document'}). Check your Campus Portal!`;
        for (const student of targetStudents) {
          if (student.user_id) {
            await db.query(
              `INSERT INTO notifications (user_id, title, message, type, is_read) VALUES (?, ?, ?, 'MATERIAL', 0)`,
              [student.user_id, `New Study Material: ${title}`, notifMsg]
            );
            dispatchedCount++;
          }
        }
      }
    } catch (notifErr) {
      console.error("Error dispatching material notifications:", notifErr);
    }

    res.json({
      success: true,
      message: `Study material "${title}" published and notified to ${dispatchedCount} student(s).`,
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error("Error creating study material:", error);
    res.status(500).json({ success: false, message: "Error uploading study material" });
  }
});

// DELETE Study Material
router.delete("/study-materials/:id", authenticate, authorize(["TPO"]), async (req: any, res) => {
  try {
    const tpoId = req.user.userId;
    const { id } = req.params;

    await db.query("DELETE FROM study_materials WHERE id = ? AND tpo_id = ?", [id, tpoId]);
    res.json({ success: true, message: "Study material deleted successfully" });
  } catch (error) {
    console.error("Error deleting study material:", error);
    res.status(500).json({ success: false, message: "Error removing study material" });
  }
});


export default router;

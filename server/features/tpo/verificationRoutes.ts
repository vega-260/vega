import express from "express";
import db from "../../db.ts";
import { getTPOContext } from "./tpoContext.ts";
const router = express.Router();
// Get Verifications for Assigned Colleges
router.get("/verifications", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const { collegeIds } = context;
    const placeholders = collegeIds.map(() => '?').join(',');

    // 1. Proactive auto-generation of verification rows for student profiles who uploaded resumes but don't have records
    const [eligibleStudents]: any = await db.query(`
      SELECT sp.id, sp.resume_url, sp.aadhar_or_college_id
      FROM student_profiles sp
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      WHERE COALESCE(sp.college_id, b.college_id) IN (${placeholders}) 
        AND (sp.resume_url IS NOT NULL AND sp.resume_url != '')
    `, [...collegeIds]);

    for (const student of eligibleStudents) {
      if (student.resume_url) {
        const [existing]: any = await db.query(
          "SELECT id FROM tpo_verifications WHERE student_id = ? AND document_type = 'Resume'",
          [student.id]
        );
        if (existing.length === 0) {
          await db.query(`
            INSERT INTO tpo_verifications (student_id, document_type, document_url, status)
            VALUES (?, 'Resume', ?, 'PENDING')
          `, [student.id, student.resume_url]);
        }
      }
    }

    // Checking for Aadhar / College ID Card
    const [eligibleIdStudents]: any = await db.query(`
      SELECT sp.id, sp.aadhar_or_college_id
      FROM student_profiles sp
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      WHERE COALESCE(sp.college_id, b.college_id) IN (${placeholders}) 
        AND (sp.aadhar_or_college_id IS NOT NULL AND sp.aadhar_or_college_id != '')
    `, [...collegeIds]);

    for (const student of eligibleIdStudents) {
      if (student.aadhar_or_college_id) {
        const [existing]: any = await db.query(
          "SELECT id FROM tpo_verifications WHERE student_id = ? AND document_type = 'College ID Card'",
          [student.id]
        );
        if (existing.length === 0) {
          let url = student.aadhar_or_college_id;
          if (!url.startsWith('http') && !url.startsWith('/')) {
            url = `/id-proof-text-declaration?id=${encodeURIComponent(url)}`;
          }
          await db.query(`
            INSERT INTO tpo_verifications (student_id, document_type, document_url, status)
            VALUES (?, 'College ID Card', ?, 'PENDING')
          `, [student.id, url]);
        }
      }
    }

    // 2. Fetch all verification records for assigned colleges
    const [verifications]: any = await db.query(`
      SELECT v.*, sp.full_name, cm.college_name as college_name, u.email,
             COALESCE(b.status, 'ACTIVE') as batch_status
      FROM tpo_verifications v
      JOIN student_profiles sp ON v.student_id = sp.id
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      LEFT JOIN college_master cm ON COALESCE(sp.college_id, b.college_id) = cm.id
      WHERE COALESCE(sp.college_id, b.college_id) IN (${placeholders})
      ORDER BY v.created_at DESC
    `, [...collegeIds]);

    res.json({ success: true, data: verifications });
  } catch (error) {
    console.error("Verification retrieval error:", error);
    res.status(500).json({ success: false, message: "Error fetching verification requests" });
  }
});

// Approve Verification
router.post("/verifications/:id/approve", async (req: any, res) => {
  try {
    const { id } = req.params;
    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const { collegeIds } = context;
    const placeholders = collegeIds.map(() => '?').join(',');

    // Ensure verification belongs to a student of TPO's assigned colleges
    const [verification]: any = await db.query(`
      SELECT v.id, v.student_id, COALESCE(b.status, 'ACTIVE') as batch_status
      FROM tpo_verifications v
      JOIN student_profiles sp ON v.student_id = sp.id
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      WHERE v.id = ? AND COALESCE(sp.college_id, b.college_id) IN (${placeholders})
    `, [id, ...collegeIds]);

    if (verification.length === 0) {
      return res.status(403).json({ success: false, message: "Verification record not found or access denied" });
    }

    if (verification[0].batch_status === 'INACTIVE') {
      return res.status(400).json({ success: false, message: "Interaction blocked. Student belongs to an INACTIVE/DISABLED academic batch." });
    }

    const now = new Date();
    await db.query(
      "UPDATE tpo_verifications SET status = 'VERIFIED', verified_at = ? WHERE id = ?",
      [now, id]
    );

    res.json({ success: true, message: "Document verified successfully" });
  } catch (error) {
    console.error("Verification approve error:", error);
    res.status(500).json({ success: false, message: "Error approving verification" });
  }
});

// Reject Verification
router.post("/verifications/:id/reject", async (req: any, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const { collegeIds } = context;
    const placeholders = collegeIds.map(() => '?').join(',');

    // Ensure verification belongs to a student of TPO's assigned colleges
    const [verification]: any = await db.query(`
      SELECT v.id, v.student_id, COALESCE(b.status, 'ACTIVE') as batch_status
      FROM tpo_verifications v
      JOIN student_profiles sp ON v.student_id = sp.id
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      WHERE v.id = ? AND COALESCE(sp.college_id, b.college_id) IN (${placeholders})
    `, [id, ...collegeIds]);

    if (verification.length === 0) {
      return res.status(403).json({ success: false, message: "Verification record not found or access denied" });
    }

    if (verification[0].batch_status === 'INACTIVE') {
      return res.status(400).json({ success: false, message: "Interaction blocked. Student belongs to an INACTIVE/DISABLED academic batch." });
    }

    await db.query(
      "UPDATE tpo_verifications SET status = 'REJECTED', rejection_reason = ? WHERE id = ?",
      [reason || 'Incorrect document or low resolution', id]
    );

    res.json({ success: true, message: "Document verification rejected" });
  } catch (error) {
    console.error("Verification reject error:", error);
    res.status(500).json({ success: false, message: "Error rejecting verification" });
  }
});


export default router;

import express from "express";
import db from "../../db.ts";
import { getTPOContext } from "./tpoContext.ts";

const router = express.Router();

/**
 * Ensures the TPO profile record exists for the given user.
 */
async function getOrCreateTPOProfile(userId: number, email: string) {
  let [rows]: any = await db.query("SELECT * FROM tpo_profiles WHERE user_id = ?", [userId]);
  if (!rows || rows.length === 0) {
    const defaultName = email ? email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "Placement Officer";
    const employeeId = `TPO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    await db.query(
      `INSERT INTO tpo_profiles (user_id, full_name, designation, department, status, employee_id) 
       VALUES (?, ?, ?, 'Training & Placement Cell', 'ACTIVE', ?)`,
      [userId, defaultName, "Training & Placement Officer", employeeId]
    );
    [rows] = await db.query("SELECT * FROM tpo_profiles WHERE user_id = ?", [userId]);
  }
  return rows[0];
}

/**
 * GET /profile
 * Retrieves full TPO profile details with user credentials, institutional assignments, and key statistics.
 */
router.get("/profile", async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const [users]: any = await db.query(
      "SELECT id, email, role, status, is_verified, created_at FROM users WHERE id = ?",
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: "User account not found" });
    }
    const user = users[0];

    const profile = await getOrCreateTPOProfile(userId, user.email);

    // 1. Fetch assigned colleges
    let colleges: any[] = [];
    try {
      const [assignedColleges]: any = await db.query(`
        SELECT cm.* 
        FROM tpo_colleges tc
        JOIN college_master cm ON tc.college_id = cm.id
        WHERE tc.tpo_id = ?
      `, [profile.id]);
      colleges = assignedColleges || [];
    } catch (e) {
      console.warn("Could not fetch assigned colleges for TPO:", e);
    }

    // Fallback: check batches assigned directly to this TPO if tpo_colleges is empty
    if (colleges.length === 0) {
      try {
        const [batchColleges]: any = await db.query(`
          SELECT DISTINCT cm.* 
          FROM batches b
          JOIN college_master cm ON b.college_id = cm.id
          WHERE b.assigned_tpo_id = ?
        `, [profile.id]);
        colleges = batchColleges || [];
      } catch (e) {}
    }

    // 2. Fetch operational and placement metrics
    const context = await getTPOContext(userId);
    const stats = {
      totalStudents: 0,
      placedStudents: 0,
      activeDrives: 0,
      assignedBatches: 0,
      createdTests: 0,
    };

    if (context && context.collegeIds.length > 0) {
      const placeholders = context.collegeIds.map(() => "?").join(",");
      try {
        const [studentCount]: any = await db.query(`
          SELECT COUNT(*) as total 
          FROM student_profiles sp
          LEFT JOIN student_batch sb ON sp.id = sb.student_id
          LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
          WHERE COALESCE(sp.college_id, b.college_id) IN (${placeholders})
        `, [...context.collegeIds]);
        stats.totalStudents = studentCount[0]?.total || 0;
      } catch (e) {}

      try {
        const [placedCount]: any = await db.query(`
          SELECT COUNT(DISTINCT er.student_id) as total
          FROM event_registrations er
          JOIN student_profiles sp ON er.student_id = sp.id
          LEFT JOIN student_batch sb ON sp.id = sb.student_id
          LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
          WHERE COALESCE(sp.college_id, b.college_id) IN (${placeholders}) AND er.status = 'SELECTED'
        `, [...context.collegeIds]);
        stats.placedStudents = placedCount[0]?.total || 0;
      } catch (e) {}

      try {
        const [batchCount]: any = await db.query(`
          SELECT COUNT(*) as total FROM batches WHERE college_id IN (${placeholders})
        `, [...context.collegeIds]);
        stats.assignedBatches = batchCount[0]?.total || 0;
      } catch (e) {}

      try {
        const [driveCount]: any = await db.query(`
          SELECT COUNT(*) as total FROM events WHERE college_id IN (${placeholders}) AND status IN ('UPCOMING', 'ACTIVE')
        `, [...context.collegeIds]);
        stats.activeDrives = driveCount[0]?.total || 0;
      } catch (e) {}
    }

    try {
      const [testCount]: any = await db.query(`
        SELECT COUNT(*) as total FROM assessment_tests WHERE tpo_id = ?
      `, [profile.id]);
      stats.createdTests = testCount[0]?.total || 0;
    } catch (e) {}

    return res.json({
      success: true,
      data: {
        user,
        profile,
        colleges,
        stats,
      },
    });
  } catch (error: any) {
    console.error("Error fetching TPO profile:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch TPO profile details" });
  }
});

/**
 * PUT /profile
 * Updates the allowed editable fields for the logged in TPO.
 */
router.put("/profile", async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const {
      full_name,
      contact_number,
      alternate_contact,
      designation,
      department,
      office_location,
      office_hours,
      bio,
      linkedin_url,
      profile_photo_url,
      secondary_email,
      experience_years,
      qualification,
    } = req.body;

    if (!full_name || !String(full_name).trim()) {
      return res.status(400).json({ success: false, message: "Full Name is required." });
    }

    const trimmedName = String(full_name).trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({ success: false, message: "Full Name must be between 2 and 100 characters." });
    }

    if (secondary_email && String(secondary_email).trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(secondary_email).trim())) {
        return res.status(400).json({ success: false, message: "Please provide a valid secondary email address." });
      }
    }

    // Ensure profile row exists
    const [users]: any = await db.query("SELECT email FROM users WHERE id = ?", [userId]);
    const userEmail = users[0]?.email || "";
    await getOrCreateTPOProfile(userId, userEmail);

    // Whitelist only editable fields to prevent any unauthorized elevation of role/status/colleges
    const editableData = {
      full_name: trimmedName,
      contact_number: contact_number ? String(contact_number).trim() : null,
      alternate_contact: alternate_contact ? String(alternate_contact).trim() : null,
      designation: designation ? String(designation).trim() : "Training & Placement Officer",
      department: department ? String(department).trim() : "Training & Placement Cell",
      office_location: office_location ? String(office_location).trim() : null,
      office_hours: office_hours ? String(office_hours).trim() : null,
      bio: bio ? String(bio).trim() : null,
      linkedin_url: linkedin_url ? String(linkedin_url).trim() : null,
      profile_photo_url: profile_photo_url ? String(profile_photo_url).trim() : null,
      secondary_email: secondary_email ? String(secondary_email).trim() : null,
      experience_years: experience_years ? String(experience_years).trim() : null,
      qualification: qualification ? String(qualification).trim() : null,
    };

    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(editableData)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
    values.push(userId);

    await db.query(
      `UPDATE tpo_profiles SET ${setClauses.join(", ")} WHERE user_id = ?`,
      values
    );

    const [updatedRows]: any = await db.query("SELECT * FROM tpo_profiles WHERE user_id = ?", [userId]);

    return res.json({
      success: true,
      message: "TPO Profile updated successfully.",
      data: updatedRows[0],
    });
  } catch (error: any) {
    console.error("Error updating TPO profile:", error);
    return res.status(500).json({ success: false, message: "Failed to update profile details." });
  }
});

export default router;

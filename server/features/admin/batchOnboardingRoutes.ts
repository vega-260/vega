import express from "express";
import db from "../../db.ts";
import { logAdminAction } from "./adminAudit.ts";
const router = express.Router();
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendStudentCredentials } from "../../services/emailService.ts";
// --- BATCH MANAGEMENT ---

router.get("/batches", async (req, res) => {
  try {
    const { college_id } = req.query;
    let queryStr = `
      SELECT b.*, cm.college_name, tp.full_name as tpo_name,
             (SELECT COUNT(*) FROM student_batch sb WHERE sb.batch_id = b.id) as student_count
      FROM batches b
      JOIN college_master cm ON b.college_id = cm.id
      LEFT JOIN tpo_profiles tp ON b.assigned_tpo_id = tp.id
    `;
    const params = [];
    if (college_id) {
      queryStr += ` WHERE b.college_id = ?`;
      params.push(college_id);
    }
    queryStr += ` ORDER BY b.batch_name ASC`;

    const [batches]: any = await db.query(queryStr, params);
    res.json({ success: true, data: batches });
  } catch (error) {
    console.error("Fetch Batches Error:", error);
    res.status(500).json({ success: false, message: "Error fetching academic batches" });
  }
});

router.post("/batches", async (req, res) => {
  try {
    const { college_id, batch_name, department, academic_year, semester, assigned_tpo_id } = req.body;

    if (!college_id || !batch_name || !String(batch_name).trim()) {
      return res.status(400).json({ success: false, message: "College ID and Batch Name are required." });
    }

    const cleanBatchName = String(batch_name).trim();

    // Verify uniqueness of batch under the college (case-insensitive)
    const [existing]: any = await db.query(
      "SELECT id FROM batches WHERE college_id = ? AND LOWER(TRIM(batch_name)) = LOWER(TRIM(?))", 
      [college_id, cleanBatchName]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "A batch with this name already exists under the selected college." });
    }

    const [result]: any = await db.query(`
      INSERT INTO batches (college_id, batch_name, department, academic_year, semester, assigned_tpo_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [college_id, cleanBatchName, department ? String(department).trim() : null, academic_year ? String(academic_year).trim() : null, semester ? String(semester).trim() : null, assigned_tpo_id || null]);

    await logAdminAction((req as any).user.userId, "CREATE_BATCH", { college_id, batch_name }, req);

    res.json({ success: true, message: "Batch created successfully", batchId: result.insertId });
  } catch (error) {
    console.error("Create Batch Error:", error);
    res.status(500).json({ success: false, message: "Error creating academic batch" });
  }
});

router.put("/batches/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { batch_name, department, academic_year, semester, assigned_tpo_id, status } = req.body;

    await db.query(`
      UPDATE batches SET
        batch_name = ?, department = ?, academic_year = ?, semester = ?, assigned_tpo_id = ?, status = ?
      WHERE id = ?
    `, [batch_name, department || null, academic_year || null, semester || null, assigned_tpo_id || null, status || "ACTIVE", id]);

    await logAdminAction((req as any).user.userId, "UPDATE_BATCH", { batchId: id, batch_name }, req);

    res.json({ success: true, message: "Batch updated successfully" });
  } catch (error) {
    console.error("Update Batch Error:", error);
    res.status(500).json({ success: false, message: "Error updating academic batch" });
  }
});

router.delete("/batches/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Delete batch
    await db.query("DELETE FROM batches WHERE id = ?", [id]);

    await logAdminAction((req as any).user.userId, "DELETE_BATCH", { batchId: id }, req);

    res.json({ success: true, message: "Batch deleted successfully" });
  } catch (error) {
    console.error("Delete Batch Error:", error);
    res.status(500).json({ success: false, message: "Error deleting batch" });
  }
});

// --- BATCH STUDENTS MANAGEMENT ---

router.get("/batches/:id/students", async (req, res) => {
  try {
    const { id } = req.params;
    const [students]: any = await db.query(`
      SELECT sp.id, sp.user_id, sp.full_name, sp.college_id, sp.batch_id, COALESCE(sp.department, b.department) as department, u.email, u.status as user_status, ts.overall_score as talent_score
      FROM student_profiles sp
      JOIN users u ON sp.user_id = u.id
      JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON sb.batch_id = b.id
      LEFT JOIN talent_scores ts ON sp.user_id = ts.user_id
      WHERE sb.batch_id = ?
    `, [id]);
    res.json({ success: true, data: students });
  } catch (error) {
    console.error("Fetch Batch Students Error:", error);
    res.status(500).json({ success: false, message: "Error fetching batch students" });
  }
});

router.post("/batches/:id/students", async (req, res) => {
  try {
    const { id } = req.params; // batch_id
    const { name, email, department } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: "Name and email are required." });
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const NAME_REGEX = /^[a-zA-Z0-9\s.,'()&/-]{2,100}$/;

    if (!NAME_REGEX.test(cleanName)) {
      return res.status(400).json({ success: false, message: "Please enter a valid student full name." });
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Please enter a valid student email address." });
    }

    // Check duplicate user
    const [existing]: any = await db.query("SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))", [cleanEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Email already registered in the ecosystem." });
    }

    // Get batch and college info
    const [batches]: any = await db.query(`
      SELECT b.batch_name, b.department as batch_dept, b.college_id, cm.college_name 
      FROM batches b
      JOIN college_master cm ON b.college_id = cm.id
      WHERE b.id = ?
    `, [id]);

    if (batches.length === 0) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }

    const { batch_name, batch_dept, college_id, college_name } = batches[0];
    const finalDepartment = (department ? String(department).trim() : null) || batch_dept || null;

    // Generate credentials
    const studentPass = crypto.randomBytes(8).toString("hex");
    const studentHash = await bcrypt.hash(studentPass, 10);

    // Create user
    const [userRes]: any = await db.query(`
      INSERT INTO users (email, password_hash, role, status, is_verified, xp_balance)
      VALUES (?, ?, 'STUDENT', 'ACTIVE', 1, 100)
    `, [cleanEmail, studentHash]);

    const studentUserId = userRes.insertId;

    // Insert Student Profile
    const [profileRes]: any = await db.query(`
      INSERT INTO student_profiles (user_id, college_id, batch_id, full_name, department, batch, onboarding_completed, completeness_score)
      VALUES (?, ?, ?, ?, ?, ?, 1, 40)
    `, [studentUserId, college_id, id, cleanName, finalDepartment, batch_name]);

    const studentProfileId = profileRes.insertId;

    // Add map to student_batch table
    await db.query(`
      INSERT INTO student_batch (student_id, batch_id)
      VALUES (?, ?)
    `, [studentProfileId, id]);

    // Update batch strength count (strength or student_count)
    const [successCount]: any = await db.query("SELECT COUNT(*) as count FROM student_batch WHERE batch_id = ?", [id]);
    await db.query("UPDATE batches SET strength = ? WHERE id = ?", [successCount[0].count, id]);

    // Send Email via SMTP in background (non-blocking)
    const loginUrl = `${process.env.APP_URL || 'http://localhost:3000'}/login`;
    sendStudentCredentials(cleanEmail, cleanName, studentPass, college_name, batch_name, loginUrl)
      .then(async () => {
        try {
          await db.query(`
            INSERT INTO email_logs (user_id, email_type, recipient, subject, status)
            VALUES (?, 'STUDENT_CREDENTIALS', ?, 'Welcome to VEGA - Student Credentials', 'SENT')
          `, [studentUserId, cleanEmail]);
        } catch (e) {
          console.error("Email log insert error:", e);
        }
      })
      .catch((emailErr) => {
        console.error(`Email dispatch failed for manual student ${cleanEmail}:`, emailErr);
      });

    await logAdminAction((req as any).user.userId, "ADD_MANUAL_STUDENT", { batch_id: id, batch_name, student_email: cleanEmail, student_name: cleanName }, req);

    res.json({ success: true, message: "Student added successfully to the batch" });
  } catch (error: any) {
    console.error("Add Manual Student Error:", error);
    res.status(500).json({ success: false, message: "Error adding student to batch: " + error.message });
  }
});


// --- COLLEGE TREE WORKFLOWS ---

router.get("/college-tree", async (req, res) => {
  try {
    // 1. Fetch all colleges
    const [colleges]: any = await db.query(`
      SELECT id, college_name, college_code, district, state, status, website, official_email 
      FROM college_master 
      ORDER BY id DESC
    `);

    // 2. Fetch all batches
    const [batches]: any = await db.query(`
      SELECT b.*, tp.full_name as tpo_name
      FROM batches b
      LEFT JOIN tpo_profiles tp ON b.assigned_tpo_id = tp.id
      ORDER BY b.batch_name ASC
    `);

    // 3. Fetch all students with batch details
    const [students]: any = await db.query(`
      SELECT sp.id, sp.user_id, sp.full_name, sp.college_id, sp.batch_id, sp.department, u.email, u.status as user_status, ts.overall_score as talent_score
      FROM student_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN talent_scores ts ON sp.user_id = ts.user_id
    `);

    // Process Tree Map hierarchy
    const resultTree = colleges.map((college: any) => {
      const collegeBatches = batches.filter((b: any) => Number(b.college_id) === Number(college.id)).map((batch: any) => {
        const batchStudents = students.filter((s: any) => Number(s.batch_id) === Number(batch.id));
        return {
          id: batch.id,
          batch_name: batch.batch_name,
          department: batch.department,
          academic_year: batch.academic_year,
          semester: batch.semester,
          status: batch.status,
          tpo_name: batch.tpo_name,
          student_count: batchStudents.length,
          students: batchStudents
        };
      });

      const unassignedStudents = students.filter((s: any) => Number(s.college_id) === Number(college.id) && !s.batch_id);

      return {
        id: college.id,
        college_name: college.college_name,
        college_code: college.college_code,
        district: college.district,
        state: college.state,
        website: college.website,
        official_email: college.official_email,
        status: college.status,
        batches: collegeBatches,
        unassigned_students_count: unassignedStudents.length,
        unassigned_students: unassignedStudents
      };
    });

    res.json({ success: true, data: resultTree });
  } catch (error) {
    console.error("College Tree Fetch Error:", error);
    res.status(500).json({ success: false, message: "Error fetching college organizational tree structure" });
  }
});


// --- STUDENT BULK ONBOARDING ENGINE ---

router.post("/onboard-batch", async (req, res) => {
  try {
    const { college_id, batch_id, department, students } = req.body;
    
    if (!college_id || !batch_id || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: "College, Batch, and a list of students are required." });
    }

    // Validate college
    const [colleges]: any = await db.query("SELECT college_name FROM college_master WHERE id = ?", [college_id]);
    if (colleges.length === 0) {
      return res.status(404).json({ success: false, message: "College not found" });
    }
    const collegeName = colleges[0].college_name;

    // Validate batch
    const [batches]: any = await db.query("SELECT batch_name, department as batch_dept FROM batches WHERE id = ? AND college_id = ?", [batch_id, college_id]);
    if (batches.length === 0) {
      return res.status(404).json({ success: false, message: "Batch not found under this college" });
    }
    const batchName = batches[0].batch_name;
    const batchDept = batches[0].batch_dept;

    const results = [];
    const loginUrl = `${process.env.APP_URL || 'http://localhost:3000'}/login`;

    for (const student of students) {
      const { name, email, department: studentDept } = student;
      if (!email || !name) continue;

      const finalDepartment = studentDept || department || batchDept || null;

      try {
        // Check duplicate user
        const [existing]: any = await db.query("SELECT id FROM users WHERE email = ?", [email]);
        if (existing.length > 0) {
          results.push({ email, name, status: "SKIPPED", reason: "Email already registered in the ecosystem" });
          continue;
        }

        // Generate credentials
        const studentPass = crypto.randomBytes(8).toString("hex");
        const studentHash = await bcrypt.hash(studentPass, 10);

        // Transactional execution simulation (isolated try-catch blocks)
        const [userRes]: any = await db.query(`
          INSERT INTO users (email, password_hash, role, status, is_verified, xp_balance)
          VALUES (?, ?, 'STUDENT', 'ACTIVE', 1, 100)
        `, [email, studentHash]);

        const studentUserId = userRes.insertId;

        // Insert Student Profile
        const [profileRes]: any = await db.query(`
          INSERT INTO student_profiles (user_id, college_id, batch_id, full_name, department, batch, onboarding_completed, completeness_score)
          VALUES (?, ?, ?, ?, ?, ?, 1, 40)
        `, [studentUserId, college_id, batch_id, name, finalDepartment, batchName]);

        const studentProfileId = profileRes.insertId;

        // Add map to student_batch table
        await db.query(`
          INSERT INTO student_batch (student_id, batch_id)
          VALUES (?, ?)
        `, [studentProfileId, batch_id]);

        // Send Email via SMTP & Log Email in background (non-blocking)
        sendStudentCredentials(email, name, studentPass, collegeName, batchName, loginUrl)
          .then(async () => {
            try {
              await db.query(`
                INSERT INTO email_logs (user_id, email_type, recipient, subject, status)
                VALUES (?, 'STUDENT_CREDENTIALS', ?, 'Welcome to VEGA - Student Credentials', 'SENT')
              `, [studentUserId, email]);
            } catch (e) {
              console.error("Failed email log insert:", e);
            }
          })
          .catch((emailErr) => {
            console.error(`Email dispatch failed for student ${email}:`, emailErr);
          });

        results.push({ email, name, status: "SUCCESS" });
      } catch (err: any) {
        console.error(`Error registering student ${email}:`, err);
        results.push({ email, name, status: "FAILED", reason: err.message });
      }
    }

    // Increment strength of batch
    const [successCount]: any = await db.query("SELECT COUNT(*) as count FROM student_batch WHERE batch_id = ?", [batch_id]);
    await db.query("UPDATE batches SET strength = ? WHERE id = ?", [successCount[0].count, batch_id]);

    await logAdminAction((req as any).user.userId, "ONBOARD_BATCH", { college_id, collegeName, batch_id, batchName, total: students.length, results }, req);

    res.json({ 
      success: true, 
      message: `Batch '${batchName}' students onboarded successfully`, 
      results 
    });
  } catch (error: any) {
    console.error("Batch Onboarding Error:", error);
    res.status(500).json({ success: false, message: "Error onboarding batch students" });
  }
});



export default router;

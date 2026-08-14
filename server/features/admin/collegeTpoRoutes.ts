import express from "express";
import db from "../../db.ts";
import { logAdminAction } from "./adminAudit.ts";
const router = express.Router();
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendTPOCredentials } from "../../services/emailService.ts";
// --- COLLEGE MANAGEMENT ---

router.post("/colleges", async (req, res) => {
  try {
    const { 
      college_name, college_code, university, address, district, state, 
      country, website, contact_number, official_email, principal_name, 
      placement_head, college_logo, status 
    } = req.body;
    
    if (!college_name || !college_code) {
      return res.status(400).json({ success: false, message: "College name and code are required." });
    }

    if (contact_number) {
      const cleanContact = String(contact_number).replace(/\D/g, "");
      if (cleanContact.length < 10 || cleanContact.length > 15) {
        return res.status(400).json({ success: false, message: "Contact number must be between 10 and 15 digits." });
      }
    }

    const [result]: any = await db.query(`
      INSERT INTO college_master (
        college_name, college_code, university, address, district, state, 
        country, website, contact_number, official_email, principal_name, 
        placement_head, college_logo, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      college_name, college_code, university || null, address || null, 
      district || null, state || null, country || "India", website || null, 
      contact_number || null, official_email || null, principal_name || null, 
      placement_head || null, college_logo || null, status || "ACTIVE"
    ]);

    await logAdminAction((req as any).user.userId, "CREATE_COLLEGE", { college_name, college_code }, req);

    res.json({ success: true, message: "College created successfully", collegeId: result.insertId });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY' || String(error.message).includes("UNIQUE")) {
      return res.status(400).json({ success: false, message: "College code already exists" });
    }
    console.error("Create College Error:", error);
    res.status(500).json({ success: false, message: "Error creating college" });
  }
});

router.put("/colleges/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      college_name, college_code, university, address, district, state, 
      country, website, contact_number, official_email, principal_name, 
      placement_head, college_logo, status 
    } = req.body;

    await db.query(`
      UPDATE college_master SET
        college_name = ?, college_code = ?, university = ?, address = ?, 
        district = ?, state = ?, country = ?, website = ?, contact_number = ?, 
        official_email = ?, principal_name = ?, placement_head = ?, 
        college_logo = ?, status = ?
      WHERE id = ?
    `, [
      college_name, college_code, university || null, address || null, 
      district || null, state || null, country || "India", website || null, 
      contact_number || null, official_email || null, principal_name || null, 
      placement_head || null, college_logo || null, status || "ACTIVE",
      id
    ]);

    await logAdminAction((req as any).user.userId, "UPDATE_COLLEGE", { collegeId: id, college_name }, req);

    res.json({ success: true, message: "College updated successfully" });
  } catch (error: any) {
    console.error("Update College Error:", error);
    res.status(500).json({ success: false, message: "Error updating college" });
  }
});

router.get("/colleges", async (req, res) => {
  try {
    const [colleges]: any = await db.query("SELECT * FROM college_master ORDER BY college_name ASC");
    res.json({ success: true, data: colleges });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching colleges" });
  }
});

router.delete("/colleges/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE college_master SET status = 'INACTIVE' WHERE id = ?", [id]);
    await logAdminAction((req as any).user.userId, "DELETE_COLLEGE", { collegeId: id, mode: "SOFT_DELETE" }, req);
    res.json({ success: true, message: "College marked as INACTIVE successfully" });
  } catch (error) {
    console.error("Delete College Error:", error);
    res.status(500).json({ success: false, message: "Error deleting college." });
  }
});

// --- TPO MANAGEMENT ---

router.post("/tpos", async (req, res) => {
  try {
    const { email, full_name, contact_number, designation, employee_id, college_ids } = req.body;

    if (!email || !full_name) {
      return res.status(400).json({ success: false, message: "Email and full name are required." });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    // Check if user already exists
    const [existingUsers]: any = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    // Create User
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const [userResult]: any = await db.query(`
      INSERT INTO users (email, password_hash, role, status, is_verified)
      VALUES (?, ?, 'TPO', 'ACTIVE', 1)
    `, [email, passwordHash]);

    const userId = userResult.insertId;

    // Create TPO Profile
    const [tpoResult]: any = await db.query(`
      INSERT INTO tpo_profiles (user_id, full_name, contact_number, designation, employee_id, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [userId, full_name, contact_number || null, designation || null, employee_id || null, contact_number || null]);

    const tpoId = tpoResult.insertId;

    // Assign Colleges
    if (college_ids && Array.isArray(college_ids)) {
      for (const collegeId of college_ids) {
        await db.query("INSERT INTO tpo_colleges (tpo_id, college_id) VALUES (?, ?)", [tpoId, collegeId]);
      }
    }

    // Send SMTP Credentials & Log Email
    try {
      const loginUrl = `${process.env.APP_URL || 'http://localhost:3000'}/login`;
      await sendTPOCredentials(email, full_name, tempPassword, loginUrl);
      
      await db.query(`
        INSERT INTO email_logs (user_id, email_type, recipient, subject, status)
        VALUES (?, 'TPO_CREDENTIALS', ?, 'Welcome to VEGA - TPO Credentials', 'SENT')
      `, [userId, email]);
    } catch (emailErr) {
      console.error("Failed to send SMTP email:", emailErr);
    }

    await logAdminAction((req as any).user.userId, "CREATE_TPO", { email, full_name, college_ids }, req);

    res.json({ 
      success: true, 
      message: "TPO account created successfully and credentials sent to official email."
    });
  } catch (error: any) {
    console.error("Create TPO Error:", error);
    res.status(500).json({ success: false, message: "Error creating TPO account" });
  }
});

router.put("/tpos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, contact_number, designation, employee_id, college_ids, status } = req.body;

    const [tpoProfiles]: any = await db.query("SELECT user_id FROM tpo_profiles WHERE id = ?", [id]);
    if (tpoProfiles.length === 0) {
      return res.status(404).json({ success: false, message: "TPO profile not found" });
    }
    const userId = tpoProfiles[0].user_id;

    // Update profiles
    await db.query(`
      UPDATE tpo_profiles SET
        full_name = ?, contact_number = ?, designation = ?, employee_id = ?, phone = ?, status = ?
      WHERE id = ?
    `, [full_name, contact_number || null, designation || null, employee_id || null, contact_number || null, status || "ACTIVE", id]);

    // Update users table status
    if (status) {
      await db.query("UPDATE users SET status = ? WHERE id = ?", [status, userId]);
    }

    // Sync Colleges Assignment
    await db.query("DELETE FROM tpo_colleges WHERE tpo_id = ?", [id]);
    if (college_ids && Array.isArray(college_ids)) {
      for (const collegeId of college_ids) {
        await db.query("INSERT INTO tpo_colleges (tpo_id, college_id) VALUES (?, ?)", [id, collegeId]);
      }
    }

    await logAdminAction((req as any).user.userId, "UPDATE_TPO", { tpoId: id, full_name }, req);

    res.json({ success: true, message: "TPO updated successfully" });
  } catch (error) {
    console.error("Update TPO Error:", error);
    res.status(500).json({ success: false, message: "Error updating TPO" });
  }
});

router.delete("/tpos/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [tpoProfiles]: any = await db.query("SELECT user_id FROM tpo_profiles WHERE id = ?", [id]);
    if (tpoProfiles.length > 0) {
      const userId = tpoProfiles[0].user_id;
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
    }

    await logAdminAction((req as any).user.userId, "DELETE_TPO", { tpoId: id }, req);

    res.json({ success: true, message: "TPO account deleted successfully" });
  } catch (error) {
    console.error("Delete TPO Error:", error);
    res.status(500).json({ success: false, message: "Error deleting TPO" });
  }
});


export default router;

import express from "express";
import db from "../../db.ts";
import { logAdminAction } from "./adminAudit.ts";
const router = express.Router();
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendTPOCredentials } from "../../services/emailService.ts";
// --- COLLEGE & TPO MANAGEMENT ---

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/;
const URL_REGEX = /^(https?:\/\/)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i;
const COLLEGE_CODE_REGEX = /^[A-Z0-9_-]{2,30}$/;

router.post("/colleges", async (req, res) => {
  try {
    const { 
      college_name, college_code, university, address, district, state, 
      country, website, contact_number, official_email, principal_name, 
      placement_head, college_logo, status 
    } = req.body;
    
    const trimmedName = typeof college_name === "string" ? college_name.trim() : "";
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: "College/Institute name is required." });
    }

    let finalCode = typeof college_code === "string" ? college_code.trim().toUpperCase() : "";
    if (finalCode && !COLLEGE_CODE_REGEX.test(finalCode)) {
      return res.status(400).json({ success: false, message: "College code must be 2-30 alphanumeric characters." });
    }

    if (!finalCode) {
      const acronym = trimmedName
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .split(/\s+/)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase();
      const suffix = Math.floor(1000 + Math.random() * 9000);
      finalCode = `${acronym || "COL"}-${suffix}`;
    }

    let cleanEmail: string | null = null;
    if (official_email && typeof official_email === "string" && official_email.trim()) {
      cleanEmail = official_email.trim();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: "Please enter a valid official email address (e.g. info@college.edu)." });
      }
    }

    let cleanContact: string | null = null;
    if (contact_number && typeof contact_number === "string" && contact_number.trim()) {
      cleanContact = contact_number.trim();
      if (!PHONE_REGEX.test(cleanContact)) {
        return res.status(400).json({ success: false, message: "Contact number must be a valid telephone number." });
      }
    }

    let cleanWebsite: string | null = null;
    if (website && typeof website === "string" && website.trim()) {
      const trimmedUrl = website.trim();
      if (!URL_REGEX.test(trimmedUrl)) {
        return res.status(400).json({ success: false, message: "Please enter a valid website URL (e.g. https://college.edu)." });
      }
      cleanWebsite = trimmedUrl;
    }

    const normalizedStatus = (status || "ACTIVE").toString().toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    const [result]: any = await db.query(`
      INSERT INTO college_master (
        college_name, college_code, university, address, district, state, 
        country, website, contact_number, official_email, principal_name, 
        placement_head, college_logo, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trimmedName,
      finalCode,
      typeof university === "string" && university.trim() ? university.trim() : null,
      typeof address === "string" && address.trim() ? address.trim() : null, 
      typeof district === "string" && district.trim() ? district.trim() : null,
      typeof state === "string" && state.trim() ? state.trim() : null,
      typeof country === "string" && country.trim() ? country.trim() : "India",
      cleanWebsite, 
      cleanContact,
      cleanEmail,
      typeof principal_name === "string" && principal_name.trim() ? principal_name.trim() : null, 
      typeof placement_head === "string" && placement_head.trim() ? placement_head.trim() : null,
      college_logo || null,
      normalizedStatus
    ]);

    const adminId = (req as any).user?.userId || (req as any).user?.id || 1;
    await logAdminAction(adminId, "CREATE_COLLEGE", { college_name: trimmedName, college_code: finalCode }, req);

    res.status(201).json({ 
      success: true, 
      message: "College registered successfully", 
      collegeId: result?.insertId || result?.id 
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY' || String(error.message).includes("UNIQUE") || String(error.message).includes("college_code")) {
      return res.status(400).json({ success: false, message: "A college with this unique code already exists. Please choose a different code." });
    }
    console.error("Create College Error:", error);
    res.status(500).json({ success: false, message: error.message || "Error creating college" });
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

    const trimmedName = typeof college_name === "string" ? college_name.trim() : "";
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: "College/Institute name is required." });
    }

    const finalCode = typeof college_code === "string" ? college_code.trim().toUpperCase() : "";
    if (!finalCode) {
      return res.status(400).json({ success: false, message: "Unique college code is required." });
    }

    let cleanEmail: string | null = null;
    if (official_email && typeof official_email === "string" && official_email.trim()) {
      cleanEmail = official_email.trim();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: "Please enter a valid official email address (e.g. info@college.edu)." });
      }
    }

    let cleanContact: string | null = null;
    if (contact_number && typeof contact_number === "string" && contact_number.trim()) {
      const digits = contact_number.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) {
        return res.status(400).json({ success: false, message: "Contact number must be between 7 and 15 digits." });
      }
      cleanContact = contact_number.trim();
    }

    let cleanWebsite: string | null = null;
    if (website && typeof website === "string" && website.trim()) {
      const trimmedUrl = website.trim();
      if (!URL_REGEX.test(trimmedUrl)) {
        return res.status(400).json({ success: false, message: "Please enter a valid website URL (e.g. https://college.edu)." });
      }
      cleanWebsite = trimmedUrl;
    }

    const normalizedStatus = (status || "ACTIVE").toString().toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    await db.query(`
      UPDATE college_master SET
        college_name = ?, college_code = ?, university = ?, address = ?, 
        district = ?, state = ?, country = ?, website = ?, contact_number = ?, 
        official_email = ?, principal_name = ?, placement_head = ?, 
        college_logo = ?, status = ?
      WHERE id = ?
    `, [
      trimmedName,
      finalCode,
      typeof university === "string" && university.trim() ? university.trim() : null,
      typeof address === "string" && address.trim() ? address.trim() : null, 
      typeof district === "string" && district.trim() ? district.trim() : null,
      typeof state === "string" && state.trim() ? state.trim() : null,
      typeof country === "string" && country.trim() ? country.trim() : "India",
      cleanWebsite, 
      cleanContact, 
      cleanEmail, 
      typeof principal_name === "string" && principal_name.trim() ? principal_name.trim() : null, 
      typeof placement_head === "string" && placement_head.trim() ? placement_head.trim() : null, 
      college_logo || null,
      normalizedStatus,
      id
    ]);

    const adminId = (req as any).user?.userId || (req as any).user?.id || 1;
    await logAdminAction(adminId, "UPDATE_COLLEGE", { collegeId: id, college_name: trimmedName }, req);

    res.json({ success: true, message: "College updated successfully" });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY' || String(error.message).includes("UNIQUE") || String(error.message).includes("college_code")) {
      return res.status(400).json({ success: false, message: "A college with this unique code already exists." });
    }
    console.error("Update College Error:", error);
    res.status(500).json({ success: false, message: error.message || "Error updating college" });
  }
});

router.get("/colleges", async (req, res) => {
  try {
    const [colleges]: any = await db.query("SELECT * FROM college_master ORDER BY id DESC");
    res.json({ success: true, data: colleges });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching colleges" });
  }
});

router.delete("/colleges/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM tpo_colleges WHERE college_id = ?", [id]);
    await db.query("DELETE FROM academic_batches WHERE college_id = ?", [id]);
    await db.query("DELETE FROM college_master WHERE id = ?", [id]);
    await logAdminAction((req as any).user.userId, "DELETE_COLLEGE", { collegeId: id }, req);
    res.json({ success: true, message: "College deleted successfully" });
  } catch (error) {
    console.error("Delete College Error:", error);
    res.status(500).json({ success: false, message: "Error deleting college." });
  }
});

// --- TPO MANAGEMENT ---

router.post("/tpos", async (req, res) => {
  let createdUserId: number | null = null;
  try {
    const { email, full_name, contact_number, designation, employee_id, college_ids } = req.body;

    if (!email || !full_name) {
      return res.status(400).json({ success: false, message: "Email and full name are required." });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    if (contact_number && typeof contact_number === "string" && contact_number.trim()) {
      if (!PHONE_REGEX.test(contact_number.trim())) {
        return res.status(400).json({ success: false, message: "Contact number must be a valid telephone number." });
      }
    }

    // Check if employee_id already exists
    const cleanEmpId = typeof employee_id === "string" && employee_id.trim() ? employee_id.trim() : null;
    if (cleanEmpId) {
      const [existingEmp]: any = await db.query(
        "SELECT id FROM tpo_profiles WHERE LOWER(TRIM(employee_id)) = LOWER(?)",
        [cleanEmpId]
      );
      if (existingEmp.length > 0) {
        return res.status(400).json({ success: false, message: "Employee ID already exists" });
      }
    }

    // Check if contact_number already exists
    const cleanPhone = contact_number && typeof contact_number === "string" && contact_number.trim() ? contact_number.trim() : null;
    if (cleanPhone) {
      const [existingPhone]: any = await db.query(
        "SELECT id FROM tpo_profiles WHERE contact_number = ? OR phone = ?",
        [cleanPhone, cleanPhone]
      );
      if (existingPhone.length > 0) {
        return res.status(400).json({ success: false, message: "Contact phone number already exists" });
      }
    }

    // Check if user already exists
    const [existingUsers]: any = await db.query("SELECT id, role FROM users WHERE LOWER(TRIM(email)) = LOWER(?)", [cleanEmail]);
    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      // Check if this is an orphaned user record from an interrupted attempt
      const [profiles]: any = await db.query("SELECT id FROM tpo_profiles WHERE user_id = ?", [existingUser.id]);
      if (profiles.length === 0 && existingUser.role === 'TPO') {
        // Clean up orphaned user record from previous failed creation attempt
        await db.query("DELETE FROM users WHERE id = ?", [existingUser.id]);
      } else {
        return res.status(400).json({ success: false, message: "Email already exists" });
      }
    }

    // Create User
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const [userResult]: any = await db.query(`
      INSERT INTO users (email, password_hash, role, status, is_verified)
      VALUES (?, ?, 'TPO', 'ACTIVE', 1)
    `, [cleanEmail, passwordHash]);

    createdUserId = userResult.insertId;

    // Create TPO Profile
    const [tpoResult]: any = await db.query(`
      INSERT INTO tpo_profiles (user_id, full_name, contact_number, designation, employee_id, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [createdUserId, full_name, contact_number || null, designation || null, employee_id || null, contact_number || null]);

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
      await sendTPOCredentials(cleanEmail, full_name, tempPassword, loginUrl);
      
      await db.query(`
        INSERT INTO email_logs (user_id, email_type, recipient, subject, status)
        VALUES (?, 'TPO_CREDENTIALS', ?, 'Welcome to VEGA - TPO Credentials', 'SENT')
      `, [createdUserId, cleanEmail]);
    } catch (emailErr) {
      console.error("Failed to send SMTP email:", emailErr);
    }

    await logAdminAction((req as any).user.userId, "CREATE_TPO", { email: cleanEmail, full_name, college_ids }, req);

    res.json({ 
      success: true, 
      message: "TPO registered successfully and credentials sent to official email."
    });
  } catch (error: any) {
    console.error("Create TPO Error:", error);
    if (createdUserId) {
      try {
        await db.query("DELETE FROM tpo_profiles WHERE user_id = ?", [createdUserId]);
        await db.query("DELETE FROM users WHERE id = ?", [createdUserId]);
      } catch (cleanupErr) {
        console.error("Cleanup error during rollback:", cleanupErr);
      }
    }
    res.status(500).json({ success: false, message: error.message || "Error creating TPO account" });
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

    const cleanEmpId = typeof employee_id === "string" && employee_id.trim() ? employee_id.trim() : null;
    if (cleanEmpId) {
      const [existingEmp]: any = await db.query(
        "SELECT id FROM tpo_profiles WHERE LOWER(TRIM(employee_id)) = LOWER(?) AND id != ?",
        [cleanEmpId, id]
      );
      if (existingEmp.length > 0) {
        return res.status(400).json({ success: false, message: "Employee ID already exists" });
      }
    }

    const cleanPhone = contact_number && typeof contact_number === "string" && contact_number.trim() ? contact_number.trim() : null;
    if (cleanPhone) {
      const [existingPhone]: any = await db.query(
        "SELECT id FROM tpo_profiles WHERE (contact_number = ? OR phone = ?) AND id != ?",
        [cleanPhone, cleanPhone, id]
      );
      if (existingPhone.length > 0) {
        return res.status(400).json({ success: false, message: "Contact phone number already exists" });
      }
    }

    // Update profiles
    await db.query(`
      UPDATE tpo_profiles SET
        full_name = ?, contact_number = ?, designation = ?, employee_id = ?, phone = ?, status = ?
      WHERE id = ?
    `, [full_name, cleanPhone, designation || null, cleanEmpId, cleanPhone, status || "ACTIVE", id]);

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

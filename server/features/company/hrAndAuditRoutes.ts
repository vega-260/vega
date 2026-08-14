import express from "express";
import db from "../../db.ts";
import { authenticate } from "../../middleware/auth.ts";
import { sendEmail } from "../../services/emailService.ts";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getCompanyContext, logCompanyAudit } from "./companyAccess.ts";
const router = express.Router();
router.get("/sub-hr", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req, "HR Management");
    if (ctx.isSubHr) {
      return res.status(403).json({ success: false, message: "Only Super HR can manage Sub HR accounts." });
    }
    const [hrList]: any = await db.query(`
      SELECT u.id, u.id AS user_id, u.email, u.status, u.created_at, h.designation, h.permissions, h.role_type
      FROM users u
      JOIN company_hr_profiles h ON u.id = h.user_id
      WHERE h.company_id = ?
      ORDER BY u.created_at DESC
    `, [ctx.companyId]);
    const enrichedList = hrList.map((hr: any) => ({
      ...hr,
      permissions: JSON.parse(hr.permissions || "[]")
    }));
    res.json({ success: true, data: enrichedList });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// Create a Sub HR
router.post("/sub-hr", authenticate, async (req: any, res) => {
  try {
    let ctx;
    try {
      ctx = await getCompanyContext(req);
    } catch (ctxErr: any) {
      const msg = ctxErr.message || "";
      if (msg.includes("profile not found")) {
        return res.status(403).json({ success: false, message: "Company profile mapping was not found for this account." });
      }
      if (msg.includes("Forbidden") || msg.includes("Unauthorized")) {
        return res.status(403).json({ success: false, message: msg });
      }
      return res.status(403).json({ success: false, message: "Access denied. Only Super HR can perform this action." });
    }
    if (ctx.isSubHr) {
      return res.status(403).json({ success: false, message: "Only Super HR can create Sub HR accounts." });
    }
    // Check company status
    if (ctx.companyStatus === 'REJECTED' || ctx.companyStatus === 'SUSPENDED' || ctx.companyStatus === 'FROZEN') {
      return res.status(403).json({ success: false, message: "Company account is not allowed to create HR users in its current verification status." });
    }

    // Normalize designation
    const designation = String(req.body.designation || req.body.role || "Recruiter").trim();
    // Normalize and validate email presence and format
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }
    // Check unique email case-sensitively
    const [existing]: any = await db.query("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "A user with this email already exists." });
    }
    // Password auto-generation or validation
    let rawPassword = String(req.body.password || "").trim();
    if (!rawPassword) {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
      const bytes = crypto.randomBytes(12);
      rawPassword = "";
      for (let i = 0; i < 12; i++) {
        rawPassword += chars.charAt(bytes[i] % chars.length);
      }
    } else {
      if (rawPassword.length < 6) {
        return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
      }
    }
    // Normalize and check permissions list validity
    let permissions = req.body.permissions;
    if (typeof permissions === "string") {
      try {
        permissions = JSON.parse(permissions);
      } catch {
        permissions = permissions.split(",").map((p: string) => p.trim()).filter(Boolean);
      }
    }
    let normalizedPermissions: string[] = [];
    if (Array.isArray(permissions)) {
      normalizedPermissions = permissions.filter(Boolean);
    } else if (permissions && typeof permissions === "object") {
      normalizedPermissions = Object.keys(permissions).filter(key => (permissions as any)[key]);
    }
    if (!normalizedPermissions.length) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one permission for the HR user."
      });
    }
    const hashedPassword = await bcrypt.hash(rawPassword, 12);
    // Create user
    const [userRes]: any = await db.query(`
      INSERT INTO users (email, password_hash, role, status, is_verified)
      VALUES (?, ?, 'COMPANY', 'ACTIVE', 1)
    `, [email, hashedPassword]);
    const newUserId = userRes.insertId !== undefined ? userRes.insertId : userRes[0]?.insertId;
    // Create HR profile
    await db.query(`
      INSERT INTO company_hr_profiles (user_id, company_id, designation, permissions, role_type)
      VALUES (?, ?, ?, ?, 'SUB_HR')
    `, [newUserId, ctx.companyId, designation, JSON.stringify(normalizedPermissions)]);
    await logCompanyAudit(
      ctx.companyId,
      ctx.userId,
      ctx.actorName,
      ctx.roleType,
      "CREATE_SUB_HR",
      "HR Management",
      `Created Sub HR account for ${email} with designation ${designation}.`,
      "users",
      newUserId,
      { email, designation, permissions: normalizedPermissions }
    );
    // Email credentials to the new Sub HR
    const loginUrl = `${process.env.APP_URL || 'http://localhost:3000'}/login`;
    const emailSubject = "Your VEGA Recruiter Credentials";
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">Welcome to VEGA!</h2>
        <p>Hello,</p>
        <p>Your recruiter / Sub HR account has been created by your Super HR Administrator at <strong>${ctx.companyName}</strong>.</p>
        <p>You can now log in, view candidate applications, manage jobs, and participate in placement pipelines!</p>
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <p style="margin: 5px 0;"><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
          <p style="margin: 5px 0;"><strong>Company:</strong> ${ctx.companyName}</p>
          <p style="margin: 5px 0;"><strong>Username / Email:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #eee; padding: 2px 5px; border-radius: 4px;">${rawPassword}</code></p>
          <p style="margin: 5px 0;"><strong>Designation:</strong> ${designation}</p>
        </div>
        <p style="color: #dc2626; font-weight: bold;">Note: For security reasons, please change your password after logging in for the first time.</p>
                <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Login to Recruitment Portal</a>
        </div>
        <p>If you have any questions, please contact your Super HR administrator.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #6b7280; text-align: center;">VEGA - Your Guiding Star for Success</p>
      </div>
    `;
    let emailStatus = "SENT";
    try {
      await sendEmail(email, emailSubject, emailHtml);
    } catch (mailErr) {
      console.error("Error sending credentials email:", mailErr);
      emailStatus = "FAILED";
    }
    if (emailStatus === "FAILED") {
      return res.json({ 
         success: true,
         message: "Sub HR created successfully, but credential email could not be sent.",
         emailStatus: "FAILED",
        temporaryPassword: rawPassword
      });
    }
    res.json({ 
       success: true,
       message: "Sub HR created successfully. Credentials emailed.",
      emailStatus: "SENT"
    });
  } catch (error: any) {
    console.error("Error in POST /sub-hr:", error);
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// Update an existing Sub HR
router.put("/sub-hr/:id", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req, "HR Management");
    if (ctx.isSubHr) {
      return res.status(403).json({ success: false, message: "Only Super HR can manage Sub HR accounts." });
    }
    const targetUserId = req.params.id;
    const { email, password, designation, permissions, status } = req.body;
    // Verify target Sub HR belongs to this company
    const [hrProfiles]: any = await db.query(
      "SELECT * FROM company_hr_profiles WHERE user_id = ? AND company_id = ?",
      [targetUserId, ctx.companyId]
    );
    if (hrProfiles.length === 0) {
      return res.status(404).json({ success: false, message: "Sub HR profile not found or does not belong to your company." });
    }
    // Verify email doesn't collide
    if (email) {
      const [existing]: any = await db.query("SELECT * FROM users WHERE email = ? AND id != ?", [email, targetUserId]);
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: "Email is already in use by another user." });
      }
      await db.query("UPDATE users SET email = ? WHERE id = ?", [email, targetUserId]);
    }
    if (status) {
      await db.query("UPDATE users SET status = ? WHERE id = ?", [status, targetUserId]);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [hashedPassword, targetUserId]);
    }
    await db.query(`
      UPDATE company_hr_profiles
      SET designation = ?, permissions = ?
      WHERE user_id = ?
    `, [designation || "Sub HR", JSON.stringify(permissions || []), targetUserId]);
    await logCompanyAudit(
      ctx.companyId,
      ctx.userId,
      ctx.actorName,
      ctx.roleType,
      "UPDATE_SUB_HR",
      "HR Management",
      `Updated Sub HR account details for user ID ${targetUserId}.`,
      "users",
      Number(targetUserId),
      { email, designation, permissions, status }
    );
    res.json({ success: true, message: "Sub HR account updated successfully." });
  } catch (error: any) {
    console.error("Error in PUT /sub-hr:", error);
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// Delete a Sub HR
router.delete("/sub-hr/:id", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req, "HR Management");
    if (ctx.isSubHr) {
      return res.status(403).json({ success: false, message: "Only Super HR can manage Sub HR accounts." });
    }
    const targetUserId = req.params.id;
    // Verify target Sub HR belongs to this company
    const [hrProfiles]: any = await db.query(
      "SELECT * FROM company_hr_profiles WHERE user_id = ? AND company_id = ?",
      [targetUserId, ctx.companyId]
    );
    if (hrProfiles.length === 0) {
      return res.status(404).json({ success: false, message: "Sub HR profile not found or does not belong to your company." });
    }
    await db.query("DELETE FROM users WHERE id = ?", [targetUserId]);
    await logCompanyAudit(
      ctx.companyId,
      ctx.userId,
      ctx.actorName,
      ctx.roleType,
      "DELETE_SUB_HR",
      "HR Management",
      `Deleted Sub HR account for user ID ${targetUserId}.`,
      "users",
      Number(targetUserId)
    );
    res.json({ success: true, message: "Sub HR account deleted successfully." });
  } catch (error: any) {
    console.error("Error in DELETE /sub-hr:", error);
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// Get Audit Trail
router.get("/audit-trail", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    let query = `
      SELECT * FROM company_audit_logs 
      WHERE company_id = ?
    `;
    const params: any[] = [ctx.companyId];
    if (ctx.isSubHr && !ctx.permissions?.includes("Audit Trail View All")) {
      query += ` AND actor_user_id = ?`;
      params.push(ctx.userId);
    }
    query += ` ORDER BY created_at DESC`;
    const [logs]: any = await db.query(query, params);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// Get Job Assignments
router.get("/jobs/:jobId/assignments", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    const [assigned]: any = await db.query(`
      SELECT cja.*, u.email, chp.designation
      FROM company_job_assignments cja
      JOIN users u ON cja.assigned_hr_user_id = u.id
      JOIN company_hr_profiles chp ON u.id = chp.user_id
      WHERE cja.job_id = ? AND cja.company_id = ?
    `, [req.params.jobId, ctx.companyId]);
    res.json({ success: true, data: assigned });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// Update Job Assignments
router.post("/jobs/assign", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req, "HR Management");
    if (ctx.isSubHr) {
      return res.status(403).json({ success: false, message: "Only Super HR can manage job assignments." });
    }
    const { jobId, hrUserIds } = req.body;
    if (!jobId || !Array.isArray(hrUserIds)) {
      return res.status(400).json({ success: false, message: "Missing required fields: jobId or hrUserIds list" });
    }
    // Clear existing assignments for this job
    await db.query("DELETE FROM company_job_assignments WHERE job_id = ? AND company_id = ?", [jobId, ctx.companyId]);
    // Insert new assignments
    for (const hrUserId of hrUserIds) {
      await db.query(`
        INSERT INTO company_job_assignments (company_id, job_id, assigned_hr_user_id, assigned_by_user_id)
        VALUES (?, ?, ?, ?)
      `, [ctx.companyId, jobId, hrUserId, ctx.userId]);
    }
    await logCompanyAudit(
      ctx.companyId,
      ctx.userId,
      ctx.actorName,
      ctx.roleType,
      "ASSIGN_JOB",
      "Jobs",
      `Assigned job ID ${jobId} to ${hrUserIds.length} HRs.`,
      "jobs",
      Number(jobId),
      { hrUserIds }
    );
    res.json({ success: true, message: "Job assignments updated successfully" });
  } catch (error: any) {
    console.error("Error in /jobs/assign:", error);
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// GET /settings/preferences

export default router;

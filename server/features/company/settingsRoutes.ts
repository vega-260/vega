import express from "express";
import db from "../../db.ts";
import { authenticate } from "../../middleware/auth.ts";
import bcrypt from "bcryptjs";
import { getCompanyContext, logCompanyAudit } from "./companyAccess.ts";
const router = express.Router();
router.get("/settings/preferences", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    const [rows]: any = await db.query(
      "SELECT timezone, email_notification_settings_json FROM company_preferences WHERE company_id = ?",
      [ctx.companyId]
    );
    if (rows.length === 0) {
      return res.json({
        success: true,
        preferences: {
          timezone: "Asia/Kolkata",
          emailNotifications: {
            newApplications: true,
            candidateStageUpdates: true,
            interviewReminders: true,
            assessmentSubmissions: true,
            jobExpiryAlerts: true,
            weeklyHiringSummary: false
          }
        }
      });
    }
    const row = rows[0];
    let emailNotifications = {
      newApplications: true,
      candidateStageUpdates: true,
      interviewReminders: true,
      assessmentSubmissions: true,
      jobExpiryAlerts: true,
      weeklyHiringSummary: false
    };
    if (row.email_notification_settings_json) {
      try {
        emailNotifications = typeof row.email_notification_settings_json === "string"
          ? JSON.parse(row.email_notification_settings_json)
          : row.email_notification_settings_json;
      } catch (e) {
        console.error("Error parsing email preferences JSON:", e);
      }
    }
    res.json({
      success: true,
      preferences: {
        timezone: row.timezone || "Asia/Kolkata",
        emailNotifications
      }
    });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// PUT /settings/preferences
router.put("/settings/preferences", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    if (ctx.isSubHr && !ctx.permissions.includes("HR Management")) {
      return res.status(403).json({ success: false, message: "Only Super HR or Sub HRs with HR Management permission can change preferences." });
    }
    const { timezone, emailNotifications } = req.body;
    if (!timezone) {
      return res.status(400).json({ success: false, message: "Timezone is required." });
    }
    const settingsJson = JSON.stringify(emailNotifications || {});
    
    const [exists]: any = await db.query("SELECT id FROM company_preferences WHERE company_id = ?", [ctx.companyId]);
    if (exists.length > 0) {
      await db.query(
        "UPDATE company_preferences SET timezone = ?, email_notification_settings_json = ?, updated_at = CURRENT_TIMESTAMP WHERE company_id = ?",
        [timezone, settingsJson, ctx.companyId]
      );
    } else {
      await db.query(
        "INSERT INTO company_preferences (company_id, timezone, email_notification_settings_json) VALUES (?, ?, ?)",
        [ctx.companyId, timezone, settingsJson]
      );
    }

    await logCompanyAudit(
      ctx.companyId,
      ctx.userId,
      ctx.actorName,
      ctx.roleType,
      "UPDATE_PREFERENCES",
      "Settings",
      `Updated company settings preferences. Timezone: ${timezone}.`,
      "company_preferences",
      ctx.companyId,
      { timezone, emailNotifications }
    );

    res.json({ success: true, message: "Settings preferences updated successfully" });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// PUT /settings/password
router.put("/settings/password", authenticate, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "All password fields are required." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "New passwords do not match." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters long." });
    }

    const [users]: any = await db.query("SELECT password_hash FROM users WHERE id = ?", [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    const userObj = users[0];
    const isMatch = await bcrypt.compare(currentPassword, userObj.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid current password." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [hashedPassword, userId]);

    try {
      const ctx = await getCompanyContext(req);
      await logCompanyAudit(
        ctx.companyId,
        ctx.userId,
        ctx.actorName,
        ctx.roleType,
        "CHANGE_PASSWORD",
        "Security",
        `Changed account password.`,
        "users",
        userId
      );
    } catch (e) {
      // Ignore context errors (e.g. if profile doesn't exist yet)
    }

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    console.error("Error in password change:", error);
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// GET /settings/billing
router.get("/settings/billing", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    
    // Active jobs count
    const [jobsCountResult]: any = await db.query(
      "SELECT COUNT(*) AS count FROM jobs WHERE company_id = ? AND status = 'OPEN'",
      [ctx.companyId]
    );
    const activeJobs = jobsCountResult[0]?.count || 0;

    // Sub HR count
    const [subHrCountResult]: any = await db.query(
      "SELECT COUNT(*) AS count FROM company_hr_profiles WHERE company_id = ?",
      [ctx.companyId]
    );
    const subHrCount = subHrCountResult[0]?.count || 0;

    // Applications count
    const [appCountResult]: any = await db.query(
      `SELECT COUNT(*) AS count 
       FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.id
       WHERE j.company_id = ?`,
      [ctx.companyId]
    );
    const totalApplications = appCountResult[0]?.count || 0;

    res.json({
      success: true,
      billing: {
        planName: "Standard Free Tier",
        status: "NOT_CONFIGURED",
        billingMessage: "No payment method configured. This company is operating on the standard default tier.",
        activeJobs,
        subHrCount,
        totalApplications,
        seatLimit: 10,
        jobPostingLimit: "Unlimited"
      }
    });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// GET /pending-actions
router.get("/pending-actions", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    const [rows]: any = await db.query(
      "SELECT * FROM company_pending_actions WHERE company_id = ? ORDER BY created_at DESC",
      [ctx.companyId]
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// POST /pending-actions
router.post("/pending-actions", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    const { title, priority, sourceType, entityType, entityId, description } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Task title is required." });
    }

    const [result]: any = await db.query(`
      INSERT INTO company_pending_actions (
        company_id, created_by_user_id, source_type, entity_type, entity_id, title, description, priority, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ctx.companyId,
      ctx.userId,
      sourceType || "MANUAL",
      entityType || null,
      entityId || null,
      title.trim(),
      description || null,
      priority || "NORMAL",
      "PENDING"
    ]);

    const newId = result.insertId;
    const [inserted]: any = await db.query("SELECT * FROM company_pending_actions WHERE id = ?", [newId]);

    await logCompanyAudit(
      ctx.companyId,
      ctx.userId,
      ctx.actorName,
      ctx.roleType,
      "CREATE_PENDING_ACTION",
      "Dashboard",
      `Created manual pending action: ${title.trim()}`,
      "company_pending_actions",
      newId,
      { title, priority }
    );

    res.json({ success: true, data: inserted[0] });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// DELETE /pending-actions/:id
router.delete("/pending-actions/:id", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    const actionId = req.params.id;

    // Verify ownership
    const [actionRows]: any = await db.query(
      "SELECT * FROM company_pending_actions WHERE id = ? AND company_id = ?",
      [actionId, ctx.companyId]
    );

    if (actionRows.length === 0) {
      return res.status(404).json({ success: false, message: "Pending action not found or access denied." });
    }

    await db.query("DELETE FROM company_pending_actions WHERE id = ?", [actionId]);

    await logCompanyAudit(
      ctx.companyId,
      ctx.userId,
      ctx.actorName,
      ctx.roleType,
      "DELETE_PENDING_ACTION",
      "Dashboard",
      `Deleted pending action ID ${actionId}: ${actionRows[0].title}`,
      "company_pending_actions",
      Number(actionId),
      {}
    );

    res.json({ success: true, message: "Pending action deleted successfully." });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// PATCH /pending-actions/:id/toggle
router.patch("/pending-actions/:id/toggle", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    const actionId = req.params.id;

    // Verify ownership
    const [actionRows]: any = await db.query(
      "SELECT * FROM company_pending_actions WHERE id = ? AND company_id = ?",
      [actionId, ctx.companyId]
    );

    if (actionRows.length === 0) {
      return res.status(404).json({ success: false, message: "Pending action not found or access denied." });
    }

    const currentStatus = actionRows[0].status;
    const newStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";
    const completedAt = newStatus === "COMPLETED" ? new Date() : null;

    await db.query(
      "UPDATE company_pending_actions SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [newStatus, completedAt, actionId]
    );

    res.json({ success: true, message: `Status updated to ${newStatus}.` });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// GET /company/todos - Get personal todos
router.get("/todos", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    const userId = ctx.userId;
    const companyId = ctx.companyId;

    const [rows]: any = await db.query(
      "SELECT * FROM company_todos WHERE company_id = ? AND created_by_user_id = ? ORDER BY due_date ASC, due_time ASC",
      [companyId, userId]
    );

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// POST /company/todos - Create personal todo
router.post("/todos", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    const userId = ctx.userId;
    const companyId = ctx.companyId;

    const { title, description, dueDate, dueTime } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Task title is required." });
    }
    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return res.status(400).json({ success: false, message: "Valid due date (YYYY-MM-DD) is required." });
    }

    const [result]: any = await db.query(
      "INSERT INTO company_todos (company_id, created_by_user_id, title, description, due_date, due_time, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [companyId, userId, title.trim(), description || null, dueDate, dueTime || null, "PENDING"]
    );

    const newId = result.insertId;
    const [inserted]: any = await db.query("SELECT * FROM company_todos WHERE id = ?", [newId]);

    res.json({ success: true, data: inserted[0] });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// PATCH /company/todos/:id/toggle - Toggle todo status
router.patch("/todos/:id/toggle", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    const userId = ctx.userId;
    const companyId = ctx.companyId;
    const todoId = req.params.id;

    // Verify ownership
    const [rows]: any = await db.query(
      "SELECT * FROM company_todos WHERE id = ? AND company_id = ? AND created_by_user_id = ?",
      [todoId, companyId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Todo not found or access denied." });
    }

    const newStatus = rows[0].status === "COMPLETED" ? "PENDING" : "COMPLETED";

    await db.query(
      "UPDATE company_todos SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [newStatus, todoId]
    );

    res.json({ success: true, message: `Status updated to ${newStatus}.` });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// DELETE /company/todos/:id - Delete todo
router.delete("/todos/:id", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    const userId = ctx.userId;
    const companyId = ctx.companyId;
    const todoId = req.params.id;

    // Verify ownership
    const [rows]: any = await db.query(
      "SELECT * FROM company_todos WHERE id = ? AND company_id = ? AND created_by_user_id = ?",
      [todoId, companyId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Todo not found or access denied." });
    }

    await db.query("DELETE FROM company_todos WHERE id = ?", [todoId]);

    res.json({ success: true, message: "Todo deleted successfully." });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});


export default router;

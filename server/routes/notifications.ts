import express from "express";
import db from "../db.ts";
import { authenticate } from "../middleware/auth.ts";

const router = express.Router();

/**
 * Synchronize any pending company verifications into the notifications table for admin users.
 * This guarantees that even if a verification request was submitted prior to notification routing
 * or by direct DB status updates, the admin notification panel will display them.
 */
async function syncAdminVerificationNotifications(adminUserId: number) {
  try {
    const [pendingCompanies]: any = await db.query(`
      SELECT id, user_id, company_name, business_name, updated_at, created_at 
      FROM company_profiles 
      WHERE status IN ('PENDING', 'PENDING_REVERIFICATION')
    `);

    for (const comp of pendingCompanies || []) {
      const compName = comp.company_name || comp.business_name || "A company";
      const idempotencyKey = `pending_verification_${comp.id}`;

      // Check if notification already exists for this admin user
      const [existing]: any = await db.query(
        "SELECT id FROM notifications WHERE user_id = ? AND idempotency_key = ?",
        [adminUserId, idempotencyKey]
      );

      if (!existing || existing.length === 0) {
        await db.query(
          "INSERT INTO notifications (user_id, title, message, type, is_read, created_at, idempotency_key) VALUES (?, ?, ?, 'VERIFICATION_REQUEST', 0, ?, ?)",
          [
            adminUserId,
            "Company Verification Request",
            `${compName} has submitted a company verification request for approval.`,
            comp.updated_at || comp.created_at || new Date(),
            idempotencyKey
          ]
        );
      }
    }
  } catch (err) {
    console.error("Error syncing admin verification notifications:", err);
  }
}

// GET /api/notifications
router.get("/", authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    // If admin or super admin, sync any pending company verification requests
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      await syncAdminVerificationNotifications(userId);
    }

    const [rows]: any = await db.query(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [userId]);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ success: false, message: "Error fetching notifications" });
  }
});

// POST /api/notifications/mark-all-read
router.post("/mark-all-read", authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    await db.query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [userId]);
    res.json({ success: true, message: "Notifications marked as read" });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({ success: false, message: "Error marking notifications as read" });
  }
});

// POST /api/notifications/read-all
router.post("/read-all", authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    await db.query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [userId]);
    res.json({ success: true, message: "Notifications marked as read" });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({ success: false, message: "Error marking notifications as read" });
  }
});

// POST /api/notifications/read/:id
router.post("/read/:id", authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    await db.query("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [req.params.id, userId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ success: false, message: "Error marking notification as read" });
  }
});

// GET /api/notifications/:userId
router.get("/:userId", authenticate, async (req: any, res) => {
  try {
    const targetUserId = req.params.userId;
    if (String(req.user.userId) !== String(targetUserId) && !["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    const [rows]: any = await db.query(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [targetUserId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ success: false, message: "Error fetching notifications" });
  }
});

// POST /api/notifications/read-all/:userId
router.post("/read-all/:userId", authenticate, async (req: any, res) => {
  try {
    const targetUserId = req.params.userId;
    if (String(req.user.userId) !== String(targetUserId) && !["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    await db.query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [targetUserId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({ success: false, message: "Error marking notifications as read" });
  }
});

export default router;

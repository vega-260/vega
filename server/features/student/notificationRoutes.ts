import express from "express";
import db from "../../db.ts";
import { authenticate, authorize, requireSelfParam } from "../../middleware/auth.ts";
const router = express.Router();
// Get notifications
router.get("/notifications", authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await db.query(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [userId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching notifications" });
  }
});

router.post("/notifications/mark-all-read", authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    await db.query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error marking notifications as read" });
  }
});

router.get("/notifications/:userId", authenticate, requireSelfParam("userId"), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [req.params.userId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching notifications" });
  }
});

// Mark notification as read
router.post("/notifications/read/:id", authenticate, async (req: any, res) => {
  try {
    await db.query("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [req.params.id, req.user.userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error marking notification as read" });
  }
});

// Mark all notifications as read
router.post("/notifications/read-all/:userId", authenticate, requireSelfParam("userId"), async (req, res) => {
  try {
    await db.query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [req.params.userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error marking all notifications as read" });
  }
});


export default router;

import express from "express";
import db from "../../db.ts";
import { logAdminAction } from "./adminAudit.ts";
const router = express.Router();
// --- CONTACT INQUIRIES MANAGEMENT ---

// GET /api/admin/contact-inquiries
router.get("/contact-inquiries", async (req, res) => {
  try {
    const [inquiries]: any = await db.query(`
      SELECT * FROM contact_inquiries
      ORDER BY created_at DESC
    `);
    res.json({ success: true, inquiries });
  } catch (error: any) {
    console.error("Error fetching contact inquiries:", error);
    res.status(500).json({ success: false, message: "Error fetching contact inquiries" });
  }
});

// PUT /api/admin/contact-inquiries/:id/status
router.put("/contact-inquiries/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    await db.query(`
      UPDATE contact_inquiries SET status = ? WHERE id = ?
    `, [status, id]);

    await logAdminAction((req as any).user.userId, "UPDATE_INQUIRY_STATUS", { id, status }, req);

    res.json({ success: true, message: "Inquiry status updated successfully" });
  } catch (error: any) {
    console.error("Error updating inquiry status:", error);
    res.status(500).json({ success: false, message: "Error updating inquiry status" });
  }
});

// DELETE /api/admin/contact-inquiries/:id
router.delete("/contact-inquiries/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`
      DELETE FROM contact_inquiries WHERE id = ?
    `, [id]);

    await logAdminAction((req as any).user.userId, "DELETE_INQUIRY", { id }, req);

    res.json({ success: true, message: "Inquiry deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting inquiry:", error);
    res.status(500).json({ success: false, message: "Error deleting inquiry" });
  }
});


export default router;

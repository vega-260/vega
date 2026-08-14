import express from "express";
import db from "../../db.ts";
import { logAdminAction } from "./adminAudit.ts";
const router = express.Router();
// --- PSYCHOMETRIC QUESTION MANAGEMENT ---

// List all psychometric questions
router.get("/psychometric/questions", async (req, res) => {
  try {
    const [questions]: any = await db.query("SELECT * FROM psychometric_questions ORDER BY created_at DESC");
    res.json({ success: true, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching psychometric questions" });
  }
});

// Add new psychometric question
router.post("/psychometric/questions", async (req, res) => {
  const { category, trait, question_text, options_json } = req.body;
  const adminId = (req as any).user.userId;
  try {
    const [result]: any = await db.query(
      "INSERT INTO psychometric_questions (category, trait, question_text, options_json) VALUES (?, ?, ?, ?)",
      [category, trait, question_text, JSON.stringify(options_json)]
    );
    await logAdminAction(adminId, "ADD_PSYCHOMETRIC_QUESTION", { id: result.insertId, category, trait }, req);
    res.json({ success: true, message: "Question added", id: result.insertId });
  } catch (error) {
    console.error("❌ Error adding psychometric question:", error);
    res.status(500).json({ success: false, message: "Error adding question: " + (error as any).message });
  }
});

// Update psychometric question
router.put("/psychometric/questions/:id", async (req, res) => {
  const { category, trait, question_text, options_json } = req.body;
  const adminId = (req as any).user.userId;
  try {
    await db.query(
      "UPDATE psychometric_questions SET category = ?, trait = ?, question_text = ?, options_json = ? WHERE id = ?",
      [category, trait, question_text, JSON.stringify(options_json), req.params.id]
    );
    await logAdminAction(adminId, "UPDATE_PSYCHOMETRIC_QUESTION", { id: req.params.id }, req);
    res.json({ success: true, message: "Question updated" });
  } catch (error) {
    console.error("❌ Error updating psychometric question:", error);
    res.status(500).json({ success: false, message: "Error updating question: " + (error as any).message });
  }
});

// Delete psychometric question
router.delete("/psychometric/questions/:id", async (req, res) => {
  const adminId = (req as any).user.userId;
  try {
    await db.query("DELETE FROM psychometric_questions WHERE id = ?", [req.params.id]);
    await logAdminAction(adminId, "DELETE_PSYCHOMETRIC_QUESTION", { id: req.params.id }, req);
    res.json({ success: true, message: "Question deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting question" });
  }
});

// --- DYNAMIC PRICING & SYSTEM CONFIGURATION MANAGEMENT ---

// Fetch all system configs
router.get("/config", async (req, res) => {
  try {
    const [configs] = await db.query("SELECT config_key, config_value, description FROM system_configs");
    res.json({ success: true, data: configs });
  } catch (error: any) {
    console.error("❌ Error fetching configuration:", error);
    res.status(500).json({ success: false, message: "Error fetching configs: " + error.message });
  }
});

// Update a system config key value
router.put("/config/:key", async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  const adminId = (req as any).user.userId;

  try {
    await db.query(
      "UPDATE system_configs SET config_value = ? WHERE config_key = ?",
      [String(value), key]
    );

    await logAdminAction(adminId, "UPDATE_SYSTEM_CONFIG", { key, value }, req);
    res.json({ success: true, message: `Config '${key}' updated successfully` });
  } catch (error: any) {
    console.error("❌ Error updating configuration:", error);
    res.status(500).json({ success: false, message: "Error updating config: " + error.message });
  }
});

// --- Dynamic XP Packages Management ---

// Fetch all packages for editing/management
router.get("/packages", async (req, res) => {
  try {
    const [packages] = await db.query("SELECT * FROM xp_packages ORDER BY price_inr ASC");
    res.json({ success: true, data: packages });
  } catch (error: any) {
    console.error("❌ Error fetching packages:", error);
    res.status(500).json({ success: false, message: "Error fetching packages" });
  }
});

// Add a new package
router.post("/packages", async (req, res) => {
  const { name, xp_amount, price_inr, is_popular, is_best_value, mock_interviews_included, resume_reviews_included } = req.body;
  const adminId = (req as any).user.userId;

  try {
    const [result]: any = await db.query(
      "INSERT INTO xp_packages (name, xp_amount, price_inr, is_popular, is_best_value, mock_interviews_included, resume_reviews_included) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        name, 
        Number(xp_amount), 
        Number(price_inr), 
        is_popular ? 1 : 0, 
        is_best_value ? 1 : 0,
        mock_interviews_included !== undefined && mock_interviews_included !== null ? Number(mock_interviews_included) : null,
        resume_reviews_included !== undefined && resume_reviews_included !== null ? Number(resume_reviews_included) : null
      ]
    );

    await logAdminAction(adminId, "ADD_XP_PACKAGE", { name, xp_amount, price_inr }, req);
    res.json({ success: true, message: "XP package added successfully", id: result.insertId });
  } catch (error: any) {
    console.error("❌ Error adding package:", error);
    res.status(500).json({ success: false, message: "Error adding package: " + error.message });
  }
});

// Edit existing package
router.put("/packages/:id", async (req, res) => {
  const { id } = req.params;
  const { name, xp_amount, price_inr, is_popular, is_best_value, mock_interviews_included, resume_reviews_included } = req.body;
  const adminId = (req as any).user.userId;

  try {
    await db.query(
      "UPDATE xp_packages SET name = ?, xp_amount = ?, price_inr = ?, is_popular = ?, is_best_value = ?, mock_interviews_included = ?, resume_reviews_included = ? WHERE id = ?",
      [
        name, 
        Number(xp_amount), 
        Number(price_inr), 
        is_popular ? 1 : 0, 
        is_best_value ? 1 : 0,
        mock_interviews_included !== undefined && mock_interviews_included !== null ? Number(mock_interviews_included) : null,
        resume_reviews_included !== undefined && resume_reviews_included !== null ? Number(resume_reviews_included) : null,
        id
      ]
    );

    await logAdminAction(adminId, "UPDATE_XP_PACKAGE", { id, name, xp_amount, price_inr }, req);
    res.json({ success: true, message: "XP package updated successfully" });
  } catch (error: any) {
    console.error("❌ Error updating package:", error);
    res.status(500).json({ success: false, message: "Error updating package: " + error.message });
  }
});

// Delete package
router.delete("/packages/:id", async (req, res) => {
  const { id } = req.params;
  const adminId = (req as any).user.userId;

  try {
    await db.query("DELETE FROM xp_packages WHERE id = ?", [id]);
    await logAdminAction(adminId, "DELETE_XP_PACKAGE", { id }, req);
    res.json({ success: true, message: "XP package deleted successfully" });
  } catch (error: any) {
    console.error("❌ Error deleting package:", error);
    res.status(500).json({ success: false, message: "Error deleting package" });
  }
});


export default router;

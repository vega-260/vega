import express from "express";
import db from "../../db.ts";
import { logAdminAction } from "./adminAudit.ts";
const router = express.Router();
import { XPService } from "../../services/xpService.ts";
// --- ADMIN COMMUNITY post & XP MANAGEMENT ---

// List all community posts
router.get("/community/posts", async (req, res) => {
  try {
    const queryStr = `
      SELECT p.*, u.email as creator_email, u.name as creator_name, u.photo as creator_photo
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `;
    const [posts] = await db.query(queryStr);
    res.json({ success: true, posts });
  } catch (error: any) {
    console.error("❌ Error loading admin posts:", error);
    res.status(500).json({ success: false, message: "Error loading community posts: " + error.message });
  }
});

// Toggle post verification / badge
router.put("/community/posts/:id/verify", async (req, res) => {
  const { id } = req.params;
  let { is_verified, send_reward } = req.body;
  if (is_verified === undefined) is_verified = true;
  if (send_reward === undefined) send_reward = true;
  const adminId = (req as any).user.userId;

  try {
    const [posts]: any = await db.query("SELECT * FROM posts WHERE id = ?", [id]);
    if (posts.length === 0) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    const post = posts[0];

    await db.query("UPDATE posts SET is_verified = ? WHERE id = ?", [is_verified ? 1 : 0, id]);

    if (is_verified && send_reward) {
      // Award Verification Bonus XP!
      await XPService.addXP(post.user_id, 100, "BONUS", `[Community] Double Verification Reward for post: "${post.title}"`);
    }

    await logAdminAction(adminId, "TOGGLE_COMMUNITY_POST_VERIFICATION", { id, is_verified, send_reward }, req);
    res.json({ success: true, message: `Post verification toggled successfully. ${is_verified && send_reward ? "100 XP award granted to user." : ""}` });
  } catch (error: any) {
    console.error("❌ Error toggling post verification:", error);
    res.status(500).json({ success: false, message: "Error toggling post verification: " + error.message });
  }
});

// Adjust rating / manual scoring
router.put("/community/posts/:id/update-score", async (req, res) => {
  const { id } = req.params;
  const { content_score, quality_analysis } = req.body;
  const adminId = (req as any).user.userId;

  try {
    await db.query(
      "UPDATE posts SET content_score = ?, quality_analysis = ? WHERE id = ?",
      [Number(content_score), quality_analysis, id]
    );

    await logAdminAction(adminId, "UPDATE_COMMUNITY_POST_SCORE", { id, content_score }, req);
    res.json({ success: true, message: "Content score and evaluation updated successfully." });
  } catch (error: any) {
    console.error("❌ Error updating post score:", error);
    res.status(500).json({ success: false, message: "Error updating post score: " + error.message });
  }
});

// Delete community post
router.delete("/community/posts/:id", async (req, res) => {
  const { id } = req.params;
  const adminId = (req as any).user.userId;

  try {
    await db.query("DELETE FROM posts WHERE id = ?", [id]);
    await logAdminAction(adminId, "DELETE_COMMUNITY_POST", { id }, req);
    res.json({ success: true, message: "Post deleted successfully" });
  } catch (error: any) {
    console.error("❌ Error deleting community post:", error);
    res.status(500).json({ success: false, message: "Error deleting community post" });
  }
});

// Grant or deduct User XP directly
router.post("/community/users/:id/grant-xp", async (req, res) => {
  const { id } = req.params;
  const { amount, description } = req.body;
  const adminId = (req as any).user.userId;

  try {
    const amt = Number(amount);
    if (isNaN(amt) || amt === 0) {
      return res.status(400).json({ success: false, message: "Invalid amount value." });
    }

    if (amt > 0) {
      await XPService.addXP(Number(id), amt, "BONUS", description || "[Community] Admin Community Bonus award");
      await logAdminAction(adminId, "GRANT_USER_XP", { id, amount: amt, description }, req);
    } else {
      // For backwards compatibility let's safeguard DB. This does not crash even if client sends deductXP or we do it directly
      await db.query(`
        UPDATE users 
        SET xp_balance = MAX(0, xp_balance - ?)
        WHERE id = ?
      `, [Math.abs(amt), Number(id)]);
      await logAdminAction(adminId, "DEDUCT_USER_XP", { id, amount: Math.abs(amt), description }, req);
    }

    res.json({ success: true, message: "User XP updated successfully." });
  } catch (error: any) {
    console.error("❌ Error adjusting user XP:", error);
    res.status(500).json({ success: false, message: "Error adjusting user XP: " + error.message });
  }
});


export default router;

import express from "express";
import db from "../../db.ts";
import { logAdminAction } from "./adminAudit.ts";
const router = express.Router();
import bcrypt from "bcryptjs";
// --- STAFF/ADMIN OFFICER PERMISSIONS & DYNAMIC DASHBOARD ---

// Create a new staff officer
router.post("/staff", async (req, res) => {
  try {
    const { email, password, allowed_pages } = req.body;

    if (!email || !password || !Array.isArray(allowed_pages)) {
      return res.status(400).json({ success: false, message: "Missing required fields: email, password, or allowed_pages" });
    }

    // Check if email already exists
    const [existingUsers]: any = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const [userResult]: any = await db.query(`
      INSERT INTO users (email, password_hash, role, status, is_verified)
      VALUES (?, ?, 'ADMIN', 'ACTIVE', 1)
    `, [email, hashedPassword]);

    const userId = userResult.insertId;

    // Save sidebar permissions
    await db.query(`
      INSERT INTO admin_sidebar_permissions (user_id, allowed_pages)
      VALUES (?, ?)
    `, [userId, JSON.stringify(allowed_pages)]);

    await logAdminAction((req as any).user.userId, "CREATE_STAFF_OFFICER", { email, allowed_pages }, req);

    res.json({ success: true, message: "Staff Officer account created successfully", userId });
  } catch (error: any) {
    console.error("Error creating staff account:", error);
    res.status(500).json({ success: false, message: "Error creating staff account: " + error.message });
  }
});

// Get all staff officers & their sidebar access
router.get("/staff", async (req, res) => {
  try {
    const [staffList]: any = await db.query(`
      SELECT u.id, u.email, u.status, u.created_at, p.allowed_pages
      FROM users u
      LEFT JOIN admin_sidebar_permissions p ON u.id = p.user_id
      WHERE u.role = 'ADMIN' OR u.role = 'SUPER_ADMIN'
      ORDER BY u.created_at DESC
    `);

    // Parse the allowed_pages JSON list
    const enrichedStaff = staffList.map((s: any) => {
      let allowedPages = [];
      if (s.allowed_pages) {
        try {
          allowedPages = JSON.parse(s.allowed_pages);
        } catch (e) {
          allowedPages = [];
        }
      }
      return {
        id: s.id,
        email: s.email,
        status: s.status,
        created_at: s.created_at,
        allowed_pages: allowedPages
      };
    });

    res.json({ success: true, data: enrichedStaff });
  } catch (error: any) {
    console.error("Error listing staff:", error);
    res.status(500).json({ success: false, message: "Error fetching staff accounts: " + error.message });
  }
});

// Update an existing staff officer
router.put("/staff/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, allowed_pages, status } = req.body;

    if (!email || !Array.isArray(allowed_pages)) {
      return res.status(400).json({ success: false, message: "Missing email or allowed_pages" });
    }

    // Verify email doesn't collide with other users
    const [existing]: any = await db.query("SELECT * FROM users WHERE email = ? AND id != ?", [email, id]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Email is already in use by another user" });
    }

    // Update user properties
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      await db.query("UPDATE users SET email = ?, password_hash = ?, status = ? WHERE id = ?", [email, hashedPassword, status || 'ACTIVE', id]);
    } else {
      await db.query("UPDATE users SET email = ?, status = ? WHERE id = ?", [email, status || 'ACTIVE', id]);
    }

    // Upsert sidebar permissions
    const [perms]: any = await db.query("SELECT * FROM admin_sidebar_permissions WHERE user_id = ?", [id]);
    if (perms.length > 0) {
      await db.query("UPDATE admin_sidebar_permissions SET allowed_pages = ? WHERE user_id = ?", [JSON.stringify(allowed_pages), id]);
    } else {
      await db.query("INSERT INTO admin_sidebar_permissions (user_id, allowed_pages) VALUES (?, ?)", [id, JSON.stringify(allowed_pages)]);
    }

    await logAdminAction((req as any).user.userId, "UPDATE_STAFF_OFFICER", { id, email, allowed_pages, status }, req);

    res.json({ success: true, message: "Staff Officer updated successfully" });
  } catch (error: any) {
    console.error("Error updating staff account:", error);
    res.status(500).json({ success: false, message: "Error updating staff: " + error.message });
  }
});

// Delete a staff officer
router.delete("/staff/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Safety: prevent self-deletion
    if (Number(id) === Number((req as any).user.userId)) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account" });
    }

    // Perform deletion
    await db.query("DELETE FROM users WHERE id = ?", [id]);
    // foreign key with ON DELETE CASCADE will handle admin_sidebar_permissions in DB

    await logAdminAction((req as any).user.userId, "DELETE_STAFF_OFFICER", { id }, req);

    res.json({ success: true, message: "Staff Officer deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting staff account:", error);
    res.status(500).json({ success: false, message: "Error deleting staff user" });
  }
});


export default router;

import express from "express";
import db from "../../db.ts";
import { authenticate, authorize, requireSelfParam } from "../../middleware/auth.ts";
const router = express.Router();
// --- DPDP & GDPR Privacy Consent Dashboard Compliance Endpoints ---

// Get consent settings
router.get("/privacy/:userId", authenticate, requireSelfParam("userId"), async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    const [profiles]: any = await db.query("SELECT onboarding_help_actions FROM student_profiles WHERE user_id = ?", [userId]);
    
    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }
    
    let consents = {
      academic_sharing: true,
      employer_matching: true,
      ai_optimization: true,
      telemetry_tracking: false,
      timestamp: new Date().toISOString()
    };
    
    const rawActions = profiles[0].onboarding_help_actions;
    if (rawActions) {
      try {
        const parsed = typeof rawActions === 'string' ? JSON.parse(rawActions) : rawActions;
        if (parsed && typeof parsed === 'object' && 'consents' in parsed) {
          consents = parsed.consents;
        }
      } catch (e) {
        // use default state
      }
    }
    
    res.json({ success: true, consents });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching privacy consents" });
  }
});

// Update consent settings
router.post("/privacy/:userId", authenticate, requireSelfParam("userId"), async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    const { consents } = req.body;
    
    if (!consents) {
      return res.status(400).json({ success: false, message: "Consents config missing in body" });
    }
    
    const [profiles]: any = await db.query("SELECT id, onboarding_help_actions FROM student_profiles WHERE user_id = ?", [userId]);
    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }
    
    const studentId = profiles[0].id;
    const payload = { consents };
    const serializedPayload = JSON.stringify(payload);
    
    await db.query("UPDATE student_profiles SET onboarding_help_actions = ? WHERE id = ?", [serializedPayload, studentId]);
    
    // Log security access log
    await db.query(`
      INSERT INTO security_logs (user_id, action, ip_address, user_agent, details)
      VALUES (?, 'UPDATE_PRIVACY_CONSENTS', ?, ?, 'Consents updated by student')
    `, [userId, req.ip || "127.0.0.1", req.headers['user-agent'] || "Unknown"]);
    
    res.json({ success: true, message: "Privacy consents and data processing preference updated successfully." });
  } catch (error) {
    console.error("Privacy update error:", error);
    res.status(500).json({ success: false, message: "Error updating privacy settings" });
  }
});

// Export profile data - DPDP Right to Data Portability
router.get("/privacy/:userId/export", authenticate, requireSelfParam("userId"), async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    
    // 1. Fetch user root info
    const [users]: any = await db.query("SELECT id, email, role, status, xp_balance, free_mock_count, login_streak, total_earned_xp, created_at FROM users WHERE id = ?", [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }
    
    // 2. Fetch student profile
    const [profiles]: any = await db.query("SELECT * FROM student_profiles WHERE user_id = ?", [userId]);
    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: "Student profile record not found." });
    }
    
    const studentId = profiles[0].id;
    
    // Fetch related tables
    const [education]: any = await db.query("SELECT * FROM student_education WHERE student_id = ?", [studentId]);
    const [experience]: any = await db.query("SELECT * FROM student_experience WHERE student_id = ?", [studentId]);
    const [projects]: any = await db.query("SELECT * FROM student_projects WHERE student_id = ?", [studentId]);
    const [certifications]: any = await db.query("SELECT * FROM student_certifications WHERE student_id = ?", [studentId]);
    const [extracurriculars]: any = await db.query("SELECT * FROM extracurricular_activities WHERE user_id = ?", [userId]);
    const [interviewAttempts]: any = await db.query("SELECT * FROM interview_history WHERE student_id = ?", [studentId]);
    
    // Package into neat high-compliance export wrapper
    const exportedData = {
      compliance_framework: "DPDP (Digital Personal Data Protection Act - India) & GDPR (General Data Protection Regulation)",
      export_timestamp: new Date().toISOString(),
      user_account: users[0],
      profile: {
        ...profiles[0],
        education,
        experience,
        projects,
        certifications,
        extracurriculars
      },
      historical_assessments: {
        mock_interviews: interviewAttempts
      }
    };
    
    // Set response headers to force download as file attachment
    res.setHeader("Content-Disposition", `attachment; filename="vega-user-${userId}-profile-export.json"`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(exportedData, null, 2));
  } catch (error) {
    console.error("Privacy data export error:", error);
    res.status(500).json({ success: false, message: "Error assembling personal data export package." });
  }
});

// Complete Account Deletion - DPDP Right to Be Forgotten
router.delete("/privacy/:userId/delete-account", authenticate, requireSelfParam("userId"), async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    
    const [users]: any = await db.query("SELECT id FROM users WHERE id = ?", [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "User account does not exist or has already been anonymous-deleted." });
    }
    
    // Execute a cascading transaction delete
    await db.query("DELETE FROM users WHERE id = ?", [userId]);
    
    res.json({ 
      success: true, 
      message: "Under Right to Be Forgotten / Right to Erasure, all active credentials, profiles, records, and linked metadata have been deleted from the primary cluster." 
    });
  } catch (error) {
    console.error("Privacy erase error:", error);
    res.status(500).json({ success: false, message: "Error deleting and purging personal data record." });
  }
});


export default router;

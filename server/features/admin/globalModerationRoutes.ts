import express from "express";
import db from "../../db.ts";
import { logAdminAction } from "./adminAudit.ts";
const router = express.Router();
// Admin stats
router.get("/stats", async (req, res) => {
  try {
    const [userCount]: any = await db.query("SELECT COUNT(*) as total FROM users");
    const [studentCount]: any = await db.query("SELECT COUNT(*) as total FROM users WHERE role = 'STUDENT'");
    const [companyCount]: any = await db.query("SELECT COUNT(*) as total FROM users WHERE role = 'COMPANY'");
    const [pendingCompanies]: any = await db.query("SELECT COUNT(*) as total FROM company_profiles WHERE status = 'PENDING'");
    const [jobCount]: any = await db.query("SELECT COUNT(*) as total FROM jobs");
    const [appCount]: any = await db.query("SELECT COUNT(*) as total FROM job_applications");
    const [shortlistedCount]: any = await db.query("SELECT COUNT(*) as total FROM job_applications WHERE status = 'SHORTLISTED'");

    // Application trend (last 7 days)
    const trendQuery = db.useMySQL ? `
      SELECT DATE(applied_at) as date, COUNT(*) as count 
      FROM job_applications 
      WHERE applied_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY date
      ORDER BY date ASC
    ` : `
      SELECT date(applied_at) as date, COUNT(*) as count 
      FROM job_applications 
      WHERE applied_at >= date('now', '-7 days')
      GROUP BY date
      ORDER BY date ASC
    `;

    const [trend]: any = await db.query(trendQuery);

    res.json({
      success: true,
      data: {
        metrics: {
          totalUsers: userCount[0]?.total || 0,
          students: studentCount[0]?.total || 0,
          companies: companyCount[0]?.total || 0,
          pendingVerifications: pendingCompanies[0]?.total || 0,
          totalJobs: jobCount[0]?.total || 0,
          totalApplications: appCount[0]?.total || 0,
          shortlisted: shortlistedCount[0]?.total || 0
        },
        trend
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error fetching stats" });
  }
});

// Get Student Activity Logs
router.get("/students/:userId/activity-logs", async (req, res) => {
  try {
    const { userId } = req.params;
    const [logs]: any = await db.query(`
      SELECT * FROM student_activity_logs 
      WHERE student_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1000
    `, [userId]);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ success: false, message: "Error fetching activity logs" });
  }
});

// Get Comprehensive Student Details
router.get("/students/:userId/details", async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if student exists
    const [userQuery]: any = await db.query("SELECT id, email, status, role, created_at FROM users WHERE id = ?", [userId]);
    if (userQuery.length === 0) return res.status(404).json({ success: false, message: "User not found" });
    const user = userQuery[0];

    const [profiles]: any = await db.query("SELECT * FROM student_profiles WHERE user_id = ?", [userId]);
    const profile = profiles[0] || null;

    if (!profile) {
      return res.json({ success: true, data: { user, profile: null } });
    }

    const studentId = profile.id;

    const [education]: any = await db.query("SELECT * FROM student_education WHERE student_id = ? ORDER BY start_date DESC", [studentId]);
    const [experience]: any = await db.query("SELECT * FROM student_experience WHERE student_id = ? ORDER BY start_date DESC", [studentId]);
    const [projects]: any = await db.query("SELECT * FROM student_projects WHERE student_id = ? ORDER BY created_at DESC", [studentId]);
    const [certifications]: any = await db.query("SELECT * FROM student_certifications WHERE student_id = ? ORDER BY issue_date DESC", [studentId]);
    const [extracurriculars]: any = await db.query("SELECT * FROM extracurricular_activities WHERE user_id = ? ORDER BY activity_date DESC", [userId]);
    
    const [applications]: any = await db.query(`
      SELECT a.id, a.status, a.applied_at, j.title as job_title, cp.company_name
      FROM job_applications a
      JOIN jobs j ON a.job_id = j.id
      JOIN company_profiles cp ON j.company_id = cp.id
      WHERE a.student_id = ?
      ORDER BY a.applied_at DESC
    `, [studentId]);

    const [activityLogs]: any = await db.query(`
      SELECT path, action, duration_seconds, created_at 
      FROM student_activity_logs 
      WHERE student_id = ? 
      ORDER BY created_at DESC 
      LIMIT 100
    `, [userId]);

    res.json({ 
      success: true, 
      data: {
        user,
        profile,
        education,
        experience,
        projects,
        certifications,
        extracurriculars,
        applications,
        activityLogs
      }
    });
  } catch (error) {
    console.error("Error fetching detailed student info:", error);
    res.status(500).json({ success: false, message: "Error fetching details" });
  }
});

// Get Comprehensive Company Details
router.get("/companies/:userId/details", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [userQuery]: any = await db.query("SELECT id, email, status, role, created_at FROM users WHERE id = ?", [userId]);
    if (userQuery.length === 0) return res.status(404).json({ success: false, message: "User not found" });
    const user = userQuery[0];

    const [profiles]: any = await db.query("SELECT * FROM company_profiles WHERE user_id = ?", [userId]);
    const profile = profiles[0] || null;

    if (!profile) {
      return res.json({ success: true, data: { user, profile: null } });
    }

    const companyId = profile.id;

    // Fetch jobs
    const [jobs]: any = await db.query("SELECT * FROM jobs WHERE company_id = ? ORDER BY created_at DESC", [companyId]);

    // Fetch documents
    const [documents]: any = await db.query("SELECT * FROM company_documents WHERE company_id = ?", [companyId]);

    // Fetch brief application stats
    const [applications]: any = await db.query(`
      SELECT a.status, COUNT(*) as count
      FROM job_applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE j.company_id = ?
      GROUP BY a.status
    `, [companyId]);

    res.json({ 
      success: true, 
      data: {
        user,
        profile,
        jobs,
        documents,
        applicationStats: applications
      }
    });

  } catch (error) {
    console.error("Error fetching detailed company info:", error);
    res.status(500).json({ success: false, message: "Error fetching details" });
  }
});

// List all users
router.get("/users", async (req, res) => {
  try {
    const [users]: any = await db.query(`
      SELECT u.id, u.email, u.role, u.status, u.created_at,
             cp.company_name, cp.status as company_status, cp.id as company_profile_id,
             cp.company_type, cp.industry, cp.city as location, cp.contact_number, cp.about as description,
             sp.full_name as student_name, sp.id as student_profile_id, sp.completeness_score
      FROM users u
      LEFT JOIN company_profiles cp ON u.id = cp.user_id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching users" });
  }
});

// Pending verification list with details
router.get("/companies/pending", async (req, res) => {
  try {
    const [pending]: any = await db.query(`
      SELECT C.*, U.email 
      FROM company_profiles C 
      JOIN users U ON C.user_id = U.id 
      WHERE C.status = 'PENDING'
      ORDER BY C.updated_at ASC
    `);

    // Fetch all documents in one bounded query rather than one query per company.
    const companyIds = pending.map((p: any) => Number(p.id)).filter(Number.isFinite);
    const docsByCompany = new Map<number, any[]>();
    if (companyIds.length > 0) {
      const placeholders = companyIds.map(() => '?').join(',');
      const [docs]: any = await db.query(`SELECT id, company_id, doc_type, status FROM company_documents WHERE company_id IN (${placeholders})`, companyIds);
      for (const doc of docs || []) { const id = Number(doc.company_id); if (!docsByCompany.has(id)) docsByCompany.set(id, []); docsByCompany.get(id)!.push(doc); }
    }
    const enriched = pending.map((p: any) => ({ ...p, documents: docsByCompany.get(Number(p.id)) || [] }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching pending list" });
  }
});

// Approve/Reject Company
router.post("/companies/verify", async (req, res) => {
  const { companyId, status, reason } = req.body;
  const adminId = (req as any).user.userId;

  try {
    const verifiedAt = status === 'APPROVED' ? new Date() : null;
    
    await db.query(`
      UPDATE company_profiles 
      SET status = ?, rejection_reason = ?, verified_at = ?
      WHERE id = ?
    `, [status, status === 'REJECTED' ? reason : null, verifiedAt, companyId]);

    // Log the review
    await db.query(`
      INSERT INTO admin_reviews (company_id, admin_id, action, reason)
      VALUES (?, ?, ?, ?)
    `, [companyId, adminId, status, reason]);

    await logAdminAction(adminId, `VERIFY_COMPANY_${status}`, { companyId, reason }, req);

    res.json({ success: true, message: `Company ${status}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Verification failed" });
  }
});

// Applications Tracker (Global)
router.get("/applications", async (req, res) => {
  try {
    const [apps]: any = await db.query(`
      SELECT a.*, sp.full_name as student_name, j.title as job_title, cp.company_name
      FROM applications a
      JOIN student_profiles sp ON a.student_id = sp.id
      JOIN jobs j ON a.job_id = j.id
      JOIN company_profiles cp ON j.company_id = cp.id
      ORDER BY a.applied_at DESC
    `);
    res.json({ success: true, data: apps });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching applications" });
  }
});

// Talent Score Monitoring
router.get("/monitoring/talent-scores", async (req, res) => {
  try {
    const [scores]: any = await db.query(`
      SELECT sp.full_name, sp.id as profile_id, u.email, sp.completeness_score,
             (SELECT COUNT(*) FROM applications WHERE student_id = sp.id) as app_count
      FROM student_profiles sp
      JOIN users u ON sp.user_id = u.id
      ORDER BY sp.completeness_score DESC
      LIMIT 100
    `);
    res.json({ success: true, data: scores });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching talent scores" });
  }
});

// Admin Logs
router.get("/logs", async (req, res) => {
  try {
    const [logs]: any = await db.query(`
      SELECT al.*, u.email as admin_email
      FROM admin_logs al
      JOIN users u ON al.admin_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 200
    `);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching logs" });
  }
});

// Moderate jobs
router.get("/jobs", async (req, res) => {
  try {
    const [jobs]: any = await db.query(`
      SELECT j.*, cp.company_name 
      FROM jobs j
      JOIN company_profiles cp ON j.company_id = cp.id
      ORDER BY j.created_at DESC
    `);
    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching jobs" });
  }
});

router.delete("/jobs/:id", async (req, res) => {
  const adminId = (req as any).user.userId;
  try {
    await db.query("DELETE FROM jobs WHERE id = ?", [req.params.id]);
    await logAdminAction(adminId, "DELETE_JOB", { jobId: req.params.id }, req);
    res.json({ success: true, message: "Job deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

// Update user account status (Ban/Unban)
router.patch("/users/:id/status", async (req, res) => {
  const { status } = req.body;
  const adminId = (req as any).user.userId;
  try {
    await db.query("UPDATE users SET status = ? WHERE id = ?", [status, req.params.id]);
    await logAdminAction(adminId, `USER_STATUS_${status}`, { userId: req.params.id }, req);
    res.json({ success: true, message: `User status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: "Update failed" });
  }
});


export default router;

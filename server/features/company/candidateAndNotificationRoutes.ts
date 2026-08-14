import express from "express";
import db from "../../db.ts";
import { authenticate } from "../../middleware/auth.ts";
import { getCompanyContext, logCompanyAudit } from "./companyAccess.ts";
const router = express.Router();
// Update Candidate Assignment
router.post("/candidates/assign", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req, "Pipeline Manage");
    const { applicationIds, hrUserId, assignmentType } = req.body;
    const ids = Array.isArray(applicationIds) ? [...new Set(applicationIds.map(Number).filter(Number.isInteger))] : [];
    if (ids.length === 0 || !hrUserId || ids.length > 1000) return res.status(400).json({ success: false, message: "Missing or invalid required fields" });
    const placeholders = ids.map(() => '?').join(',');
    const [apps]: any = await db.query(`SELECT JA.id, JA.job_id FROM job_applications JA JOIN jobs J ON JA.job_id=J.id WHERE JA.id IN (${placeholders}) AND J.company_id = ?`, [...ids, ctx.companyId]);
    if (apps.length !== ids.length) return res.status(403).json({ success: false, message: "One or more applications are outside your company scope" });

    await db.transaction(async (tx) => {
      await tx.query(`DELETE FROM company_application_assignments WHERE application_id IN (${placeholders})`, ids);
      const values = apps.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
      const params = apps.flatMap((app: any) => [ctx.companyId, app.job_id, app.id, hrUserId, ctx.userId, assignmentType || 'MANUAL']);
      await tx.query(`INSERT INTO company_application_assignments (company_id, job_id, application_id, assigned_hr_user_id, assigned_by_user_id, assignment_type) VALUES ${values}`, params);
    });
    await logCompanyAudit(ctx.companyId, ctx.userId, ctx.actorName, ctx.roleType, "ASSIGN_CANDIDATE", "Applicants", `Assigned ${ids.length} candidate(s) to HR user ID ${hrUserId}.`, "job_applications", null, { applicationIds: ids, hrUserId, assignmentType });
    res.json({ success: true, message: "Candidates assigned successfully" });
  } catch (error: any) {
    console.error("Error in /candidates/assign:", error);
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// Auto Distribute Candidates
router.post("/candidates/auto-distribute", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req, "Pipeline Manage");
    const { applicationIds, hrUserIds } = req.body;
    const ids = Array.isArray(applicationIds) ? [...new Set(applicationIds.map(Number).filter(Number.isInteger))] : [];
    const hrs = Array.isArray(hrUserIds) ? [...new Set(hrUserIds.map(Number).filter(Number.isInteger))] : [];
    if (ids.length === 0 || hrs.length === 0 || ids.length > 1000) return res.status(400).json({ success: false, message: "Invalid application list or empty HR list" });
    const placeholders = ids.map(() => '?').join(',');
    const [apps]: any = await db.query(`SELECT JA.id, JA.job_id FROM job_applications JA JOIN jobs J ON JA.job_id=J.id WHERE JA.id IN (${placeholders}) AND J.company_id = ?`, [...ids, ctx.companyId]);
    if (apps.length !== ids.length) return res.status(403).json({ success: false, message: "One or more applications are outside your company scope" });
    const byId = new Map(apps.map((a: any) => [Number(a.id), a]));

    await db.transaction(async (tx) => {
      await tx.query(`DELETE FROM company_application_assignments WHERE application_id IN (${placeholders})`, ids);
      const values = ids.map(() => '(?, ?, ?, ?, ?, \'AUTO\')').join(',');
      const params = ids.flatMap((appId, i) => { const app: any = byId.get(appId); return [ctx.companyId, app.job_id, appId, hrs[i % hrs.length], ctx.userId]; });
      await tx.query(`INSERT INTO company_application_assignments (company_id, job_id, application_id, assigned_hr_user_id, assigned_by_user_id, assignment_type) VALUES ${values}`, params);
    });
    await logCompanyAudit(ctx.companyId, ctx.userId, ctx.actorName, ctx.roleType, "AUTO_DISTRIBUTE_CANDIDATES", "Applicants", `Auto-distributed ${ids.length} candidate(s) among ${hrs.length} selected HRs.`, "job_applications", null, { applicationIds: ids, hrUserIds: hrs });
    res.json({ success: true, message: "Candidates distributed successfully" });
  } catch (error: any) {
    console.error("Error in /candidates/auto-distribute:", error);
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// Get all Candidate Assignments
router.get("/candidates/assignments", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    const [assignments]: any = await db.query(`
      SELECT caa.*, u.email as assigned_hr_email, chp.designation as assigned_hr_designation
      FROM company_application_assignments caa
      JOIN users u ON caa.assigned_hr_user_id = u.id
      JOIN company_hr_profiles chp ON u.id = chp.user_id
      WHERE caa.company_id = ?
    `, [ctx.companyId]);
    res.json({ success: true, data: assignments });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// Get Company Notifications (Dynamic + Physical)
router.get("/notifications", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    const userId = ctx.userId;
    const companyId = ctx.companyId;

    // 1. Fetch user-specific notifications from physical table
    const [physicalRows]: any = await db.query(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `, [userId]);

    // 2. Fetch application assignments if any (for Sub HR scoping)
    const [assignments]: any = await db.query(`
      SELECT application_id FROM company_application_assignments
      WHERE company_id = ? AND assigned_hr_user_id = ?
    `, [companyId, userId]);

    const isSubHr = ctx.roleType === 'SUB_HR';
    const hasAssignments = assignments.length > 0;
    const assignedAppIds = assignments.map((a: any) => a.application_id);

    // 3. Helper to filter app-specific notifications based on Sub HR assignment scope
    const isAppInScope = (appId: number) => {
      if (!isSubHr) return true; // Super HR sees everything
      if (!hasAssignments) return true; // Sub HR sees everything if no assignment scope is active
      return assignedAppIds.includes(appId);
    };

    const dynamicNotifications: any[] = [];

    // A. Generate "New Application" notifications
    const [newApps]: any = await db.query(`
      SELECT ja.id as app_id, ja.applied_at as created_at, j.title as job_title, s.full_name as student_name
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      JOIN student_profiles s ON ja.student_id = s.id
      WHERE j.company_id = ?
      ORDER BY ja.applied_at DESC
      LIMIT 50
    `, [companyId]);

    for (const app of newApps) {
      if (isAppInScope(app.app_id)) {
        dynamicNotifications.push({
          id: `app-${app.app_id}`,
          title: "New Application",
          desc: `${app.student_name} applied for "${app.job_title}"`,
          time: app.created_at,
          type: "success"
        });
      }
    }

    // B. Generate "Pipeline Update" notifications
    const [historyRows]: any = await db.query(`
      SELECT ah.id as hist_id, ah.created_at, ah.action, ah.notes, j.title as job_title, s.full_name as student_name, ja.id as app_id, js.stage_name
      FROM application_history ah
      JOIN job_applications ja ON ah.application_id = ja.id
      JOIN jobs j ON ja.job_id = j.id
      JOIN student_profiles s ON ja.student_id = s.id
      LEFT JOIN job_stages js ON ah.stage_id = js.id
      WHERE j.company_id = ?
      ORDER BY ah.created_at DESC
      LIMIT 50
    `, [companyId]);

    for (const h of historyRows) {
      if (isAppInScope(h.app_id)) {
        const stage = h.stage_name || "Next Phase";
        dynamicNotifications.push({
          id: `hist-${h.hist_id}`,
          title: "Pipeline Update",
          desc: `${h.student_name} was moved to stage "${stage}" for "${h.job_title}" (${h.action})`,
          time: h.created_at,
          type: "info"
        });
      }
    }

    // C. Generate "Interview Scheduled" notifications
    const [interviews]: any = await db.query(`
      SELECT i.id as int_id, i.scheduled_at, i.status, i.interview_type, j.title as job_title, s.full_name as student_name, ja.id as app_id
      FROM interview_schedules i
      JOIN job_applications ja ON i.application_id = ja.id
      JOIN jobs j ON ja.job_id = j.id
      JOIN student_profiles s ON ja.student_id = s.id
      WHERE j.company_id = ?
      ORDER BY i.scheduled_at DESC
      LIMIT 50
    `, [companyId]);

    for (const iv of interviews) {
      if (isAppInScope(iv.app_id)) {
        dynamicNotifications.push({
          id: `interview-${iv.int_id}`,
          title: "Interview Scheduled",
          desc: `${iv.interview_type} Interview scheduled with ${iv.student_name} for "${iv.job_title}" on ${new Date(iv.scheduled_at).toLocaleDateString()}`,
          time: iv.scheduled_at,
          type: "warning"
        });
      }
    }

    // D. Generate "Deadline Alert" notifications
    let expiringJobs: any[] = [];
    if (db.useMySQL) {
      try {
        const [rows]: any = await db.query(`
          SELECT id, title, deadline as application_deadline, DATEDIFF(deadline, CURRENT_DATE()) as days_left
          FROM jobs
          WHERE company_id = ? AND deadline >= CURRENT_DATE() AND deadline <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)
        `, [companyId]);
        expiringJobs = rows || [];
      } catch (err) {
        console.error("Error running MySQL deadline alerts query:", err);
      }
    } else {
      try {
        const [rows]: any = await db.query(`
          SELECT id, title, deadline as application_deadline,
                 CAST((julianday(deadline) - julianday('now')) AS INTEGER) as days_left
          FROM jobs
          WHERE company_id = ? AND deadline >= date('now') AND deadline <= date('now', '+7 days')
        `, [companyId]);
        expiringJobs = rows || [];
      } catch (err) {
        console.error("Error running SQLite deadline alerts query:", err);
      }
    }

    for (const j of expiringJobs) {
      dynamicNotifications.push({
        id: `deadline-${j.id}`,
        title: "Deadline Alert",
        desc: `Job post "${j.title}" expires in ${j.days_left} days!`,
        time: j.application_deadline,
        type: "warning"
      });
    }

    // E. Map physical notifications to expected format
    const formattedPhysical = physicalRows.map((p: any) => ({
      id: `p-${p.id}`,
      title: p.title,
      desc: p.message,
      time: p.created_at,
      type: p.type === 'SUCCESS' ? 'success' : p.type === 'WARNING' ? 'warning' : 'info',
      is_read: p.is_read
    }));

    // Combine all and sort by time DESC
    let allNotifications = [...formattedPhysical, ...dynamicNotifications];
    allNotifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // Deduplicate notifications by description
    const seenDesc = new Set();
    allNotifications = allNotifications.filter(n => {
      const key = `${n.title}-${n.desc}`;
      if (seenDesc.has(key)) return false;
      seenDesc.add(key);
      return true;
    });

    // Limit to most recent 40
    allNotifications = allNotifications.slice(0, 40);

    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    allNotifications = allNotifications.map(n => ({
      ...n,
      is_read: n.is_read !== undefined ? n.is_read : (new Date(n.time).getTime() < twoDaysAgo ? 1 : 0)
    }));

    res.json({ success: true, data: allNotifications });
  } catch (error: any) {
    console.error("Error fetching company notifications:", error);
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// Mark all company notifications as read
router.post("/notifications/read-all", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req);
    await db.query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [ctx.userId]);
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error: any) {
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message });
  }
});

// Get all Sub HRs

export default router;

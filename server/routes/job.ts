import express from "express";
import db from "../db.ts";
import { authenticate, authorize } from "../middleware/auth.ts";
import { checkAndProcessJobExpirations } from "../services/jobExpiryService.ts";
import { processJobEnding, isJobActive, isJobEnded } from "../services/jobLifecycleService.ts";
export { recoverStaleProcessingMedia, runStartupRecovery, cleanupOrphanedAndRejectedDropMedia } from "../features/drops/dropMediaService.ts";
import { registerDropRoutes } from "../features/drops/dropRoutes.ts";
import { registerJobApplicationRoutes } from "../features/applications/applicationRoutes.ts";
import { cacheGetOrLoad, invalidateCacheNamespace } from "../services/cacheService.ts";

import {
  resolveCompanyContext,
  resolveCompanyAndCheckPermission,
  canAccessApplication,
  requireApplicationAccess,
  requireCompanyJobAccess,
  requireCompanyApplicationsAccess,
  requireStudentRecruitingDataAccess,
} from "../features/applications/applicationAccessPolicy.ts";

const router = express.Router();

// List jobs with filtering and search
router.get("/", async (req, res) => {
  const { search, skills, location, type, experience, studentId, companyId, status } = req.query;
  try {
    // Production expiry is handled by the distributed worker. Keeping writes out of a
    // public GET endpoint makes this route cacheable and read-replica safe.
    if (process.env.NODE_ENV !== "production") await checkAndProcessJobExpirations();

    const typeKey = Array.isArray(type) ? type.join(",") : (typeof type === "string" ? type : "");
    const ttl = studentId ? Number(process.env.CACHE_TTL_JOB_MATCH_SECONDS || 20) : Number(process.env.CACHE_TTL_JOBS_SECONDS || 60);
    const enrichedJobs = await cacheGetOrLoad<any[]>("jobs:list",
      [search || "", skills || "", location || "", typeKey, experience || "", studentId || "", companyId || "", status || "OPEN"],
      ttl,
      async () => {
        let query = `
          SELECT J.*, C.company_name, C.logo_url, COALESCE(JS.stage_count, 0) AS stage_count
          FROM jobs J
          JOIN company_profiles C ON J.company_id = C.id
          LEFT JOIN (SELECT job_id, COUNT(*) AS stage_count FROM job_stages GROUP BY job_id) JS ON JS.job_id = J.id
          WHERE 1=1
        `;
        const params: any[] = [];

        if (status && status !== 'ALL') { query += ` AND J.status = ?`; params.push(status); }
        else if (!status) query += ` AND J.status = 'OPEN'`;
        if (companyId) { query += ` AND J.company_id = ?`; params.push(companyId); }
        if (search) { query += ` AND (J.title LIKE ? OR C.company_name LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
        if (location) { query += ` AND J.location LIKE ?`; params.push(`%${location}%`); }
        if (type) {
          const types = Array.isArray(type)
            ? type.map((t: any) => String(t).trim()).filter(Boolean)
            : typeof type === 'string'
              ? type.split(',').map((t: string) => t.trim()).filter(Boolean)
              : [];
          if (types.length === 1) {
            query += ` AND J.job_type = ?`;
            params.push(types[0]);
          } else if (types.length > 1) {
            const placeholders = types.map(() => '?').join(', ');
            query += ` AND J.job_type IN (${placeholders})`;
            params.push(...types);
          }
        }
        if (experience) { query += ` AND J.experience_level = ?`; params.push(experience); }
        // MySQL prepared statements can be sensitive to LIMIT/OFFSET bindings on
        // some server/driver combinations. Validate the value as a bounded integer
        // and embed only the sanitized numeric literal. All user-controlled filters
        // remain parameterized above.
        const requestedLimit = Number(req.query.limit ?? 100);
        const limit = Number.isFinite(requestedLimit)
          ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 200)
          : 100;

        query += ` ORDER BY J.created_at DESC LIMIT ${limit}`;

        const [jobs]: any = await db.readQuery(query, params);
        if (!studentId) return jobs;

        const [profiles]: any = await db.readQuery("SELECT skills_json FROM student_profiles WHERE id = ?", [studentId]);
        if (profiles.length === 0) return jobs;
        const studentSkills = profiles[0].skills_json ? (typeof profiles[0].skills_json === 'string' ? JSON.parse(profiles[0].skills_json) : profiles[0].skills_json) : [];
        return jobs.map((job: any) => {
          const jobSkills = job.skills_json ? (typeof job.skills_json === 'string' ? JSON.parse(job.skills_json) : job.skills_json) : [];
          if (!Array.isArray(jobSkills) || jobSkills.length === 0) return { ...job, match_score: 100 };
          const matches = jobSkills.filter((skill: string) => studentSkills.some((ss: any) => {
            const name = typeof ss === 'string' ? ss : (ss.name || "");
            return name.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(name.toLowerCase());
          }));
          return { ...job, match_score: Math.round((matches.length / jobSkills.length) * 100) };
        });
      }
    );

    res.json({ success: true, data: enrichedJobs });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ success: false, message: "Error fetching jobs" });
  }
});

// Create job with stages
router.post("/", authenticate, async (req: any, res) => {
  const { 
    title, description, skills, location, jobType, 
    experienceLevel, educationRequirement, responsibilities, 
    qualifications, additionalNotes, startDate, deadline, stages,
    salaryRange, publishDestination, openings
  } = req.body;

  try {
    // Auth safety: Resolve company ID directly from authenticated user
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User is not authenticated." });
    }

    const [profiles]: any = await db.query("SELECT * FROM company_profiles WHERE user_id = ?", [userId]);
    if (!profiles[0]) {
      return res.status(404).json({ success: false, message: "Company profile not found for authenticated user." });
    }

    const companyId = profiles[0].id;
    const companyStatus = profiles[0].status;

    if (companyStatus !== 'APPROVED') {
      return res.status(403).json({ success: false, message: "Only approved companies can post job opportunities." });
    }

    // Input Validation
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ success: false, message: "Job title is required." });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ success: false, message: "Job description is required." });
    }
    if (!location || typeof location !== "string" || !location.trim()) {
      return res.status(400).json({ success: false, message: "Job location is required." });
    }
    if (!deadline) {
      return res.status(400).json({ success: false, message: "Application end deadline is required." });
    }

    // Date validations
    const start = new Date(startDate || new Date().toISOString().split('T')[0]);
    const end = new Date(deadline);

    if (isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid application start date format." });
    }
    if (isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid application end deadline format." });
    }
    if (end < start) {
      return res.status(400).json({ success: false, message: "Application end deadline cannot be before start date." });
    }

    let openingsNum = 1;
    if (openings !== undefined && openings !== null) {
      openingsNum = typeof openings === "number" ? openings : Number(openings);
      if (isNaN(openingsNum) || !Number.isInteger(openingsNum) || openingsNum < 1 || openingsNum > 999) {
        return res.status(400).json({ success: false, message: "Number of openings must be an integer between 1 and 999." });
      }
    }

    const publishDestinationValue = publishDestination === "JOB_AND_DROPS" ? "JOB_AND_DROPS" : "JOB_ONLY";

    const [result]: any = await db.query(`
      INSERT INTO jobs (
        company_id, title, description, skills_json, location, job_type,
        experience_level, salary_range, education_requirement, responsibilities,
        qualifications, additional_notes, application_start_date, deadline, publish_destination,
        openings
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      companyId, title, description, JSON.stringify(skills || []), location, jobType || "Full-time",
      experienceLevel || "Entry Level", salaryRange || "", educationRequirement || "", responsibilities || "",
      qualifications || "", additionalNotes || "", startDate || new Date().toISOString().split('T')[0], deadline,
      publishDestinationValue, openingsNum
    ]);

    const jobId = result.insertId;

    // Transaction safety & Manual cleanup of partial jobs if any stage insert fails
    try {
      if (stages && Array.isArray(stages)) {
        for (let i = 0; i < stages.length; i++) {
          const [stageResult]: any = await db.query(`
            INSERT INTO job_stages (job_id, stage_name, stage_type, stage_order, description, config_json)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            jobId, 
            stages[i].name, 
            stages[i].type || 'APPLICATION',
            i + 1, 
            stages[i].description || "",
            JSON.stringify(stages[i].config || {})
          ]);

          const stageId = stageResult.insertId;

          // If stage is a test and has questions, insert them
          if (stages[i].type === 'TEST' && stages[i].questions) {
             for (const q of stages[i].questions) {
                await db.query(`
                  INSERT INTO test_questions (stage_id, question_text, options_json, correct_answer)
                  VALUES (?, ?, ?, ?)
                `, [stageId, q.text, JSON.stringify(q.options), q.correctAnswer]);
             }
          }
        }
      }

      // Automatically create a Drop if publishDestination is JOB_AND_DROPS
      if (publishDestinationValue === "JOB_AND_DROPS") {
        await db.query(`
          INSERT INTO drops (
            company_id, job_id, title, type, description, location, status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          companyId,
          jobId,
          `New Role: ${title}`,
          'Job Promotion',
          description,
          location || null,
          'ACTIVE'
        ]);
      }
    } catch (stageError) {
      console.error("[JOB REQUISITION TRANSACTION FAILED] Reverting job id:", jobId, stageError);
      await db.query("DELETE FROM jobs WHERE id = ?", [jobId]);
      throw stageError;
    }

    await invalidateCacheNamespace("jobs:list");
    res.json({ success: true, message: "Job opportunity published successfully", jobId });
  } catch (error: any) {
    console.error("Error posting job:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error occurred while posting job." });
  }
});

// Get current stage details for student
registerJobApplicationRoutes(router, {
  resolveCompanyContext,
  requireApplicationAccess,
  requireCompanyJobAccess,
  requireCompanyApplicationsAccess,
  requireStudentRecruitingDataAccess,
});

router.get("/company-managed/all", authenticate, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User is not authenticated." });
    }

    await checkAndProcessJobExpirations();

    let companyId = null;
    let isSubHr = false;

    // Check if user is a Sub HR
    const [hrProfiles]: any = await db.query("SELECT * FROM company_hr_profiles WHERE user_id = ?", [userId]);
    if (hrProfiles && hrProfiles.length > 0) {
      isSubHr = true;
      companyId = hrProfiles[0].company_id;
    } else {
      // Check if user is a Super HR / Company Profile owner
      const [profiles]: any = await db.query("SELECT * FROM company_profiles WHERE user_id = ?", [userId]);
      if (profiles && profiles.length > 0) {
        companyId = profiles[0].id;
      }
    }

    if (!companyId) {
      return res.status(404).json({ success: false, message: "Company profile not found for authenticated user." });
    }

    let assignedJobIds: number[] | null = null;
    if (isSubHr) {
      const [assignments]: any = await db.query(
        "SELECT job_id FROM company_job_assignments WHERE company_id = ? AND assigned_hr_user_id = ?",
        [companyId, userId]
      );
      if (assignments.length === 0) {
        return res.json({ success: true, data: [] });
      }
      assignedJobIds = assignments.map((a: any) => Number(a.job_id));
    }

    let sql = `
      SELECT J.*, C.company_name, C.logo_url,
             (SELECT COUNT(DISTINCT JA.id) FROM job_applications JA WHERE JA.job_id = J.id) as total_applicants,
             (SELECT COUNT(DISTINCT JS.id) FROM job_stages JS WHERE JS.job_id = J.id) as stage_count
      FROM jobs J
      JOIN company_profiles C ON J.company_id = C.id
      WHERE J.company_id = ?
    `;
    const params: any[] = [companyId];

    if (assignedJobIds !== null && assignedJobIds.length > 0) {
      sql += ` AND J.id IN (${assignedJobIds.map(() => '?').join(',')})`;
      params.push(...assignedJobIds);
    }

    sql += ` ORDER BY J.created_at DESC`;

    const [jobs]: any = await db.query(sql, params);

    const formattedJobs = (jobs || []).map((j: any) => {
      let skills = [];
      if (j.skills_json) {
        try {
          skills = typeof j.skills_json === 'string' ? JSON.parse(j.skills_json) : j.skills_json;
        } catch (e) {
          skills = [];
        }
      }
      return {
        ...j,
        skills,
        applicant_count: j.total_applicants || 0
      };
    });

    res.json({ success: true, data: formattedJobs });
  } catch (error: any) {
    console.error("Error in GET /api/jobs/company-managed/all:", error);
    res.status(500).json({ success: false, message: "Error fetching company managed jobs: " + (error.message || error) });
  }
});

// Get single job details including stages, applicant count, and assigned HRs
router.get("/:id", async (req, res) => {
  try {
    const [jobs]: any = await db.query(`
      SELECT J.*, C.company_name, C.logo_url,
             (SELECT COUNT(*) FROM job_applications JA WHERE JA.job_id = J.id) as total_applicants,
             (SELECT COUNT(*) FROM job_applications JA WHERE JA.job_id = J.id AND JA.status = 'SELECTED') as selected_count,
             (SELECT COUNT(*) FROM job_applications JA WHERE JA.job_id = J.id AND JA.status = 'REJECTED') as rejected_count
      FROM jobs J 
      JOIN company_profiles C ON J.company_id = C.id 
      WHERE J.id = ?
    `, [req.params.id]);
    
    if (jobs.length === 0) return res.status(404).json({ success: false, message: "Job not found" });

    const job = jobs[0];

    // Fetch stages
    const [stages] = await db.query("SELECT * FROM job_stages WHERE job_id = ? ORDER BY stage_order ASC", [req.params.id]);
    
    // Fetch assigned HRs
    const [assignedHrs]: any = await db.query(`
      SELECT cja.assigned_hr_user_id, u.email, chp.designation
      FROM company_job_assignments cja
      JOIN users u ON cja.assigned_hr_user_id = u.id
      JOIN company_hr_profiles chp ON u.id = chp.user_id
      WHERE cja.job_id = ?
    `, [req.params.id]);

    // Format skills_json if present
    let skills = [];
    if (job.skills_json) {
      try {
        skills = typeof job.skills_json === 'string' ? JSON.parse(job.skills_json) : job.skills_json;
      } catch (e) {
        skills = [];
      }
    }

    res.json({ 
      success: true, 
      data: { 
        ...job, 
        skills,
        stages: stages || [], 
        assigned_hrs: assignedHrs || [] 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching job details" });
  }
});

// Update authenticated company's own job details (description, key responsibilities, and job expiry date)
router.patch("/:id", authenticate, async (req: any, res) => {
  const jobId = req.params.id;
  const { description, responsibilities, deadline } = req.body;

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User is not authenticated." });
    }

    let companyId = null;
    let roleType = "SUPER_HR";
    let actorName = req.user.email || "Company User";

    // Support both Super HR and Sub HR
    const [hrProfiles]: any = await db.query("SELECT * FROM company_hr_profiles WHERE user_id = ?", [userId]);
    if (hrProfiles && hrProfiles.length > 0) {
      const hr = hrProfiles[0];
      roleType = "SUB_HR";
      companyId = hr.company_id;
      actorName = `${hr.designation || "Sub HR"} (${req.user.email})`;

      const permissions = JSON.parse(hr.permissions || "[]");
      if (!permissions.includes("Edit Jobs") && !permissions.includes("Create Jobs")) {
        return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to edit jobs." });
      }

      // Verify job assignment if Sub HR has assignment scope
      const [assignments]: any = await db.query(
        "SELECT job_id FROM company_job_assignments WHERE company_id = ? AND assigned_hr_user_id = ?",
        [companyId, userId]
      );
      if (assignments.length > 0) {
        const assignedIds = assignments.map((a: any) => Number(a.job_id));
        if (!assignedIds.includes(Number(jobId))) {
          return res.status(403).json({ success: false, message: "Forbidden: You are not assigned to manage this job." });
        }
      }
    } else {
      const [profiles]: any = await db.query("SELECT * FROM company_profiles WHERE user_id = ?", [userId]);
      if (profiles && profiles.length > 0) {
        companyId = profiles[0].id;
        actorName = `Super HR (${req.user.email})`;
      }
    }

    if (!companyId) {
      return res.status(404).json({ success: false, message: "Company profile not found for authenticated user." });
    }

    // Check if job exists and belongs to this company
    const [jobs]: any = await db.query("SELECT * FROM jobs WHERE id = ? AND company_id = ?", [jobId, companyId]);
    if (!jobs[0]) {
      return res.status(404).json({ success: false, message: "Job post not found or you are not authorized to edit it." });
    }

    const job = jobs[0];

    // Helper to extract YYYY-MM-DD without timezone shifts
    const toDateString = (d: any): string | null => {
      if (!d) return null;
      if (typeof d === 'string') {
        const match = d.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
      }
      if (d instanceof Date && !isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      const match = String(d).match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : null;
    };

    // Calculate today's date in local YYYY-MM-DD format
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const deadlineStr = toDateString(job.deadline);
    const isExpired = deadlineStr !== null && deadlineStr < todayStr;
    const isClosedOrEnded = job.status === "CLOSED" || job.ended_at !== null || isExpired;

    if (isClosedOrEnded) {
      return res.status(400).json({
        success: false,
        message: "Cannot edit job details: This job is closed, manually ended, or has already expired."
      });
    }

    // Input Validation
    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ success: false, message: "Job description is required." });
    }
    if (!responsibilities || typeof responsibilities !== "string" || !responsibilities.trim()) {
      return res.status(400).json({ success: false, message: "Key responsibilities are required." });
    }

    if (description.trim().length < 10) {
      return res.status(400).json({ success: false, message: "Job description must be at least 10 characters long." });
    }
    if (responsibilities.trim().length < 10) {
      return res.status(400).json({ success: false, message: "Key responsibilities must be at least 10 characters long." });
    }

    // Expiry Date Validation
    let targetDeadline = deadlineStr || todayStr;
    if (deadline) {
      const parsedStr = toDateString(deadline);
      if (!parsedStr) {
        return res.status(400).json({ success: false, message: "Invalid job expiry date format." });
      }

      if (parsedStr < todayStr) {
        return res.status(400).json({ success: false, message: "Job expiry date cannot be in the past. Earliest allowed date is today." });
      }

      targetDeadline = parsedStr;
    }

    // Update ONLY description, responsibilities, and deadline. NEVER modify status, ended_at, or pipeline_ended_at.
    await db.query(
      "UPDATE jobs SET description = ?, responsibilities = ?, deadline = ? WHERE id = ? AND company_id = ?",
      [description.trim(), responsibilities.trim(), targetDeadline, jobId, companyId]
    );

    // If there is any linked Drop in the drops table, update the drop's description too!
    try {
      await db.query(
        "UPDATE drops SET description = ? WHERE job_id = ? AND company_id = ?",
        [description.trim(), jobId, companyId]
      );
    } catch (dropUpdateErr) {
      console.warn("Could not auto-update linked drop description:", dropUpdateErr);
    }

    // Record audit log entry in company_audit_logs
    try {
      await db.query(`
        INSERT INTO company_audit_logs (
          company_id, actor_user_id, actor_name, actor_role, action_type, module, description, target_type, target_id, metadata_json
        ) VALUES (?, ?, ?, ?, 'UPDATE_JOB', 'Jobs', ?, 'jobs', ?, ?)
      `, [
        companyId,
        userId,
        actorName,
        roleType,
        `Updated job details and expiry date for "${job.title}" (Expiry: ${targetDeadline}).`,
        Number(jobId),
        JSON.stringify({ description: description.trim(), responsibilities: responsibilities.trim(), deadline: targetDeadline })
      ]);
    } catch (auditErr) {
      console.error("Error inserting company audit log:", auditErr);
    }

    await invalidateCacheNamespace("jobs:list");
    // Fetch and return the updated job
    const [updatedJobs]: any = await db.query("SELECT * FROM jobs WHERE id = ?", [jobId]);

    return res.json({ 
      success: true, 
      message: "Job details updated successfully.",
      data: updatedJobs[0] || null
    });
  } catch (error: any) {
    console.error("Error updating job details:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
});

// Manually end job posting
router.put("/:id/end", authenticate, async (req: any, res) => {
  const jobId = req.params.id;
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User is not authenticated." });
    }

    let companyId = null;
    let roleType = "SUPER_HR";
    let actorName = req.user.email || "Company User";

    const [hrProfiles]: any = await db.query(
      "SELECT h.*, u.status AS user_status FROM company_hr_profiles h JOIN users u ON h.user_id = u.id WHERE h.user_id = ?",
      [userId]
    );
    if (hrProfiles && hrProfiles.length > 0) {
      const hr = hrProfiles[0];
      if (hr.user_status && hr.user_status !== 'ACTIVE') {
        return res.status(403).json({ success: false, message: "Forbidden: Sub HR profile is inactive." });
      }

      roleType = "SUB_HR";
      companyId = hr.company_id;
      actorName = `${hr.designation || "Sub HR"} (${req.user.email})`;

      const permissions = JSON.parse(hr.permissions || "[]");
      if (!permissions.includes("Edit Jobs")) {
        return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to end jobs." });
      }

      const [assignments]: any = await db.query(
        "SELECT id FROM company_job_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND job_id = ?",
        [companyId, userId, jobId]
      );
      if (!assignments || assignments.length === 0) {
        return res.status(403).json({ success: false, message: "Forbidden: You are not assigned to manage this job." });
      }
    } else {
      const [profiles]: any = await db.query("SELECT * FROM company_profiles WHERE user_id = ?", [userId]);
      if (profiles && profiles.length > 0) {
        companyId = profiles[0].id;
        actorName = `Super HR (${req.user.email})`;
      }
    }

    if (!companyId) {
      return res.status(404).json({ success: false, message: "Company profile not found for authenticated user." });
    }

    const [jobs]: any = await db.query("SELECT * FROM jobs WHERE id = ? AND company_id = ?", [jobId, companyId]);
    if (!jobs[0]) {
      return res.status(404).json({ success: false, message: "Job post not found or you are not authorized to modify it." });
    }

    const job = jobs[0];

    // Reject if job is already CLOSED, ended_at is set, or deadline is expired
    const isValidDeadline = job.deadline && 
      job.deadline !== 'null' && 
      job.deadline !== 'undefined' && 
      job.deadline.toString().trim() !== '' && 
      job.deadline !== '0000-00-00' && 
      !isNaN(new Date(job.deadline).getTime());
    const isExpired = isValidDeadline && new Date(job.deadline).getTime() < new Date().getTime();

    if (job.status === 'CLOSED' || job.ended_at !== null || isExpired) {
      return res.status(400).json({ success: false, message: "Job posting is already closed, ended, or expired." });
    }

    const now = new Date();
    await processJobEnding(Number(jobId), Number(companyId));

    // Audit log - inserted ONLY after successful job update
    try {
      await db.query(`
        INSERT INTO company_audit_logs (
          company_id, actor_user_id, actor_name, actor_role, action_type, module, description, target_type, target_id, metadata_json
        ) VALUES (?, ?, ?, ?, 'END_JOB', 'Jobs', ?, 'jobs', ?, ?)
      `, [
        companyId,
        userId,
        actorName,
        roleType,
        `Manually ended job posting "${job.title}".`,
        Number(jobId),
        JSON.stringify({ status: 'CLOSED', ended_at: now })
      ]);
    } catch (auditErr) {
      console.error("Error inserting company audit log:", auditErr);
    }

    await invalidateCacheNamespace("jobs:list");
    return res.json({ success: true, message: "Job posting ended successfully." });
  } catch (error: any) {
    console.error("Error ending job posting:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
});

// Company Drops routes are isolated in server/features/drops/dropRoutes.ts.
registerDropRoutes(router, resolveCompanyAndCheckPermission);

router.get("/company/applicants/:studentId/history", authenticate, async (req: any, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user?.userId;

    if (!studentId || isNaN(Number(studentId))) {
      return res.status(400).json({ success: false, message: "Invalid student ID." });
    }

    // 1. Resolve Super HR / Sub HR company context without trusting a company ID from the request.
    const ctx = await resolveCompanyContext(req);
    if (ctx.error || !ctx.companyId) {
      return res.status(ctx.statusCode || 403).json({ success: false, message: ctx.error || "Company context required." });
    }
    const companyId = ctx.companyId;

    const [studentProfiles]: any = await db.query(
      "SELECT id FROM student_profiles WHERE id = ? OR user_id = ? LIMIT 1",
      [studentId, studentId]
    );
    if (!studentProfiles?.length) return res.status(404).json({ success: false, message: "Student profile not found." });
    const actualStudentId = Number(studentProfiles[0].id);

    // 2. Fetch all applications of this student to this specific company's jobs.
    const [allApplications]: any = await db.query(`
      SELECT 
        ja.id as application_id,
        ja.status as application_status,
        ja.applied_at,
        j.title as job_title,
        j.location as job_location,
        js.stage_name as current_stage_name,
        js.stage_type as current_stage_type
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      LEFT JOIN job_stages js ON ja.current_stage_id = js.id
      WHERE ja.student_id = ? AND j.company_id = ?
      ORDER BY ja.applied_at DESC
    `, [actualStudentId, companyId]);

    let applications = allApplications || [];
    if (ctx.roleType === "SUB_HR") {
      const scoped: any[] = [];
      for (const app of applications) {
        if (await canAccessApplication(req, Number(app.application_id))) scoped.push(app);
      }
      applications = scoped;
    }

    const sanitizeText = (text: string | null | undefined): string => {
      if (!text) return "";
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    // Batch-load related data. This replaces the previous nested N+1 pattern
    // (applications -> history -> interviews -> evaluation-per-interview -> submissions).
    const applicationIds = applications.map((app: any) => Number(app.application_id)).filter(Number.isFinite);
    if (applicationIds.length === 0) return res.json({ success: true, data: [] });
    const appPlaceholders = applicationIds.map(() => '?').join(',');

    const [[allHistory], [allInterviews], [allSubmissions]]: any = await Promise.all([
      db.query(`SELECT ah.id, ah.application_id, ah.action, ah.notes, ah.created_at, js.stage_name, js.stage_type
                FROM application_history ah LEFT JOIN job_stages js ON ah.stage_id = js.id
                WHERE ah.application_id IN (${appPlaceholders}) ORDER BY ah.application_id, ah.created_at DESC`, applicationIds),
      db.query(`SELECT id, application_id, interview_type, scheduled_at, status, notes
                FROM interview_schedules WHERE application_id IN (${appPlaceholders})
                ORDER BY application_id, scheduled_at DESC`, applicationIds),
      db.query(`SELECT application_id, score, violation_count, is_auto_submitted, submitted_at
                FROM test_submissions WHERE application_id IN (${appPlaceholders})
                ORDER BY application_id, submitted_at DESC`, applicationIds),
    ]);

    const interviewIds = (allInterviews || []).map((i: any) => Number(i.id)).filter(Number.isFinite);
    let allEvaluations: any[] = [];
    if (interviewIds.length > 0) {
      const interviewPlaceholders = interviewIds.map(() => '?').join(',');
      const [rows]: any = await db.query(`SELECT interview_id, technical_knowledge, communication, confidence, leadership, problem_solving, cultural_fit, comments AS feedback
                                          FROM interview_evaluations WHERE interview_id IN (${interviewPlaceholders})`, interviewIds);
      allEvaluations = rows || [];
    }

    const historyByApp = new Map<number, any[]>();
    for (const row of allHistory || []) { const id = Number(row.application_id); if (!historyByApp.has(id)) historyByApp.set(id, []); historyByApp.get(id)!.push(row); }
    const interviewsByApp = new Map<number, any[]>();
    for (const row of allInterviews || []) { const id = Number(row.application_id); if (!interviewsByApp.has(id)) interviewsByApp.set(id, []); interviewsByApp.get(id)!.push(row); }
    const submissionsByApp = new Map<number, any[]>();
    for (const row of allSubmissions || []) { const id = Number(row.application_id); if (!submissionsByApp.has(id)) submissionsByApp.set(id, []); submissionsByApp.get(id)!.push(row); }
    const evaluationByInterview = new Map<number, any>();
    for (const row of allEvaluations) evaluationByInterview.set(Number(row.interview_id), row);

    const detailedHistory = applications.map((app: any) => {
      const appId = Number(app.application_id);
      const history = historyByApp.get(appId) || [];
      const rejectionEvent = history.find((h: any) => h.action === 'REJECTED');
      const selectionEvent = history.find((h: any) => h.action === 'SELECTED');
      const rawNotes = history.find((h: any) => h.notes && h.notes.trim())?.notes || null;
      const latestNotes = rawNotes ? sanitizeText(rawNotes) : null;
      const sanitizedInterviews = (interviewsByApp.get(appId) || []).map((i: any) => {
        const ev = evaluationByInterview.get(Number(i.id));
        let rating: number | null = null;
        if (ev) {
          const scores = [ev.technical_knowledge, ev.communication, ev.confidence, ev.leadership, ev.problem_solving, ev.cultural_fit].filter((score: any) => score !== null && score !== undefined && score > 0);
          if (scores.length) rating = Math.round(scores.reduce((a: number, b: number) => a + Number(b), 0) / scores.length);
        }
        return { ...i, notes: i.notes ? sanitizeText(i.notes) : null, rating, feedback: ev?.feedback ? sanitizeText(ev.feedback) : null };
      });
      const sanitizedHistory = history.map((h: any) => ({ ...h, notes: h.notes ? sanitizeText(h.notes) : null }));
      return {
        ...app, history: sanitizedHistory,
        rejectionEvent: rejectionEvent ? { phase: rejectionEvent.stage_name || rejectionEvent.stage_type || '—', notes: rejectionEvent.notes ? sanitizeText(rejectionEvent.notes) : '—', date: rejectionEvent.created_at } : null,
        selectionEvent: selectionEvent ? { phase: selectionEvent.stage_name || selectionEvent.stage_type || '—', notes: selectionEvent.notes ? sanitizeText(selectionEvent.notes) : '—', date: selectionEvent.created_at } : null,
        latestNotes, interviews: sanitizedInterviews, testSubmissions: submissionsByApp.get(appId) || [], lastUpdated: history[0]?.created_at || app.applied_at
      };
    });

    return res.json({
      success: true,
      data: detailedHistory
    });

  } catch (error) {
    console.error("Error fetching applicant history:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

export default router;
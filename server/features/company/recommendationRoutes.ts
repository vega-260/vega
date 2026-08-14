import express from "express";
import db from "../../db.ts";
import { authenticate } from "../../middleware/auth.ts";
import { GoogleGenAI } from "@google/genai";
import { getCompanyContext, logCompanyAudit } from "./companyAccess.ts";
import { enqueueEmail } from "../../services/queueService.ts";
const router = express.Router();
// --- RECOMMENDATIONS ENDPOINTS (Vega AI / Talent AI) ---

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Generate concise, professional recommendation reason
async function generateRecommendationReason(
  jobTitle: string,
  jobDescription: string,
  candidateName: string,
  candidateSkills: string[],
  matchScore: number
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return `${candidateName} has a strong ${matchScore}% skill and profile overlap for the ${jobTitle} position.`;
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are Vega AI, a senior talent acquisition agent.
      Write a highly concise, professional 1-2 sentence recommendation reason why candidate ${candidateName} matches the job ${jobTitle}.
      Match percentage: ${matchScore}%
      Candidate Skills: ${candidateSkills.join(", ")}
      Job Description: ${jobDescription.substring(0, 500)}...
      Output ONLY the concise 1-2 sentence recommendation reason, starting directly with the text. Do not add any greeting or preamble.`,
    });
    return response.text?.trim() || `${candidateName} is highly recommended for this role with a match score of ${matchScore}%.`;
  } catch (err) {
    console.error("Gemini recommendation reason generation failed:", err);
    return `${candidateName} has a strong ${matchScore}% skill and profile overlap for the ${jobTitle} position.`;
  }
}

// 1. GET /api/companies/recommendations/jobs
router.get("/recommendations/jobs", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req, "Recommendations View");

    let query = `
      SELECT J.*,
             COALESCE(S.stage_count, 0) AS stage_count,
             COALESCE(A.total_applicants, 0) AS total_applicants
      FROM jobs J
      LEFT JOIN (
        SELECT job_id, COUNT(*) AS stage_count
        FROM job_stages
        GROUP BY job_id
      ) S ON S.job_id = J.id
      LEFT JOIN (
        SELECT job_id, COUNT(*) AS total_applicants
        FROM job_applications
        GROUP BY job_id
      ) A ON A.job_id = J.id
      WHERE J.company_id = ?
    `;
    const params: any[] = [ctx.companyId];

    if (ctx.isSubHr) {
      const [assignments]: any = await db.query(
        "SELECT job_id FROM company_job_assignments WHERE company_id = ? AND assigned_hr_user_id = ?",
        [ctx.companyId, ctx.userId]
      );
      if (assignments.length > 0) {
        const assignedJobIds = assignments.map((a: any) => a.job_id);
        query += ` AND J.id IN (${assignedJobIds.map(() => '?').join(',')})`;
        params.push(...assignedJobIds);
      }
    }

    query += ` ORDER BY J.created_at DESC`;

    const [jobs]: any = await db.query(query, params);

    res.json({ success: true, data: jobs });
  } catch (error: any) {
    console.error("Error fetching recommendation jobs:", error);
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message || "Error fetching company jobs." });
  }
});

// 2. POST /api/companies/recommendations/:jobId/match
router.post("/recommendations/:jobId/match", authenticate, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const ctx = await getCompanyContext(req, "Recommendations View");
    
    const { minMatch = 10, maxMatch = 100, limit = 50, filters = {} } = req.body;

    // Verify job belongs to company
    const [jobs]: any = await db.query("SELECT * FROM jobs WHERE id = ? AND company_id = ?", [jobId, ctx.companyId]);
    if (!jobs[0]) {
      return res.status(404).json({ success: false, message: "Job not found or access denied." });
    }
    const job = jobs[0];

    if (ctx.isSubHr) {
      const [assignments]: any = await db.query(
        "SELECT id FROM company_job_assignments WHERE company_id = ? AND assigned_hr_user_id = ?",
        [ctx.companyId, ctx.userId]
      );
      if (assignments.length > 0) {
        const [isAssigned]: any = await db.query(
          "SELECT id FROM company_job_assignments WHERE job_id = ? AND assigned_hr_user_id = ?",
          [jobId, ctx.userId]
        );
        if (isAssigned.length === 0) {
          return res.status(403).json({ success: false, message: "Access denied: Job is not assigned to your HR account." });
        }
      }
    }

    // Get job skills
    let jobSkills: string[] = [];
    if (job.skills_json) {
      try {
        jobSkills = typeof job.skills_json === "string" ? JSON.parse(job.skills_json) : job.skills_json;
      } catch (e) {
        if (typeof job.skills_json === "string") {
          jobSkills = job.skills_json.split(",").map((s: string) => s.trim());
        }
      }
    }
    const reqSkills = jobSkills.map((s: string) => s.toLowerCase().trim()).filter(Boolean);

    // Get all students
    const [students]: any = await db.query(`
      SELECT 
        SP.*, 
        U.email, 
        CM.college_name,
        TS.overall_score as talent_score,
        SAR.pq_score, SAR.iq_score, SAR.eq_score, SAR.sq_score,
        JA.id as application_id,
        JA.status as application_status
      FROM student_profiles SP
      JOIN users U ON SP.user_id = U.id
      LEFT JOIN college_master CM ON SP.college_id = CM.id
      LEFT JOIN talent_scores TS ON SP.user_id = TS.user_id
      LEFT JOIN student_assessment_results SAR ON SP.user_id = SAR.user_id
      LEFT JOIN job_applications JA ON SP.id = JA.student_id AND JA.job_id = ?
    `, [jobId]);

    // Track previous notifications to prevent duplicates
    const [notifs]: any = await db.query(
      "SELECT student_user_id, notified_at FROM recommendation_notifications WHERE job_id = ?",
      [jobId]
    );
    const notifiedUserIds = new Set(notifs.map((n: any) => n.student_user_id));

    const candidates: any[] = [];

    for (const student of students) {
      // 1. Required skills match: 40%
      let studentSkills: string[] = [];
      if (student.skills_json) {
        try {
          studentSkills = typeof student.skills_json === "string" ? JSON.parse(student.skills_json) : student.skills_json;
        } catch (e) {
          if (typeof student.skills_json === "string") {
            studentSkills = student.skills_json.split(",").map((s: string) => s.trim());
          }
        }
      }
      const candSkills = studentSkills.map((s: string) => s.toLowerCase().trim()).filter(Boolean);

      let skillsScore = 0;
      const matchedSkills: string[] = [];
      const missingSkills: string[] = [];

      if (reqSkills.length > 0) {
        reqSkills.forEach((skill: string) => {
          const hasSkill = candSkills.some((cs: string) => cs.includes(skill) || skill.includes(cs));
          if (hasSkill) {
            matchedSkills.push(skill);
          } else {
            missingSkills.push(skill);
          }
        });
        skillsScore = (matchedSkills.length / reqSkills.length) * 40;
      } else {
        skillsScore = 40;
      }

      // 2. Resume/profile keyword match: 25%
      let studentText = [
        student.full_name,
        student.headline,
        student.bio,
        student.preferred_job_role,
        student.location,
        student.preferred_location
      ].filter(Boolean).join(" ").toLowerCase();

      if (student.projects_json) {
        try {
          const projects = typeof student.projects_json === 'string' ? JSON.parse(student.projects_json) : student.projects_json;
          if (Array.isArray(projects)) {
            projects.forEach((p: any) => {
              studentText += " " + (p.title || "") + " " + (p.description || "") + " " + (p.technologies_json ? JSON.stringify(p.technologies_json) : "");
            });
          }
        } catch(e) {}
      }
      if (student.experience_json) {
        try {
          const exp = typeof student.experience_json === 'string' ? JSON.parse(student.experience_json) : student.experience_json;
          if (Array.isArray(exp)) {
            exp.forEach((e: any) => {
              studentText += " " + (e.company_name || "") + " " + (e.role || "") + " " + (e.description || "");
            });
          }
        } catch(e) {}
      }

      const jobText = [
        job.title,
        job.description,
        job.responsibilities,
        job.qualifications,
        job.additional_notes
      ].filter(Boolean).join(" ").toLowerCase();

      const jobTokens = Array.from(new Set(jobText.split(/[^a-zA-Z0-9+#]+/).filter(token => token.length >= 3)));
      let keywordMatchCount = 0;
      let keywordScore = 0;

      if (jobTokens.length > 0) {
        jobTokens.forEach((token: string) => {
          if (studentText.includes(token)) {
            keywordMatchCount++;
          }
        });
        const keywordOverlapRatio = keywordMatchCount / Math.min(25, jobTokens.length);
        keywordScore = Math.min(25, keywordOverlapRatio * 25);
      } else {
        keywordScore = 25;
      }

      // 3. Role/title relevance: 15%
      let roleScore = 0;
      const jobTitleLower = (job.title || "").toLowerCase();
      const prefRoleLower = (student.preferred_job_role || "").toLowerCase();
      const headlineLower = (student.headline || "").toLowerCase();

      if (jobTitleLower && (prefRoleLower || headlineLower)) {
        const overlap1 = prefRoleLower ? (jobTitleLower.includes(prefRoleLower) || prefRoleLower.includes(jobTitleLower)) : false;
        const overlap2 = headlineLower ? (jobTitleLower.includes(headlineLower) || headlineLower.includes(jobTitleLower)) : false;

        if (overlap1 && overlap2) {
          roleScore = 15;
        } else if (overlap1 || overlap2) {
          roleScore = 12;
        } else {
          const titleWords = jobTitleLower.split(/\s+/).filter(w => w.length > 2);
          const studentRoleWords = (prefRoleLower + " " + headlineLower).split(/\s+/).filter(w => w.length > 2);
          const matches = titleWords.filter(w => studentRoleWords.includes(w));
          if (matches.length > 0) {
            roleScore = Math.min(15, 5 + matches.length * 3);
          } else {
            roleScore = 0;
          }
        }
      } else {
        roleScore = 5;
      }

      // 4. Experience/projects/certifications: 10%
      let expScore = 0;
      if (student.experience_json) {
        try {
          const exp = typeof student.experience_json === 'string' ? JSON.parse(student.experience_json) : student.experience_json;
          if (Array.isArray(exp) && exp.length > 0) expScore += 4;
        } catch(e) {}
      }
      if (student.projects_json) {
        try {
          const proj = typeof student.projects_json === 'string' ? JSON.parse(student.projects_json) : student.projects_json;
          if (Array.isArray(proj) && proj.length > 0) expScore += 4;
        } catch(e) {}
      }
      if (student.resume_url) {
        expScore += 2;
      }
      expScore = Math.min(10, expScore);

      // 5. Talent/assessment score: 10%
      let tScore = student.talent_score || 0;
      if (!tScore) {
        const scores = [student.pq_score, student.iq_score, student.eq_score, student.sq_score].filter(s => s !== null && s !== undefined);
        if (scores.length > 0) {
          tScore = scores.reduce((sum, val) => sum + val, 0) / scores.length;
        }
      }
      const talentScoreResult = Math.min(10, (tScore / 100) * 10);

      const matchScore = Math.round(skillsScore + keywordScore + roleScore + expScore + talentScoreResult);

      // Check match score ranges
      if (matchScore < minMatch || matchScore > maxMatch) {
        continue;
      }

      // Applied status
      let appliedStatus = "Not Applied";
      if (student.application_id) {
        if (student.application_status === 'IN_PROGRESS' || student.application_status === 'SELECTED') {
          appliedStatus = "Already in Pipeline";
        } else {
          appliedStatus = "Already Applied";
        }
      }

      // Resume check
      const resumeAvailable = !!(student.resume_url || student.resume_builder_json);

      // --- FILTERS ---
      // Skills Filter
      if (filters.skills && Array.isArray(filters.skills) && filters.skills.length > 0) {
        const querySkills = filters.skills.map((s: string) => s.toLowerCase().trim()).filter(Boolean);
        const hasMatchingSkill = querySkills.some((qs: string) => candSkills.some((cs: string) => cs.includes(qs)));
        if (!hasMatchingSkill) continue;
      }

      // Location Filter
      if (filters.location && typeof filters.location === 'string' && filters.location.trim().length > 0) {
        const filterLoc = filters.location.toLowerCase().trim();
        const candLoc = (student.location || "").toLowerCase() + " " + (student.preferred_location || "").toLowerCase();
        if (!candLoc.includes(filterLoc)) continue;
      }

      // College Filter
      if (filters.college && typeof filters.college === 'string' && filters.college.trim().length > 0) {
        const filterCol = filters.college.toLowerCase().trim();
        const candCol = (student.college_name || "").toLowerCase();
        if (!candCol.includes(filterCol)) continue;
      }

      // Resume Available Filter
      if (filters.resumeAvailable === true && !resumeAvailable) {
        continue;
      }

      // Not Applied Only Filter
      if (filters.notAppliedOnly === true && student.application_id) {
        continue;
      }

      candidates.push({
        studentId: student.id,
        userId: student.user_id,
        fullName: student.full_name || "Anonymous Candidate",
        email: student.email,
        profilePhotoUrl: student.profile_photo_url || "",
        college: student.college_name || "N/A",
        location: student.location || "N/A",
        matchScore: matchScore,
        matchedSkills: matchedSkills,
        missingSkills: missingSkills,
        resumeAvailable: resumeAvailable,
        profileCompleteness: student.completeness_score || 0,
        talentScore: student.talent_score || Math.round(tScore) || 0,
        alreadyApplied: !!student.application_id,
        appliedStatus: appliedStatus,
        alreadyNotified: notifiedUserIds.has(student.user_id),
        recommendationReason: "" // Filled next
      });
    }

    // Sort by match score desc
    candidates.sort((a, b) => b.matchScore - a.matchScore);

    // Limit candidates
    const slicedCandidates = candidates.slice(0, limit);

    // Generate recommendation reasons for top candidates
    for (const cand of slicedCandidates) {
      cand.recommendationReason = await generateRecommendationReason(
        job.title,
        job.description,
        cand.fullName,
        cand.matchedSkills,
        cand.matchScore
      );
    }

    res.json({
      success: true,
      data: {
        job: {
          id: job.id,
          title: job.title,
          location: job.location,
          job_type: job.job_type,
          skills_json: job.skills_json,
          status: job.status,
          created_at: job.created_at
        },
        candidates: slicedCandidates
      }
    });

  } catch (error: any) {
    console.error("Error matching candidates:", error);
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message || "Error calculating candidate matches." });
  }
});

// 3. POST /api/companies/recommendations/:jobId/notify
router.post("/recommendations/:jobId/notify", authenticate, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const { candidateUserIds, message: customMessage, candidateDetails = {} } = req.body;
    const ctx = await getCompanyContext(req, "Send Recommendation Notifications");

    if (!Array.isArray(candidateUserIds) || candidateUserIds.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid candidate user IDs list." });
    }

    // Get company details
    const [profiles]: any = await db.query("SELECT * FROM company_profiles WHERE id = ?", [ctx.companyId]);
    if (!profiles[0]) {
      return res.status(404).json({ success: false, message: "Company profile not found." });
    }
    const company = profiles[0];

    // Verify job belongs to company
    const [jobs]: any = await db.query("SELECT * FROM jobs WHERE id = ? AND company_id = ?", [jobId, ctx.companyId]);
    if (!jobs[0]) {
      return res.status(404).json({ success: false, message: "Job not found or access denied." });
    }
    const job = jobs[0];

    const insertedCandidateUserIds: number[] = [];
    const alreadyNotifiedCandidateUserIds: number[] = [];
    const failedCandidateUserIds: number[] = [];

    for (const candUserId of candidateUserIds) {
      const numUserId = Number(candUserId);
      if (!numUserId) continue;

      // Check for duplicate
      const [existingNotif]: any = await db.query(
        "SELECT id FROM recommendation_notifications WHERE job_id = ? AND student_user_id = ?",
        [jobId, numUserId]
      );
      if (existingNotif.length > 0) {
        alreadyNotifiedCandidateUserIds.push(numUserId);
        continue;
      }

      // Fetch student details
      const [studentData]: any = await db.query(`
        SELECT SP.full_name, U.email 
        FROM users U
        LEFT JOIN student_profiles SP ON U.id = SP.user_id
        WHERE U.id = ?
      `, [numUserId]);

      if (studentData.length === 0) {
        failedCandidateUserIds.push(numUserId);
        continue;
      }
      const student = studentData[0];

      const details = candidateDetails[candUserId] || {};
      const matchScore = details.matchScore || 0;
      const matchedSkillsJson = details.matchedSkills ? JSON.stringify(details.matchedSkills) : null;
      const recommendationReason = details.recommendationReason || null;

      // Track notification
      await db.query(`
        INSERT INTO recommendation_notifications 
        (company_id, job_id, student_user_id, match_score, matched_skills_json, recommendation_reason, notification_status, notified_at, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'SENT', CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
      `, [ctx.companyId, jobId, numUserId, matchScore, matchedSkillsJson, recommendationReason, ctx.userId]);

      insertedCandidateUserIds.push(numUserId);

      // Create platform notification
      const notificationTitle = `Company Interest: ${company.company_name} is interested in your profile`;
      const notificationBody = `${company.company_name} found your profile suitable for the role "${job.title}". You have a strong match for this position. Kindly review the job and apply through VEGA.`;

      await db.query(`
        INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
        VALUES (?, ?, ?, 'INFO', 0, CURRENT_TIMESTAMP)
      `, [numUserId, notificationTitle, notificationBody]);

      // Send Email
      const emailSubject = `Recruitment Interest: ${job.title} at ${company.company_name}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5; margin-bottom: 20px;">Recruitment Interest Notification</h2>
          <p>Hello <strong>${student.full_name || "Candidate"}</strong>,</p>
          <p>We are pleased to inform you that <strong>${company.company_name}</strong> is interested in your profile for the position of <strong>${job.title}</strong>!</p>
          
          <div style="background-color: #f7fafc; border-left: 4px solid #4f46e5; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #4a5568; font-size: 14px;">
              ${customMessage || `"${company.company_name} found your profile suitable for the role ${job.title}. You have a strong match for this position. Kindly review the job and apply through VEGA."`}
            </p>
          </div>

          <p>Please click the button below to view the job posting and submit your application if you are interested.</p>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/jobs?search=${encodeURIComponent(job.title)}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Job Post & Apply</a>
          </div>

          <p style="color: #718096; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            This is an automated message from VEGA. Please do not reply directly to this email.
          </p>
        </div>
      `;

      try {
        await enqueueEmail({
          to: student.email,
          subject: emailSubject,
          html: emailHtml,
          dedupeKey: `company-interest:${ctx.companyId}:${numUserId}`,
        });
      } catch (err) {
        console.error("Error sending interest email:", err);
      }
    }

    await logCompanyAudit(
      ctx.companyId,
      ctx.userId,
      ctx.actorName,
      ctx.roleType,
      "NOTIFY_RECOMMENDED_CANDIDATES",
      "Hiring Copilot",
      `Notified ${insertedCandidateUserIds.length} candidate(s) for job "${job.title}".`,
      "jobs",
      Number(jobId),
      { candidateUserIds: insertedCandidateUserIds }
    );

    res.json({
      success: true,
      message: `Interest notifications sent to ${insertedCandidateUserIds.length} candidate(s).`,
      insertedCandidateUserIds,
      alreadyNotifiedCandidateUserIds,
      failedCandidateUserIds,
      insertedCount: insertedCandidateUserIds.length
    });
  } catch (error: any) {
    console.error("Error sending interest notifications:", error);
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message || "Error sending interest notifications." });
  }
});

// 4. GET /api/companies/recommendations/notified
router.get("/recommendations/notified", authenticate, async (req: any, res) => {
  try {
    const ctx = await getCompanyContext(req, "Recommendations View");
    const { jobId, search } = req.query;

    const cleanJobId = (jobId && jobId !== "undefined" && jobId !== "null" && String(jobId).trim() !== "") ? String(jobId).trim() : null;

    let query = `
      SELECT 
        RN.id as notification_id,
        RN.company_id,
        RN.job_id,
        RN.student_user_id,
        RN.match_score,
        RN.matched_skills_json,
        RN.recommendation_reason,
        RN.notification_status,
        RN.notified_at,
        RN.created_by,
        J.title as job_title,
        J.location as job_location,
        SP.id as student_id,
        SP.full_name as student_name,
        SP.location as student_location,
        SP.skills_json as student_skills_json,
        CM.college_name,
        U_cand.email as student_email,
        U_notifier.email as notifier_email,
        CHP.designation as notifier_designation,
        CHP.role_type as notifier_role_type
      FROM recommendation_notifications RN
      JOIN jobs J ON RN.job_id = J.id
      JOIN users U_cand ON RN.student_user_id = U_cand.id
      LEFT JOIN student_profiles SP ON U_cand.id = SP.user_id
      LEFT JOIN college_master CM ON SP.college_id = CM.id
      LEFT JOIN users U_notifier ON RN.created_by = U_notifier.id
      LEFT JOIN company_hr_profiles CHP ON RN.created_by = CHP.user_id AND CHP.company_id = RN.company_id
      WHERE RN.company_id = ?
    `;
    const params: any[] = [ctx.companyId];

    if (cleanJobId) {
      query += ` AND RN.job_id = ?`;
      params.push(cleanJobId);
    }

    if (ctx.isSubHr) {
      const [assignments]: any = await db.query(
        "SELECT job_id FROM company_job_assignments WHERE company_id = ? AND assigned_hr_user_id = ?",
        [ctx.companyId, ctx.userId]
      );
      if (assignments.length > 0) {
        const assignedJobIds = assignments.map((a: any) => a.job_id);
        query += ` AND RN.job_id IN (${assignedJobIds.map(() => '?').join(',')})`;
        params.push(...assignedJobIds);
      } else {
        query += ` AND 1 = 0`;
      }
    }

    if (search && String(search).trim()) {
      const searchTerm = `%${String(search).trim()}%`;
      query += ` AND (SP.full_name LIKE ? OR U_cand.email LIKE ? OR J.title LIKE ?)`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY RN.notified_at DESC`;

    const [notifiedRows]: any = await db.query(query, params);

    const data = notifiedRows.map((row: any) => {
      let matchedSkills: string[] = [];
      if (row.matched_skills_json) {
        try {
          matchedSkills = typeof row.matched_skills_json === 'string' ? JSON.parse(row.matched_skills_json) : row.matched_skills_json;
        } catch(e) {}
      } else if (row.student_skills_json) {
        try {
          matchedSkills = typeof row.student_skills_json === 'string' ? JSON.parse(row.student_skills_json) : row.student_skills_json;
        } catch(e) {}
      }

      let notifierLabel = "System Admin";
      if (row.notifier_email) {
        if (row.notifier_designation) {
          notifierLabel = `${row.notifier_designation} (${row.notifier_email})`;
        } else if (row.notifier_role_type === "SUB_HR") {
          notifierLabel = `Sub HR (${row.notifier_email})`;
        } else {
          notifierLabel = `Super HR (${row.notifier_email})`;
        }
      } else if (row.created_by) {
        notifierLabel = `Recruiter (ID ${row.created_by})`;
      } else {
        notifierLabel = "Not recorded";
      }

      return {
        notificationId: row.notification_id,
        jobId: row.job_id,
        jobTitle: row.job_title || "Job Requirement",
        jobLocation: row.job_location || "Remote",
        studentId: row.student_id,
        studentUserId: row.student_user_id,
        studentName: row.student_name || "Anonymous Student",
        studentEmail: row.student_email || "N/A",
        studentLocation: row.student_location || "N/A",
        collegeName: row.college_name || "N/A",
        matchScore: row.match_score !== null && row.match_score !== undefined && row.match_score > 0 ? row.match_score : "Not recorded",
        matchedSkills,
        recommendationReason: row.recommendation_reason || "Not recorded",
        notifiedAt: row.notified_at,
        notificationStatus: row.notification_status || "Already Notified",
        notifiedBy: notifierLabel,
        notifierRole: row.notifier_role_type || (row.notifier_designation ? "SUB_HR" : "SUPER_HR")
      };
    });

    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching notified recommendations:", error);
    res.status(Number(error?.statusCode) || 500).json({ success: false, message: error.message || "Error fetching notified candidates." });
  }
});


export default router;

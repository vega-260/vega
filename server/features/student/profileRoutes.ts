import express from "express";
import db from "../../db.ts";
import { authenticate, authorize, requireSelfParam } from "../../middleware/auth.ts";
const router = express.Router();
import { calculateTalentScore, updateDailyTask, updateLoginStreak } from "../../services/analyticsService.ts";
import { getStudentMetrics } from "./studentMetrics.ts";
// Get Profile (Comprehensive)
router.get("/profile/:userId", authenticate, authorize(["STUDENT", "ADMIN", "SUPER_ADMIN"]), requireSelfParam("userId"), async (req, res) => {
  const { userId } = req.params;
  try {
    await updateLoginStreak(Number(userId));
    const [profiles]: any = await db.query(
      `SELECT sp.*, COALESCE(sp.college_id, b.college_id) as actual_college_id, 
              COALESCE(b.batch_name, sp.batch) as actual_batch_name, 
              cm.college_name 
       FROM student_profiles sp 
       LEFT JOIN student_batch sb ON sp.id = sb.student_id 
       LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id 
       LEFT JOIN college_master cm ON COALESCE(sp.college_id, b.college_id) = cm.id 
       WHERE sp.user_id = ?`,
      [userId]
    );
    if (profiles.length === 0) {
      // Fallback: Create profile if missing
      const [users]: any = await db.query("SELECT id FROM users WHERE id = ? AND role = 'STUDENT'", [userId]);
      if (users.length > 0) {
        const tbId = `TB-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
        await db.query("INSERT INTO student_profiles (user_id, tb_id, profile_visibility) VALUES (?, ?, 'PUBLIC')", [userId, tbId]);
        const [newProfiles]: any = await db.query(
          `SELECT sp.*, COALESCE(sp.college_id, b.college_id) as actual_college_id, 
                  COALESCE(b.batch_name, sp.batch) as actual_batch_name, 
                  cm.college_name 
           FROM student_profiles sp 
           LEFT JOIN student_batch sb ON sp.id = sb.student_id 
           LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id 
           LEFT JOIN college_master cm ON COALESCE(sp.college_id, b.college_id) = cm.id 
           WHERE sp.user_id = ?`,
          [userId]
        );
        profiles.push(newProfiles[0]);
      } else {
        return res.json({ success: true, data: null });
      }
    }
    
    let profile = profiles[0];
    if (profile) {
      profile.college_id = profile.actual_college_id || profile.college_id;
      profile.batch_name = profile.actual_batch_name || profile.batch || '';
      profile.batch = profile.actual_batch_name || profile.batch || '';
    }
    if (!profile.tb_id) {
      const tbId = `TB-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      await db.query("UPDATE student_profiles SET tb_id = ? WHERE id = ?", [tbId, profile.id]);
      profile.tb_id = tbId;
    }
    if (!profile.profile_visibility) {
      await db.query("UPDATE student_profiles SET profile_visibility = 'PUBLIC' WHERE id = ?", [profile.id]);
      profile.profile_visibility = 'PUBLIC';
    }
    const [visRows]: any = await db.query("SELECT * FROM student_visibility WHERE student_id = ?", [profile.id]);
    if (visRows.length === 0) {
      await db.query("INSERT INTO student_visibility (student_id, visibility) VALUES (?, 'PUBLIC')", [profile.id]);
    }

    // Fetch related data
    const [education]: any = await db.query("SELECT * FROM student_education WHERE student_id = ? ORDER BY start_date DESC", [profile.id]);
    const [projects]: any = await db.query("SELECT * FROM student_projects WHERE student_id = ? ORDER BY created_at DESC", [profile.id]);
    const [experience]: any = await db.query("SELECT * FROM student_experience WHERE student_id = ? ORDER BY start_date DESC", [profile.id]);
    const [certifications]: any = await db.query("SELECT * FROM student_certifications WHERE student_id = ? ORDER BY created_at DESC", [profile.id]);
    const [extracurriculars]: any = await db.query("SELECT * FROM extracurricular_activities WHERE user_id = ? ORDER BY activity_date DESC, id DESC", [userId]);

    let score = 0;
    if (profile.full_name && profile.contact && profile.location && profile.profile_photo_url) score += 15;
    if (profile.preferred_job_role && profile.preferred_location) score += 10;
    
    let eduCount = education.length;
    if (eduCount === 0 && profile.education_json) {
       try { const j = JSON.parse(profile.education_json); if(Array.isArray(j)) eduCount = j.length; } catch(e){}
    }
    if (eduCount > 0) score += 15;
    
    let skills = [];
    try { skills = JSON.parse(profile.skills_json || "[]"); } catch(e) {}
    if (skills.length >= 3) score += 15;
    else if (skills.length > 0) score += 5;
    
    let projCount = projects.length;
    if (projCount === 0 && profile.projects_json) {
       try { const j = JSON.parse(profile.projects_json); if(Array.isArray(j)) projCount = j.length; } catch(e){}
    }
    if (projCount > 0) score += 15;
    
    if (profile.bio && profile.bio.length > 40) score += 10;
    if (profile.resume_url) score += 15;
    
    let extraCount = experience.length + certifications.length + extracurriculars.length;
    if (extraCount === 0) {
       const hasExpJson = profile.experience_json && profile.experience_json !== "[]" && profile.experience_json !== "null";
       const hasCertJson = profile.custom_sections_json && profile.custom_sections_json.includes('certifications');
       if (hasExpJson || hasCertJson) extraCount = 1;
    }
    if (extraCount > 0) score += 5;

    // Update if different
    if (profile.completeness_score !== score) {
       await db.query("UPDATE student_profiles SET completeness_score = ? WHERE id = ?", [score, profile.id]);
       profile.completeness_score = score;
       await calculateTalentScore(Number(userId));
    }

    const metrics = await getStudentMetrics(Number(userId));

    res.json({ 
      success: true, 
      data: { 
        ...profile, 
        education, 
        projects, 
        experience, 
        certifications,
        extracurriculars,
        metrics
      } 
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ success: false, message: "Error fetching profile" });
  }
});

// Update Profile Section
router.put("/profile/:userId/section/:section", authenticate, authorize(["STUDENT", "ADMIN", "SUPER_ADMIN"]), requireSelfParam("userId"), async (req, res) => {
  const { userId, section } = req.params;
  const data = req.body;

  try {
    const [profiles]: any = await db.query("SELECT id FROM student_profiles WHERE user_id = ?", [userId]);
    if (profiles.length === 0) return res.status(404).json({ success: false, message: "Profile not found" });
    const studentId = profiles[0].id;

    const parseDate = (d: any): string | null => {
      if (!d) return null;
      const s = String(d).trim();
      if (!s || s === 'null' || s === 'undefined' || s === 'Invalid Date') return null;

      // If already YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

      // If MM/DD/YYYY or DD/MM/YYYY or MM-DD-YYYY
      const parts = s.split(/[\/\-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) { // YYYY/MM/DD
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
        if (parts[2].length === 4) { // MM/DD/YYYY or DD/MM/YYYY
          const year = parts[2];
          const p1 = parseInt(parts[0], 10);
          const p2 = parseInt(parts[1], 10);
          if (p1 > 12) { // DD/MM/YYYY
            return `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
          } else { // MM/DD/YYYY
            return `${year}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
          }
        }
      }

      try {
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } catch {
        // fallback
      }

      return s.split('T')[0] || null;
    };

    const isValidUrl = (urlString?: string | null): boolean => {
      if (!urlString) return true;
      const trimmed = String(urlString).trim();
      if (!trimmed) return true;
      if (/\s/.test(trimmed)) return false;
      const urlPattern = /^(https?:\/\/)?((([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)\.)+[a-zA-Z]{2,}|localhost)(:\d+)?(\/[^\s]*)?$/i;
      if (!urlPattern.test(trimmed)) return false;
      try {
        const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        const parsed = new URL(withProtocol);
        return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
      } catch {
        return false;
      }
    };

    const isValidGrade = (gradeStr?: string | null): boolean => {
      if (!gradeStr) return true;
      const trimmed = String(gradeStr).trim();
      if (!trimmed) return true;

      // Reject URLs or web addresses
      if (
        trimmed.includes("://") ||
        /^https?:\/\//i.test(trimmed) ||
        /www\./i.test(trimmed) ||
        /\.(com|org|net|edu|gov|io|co|in|app|dev|me|ai|tech|online|site)(\/|$|\?)/i.test(trimmed)
      ) {
        return false;
      }

      if (trimmed.length > 50) return false;

      // Letter grades
      const letterGradeRegex = /^(?:grade\s*[:\-]?\s*)?(A\+{1,2}|A\*|A\-|A|B\+|B\-|B|C\+|C\-|C|D\+|D\-|D|E|F|O|S)$/i;
      if (letterGradeRegex.test(trimmed)) return true;

      // Academic classifications
      const standingRegex = /^(?:grade\s*[:\-]?\s*)?(first class with distinction|first class with honours|first class|second class|third class|distinction|first division|second division|third division|pass class|pass|passed|merit|honours|honors|satisfactory|outstanding|excellent|very good|good)$/i;
      if (standingRegex.test(trimmed)) return true;

      // Percentage
      const percentageRegex = /^(?:(?:percentage|score|marks)\s*[:\-]?\s*)?(100(?:\.0{1,2})?|[0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%(?:age)?$/i;
      if (percentageRegex.test(trimmed)) return true;

      // Fraction / scale
      const fractionMatch = trimmed.match(/^(?:(?:cgpa|gpa|grade|score|marks)\s*[:\-]?\s*)?(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?:\s*(?:cgpa|gpa|marks|%))?$/i);
      if (fractionMatch) {
        const score = parseFloat(fractionMatch[1]);
        const total = parseFloat(fractionMatch[2]);
        if (!isNaN(score) && !isNaN(total) && total > 0 && score <= total && score >= 0) return true;
        return false;
      }

      // Numeric GPA / CGPA / Score (0 to 100)
      const numericMatch = trimmed.match(/^(?:(cgpa|gpa|grade|score|marks|percentage)\s*[:\-]?\s*)?(\d+(?:\.\d+)?)(?:\s*(cgpa|gpa|marks|%|percent))?$/i);
      if (numericMatch) {
        const num = parseFloat(numericMatch[2]);
        if (!isNaN(num) && num >= 0 && num <= 100) return true;
      }

      return false;
    };

    if (section === 'personal') {
      const dob = parseDate(data.dob);
      if (data.contact) {
        const cleanContact = String(data.contact).replace(/\D/g, "");
        if (cleanContact.length !== 10) {
          return res.status(400).json({ success: false, message: "Mobile number must be exactly 10 digits." });
        }
      }
      if (data.country && String(data.country).trim()) {
        const countryVal = String(data.country).trim();
        const hasLetters = /[a-zA-Z]/.test(countryVal);
        if (!hasLetters || /^[^\w\s.-]+$/.test(countryVal)) {
          return res.status(400).json({ success: false, message: "Please select a valid country." });
        }
      }
      await db.query(`
        UPDATE student_profiles 
        SET full_name = ?, headline = ?, dob = ?, gender = ?, address = ?, location = ?, contact = ?, profile_photo_url = ?, country = ?
        WHERE id = ?
      `, [data.fullName, data.headline, dob, data.gender, data.address, data.location, data.contact ? String(data.contact).replace(/\D/g, "").slice(0, 10) : "", data.profilePhotoUrl, data.country ? String(data.country).trim() : null, studentId]);
    } 
    else if (section === 'preferences') {
      const isPlaced = data.isPlaced ? 1 : 0;
      const placedCompany = data.isPlaced ? (data.placedCompany || null) : null;
      const isTopPerformer = (data.isPlaced && data.isTopPerformer) ? 1 : 0;

      await db.query(`
        UPDATE student_profiles 
        SET preferred_job_role = ?, preferred_location = ?, availability = ?,
            is_placed = ?, placed_company = ?, is_top_performer = ?
        WHERE id = ?
      `, [
        data.preferredJobRole, 
        data.preferredLocation, 
        data.availability, 
        isPlaced, 
        placedCompany, 
        isTopPerformer, 
        studentId
      ]);
    }
    else if (section === 'onboarding') {
      await db.query(`
        UPDATE student_profiles 
        SET onboarding_completed = ?, 
            onboarding_industry = ?, 
            onboarding_status = ?, 
            onboarding_source = ?, 
            onboarding_help_actions = ?
        WHERE id = ?
      `, [
        data.onboardingCompleted ? 1 : 0, 
        data.onboardingIndustry || null, 
        data.onboardingStatus || null, 
        data.onboardingSource || null, 
        JSON.stringify(data.onboardingHelpActions || []),
        studentId
      ]);
    }
    else if (section === 'skills') {
      await db.query(`UPDATE student_profiles SET skills_json = ? WHERE id = ?`, [JSON.stringify(data.skills), studentId]);
    }
    else if (section === 'summary') {
      const trimmedSummary = data.summary ? String(data.summary).trim() : "";
      if (trimmedSummary.length < 50) {
        return res.status(400).json({ success: false, message: "Profile summary must be at least 50 characters." });
      }
      if (trimmedSummary.length > 5000) {
        return res.status(400).json({ success: false, message: "Profile summary cannot exceed 5000 characters." });
      }
      await db.query(`UPDATE student_profiles SET bio = ? WHERE id = ?`, [trimmedSummary, studentId]);
    }
    else if (section === 'resume') {
      await db.query(`UPDATE student_profiles SET resume_url = ? WHERE id = ?`, [data.resumeUrl, studentId]);
    }
    else if (section === 'education') {
      if (Array.isArray(data.education)) {
        for (const edu of data.education) {
          if (edu.grade && String(edu.grade).trim() && !isValidGrade(edu.grade)) {
            return res.status(400).json({ 
              success: false, 
              message: `Invalid Grade format for "${edu.degree || 'Education'}". Please enter a valid grade, percentage, or CGPA (e.g. 9.8 CGPA, 92%, or A+).` 
            });
          }
        }
      }

      // Transactional replace for simplicity in this dev environment
      await db.query("DELETE FROM student_education WHERE student_id = ?", [studentId]);
      let matchedCollegeId = null;
      let primaryEdu = null;

      if (Array.isArray(data.education)) {
        for (const edu of data.education) {
          // Skip empty entries
          if (!edu.institution || !edu.degree) continue;
          
          const startDate = parseDate(edu.start_date);
          const endDate = parseDate(edu.end_date);
          await db.query(`
            INSERT INTO student_education (student_id, institution, degree, field_of_study, start_date, end_date, grade, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [studentId, String(edu.institution || '').trim(), String(edu.degree || '').trim(), edu.field_of_study ? String(edu.field_of_study).trim() : "", startDate, endDate, edu.grade ? String(edu.grade).trim() : "", edu.description ? String(edu.description).trim() : ""]);

          if (!primaryEdu) {
            primaryEdu = edu;
          }
        }

        // Try dynamically matching institutional names with colleges registered in college_master
        const degreeOrHigherEdu = data.education.find((e: any) => 
          e.degree && !["High School", "10th", "SSC", "Metric", "Matriculation"].includes(e.degree) && e.institution
        ) || primaryEdu;

        if (degreeOrHigherEdu && degreeOrHigherEdu.institution) {
          const instName = String(degreeOrHigherEdu.institution).trim().toLowerCase();
          const [collegesList]: any = await db.query("SELECT id, college_name FROM college_master WHERE status = 'ACTIVE'");
          
          const matched = collegesList.find((c: any) => {
            const name = c.college_name.toLowerCase();
            return instName.includes(name) || name.includes(instName) || 
                   instName.replace(/[^a-z0-9]/g, '').includes(name.replace(/[^a-z0-9]/g, '')) ||
                   name.replace(/[^a-z0-9]/g, '').includes(instName.replace(/[^a-z0-9]/g, ''));
          });

          if (matched) {
            matchedCollegeId = matched.id;
          }
        }
      }

      const collegeEduForJson = data.education?.find((e: any) => 
        e.degree && !["High School", "10th", "SSC", "Metric", "Matriculation"].includes(e.degree)
      ) || primaryEdu;

      const eduJson = collegeEduForJson ? { department: collegeEduForJson.field_of_study || 'General', year: 'Final Year' } : null;
      if (matchedCollegeId) {
        await db.query(
          "UPDATE student_profiles SET college_id = ?, education_json = ? WHERE id = ?",
          [matchedCollegeId, eduJson ? JSON.stringify(eduJson) : null, studentId]
        );
      } else {
        await db.query(
          "UPDATE student_profiles SET education_json = ? WHERE id = ?",
          [eduJson ? JSON.stringify(eduJson) : null, studentId]
        );
      }
    }
    else if (section === 'projects') {
      await db.query("DELETE FROM student_projects WHERE student_id = ?", [studentId]);
      if (Array.isArray(data.projects)) {
        const seen = new Set<string>();
        for (const proj of data.projects) {
          if (!proj.title?.trim()) continue;
          const dedupKey = `${proj.title.trim().toLowerCase()}||${proj.link?.trim() || ''}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          await db.query(`
            INSERT INTO student_projects (student_id, title, description, tech_stack, link, github_link)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [studentId, proj.title.trim(), proj.description?.trim() || "", proj.techStack?.trim() || "", proj.link?.trim() || "", proj.githubLink?.trim() || ""]);
        }
      }
    }
    else if (section === 'experience') {
      await db.query("DELETE FROM student_experience WHERE student_id = ?", [studentId]);
      if (Array.isArray(data.experience)) {
        const seen = new Set<string>();
        for (const exp of data.experience) {
          if (!exp.company?.trim() || !exp.role?.trim()) continue;
          
          const startDate = parseDate(exp.start_date);
          const endDate = parseDate(exp.end_date);
          const dedupKey = `${exp.company.trim().toLowerCase()}||${exp.role.trim().toLowerCase()}||${startDate || ''}||${endDate || ''}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          await db.query(`
            INSERT INTO student_experience (student_id, company, role, location, start_date, end_date, is_current, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [studentId, exp.company.trim(), exp.role.trim(), exp.location?.trim() || "", startDate, endDate, exp.isCurrent ? 1 : 0, exp.description?.trim() || ""]);
        }
      }
    }
    else if (section === 'certifications') {
      if (Array.isArray(data.certifications)) {
        for (const cert of data.certifications) {
          if (cert.credentialUrl && cert.credentialUrl.trim() && !isValidUrl(cert.credentialUrl)) {
            return res.status(400).json({ 
              success: false, 
              message: `Invalid Credential URL format for "${cert.name || 'Certification'}". Please enter a valid URL (e.g., https://example.com/certificate/123).` 
            });
          }
        }
      }
      await db.query("DELETE FROM student_certifications WHERE student_id = ?", [studentId]);
      if (Array.isArray(data.certifications)) {
        const seen = new Set<string>();
        for (const cert of data.certifications) {
          if (!cert.name?.trim() || !cert.issuingOrganization?.trim()) continue;
          
          const issueDate = parseDate(cert.issueDate);
          const expiryDate = parseDate(cert.expiryDate);
          const dedupKey = `${cert.name.trim().toLowerCase()}||${cert.issuingOrganization.trim().toLowerCase()}||${issueDate || ''}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          await db.query(`
            INSERT INTO student_certifications (student_id, name, issuing_organization, issue_date, expiry_date, credential_id, credential_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [studentId, cert.name.trim(), cert.issuingOrganization.trim(), issueDate, expiryDate, cert.credentialId?.trim() || "", cert.credentialUrl ? cert.credentialUrl.trim() : ""]);
        }
      }
    }
    else if (section === 'extracurricular') {
      await db.query("DELETE FROM extracurricular_activities WHERE user_id = ?", [userId]);
      if (Array.isArray(data.extracurriculars)) {
        const seen = new Set<string>();
        for (const act of data.extracurriculars) {
          if (!act.title?.trim() || !act.category?.trim()) continue;
          
          const activityDate = parseDate(act.activity_date);
          const dedupKey = `${act.category.trim().toLowerCase()}||${act.title.trim().toLowerCase()}||${activityDate || ''}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          await db.query(`
            INSERT INTO extracurricular_activities (user_id, category, title, description, organization_name, participation_level, achievement_rank, activity_date, certificate_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [userId, act.category.trim(), act.title.trim(), act.description?.trim() || "", act.organization_name?.trim() || "", act.participation_level?.trim() || "Member", act.achievement_rank?.trim() || "", activityDate, act.certificate_url?.trim() || ""]);
        }
      }
    }

    // Recalculate Completeness Score
    const [finalProfile]: any = await db.query("SELECT * FROM student_profiles WHERE id = ?", [studentId]);
    const [finalEdu]: any = await db.query("SELECT * FROM student_education WHERE student_id = ?", [studentId]);
    const [finalProj]: any = await db.query("SELECT * FROM student_projects WHERE student_id = ?", [studentId]);
    const [finalExp]: any = await db.query("SELECT * FROM student_experience WHERE student_id = ?", [studentId]);
    const [finalCert]: any = await db.query("SELECT * FROM student_certifications WHERE student_id = ?", [studentId]);
    const [finalExtra]: any = await db.query("SELECT * FROM extracurricular_activities WHERE user_id = ?", [userId]);
    
    let score = 0;
    const p = finalProfile[0];
    
    // 1. Personal Info (15%) - Name, Phone, Location, Photo
    if (p.full_name && p.contact && p.location && p.profile_photo_url) score += 15;
    
    // 2. Career Preferences (10%) - Role, Location
    if (p.preferred_job_role && p.preferred_location) score += 10;
    
    // 3. Education (15%) - Must have at least one degree
    let eduCount = finalEdu.length;
    if (eduCount === 0 && p.education_json) {
       try { const j = JSON.parse(p.education_json); if(Array.isArray(j)) eduCount = j.length; } catch(e){}
    }
    if (eduCount > 0) score += 15;
    
    // 4. Skills (15%) - Min 3 skills
    let skills = [];
    try { skills = JSON.parse(p.skills_json || "[]"); } catch(e) {}
    if (skills.length >= 3) score += 15;
    else if (skills.length > 0) score += 5;
    
    // 5. Projects (15%) - At least one
    let projCount = finalProj.length;
    if (projCount === 0 && p.projects_json) {
       try { const j = JSON.parse(p.projects_json); if(Array.isArray(j)) projCount = j.length; } catch(e){}
    }
    if (projCount > 0) score += 15;
    
    // 6. Summary/Bio (10%)
    if (p.bio && p.bio.length > 40) score += 10;
    
    // 7. Resume Upload (15%)
    if (p.resume_url) score += 15;
    
    // 8. Experience or Extracurricular or Certification (5% total)
    let extraCount = finalExp.length + finalCert.length + finalExtra.length;
    if (extraCount === 0) {
       const hasExpJson = p.experience_json && p.experience_json !== "[]" && p.experience_json !== "null";
       const hasCertJson = p.custom_sections_json && p.custom_sections_json.includes('certifications');
       if (hasExpJson || hasCertJson) extraCount = 1;
    }
    if (extraCount > 0) score += 5;

    await db.query("UPDATE student_profiles SET completeness_score = ? WHERE id = ?", [score, studentId]);
    
    await updateDailyTask(Number(userId), 'PROFILE');
    await calculateTalentScore(Number(userId));

    res.json({ success: true, message: "Section updated", score });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ success: false, message: "Error updating profile section" });
  }
});


export default router;

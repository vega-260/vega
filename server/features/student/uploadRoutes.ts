import express from "express";
import db from "../../db.ts";
import { authenticate, authorize, requireSelfParam } from "../../middleware/auth.ts";
const router = express.Router();
import multer from "multer";
import { calculateTalentScore } from "../../services/analyticsService.ts";
import { uploadResume, uploadAvatar, uploadCertificate } from "./uploadConfig.ts";
import { uploadBufferToCloudBucket } from "../../services/storageService.ts";
// Upload Resume File
router.post("/upload-resume/:userId", authenticate, authorize(["STUDENT", "ADMIN", "SUPER_ADMIN"]), requireSelfParam("userId"), (req, res) => {
  uploadResume.single("resume")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: "Resume file is too large. Max size is 5MB." });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    
    const { userId } = req.params;
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const resumeUrl = await uploadBufferToCloudBucket(req.file.buffer, req.file.originalname, req.file.mimetype, "uploads/resumes");
      
      const [profiles]: any = await db.query("SELECT id FROM student_profiles WHERE user_id = ?", [userId]);
      if (profiles.length === 0) return res.status(404).json({ success: false, message: "Profile not found" });
      const studentId = profiles[0].id;

      await db.query("UPDATE student_profiles SET resume_url = ? WHERE id = ?", [resumeUrl, studentId]);

      // Recalculate Completeness Score
      const [finalProfile]: any = await db.query("SELECT * FROM student_profiles WHERE id = ?", [studentId]);
      const [finalEdu]: any = await db.query("SELECT * FROM student_education WHERE student_id = ?", [studentId]);
      const [finalProj]: any = await db.query("SELECT * FROM student_projects WHERE student_id = ?", [studentId]);
      const [finalExp]: any = await db.query("SELECT * FROM student_experience WHERE student_id = ?", [studentId]);
      const [finalCert]: any = await db.query("SELECT * FROM student_certifications WHERE student_id = ?", [studentId]);
      
      let score = 0;
      const p = finalProfile[0];
      
      if (p.full_name && p.contact && p.location && p.profile_photo_url) score += 15;
      if (p.preferred_job_role && p.preferred_location) score += 10;
      let eduCount = finalEdu.length;
      if (eduCount === 0 && p.education_json) {
         try { const j = JSON.parse(p.education_json); if(Array.isArray(j)) eduCount = j.length; } catch(e){}
      }
      if (eduCount > 0) score += 15;
      
      let skills = [];
      try { skills = JSON.parse(p.skills_json || "[]"); } catch(e) {}
      if (skills.length >= 3) score += 15;
      else if (skills.length > 0) score += 5;
      
      let projCount = finalProj.length;
      if (projCount === 0 && p.projects_json) {
         try { const j = JSON.parse(p.projects_json); if(Array.isArray(j)) projCount = j.length; } catch(e){}
      }
      if (projCount > 0) score += 15;
      
      if (p.bio && p.bio.length > 40) score += 10;
      if (p.resume_url) score += 15;
      
      const [finalExtra]: any = await db.query("SELECT * FROM extracurricular_activities WHERE user_id = ?", [userId]);
      let extraCount = finalExp.length + finalCert.length + finalExtra.length;
      if (extraCount === 0) {
         const hasExpJson = p.experience_json && p.experience_json !== "[]" && p.experience_json !== "null";
         const hasCertJson = p.custom_sections_json && p.custom_sections_json.includes('certifications');
         if (hasExpJson || hasCertJson) extraCount = 1;
      }
      if (extraCount > 0) score += 5;

      await db.query("UPDATE student_profiles SET completeness_score = ? WHERE id = ?", [score, studentId]);

      // Recalculate score
      await calculateTalentScore(Number(userId));
      
      res.json({ success: true, resumeUrl, score });
    } catch (error: any) {
      console.error("Resume upload error:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to upload resume" });
    }
  });
});

// Upload Profile Photo
router.post("/upload-avatar/:userId", authenticate, authorize(["STUDENT", "ADMIN", "SUPER_ADMIN"]), requireSelfParam("userId"), (req, res) => {
  uploadAvatar.single("avatar")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: "Profile photo is too large. Max size is 5MB." });
      }
      return res.status(400).json({ success: false, message: err.message });
    }

    const { userId } = req.params;
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const avatarUrl = await uploadBufferToCloudBucket(req.file.buffer, req.file.originalname, req.file.mimetype, "uploads/avatars");
      
      const [profiles]: any = await db.query("SELECT id FROM student_profiles WHERE user_id = ?", [userId]);
      if (profiles.length === 0) return res.status(404).json({ success: false, message: "Profile not found" });
      const studentId = profiles[0].id;

      await db.query("UPDATE student_profiles SET profile_photo_url = ? WHERE id = ?", [avatarUrl, studentId]);
      
      // Recalculate Completeness Score
      const [finalProfile]: any = await db.query("SELECT * FROM student_profiles WHERE id = ?", [studentId]);
      const [finalEdu]: any = await db.query("SELECT * FROM student_education WHERE student_id = ?", [studentId]);
      const [finalProj]: any = await db.query("SELECT * FROM student_projects WHERE student_id = ?", [studentId]);
      const [finalExp]: any = await db.query("SELECT * FROM student_experience WHERE student_id = ?", [studentId]);
      const [finalCert]: any = await db.query("SELECT * FROM student_certifications WHERE student_id = ?", [studentId]);
      
      let score = 0;
      const p = finalProfile[0];
      
      if (p.full_name && p.contact && p.location && p.profile_photo_url) score += 15;
      if (p.preferred_job_role && p.preferred_location) score += 10;
      let eduCount = finalEdu.length;
      if (eduCount === 0 && p.education_json) {
         try { const j = JSON.parse(p.education_json); if(Array.isArray(j)) eduCount = j.length; } catch(e){}
      }
      if (eduCount > 0) score += 15;
      
      let skills = [];
      try { skills = JSON.parse(p.skills_json || "[]"); } catch(e) {}
      if (skills.length >= 3) score += 15;
      else if (skills.length > 0) score += 5;
      
      let projCount = finalProj.length;
      if (projCount === 0 && p.projects_json) {
         try { const j = JSON.parse(p.projects_json); if(Array.isArray(j)) projCount = j.length; } catch(e){}
      }
      if (projCount > 0) score += 15;
      
      if (p.bio && p.bio.length > 40) score += 10;
      if (p.resume_url) score += 15;
      
      const [finalExtra]: any = await db.query("SELECT * FROM extracurricular_activities WHERE user_id = ?", [userId]);
      let extraCount = finalExp.length + finalCert.length + finalExtra.length;
      if (extraCount === 0) {
         const hasExpJson = p.experience_json && p.experience_json !== "[]" && p.experience_json !== "null";
         const hasCertJson = p.custom_sections_json && p.custom_sections_json.includes('certifications');
         if (hasExpJson || hasCertJson) extraCount = 1;
      }
      if (extraCount > 0) score += 5;

      await db.query("UPDATE student_profiles SET completeness_score = ? WHERE id = ?", [score, studentId]);

      // Recalculate score
      await calculateTalentScore(Number(userId));
      
      res.json({ success: true, avatarUrl, score });
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to upload avatar" });
    }
  });
});

router.post("/upload-certificate/:userId", authenticate, authorize(["STUDENT", "ADMIN", "SUPER_ADMIN"]), requireSelfParam("userId"), (req, res) => {
  uploadCertificate.single("certificate")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: "Certificate is too large. Max size is 5MB." });
      }
      return res.status(400).json({ success: false, message: err.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const certificateUrl = await uploadBufferToCloudBucket(req.file.buffer, req.file.originalname, req.file.mimetype, "uploads/certificates");
      res.json({ success: true, certificateUrl });
    } catch (error: any) {
      console.error("Certificate upload error:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to upload certificate" });
    }
  });
});



export default router;

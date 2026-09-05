import express from "express";
import db from "../../db.ts";
import { authenticate, authorize, requireSelfParam } from "../../middleware/auth.ts";
import { deleteCompanyVerificationDocument } from "../../services/companyDocumentService.ts";
const router = express.Router();

const calculateCompleteness = (profile: any, docs: any[]) => {
  let score = 0;
  if (profile.company_name) score += 5; if (profile.logo_url) score += 5; if (profile.website) score += 5; if (profile.company_email && profile.contact_number) score += 5;
  if (profile.business_name) score += 5; if (profile.gst_no) score += 10; if (profile.cin_no || profile.pan_no) score += 5; if (profile.address && profile.city) score += 10;
  if (docs.some(d => d.doc_type === 'GST Certificate')) score += 10; if (docs.some(d => d.doc_type === 'Business Registration Certificate')) score += 10; if (docs.some(d => d.doc_type === 'PAN Card')) score += 10;
  if (profile.about && profile.about.length > 200) score += 10; else if (profile.about && profile.about.length > 50) score += 5;
  if (profile.linkedin_url || profile.github_url) score += 10; return Math.min(100, score);
};
router.get("/profile/:userId", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireSelfParam("userId"), async (req, res) => {
  try {
    let [profiles]: any = await db.query("SELECT * FROM company_profiles WHERE user_id = ?", [req.params.userId]);
    if (!profiles[0]) {
      const [userRow]: any = await db.query("SELECT email FROM users WHERE id = ?", [req.params.userId]);
      if (userRow && userRow.length > 0) {
        const email = userRow[0].email || "";
        const defaultName = email ? email.split("@")[0] : "Company";
        await db.query(
          "INSERT INTO company_profiles (user_id, company_name, company_email, country, status, completeness_score) VALUES (?, ?, ?, 'India', 'PENDING', 0)",
          [req.params.userId, defaultName, email]
        );
        [profiles] = await db.query("SELECT * FROM company_profiles WHERE user_id = ?", [req.params.userId]);
      }
    }
    if (!profiles[0]) {
      return res.json({ success: true, data: null });
    }
    const [docs]: any = await db.query("SELECT * FROM company_documents WHERE company_id = ?", [profiles[0].id]);
    res.json({ success: true, data: { ...profiles[0], documents: docs } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching profile" });
  }
});

// Update Company Profile
router.put("/profile/:userId", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireSelfParam("userId"), async (req, res) => {
  const profile = req.body;
  const userId = req.params.userId;

  // Normalize fields first
  const contact_number = profile.contact_number ? String(profile.contact_number).replace(/\D/g, "").slice(0, 10) : "";
  const company_email = profile.company_email ? String(profile.company_email).trim() : "";
  const pan_no = profile.pan_no ? String(profile.pan_no).toUpperCase().trim() : "";
  const gst_no = profile.gst_no ? String(profile.gst_no).toUpperCase().trim() : "";
  const cin_no = profile.cin_no ? String(profile.cin_no).toUpperCase().trim() : "";

  // Company name validation
  if (!profile.company_name || !String(profile.company_name).trim()) {
    return res.status(400).json({ success: false, message: "Please enter a valid business name." });
  } else {
    const company_name = String(profile.company_name).trim();
    const allowedRegex = /^[a-zA-Z0-9\s.&'()-]+$/;
    const hasAlphanumeric = /[a-zA-Z0-9]/.test(company_name);
    if (!allowedRegex.test(company_name) || !hasAlphanumeric) {
      return res.status(400).json({ success: false, message: "Please enter a valid business name." });
    }
  }

  // Business Name validation (if filled)
  if (profile.business_name && String(profile.business_name).trim()) {
    const business_name = String(profile.business_name).trim();
    const allowedRegex = /^[a-zA-Z0-9\s.&'()-]+$/;
    const hasAlphanumeric = /[a-zA-Z0-9]/.test(business_name);
    if (!allowedRegex.test(business_name) || !hasAlphanumeric) {
      return res.status(400).json({ success: false, message: "Please enter a valid business name." });
    }
  }

  // Contact Validation
  if (profile.contact_number) {
    const cleanContact = String(profile.contact_number).replace(/\D/g, "");
    if (cleanContact.length !== 10) {
      return res.status(400).json({ success: false, message: "Mobile number must be exactly 10 digits." });
    }
  }

  // Email validation
  if (company_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company_email)) {
    return res.status(400).json({ success: false, message: "Please enter a valid official email address." });
  }

  // Website validation
  if (profile.website) {
    const websiteUrl = String(profile.website).trim();
    const urlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
    if (!urlRegex.test(websiteUrl)) {
      return res.status(400).json({ success: false, message: "Please enter a valid website URL." });
    }
  }

  // Country based validations
  if (profile.country === "India") {
    if (pan_no && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan_no)) {
      return res.status(400).json({ success: false, message: "PAN must be in valid format, for example ABCDE1234F." });
    }
    if (gst_no && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst_no)) {
      return res.status(400).json({ success: false, message: "GST number must be a valid 15-character GSTIN." });
    }
    if (cin_no && !/^[A-Z0-9]{21}$/.test(cin_no)) {
      return res.status(400).json({ success: false, message: "CIN must be a valid 21-character company identification number." });
    }
  }

  // City and State validations
  if (profile.city && String(profile.city).trim()) {
    const cityStr = String(profile.city).trim();
    if (!/^[a-zA-Z\s-]+$/.test(cityStr)) {
      return res.status(400).json({ success: false, message: "Please enter a valid city/state name." });
    }
  }
  if (profile.state && String(profile.state).trim()) {
    const stateStr = String(profile.state).trim();
    if (!/^[a-zA-Z\s-]+$/.test(stateStr)) {
      return res.status(400).json({ success: false, message: "Please enter a valid city/state name." });
    }
  }

  // Registration Date / Year established validation
  let year_established = profile.year_established ? parseInt(profile.year_established) : null;
  let registration_date = profile.registration_date ? String(profile.registration_date).trim() : null;

  if (registration_date) {
    const regDateObj = new Date(registration_date);
    if (isNaN(regDateObj.getTime())) {
      return res.status(400).json({ success: false, message: "Company registration date cannot be in the future." });
    }
    const todayStr = new Date().toISOString().split("T")[0];
    if (registration_date > todayStr) {
      return res.status(400).json({ success: false, message: "Company registration date cannot be in the future." });
    }
    year_established = regDateObj.getFullYear();
  } else if (year_established) {
    const currentYear = new Date().getFullYear();
    if (year_established < 1800 || year_established > currentYear) {
      return res.status(400).json({ success: false, message: "Please enter a valid Year Established." });
    }
    registration_date = `${year_established}-01-01`;
  }

  try {
    // Check if profile exists
    const [existing]: any = await db.query("SELECT id FROM company_profiles WHERE user_id = ?", [userId]);
    
    if (existing[0]) {
      await db.query(`
        UPDATE company_profiles 
        SET 
          company_name = ?, logo_url = ?, website = ?, company_email = ?, contact_number = ?,
          company_type = ?, industry = ?, company_size = ?, year_established = ?, registration_date = ?,
          business_name = ?, gst_no = ?, cin_no = ?, pan_no = ?,
          address = ?, operating_address = ?, country = ?, state = ?, city = ?,
          about = ?, services = ?, linkedin_url = ?, github_url = ?,
          entity_type = ?, registry_number = ?, tax_id = ?, state_of_formation = ?, licensing_authority = ?
        WHERE user_id = ?
      `, [
        profile.company_name, profile.logo_url, profile.website, company_email, contact_number,
        profile.company_type, profile.industry, profile.company_size, year_established, registration_date,
        profile.business_name, gst_no, cin_no, pan_no,
        profile.address, profile.operating_address, profile.country, profile.state, profile.city,
        profile.about, profile.services, profile.linkedin_url, profile.github_url,
        profile.entity_type, profile.registry_number, profile.tax_id, profile.state_of_formation, profile.licensing_authority,
        userId
      ]);
    } else {
      await db.query(`
        INSERT INTO company_profiles (
          user_id, company_name, logo_url, website, company_email, contact_number,
          company_type, industry, company_size, year_established, registration_date,
          business_name, gst_no, cin_no, pan_no,
          address, operating_address, country, state, city,
          about, services, linkedin_url, github_url,
          entity_type, registry_number, tax_id, state_of_formation, licensing_authority
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId, profile.company_name, profile.logo_url, profile.website, company_email, contact_number,
        profile.company_type, profile.industry, profile.company_size, year_established, registration_date,
        profile.business_name, gst_no, cin_no, pan_no,
        profile.address, profile.operating_address, profile.country, profile.state, profile.city,
        profile.about, profile.services, profile.linkedin_url, profile.github_url,
        profile.entity_type, profile.registry_number, profile.tax_id, profile.state_of_formation, profile.licensing_authority
      ]);
    }

    // Refresh score
    const [refProf]: any = await db.query("SELECT * FROM company_profiles WHERE user_id = ?", [userId]);
    const [refDocs]: any = await db.query("SELECT * FROM company_documents WHERE company_id = ?", [refProf[0].id]);
    const score = calculateCompleteness(refProf[0], refDocs);
    await db.query("UPDATE company_profiles SET completeness_score = ? WHERE user_id = ?", [score, userId]);

    res.json({ success: true, message: "Profile updated successfully", score });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Update failed" });
  }
});

// Document Upload
router.post("/profile/:userId/documents", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireSelfParam("userId"), async (req, res) => {
  const { doc_type, doc_url } = req.body;
  const userId = req.params.userId;

  if (!doc_type || !doc_url) {
    return res.status(400).json({ success: false, message: "Document type and document content are required." });
  }

  try {
    let [profiles]: any = await db.query("SELECT id FROM company_profiles WHERE user_id = ?", [userId]);
    if (!profiles[0]) {
      const [userRow]: any = await db.query("SELECT email FROM users WHERE id = ?", [userId]);
      const email = userRow?.[0]?.email || "";
      const defaultName = email ? email.split("@")[0] : "Company";
      await db.query(
        "INSERT INTO company_profiles (user_id, company_name, company_email, country, status, completeness_score) VALUES (?, ?, ?, 'India', 'PENDING', 0)",
        [userId, defaultName, email]
      );
      [profiles] = await db.query("SELECT id FROM company_profiles WHERE user_id = ?", [userId]);
    }

    const companyId = profiles[0].id;

    // Check if document of this type already exists, if so delete/replace
    await db.query("DELETE FROM company_documents WHERE company_id = ? AND (doc_type = ? OR LOWER(doc_type) = LOWER(?))", [companyId, doc_type, doc_type]);
    
    await db.query("INSERT INTO company_documents (company_id, doc_type, doc_url) VALUES (?, ?, ?)", [companyId, doc_type, doc_url]);

    // Recalculate score
    const [refProf]: any = await db.query("SELECT * FROM company_profiles WHERE user_id = ?", [userId]);
    const [refDocs]: any = await db.query("SELECT * FROM company_documents WHERE company_id = ?", [companyId]);
    const score = calculateCompleteness(refProf[0], refDocs);
    await db.query("UPDATE company_profiles SET completeness_score = ? WHERE user_id = ?", [score, userId]);

    res.json({ success: true, message: "Document uploaded successfully", score, documents: refDocs });
  } catch (error) {
    console.error("Document upload failed:", error);
    res.status(500).json({ success: false, message: "Document upload failed" });
  }
});


// Delete a verification document with server-side company ownership and storage cleanup.
router.delete("/profile/:userId/documents/:type", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireSelfParam("userId"), async (req: any, res) => {
  try {
    const actorUserId = Number(req.user?.userId);
    const result = await deleteCompanyVerificationDocument({
      userId: actorUserId,
      actorRole: String(req.user?.role || "COMPANY"),
      actorName: req.user?.email || "Company Representative",
      docIdentifier: String(req.params.type || ""),
    });
    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("Company document deletion failed:", error);
    return res.status(500).json({ success: false, message: "Document deletion failed" });
  }
});

// Submit for Verification
router.post("/profile/:userId/submit", authenticate, authorize(["COMPANY", "ADMIN", "SUPER_ADMIN"]), requireSelfParam("userId"), async (req, res) => {
  try {
    const [profiles]: any = await db.query("SELECT * FROM company_profiles WHERE user_id = ?", [req.params.userId]);
    if (!profiles[0]) return res.status(404).json({ success: false, message: "Profile not found" });

    const [docs]: any = await db.query("SELECT * FROM company_documents WHERE company_id = ?", [profiles[0].id]);
    const score = calculateCompleteness(profiles[0], docs);

    if (score < 80) {
      return res.status(400).json({ success: false, message: "Profile incompleteness. Must reach 80% with required documents." });
    }

    await db.query("UPDATE company_profiles SET status = 'PENDING', is_submitted = 1, completeness_score = ? WHERE user_id = ?", [score, req.params.userId]);
    res.json({ success: true, message: "Profile submitted for verification" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Submission failed" });
  }
});


export default router;

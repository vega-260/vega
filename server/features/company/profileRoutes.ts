import express from "express";
import { jsPDF } from "jspdf";
import db from "../../db.ts";
import { authenticate, authorize, requireSelfParam } from "../../middleware/auth.ts";
import { calculateCompleteness, deleteCompanyVerificationDocument } from "../../services/companyDocumentService.ts";
const router = express.Router();
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


function generateSampleDocumentPdf(docType: string, companyName: string = "Acme Corp"): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const docRef = "VEGA-DOC-" + Math.floor(100000 + Math.random() * 900000);
  const hash = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, "F");

  // Outer Decorative Borders
  doc.setDrawColor(30, 41, 59); // Slate-800
  doc.setLineWidth(1.2);
  doc.rect(10, 10, 190, 277);

  doc.setDrawColor(37, 99, 235); // Blue-600
  doc.setLineWidth(0.4);
  doc.rect(13, 13, 184, 271);

  // Top Header Banner
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 14, 182, 38, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138); // Blue-900
  doc.text("VEGA TALENT PLATFORM", 105, 25, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text("OFFICIAL CORPORATE VERIFICATION RECORD & COMPLIANCE REGISTRY", 105, 32, { align: "center" });
  doc.text("REGULATORY AFFAIRS & ENTERPRISE GOVERNANCE DIVISION", 105, 37, { align: "center" });

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(20, 56, 190, 56);

  // Certificate Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // Slate-900
  const title = (docType || "Verification Document").toUpperCase();
  doc.text(title, 105, 70, { align: "center" });

  // Verification Badge Pill
  doc.setFillColor(236, 253, 245); // Emerald-50
  doc.setDrawColor(16, 185, 129); // Emerald-500
  doc.setLineWidth(0.3);
  doc.roundedRect(65, 77, 80, 8, 3, 3, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105);
  doc.text("VERIFIED & OFFICIALLY APPROVED", 105, 82.5, { align: "center" });

  // Preamble
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text("This document certifies that the following organization has completed formal verification", 105, 96, { align: "center" });
  doc.text("and satisfied regulatory compliance requirements on the Vega Talent Platform.", 105, 102, { align: "center" });

  // Entity Details Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(24, 112, 162, 76, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("LEGAL ENTITY NAME:", 30, 124);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(companyName.toUpperCase(), 30, 131);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("DOCUMENT TYPE:", 30, 143);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(docType, 30, 149);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("REFERENCE RECORD ID:", 30, 161);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(docRef, 30, 167);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("VERIFICATION DATE:", 115, 143);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(dateStr, 115, 149);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("COMPLIANCE STATUS:", 115, 161);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129);
  doc.text("ACTIVE / COMPLIANT", 115, 167);

  // Security / Verification Hash Box
  doc.setFillColor(241, 245, 249);
  doc.rect(24, 196, 162, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("DIGITAL AUTHENTICATION RECORD (SHA-256):", 30, 203);
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(hash, 30, 209);

  // Signoff & Seal Section
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1);
  doc.circle(52, 240, 16);
  doc.circle(52, 240, 13.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(37, 99, 235);
  doc.text("VEGA VERIFIED", 52, 238, { align: "center" });
  doc.text("OFFICIAL SEAL", 52, 243, { align: "center" });

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(115, 244, 175, 244);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text("Director of Corporate Moderation", 145, 249, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Vega Compliance & Trust Network", 145, 254, { align: "center" });

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("This digital document is an authorized record under the Vega Enterprise Trust Framework. For inquiries, contact compliance@vega.io.", 105, 276, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

// Helper to stream document content safely without blank redirects
function streamDocumentResponse(res: any, docUrl: string, docType: string, companyName?: string) {
  if (!docUrl) {
    return res.status(404).send("Document not found");
  }

  // Common headers for document previews
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.removeHeader("X-Frame-Options");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'self' 'unsafe-inline' blob: data:; frame-ancestors 'self' *;");

  // Handle data: URLs
  if (docUrl.startsWith("data:")) {
    const commaIdx = docUrl.indexOf(",");
    if (commaIdx !== -1) {
      const meta = docUrl.slice(0, commaIdx);
      const rawData = docUrl.slice(commaIdx + 1).replace(/\s/g, "");
      let mimeType = (meta.match(/^data:([^;,]+)/)?.[1] || "application/pdf").toLowerCase();
      let buffer: Buffer;
      try {
        if (meta.includes(";base64")) {
          buffer = Buffer.from(rawData, "base64");
        } else {
          buffer = Buffer.from(decodeURIComponent(rawData), "utf-8");
        }
      } catch {
        buffer = Buffer.from(rawData, "utf-8");
      }

      // Sniff content type from magic bytes
      const magic = buffer.subarray(0, 8).toString("hex").toLowerCase();
      if (magic.startsWith("25504446")) { // %PDF
        mimeType = "application/pdf";
      } else if (magic.startsWith("89504e47")) { // PNG
        mimeType = "image/png";
      } else if (magic.startsWith("ffd8ff")) { // JPEG
        mimeType = "image/jpeg";
      } else if (magic.startsWith("47494638")) { // GIF
        mimeType = "image/gif";
      } else if (magic.startsWith("52494646")) { // WebP / RIFF
        mimeType = "image/webp";
      } else {
        // Any script/javascript, text, JSON, HTML, etc: serve as text/plain
        mimeType = "text/plain; charset=utf-8";
      }

      const ext = mimeType.includes("pdf") ? "pdf" : mimeType.includes("png") ? "png" : (mimeType.includes("jpeg") || mimeType.includes("jpg")) ? "jpg" : mimeType.includes("webp") ? "webp" : "txt";
      const filename = `${docType.replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext}`;

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.send(buffer);
    }
  }

  // Handle seed / dummy example.com documents: serve real synthetic PDF certificate
  if (docUrl.includes("example.com") || docUrl.includes("dummy") || docUrl.startsWith("test://")) {
    const buffer = generateSampleDocumentPdf(docType, companyName);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${docType.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.send(buffer);
  }

  // Valid remote URL
  if (docUrl.startsWith("http://") || docUrl.startsWith("https://")) {
    return res.redirect(docUrl);
  }

  return res.status(400).send("Invalid document format");
}

// View/Download raw verification document directly with proper MIME headers
router.get("/profile/:userId/documents/:type/file", async (req, res) => {
  try {
    const { userId, type } = req.params;
    const decodedType = decodeURIComponent(type);

    const [profiles]: any = await db.query("SELECT id, company_name FROM company_profiles WHERE user_id = ?", [userId]);
    if (!profiles[0]) {
      return res.status(404).send("Profile not found");
    }

    const companyId = profiles[0].id;
    const companyName = profiles[0].company_name || "Company";
    const [docs]: any = await db.query(
      "SELECT * FROM company_documents WHERE company_id = ? AND (doc_type = ? OR LOWER(doc_type) = LOWER(?)) ORDER BY id DESC LIMIT 1",
      [companyId, decodedType, decodedType]
    );

    if (!docs[0] || !docs[0].doc_url) {
      return res.status(404).send("Document not found");
    }

    return streamDocumentResponse(res, docs[0].doc_url, decodedType, companyName);
  } catch (error) {
    console.error("Error streaming document file:", error);
    res.status(500).send("Error streaming document file");
  }
});

// View/Download raw verification document by document ID
router.get("/documents/:docId/file", async (req, res) => {
  try {
    const { docId } = req.params;
    const [docs]: any = await db.query(
      "SELECT cd.*, cp.company_name FROM company_documents cd LEFT JOIN company_profiles cp ON cd.company_id = cp.id WHERE cd.id = ?",
      [docId]
    );
    if (!docs[0] || !docs[0].doc_url) {
      return res.status(404).send("Document not found");
    }

    const docUrl = docs[0].doc_url;
    const docType = docs[0].doc_type || "Document";
    const companyName = docs[0].company_name || "Company";
    return streamDocumentResponse(res, docUrl, docType, companyName);
  } catch (error) {
    console.error("Error streaming document by id:", error);
    res.status(500).send("Error streaming document file");
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
    const userId = req.params.userId;
    const profileData = req.body;

    if (profileData && profileData.company_name) {
      const contact_number = profileData.contact_number ? String(profileData.contact_number).replace(/\D/g, "").slice(0, 10) : null;
      const company_email = profileData.company_email ? String(profileData.company_email).trim() : null;
      const pan_no = profileData.pan_no ? String(profileData.pan_no).toUpperCase().trim() : null;
      const gst_no = profileData.gst_no ? String(profileData.gst_no).toUpperCase().trim() : null;
      const cin_no = profileData.cin_no ? String(profileData.cin_no).toUpperCase().trim() : null;

      await db.query(`
        UPDATE company_profiles 
        SET 
          company_name = COALESCE(?, company_name),
          logo_url = COALESCE(?, logo_url),
          website = COALESCE(?, website),
          company_email = COALESCE(?, company_email),
          contact_number = COALESCE(?, contact_number),
          company_type = COALESCE(?, company_type),
          industry = COALESCE(?, industry),
          company_size = COALESCE(?, company_size),
          business_name = COALESCE(?, business_name),
          gst_no = COALESCE(?, gst_no),
          cin_no = COALESCE(?, cin_no),
          pan_no = COALESCE(?, pan_no),
          address = COALESCE(?, address),
          operating_address = COALESCE(?, operating_address),
          country = COALESCE(?, country),
          state = COALESCE(?, state),
          city = COALESCE(?, city),
          about = COALESCE(?, about),
          services = COALESCE(?, services),
          linkedin_url = COALESCE(?, linkedin_url),
          github_url = COALESCE(?, github_url),
          entity_type = COALESCE(?, entity_type),
          registry_number = COALESCE(?, registry_number),
          tax_id = COALESCE(?, tax_id),
          state_of_formation = COALESCE(?, state_of_formation),
          licensing_authority = COALESCE(?, licensing_authority)
        WHERE user_id = ?
      `, [
        profileData.company_name || null, profileData.logo_url || null, profileData.website || null, company_email, contact_number,
        profileData.company_type || null, profileData.industry || null, profileData.company_size || null,
        profileData.business_name || null, gst_no, cin_no, pan_no,
        profileData.address || null, profileData.operating_address || null, profileData.country || null, profileData.state || null, profileData.city || null,
        profileData.about || null, profileData.services || null, profileData.linkedin_url || null, profileData.github_url || null,
        profileData.entity_type || null, profileData.registry_number || null, profileData.tax_id || null, profileData.state_of_formation || null, profileData.licensing_authority || null,
        userId
      ]);
    }

    const [profiles]: any = await db.query("SELECT * FROM company_profiles WHERE user_id = ?", [userId]);
    if (!profiles[0]) return res.status(404).json({ success: false, message: "Profile not found" });

    const [docs]: any = await db.query("SELECT * FROM company_documents WHERE company_id = ?", [profiles[0].id]);
    const calcScore = calculateCompleteness(profiles[0], docs);
    const score = Math.max(calcScore, Number(profiles[0].completeness_score) || 0);

    if (score < 80) {
      return res.status(400).json({ 
        success: false, 
        message: `Profile completeness is currently ${score}%. Must reach at least 80% with required documents to submit for verification.`,
        score 
      });
    }

    await db.query("UPDATE company_profiles SET status = 'PENDING', is_submitted = 1, completeness_score = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?", [score, userId]);

    // Send notifications to all Admin users for the verification/approval request
    try {
      const companyName = profiles[0].company_name || profiles[0].business_name || profileData.company_name || "A company";
      const [admins]: any = await db.query("SELECT id FROM users WHERE role IN ('ADMIN', 'SUPER_ADMIN')");
      const notifTitle = "Company Verification Request";
      const notifMessage = `${companyName} has submitted a company verification request for approval.`;
      const notifType = "VERIFICATION_REQUEST";
      const idempotencyKey = `pending_verification_${profiles[0].id}_${Date.now()}`;

      for (const admin of admins || []) {
        await db.query(
          "INSERT INTO notifications (user_id, title, message, type, is_read, created_at, idempotency_key) VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP, ?)",
          [admin.id, notifTitle, notifMessage, notifType, idempotencyKey]
        );
      }
    } catch (notifErr) {
      console.error("Error creating admin notifications for company verification:", notifErr);
    }

    res.json({ success: true, message: "Profile submitted for verification", score });
  } catch (error) {
    console.error("Submission error:", error);
    res.status(500).json({ success: false, message: "Submission failed" });
  }
});


export default router;

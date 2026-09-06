import db from "../db.ts";
import { deleteFromStorage } from "./storageService.ts";

export interface DeleteDocumentParams {
  userId: number;
  actorRole: string;
  actorName?: string;
  docIdentifier: string;
}

export interface DeleteDocumentResult {
  success: boolean;
  statusCode: number;
  message: string;
  score?: number;
  documents?: any[];
  code?: string;
}

// Helper to calculate completeness (aligned with company profile requirements)
export function calculateCompleteness(profile: any, docs: any[] = []): number {
  if (!profile) return 0;
  let score = 0;

  // 1. Basic Identity (20%)
  if (profile.company_name) score += 5;
  if (profile.logo_url) score += 5;
  if (profile.website) score += 5;
  if (profile.company_email && profile.contact_number) score += 5;

  const country = profile.country || "India";

  // 2. Business & Legal Details (30%)
  if (profile.business_name) score += 5;
  if (profile.address && profile.city) score += 10;

  // Country specific identifiers (15%)
  if (country === "India") {
    if (profile.gst_no) score += 10;
    if (profile.cin_no || profile.pan_no) score += 5;
  } else {
    let idCount = 0;
    if (profile.tax_id) idCount++;
    if (profile.registry_number) idCount++;
    if (profile.state_of_formation || profile.licensing_authority) idCount++;
    score += Math.min(15, idCount * 8);
  }

  // 3. Verification Documents (30%)
  // Support standard document types: GST Certificate, Business Registration, PAN Card, Incorporation Certificate, etc.
  if (country === "India") {
    const hasGst = docs.some(d => /gst/i.test(d.doc_type));
    const hasReg = docs.some(d => /registration|incorporation/i.test(d.doc_type));
    const hasPan = docs.some(d => /pan/i.test(d.doc_type));
    const hasOther = docs.some(d => !/gst|registration|incorporation|pan/i.test(d.doc_type));

    let docCount = 0;
    if (hasGst) docCount++;
    if (hasReg) docCount++;
    if (hasPan) docCount++;
    if (hasOther) docCount++;
    score += Math.min(30, docCount * 10);
  } else {
    score += Math.min(30, docs.length * 15);
  }

  // 4. Company Narrative & Social (20%)
  if (profile.about && profile.about.length > 200) score += 10;
  else if (profile.about && profile.about.length > 50) score += 5;

  if (profile.linkedin_url || profile.github_url) score += 10;

  return Math.min(100, score);
}

export async function deleteCompanyVerificationDocument(params: DeleteDocumentParams): Promise<DeleteDocumentResult> {
  const { userId, actorRole, actorName, docIdentifier } = params;

  // 1. Role Authorization Check
  const allowedRoles = ["COMPANY", "COMPANY_ADMIN", "COMPANY_HR", "COMPANY_SUB_HR"];
  if (!allowedRoles.includes(actorRole)) {
    return {
      success: false,
      statusCode: 403,
      message: "Access denied: Insufficient company permissions",
      code: "COMPANY_FORBIDDEN"
    };
  }

  // 2. Resolve company context strictly on server using authenticated userId
  let companyId: number | null = null;
  const [hrProfiles]: any = await db.query(
    "SELECT company_id FROM company_hr_profiles WHERE user_id = ?",
    [userId]
  );
  if (hrProfiles && hrProfiles.length > 0) {
    companyId = hrProfiles[0].company_id;
  } else {
    const [profiles]: any = await db.query(
      "SELECT id FROM company_profiles WHERE user_id = ?",
      [userId]
    );
    if (profiles && profiles.length > 0) {
      companyId = profiles[0].id;
    }
  }

  if (!companyId) {
    return {
      success: false,
      statusCode: 403,
      message: "Company profile context not found for authenticated user",
      code: "COMPANY_CONTEXT_REQUIRED"
    };
  }

  // 3. Get company profile record
  const [companyRows]: any = await db.query(
    "SELECT * FROM company_profiles WHERE id = ?",
    [companyId]
  );
  const companyProfile = companyRows[0];
  if (!companyProfile) {
    return {
      success: false,
      statusCode: 403,
      message: "Company profile record not found",
      code: "COMPANY_CONTEXT_REQUIRED"
    };
  }

  // Check company profile lock state
  const companyStatus = String(companyProfile.status || "").toUpperCase();
  const isSubmitted = Number(companyProfile.is_submitted) === 1 || companyProfile.is_submitted === true;

  const lockedCompanyStatuses = ["SUBMITTED", "PENDING", "UNDER_REVIEW", "APPROVED", "VERIFIED"];
  if (isSubmitted && lockedCompanyStatuses.includes(companyStatus)) {
    const isEditable = ["DRAFT", "REJECTED", "UNSUBMITTED", "PENDING_REVERIFICATION", "NOT_SUBMITTED"].includes(companyStatus);
    if (!isEditable) {
      return {
        success: false,
        statusCode: 409,
        message: `Cannot delete document while company profile status is ${companyStatus || 'SUBMITTED'}.`,
        code: "DOCUMENT_DELETION_LOCKED"
      };
    }
  }

  // 4. Locate document record matching company_id and docIdentifier (by id or doc_type)
  let doc: any = null;
  const isNumeric = /^\d+$/.test(docIdentifier.trim());

  if (isNumeric) {
    const [idRows]: any = await db.query(
      "SELECT * FROM company_documents WHERE company_id = ? AND id = ?",
      [companyId, parseInt(docIdentifier.trim(), 10)]
    );
    doc = idRows[0];
  }

  if (!doc) {
    const decodedType = decodeURIComponent(docIdentifier.trim());
    const [typeRows]: any = await db.query(
      "SELECT * FROM company_documents WHERE company_id = ? AND (doc_type = ? OR LOWER(doc_type) = LOWER(?))",
      [companyId, decodedType, decodedType]
    );
    doc = typeRows[0];
  }

  if (!doc) {
    return {
      success: false,
      statusCode: 404,
      message: "Verification document not found",
      code: "DOCUMENT_NOT_FOUND"
    };
  }

  // Check document status
  const docStatus = String(doc.status || "").toUpperCase();
  if (docStatus === "APPROVED" || docStatus === "UNDER_REVIEW") {
    return {
      success: false,
      statusCode: 409,
      message: `Cannot delete document with status ${docStatus}.`,
      code: "DOCUMENT_DELETION_LOCKED"
    };
  }

  // 5. Delete physical storage file via storageService
  if (doc.doc_url) {
    try {
      await deleteFromStorage(doc.doc_url);
    } catch (storageErr) {
      console.error("Non-fatal storage deletion error:", storageErr);
    }
  }

  // 6. Delete document row from database
  await db.query("DELETE FROM company_documents WHERE id = ?", [doc.id]);

  // 7. Fetch remaining documents and recalculate completeness score
  const [remainingDocs]: any = await db.query(
    "SELECT * FROM company_documents WHERE company_id = ?",
    [companyId]
  );
  const newScore = calculateCompleteness(companyProfile, remainingDocs);
  await db.query("UPDATE company_profiles SET completeness_score = ? WHERE id = ?", [newScore, companyId]);

  // 8. Insert audit trail entry
  try {
    await db.query(
      `INSERT INTO company_audit_logs (
        company_id, actor_user_id, actor_name, actor_role, action_type, module, description, target_type, target_id, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        userId,
        actorName || "Company Representative",
        actorRole,
        "VERIFICATION_DOCUMENT_DELETED",
        "VERIFICATION",
        `Verification document (${doc.doc_type}) deleted by user`,
        "COMPANY_DOCUMENT",
        doc.id,
        JSON.stringify({ doc_type: doc.doc_type })
      ]
    );
  } catch (auditErr) {
    console.error("Audit log error:", auditErr);
  }

  return {
    success: true,
    statusCode: 200,
    message: "Document deleted successfully",
    score: newScore,
    documents: remainingDocs
  };
}

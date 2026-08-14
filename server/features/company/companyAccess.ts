import type { Request, Response, NextFunction } from "express";
import { companyRepository } from "./companyRepository.ts";
import { AuthenticationError, AuthorizationError, NotFoundError } from "../../shared/errors.ts";

export async function resolveAuthenticatedCompanyId(req: any): Promise<number | null> {
  if (["ADMIN", "SUPER_ADMIN"].includes(req.user?.role)) return null;
  const userId = Number(req.user?.userId);
  if (!userId) return null;
  const hr = await companyRepository.findHrByUserId(userId);
  if (hr?.company_id) return Number(hr.company_id);
  const profile = await companyRepository.findProfileByUserId(userId);
  return profile?.id ? Number(profile.id) : null;
}

export async function requireOwnedCompanyJob(req: any, res: Response, next: NextFunction) {
  if (["ADMIN", "SUPER_ADMIN"].includes(req.user?.role)) return next();
  const companyId = await resolveAuthenticatedCompanyId(req);
  const jobId = Number(req.params.jobId || req.body?.jobId);
  if (!companyId || !Number.isInteger(jobId) || jobId <= 0) {
    return res.status(403).json({ success: false, message: "Company job access denied" });
  }
  if (!(await companyRepository.jobBelongsToCompany(jobId, companyId))) return res.status(403).json({ success: false, message: "This job does not belong to your company" });
  return next();
}

export async function requireOwnedCompanyTest(req: any, res: Response, next: NextFunction) {
  if (["ADMIN", "SUPER_ADMIN"].includes(req.user?.role)) return next();
  const companyId = await resolveAuthenticatedCompanyId(req);
  const testId = Number(req.params.id);
  if (!companyId || !Number.isInteger(testId) || testId <= 0) return res.status(403).json({ success: false, message: "Test access denied" });
  if (!(await companyRepository.testBelongsToCompany(testId, companyId))) return res.status(403).json({ success: false, message: "This test does not belong to your company" });
  return next();
}

export async function getCompanyContext(req: any, requiredPermission?: string) {
  const userId = Number(req.user?.userId);
  if (!userId) throw new AuthenticationError();
  const hr = await companyRepository.findHrByUserId(userId);
  if (hr) {
    const permissions = JSON.parse(hr.permissions || "[]");
    if (requiredPermission && !permissions.includes(requiredPermission)) throw new AuthorizationError(`Missing ${requiredPermission} permission`);
    const company = await companyRepository.findProfileById(Number(hr.company_id));
    if (!company) throw new NotFoundError("Company profile not found");
    return { isSubHr: true, roleType: "SUB_HR", companyId: hr.company_id, userId, permissions, designation: hr.designation, email: req.user.email, actorName: `${hr.designation || "Sub HR"} (${req.user.email})`, companyName: company.company_name || "Partner Company", companyStatus: company.status || "APPROVED" };
  }
  const company = await companyRepository.findProfileByUserId(userId);
  if (company) {
    return { isSubHr: false, roleType: "SUPER_HR", companyId: company.id, userId, permissions: ["Dashboard View","Jobs View","Create Jobs","Edit Jobs","End Jobs","Applicants View","Pipeline View","Pipeline Manage","Candidate Select/Reject","Candidate Notify","Interview View","Schedule Interviews","Assessments View","Create/Edit Tests","Recommendations View","Send Recommendation Notifications","Drops View","Create/Edit Drops","Analytics View","Company Profile View","Audit Trail View Own","Audit Trail View All","HR Management"], designation: "Super HR", email: req.user.email, actorName: `Super HR (${req.user.email})`, companyName: company.company_name, companyStatus: company.status };
  }
  throw new NotFoundError("Company profile not found");
}

export async function logCompanyAudit(companyId: number, actorUserId: number, actorName: string, actorRole: string, actionType: string, module: string, description: string, targetType: string | null = null, targetId: number | null = null, metadata: any = null) {
  try {
    await companyRepository.insertAudit({ companyId, actorUserId, actorName, actorRole, actionType, module, description, targetType, targetId, metadata });
  } catch (err) {
    console.error("Error logging company audit:", err);
  }
}

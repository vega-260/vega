import db from "../db.ts";

export interface CompanyContext {
  userId: number;
  companyId: number;
  role: string;
  roleType: 'SUPER_HR' | 'SUB_HR';
  isSuperHr: boolean;
  isSubHr: boolean;
  designation?: string;
}

export interface ResolveContextResult {
  success: boolean;
  statusCode: number;
  code?: string;
  error?: string;
  context?: CompanyContext;
}

export interface HrAssignedScope {
  assignedJobIds: Set<number>;
  assignedAppIds: Set<number>;
}

/**
  * Resolves authenticated Company Context strictly from JWT payload (`req.user`).
  * Never trusts request body/query/path parameters for company identification.
  */
export async function resolveAuthenticatedCompanyContext(reqUser: any): Promise<ResolveContextResult> {
  if (!reqUser) {
    return {
      success: false,
      statusCode: 401,
      code: "AUTHENTICATION_REQUIRED",
      error: "Authentication required"
    };
  }

  const userId = reqUser.userId || reqUser.id;
  if (!userId || isNaN(Number(userId))) {
    return {
      success: false,
      statusCode: 401,
      code: "AUTHENTICATION_REQUIRED",
      error: "User is not authenticated."
    };
  }

  const role = String(reqUser.role || '').toUpperCase();
  const forbiddenRoles = ['STUDENT', 'TPO', 'ADMIN', 'SUPER_ADMIN'];
  if (forbiddenRoles.includes(role)) {
    return {
      success: false,
      statusCode: 403,
      code: "COMPANY_ROLE_REQUIRED",
      error: "Access denied: Company role required"
    };
  }

  // 1. Check Sub HR profile first
  try {
    const [hrProfiles]: any = await db.query(
      `SELECT hr.company_id, hr.designation, hr.permissions, u.status as user_status 
       FROM company_hr_profiles hr
       JOIN users u ON hr.user_id = u.id
       WHERE hr.user_id = ?`,
      [userId]
    );

    if (hrProfiles && hrProfiles.length > 0) {
      const hr = hrProfiles[0];
      if (hr.user_status && String(hr.user_status).toUpperCase() !== 'ACTIVE') {
        return {
          success: false,
          statusCode: 403,
          code: "COMPANY_HR_INACTIVE",
          error: "Forbidden: Account is inactive."
        };
      }

      return {
        success: true,
        statusCode: 200,
        context: {
          userId,
          companyId: Number(hr.company_id),
          role: role || 'COMPANY_SUB_HR',
          roleType: 'SUB_HR',
          isSuperHr: false,
          isSubHr: true,
          designation: hr.designation || 'Sub HR'
        }
      };
    }

    // 2. Check Super HR / Main Company Profile
    const [profiles]: any = await db.query(
      `SELECT cp.id as company_id, u.status as user_status 
       FROM company_profiles cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.user_id = ?`,
      [userId]
    );

    if (profiles && profiles.length > 0) {
      const cp = profiles[0];
      if (cp.user_status && String(cp.user_status).toUpperCase() !== 'ACTIVE') {
        return {
          success: false,
          statusCode: 403,
          code: "COMPANY_HR_INACTIVE",
          error: "Forbidden: Account is inactive."
        };
      }

      return {
        success: true,
        statusCode: 200,
        context: {
          userId,
          companyId: Number(cp.company_id),
          role: role || 'COMPANY',
          roleType: 'SUPER_HR',
          isSuperHr: true,
          isSubHr: false,
          designation: 'Super HR'
        }
      };
    }

    return {
      success: false,
      statusCode: 403,
      code: "COMPANY_CONTEXT_REQUIRED",
      error: "Authenticated Company context is required"
    };
  } catch (err: any) {
    console.error("Error resolving company context:", err);
    return {
      success: false,
      statusCode: 500,
      code: "INTERNAL_ERROR",
      error: "Failed to resolve company authorization context"
    };
  }
}

/**
  * Fetches assigned jobs and applications for a Sub HR user within a Company.
  */
export async function getHrAssignedScope(companyId: number, userId: number): Promise<HrAssignedScope> {
  const assignedJobIds = new Set<number>();
  const assignedAppIds = new Set<number>();

  try {
    const [jobAssignments]: any = await db.query(
      "SELECT job_id FROM company_job_assignments WHERE company_id = ? AND assigned_hr_user_id = ?",
      [companyId, userId]
    );
    (jobAssignments || []).forEach((a: any) => assignedJobIds.add(Number(a.job_id)));

    const [appAssignments]: any = await db.query(
      "SELECT application_id, job_id FROM company_application_assignments WHERE company_id = ? AND assigned_hr_user_id = ?",
      [companyId, userId]
    );
    (appAssignments || []).forEach((a: any) => {
      if (a.job_id) assignedJobIds.add(Number(a.job_id));
      if (a.application_id) assignedAppIds.add(Number(a.application_id));
    });
  } catch (err) {
    console.error("Error loading Sub HR assigned scope:", err);
  }

  return { assignedJobIds, assignedAppIds };
}

/**
  * Verifies whether the authenticated company actor can access a job.
  */
export async function canAccessJob(ctx: CompanyContext, jobId: number): Promise<{ canAccess: boolean; job?: any }> {
  try {
    const [jobs]: any = await db.query(
      "SELECT id, company_id, title, status, deadline, ended_at FROM jobs WHERE id = ?",
      [jobId]
    );

    if (!jobs || jobs.length === 0) {
      return { canAccess: false };
    }

    const job = jobs[0];
    if (Number(job.company_id) !== Number(ctx.companyId)) {
      return { canAccess: false };
    }

    if (ctx.isSuperHr) {
      return { canAccess: true, job };
    }

    // Sub HR scope check
    const scope = await getHrAssignedScope(ctx.companyId, ctx.userId);
    if (scope.assignedJobIds.has(Number(jobId))) {
      return { canAccess: true, job };
    }

    // Check if any application in this job is assigned to Sub HR
    const [assignedAppsInJob]: any = await db.query(
      "SELECT id FROM company_application_assignments WHERE company_id = ? AND assigned_hr_user_id = ? AND job_id = ?",
      [ctx.companyId, ctx.userId, jobId]
    );

    if (assignedAppsInJob && assignedAppsInJob.length > 0) {
      return { canAccess: true, job };
    }

    return { canAccess: false, job };
  } catch (err) {
    console.error("Error checking job access:", err);
    return { canAccess: false };
  }
}

/**
  * Verifies whether the authenticated company actor can access a specific application.
  */
export async function canAccessApplication(ctx: CompanyContext, applicationId: number): Promise<{ canAccess: boolean; app?: any }> {
  try {
    const [apps]: any = await db.query(
      `SELECT JA.*, J.title as job_title, J.status as job_status, J.deadline as job_deadline, J.ended_at as job_ended_at, J.company_id
       FROM job_applications JA
       JOIN jobs J ON JA.job_id = J.id
       WHERE JA.id = ?`,
      [applicationId]
    );

    if (!apps || apps.length === 0) {
      return { canAccess: false };
    }

    const app = apps[0];
    if (Number(app.company_id) !== Number(ctx.companyId)) {
      return { canAccess: false };
    }

    if (ctx.isSuperHr) {
      return { canAccess: true, app };
    }

    // Sub HR scope check
    const scope = await getHrAssignedScope(ctx.companyId, ctx.userId);
    if (scope.assignedJobIds.has(Number(app.job_id)) || scope.assignedAppIds.has(Number(applicationId))) {
      return { canAccess: true, app };
    }

    return { canAccess: false, app };
  } catch (err) {
    console.error("Error checking application access:", err);
    return { canAccess: false };
  }
}

/**
  * Utility helper to check if a job recruitment pipeline has ended.
  */
export function isJobEnded(status?: string, deadline?: string | Date, endedAt?: string | Date): boolean {
  const st = String(status || '').toUpperCase();
  if (st === 'CLOSED' || st === 'ENDED' || st === 'FILLED' || st === 'COMPLETED') {
    return true;
  }
  if (endedAt) {
    return true;
  }
  if (deadline) {
    const dl = new Date(deadline);
    dl.setHours(23, 59, 59, 999);
    if (dl.getTime() < Date.now()) {
      return true;
    }
  }
  return false;
}

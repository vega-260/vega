import db from "../db.ts";
import {
  resolveAuthenticatedCompanyContext,
  getHrAssignedScope,
  canAccessJob,
  canAccessApplication
} from "./companyPipelineAuthorizationService.ts";

export interface InterviewAccessResult {
  canAccess: boolean;
  statusCode: number;
  code?: string;
  error?: string;
  schedule?: any;
  isStudent?: boolean;
  isCompany?: boolean;
  isInterviewer?: boolean;
  isSubHr?: boolean;
  companyId?: number;
  studentId?: number;
  studentUserId?: number;
}

/**
 * Resolves authorization access for an interview schedule.
 * Returns 404 for foreign or non-existent interviews to prevent disclosure.
 */
export async function resolveInterviewAccess(
  interviewId: number | string,
  authenticatedUser: any
): Promise<InterviewAccessResult> {
  if (!authenticatedUser || !authenticatedUser.userId) {
    return {
      canAccess: false,
      statusCode: 401,
      code: "UNAUTHORIZED",
      error: "Authentication token required"
    };
  }

  const numInterviewId = Number(interviewId);
  if (isNaN(numInterviewId) || !isFinite(numInterviewId) || numInterviewId <= 0) {
    return {
      canAccess: false,
      statusCode: 400,
      code: "INVALID_INTERVIEW_ID",
      error: "Malformed interview ID"
    };
  }

  try {
    const [uRows]: any = await db.query(
      "SELECT id, role, status FROM users WHERE id = ?",
      [authenticatedUser.userId]
    );
    if (!uRows || uRows.length === 0 || uRows[0].status !== "ACTIVE") {
      return {
        canAccess: false,
        statusCode: 403,
        code: "USER_INACTIVE",
        error: "User account is inactive or disabled"
      };
    }

    const query = `
      SELECT 
        i.id, i.application_id, i.stage_id, i.interview_type, i.scheduled_at, i.status, i.notes,
        i.location_or_link, i.duration, i.interviewer_name, i.instructions,
        a.student_id, a.job_id, j.company_id, j.title as job_title,
        sp.full_name as student_name, sp.user_id as student_user_id,
        cp.company_name
      FROM interview_schedules i
      JOIN job_applications a ON i.application_id = a.id
      JOIN jobs j ON a.job_id = j.id
      JOIN student_profiles sp ON a.student_id = sp.id
      JOIN company_profiles cp ON j.company_id = cp.id
      WHERE i.id = ?
    `;

    const [rows]: any = await db.query(query, [numInterviewId]);
    if (!rows || rows.length === 0) {
      return {
        canAccess: false,
        statusCode: 404,
        code: "INTERVIEW_NOT_FOUND",
        error: "Interview schedule not found"
      };
    }

    const schedule = rows[0];
    const role = authenticatedUser.role;

    // Student Check
    if (role === "STUDENT") {
      const [studentRows]: any = await db.query(
        "SELECT id, user_id FROM student_profiles WHERE user_id = ?",
        [authenticatedUser.userId]
      );
      if (!studentRows || studentRows.length === 0 || studentRows[0].id !== schedule.student_id) {
        return {
          canAccess: false,
          statusCode: 404,
          code: "INTERVIEW_NOT_FOUND",
          error: "Interview schedule not found"
        };
      }

      return {
        canAccess: true,
        statusCode: 200,
        schedule,
        isStudent: true,
        isCompany: false,
        isInterviewer: false,
        studentId: studentRows[0].id,
        studentUserId: studentRows[0].user_id
      };
    }

    // Company / HR Check
    if (role === "COMPANY") {
      const ctxRes = await resolveAuthenticatedCompanyContext(authenticatedUser);
      if (!ctxRes.success || !ctxRes.context) {
        return {
          canAccess: false,
          statusCode: ctxRes.statusCode || 403,
          code: ctxRes.code || "COMPANY_CONTEXT_REQUIRED",
          error: ctxRes.error || "Company context required"
        };
      }

      const ctx = ctxRes.context;
      if (ctx.companyId !== schedule.company_id) {
        return {
          canAccess: false,
          statusCode: 404,
          code: "INTERVIEW_NOT_FOUND",
          error: "Interview schedule not found"
        };
      }

      if (ctx.isSubHr) {
        const scope = await getHrAssignedScope(ctx.companyId, ctx.userId);
        const jobAllowed = scope.assignedJobIds.has(Number(schedule.job_id));
        const appAllowed = scope.assignedAppIds.has(Number(schedule.application_id));
        if (!jobAllowed && !appAllowed) {
          return {
            canAccess: false,
            statusCode: 404,
            code: "INTERVIEW_NOT_FOUND",
            error: "Interview schedule not found"
          };
        }
      }

      return {
        canAccess: true,
        statusCode: 200,
        schedule,
        isStudent: false,
        isCompany: true,
        isInterviewer: true,
        isSubHr: ctx.isSubHr,
        companyId: ctx.companyId
      };
    }

    // Admin / Super Admin
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      return {
        canAccess: true,
        statusCode: 200,
        schedule,
        isStudent: false,
        isCompany: true,
        isInterviewer: true
      };
    }

    return {
      canAccess: false,
      statusCode: 403,
      code: "FORBIDDEN",
      error: "Access denied"
    };
  } catch (err) {
    console.error("Error resolving interview access:", err);
    return {
      canAccess: false,
      statusCode: 500,
      code: "SERVER_ERROR",
      error: "Failed to resolve interview access"
    };
  }
}

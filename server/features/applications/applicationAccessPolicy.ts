import db from "../../db.ts";

export type CompanyContext = {
  companyId: number | null;
  roleType: "SUB_HR" | "SUPER_HR" | null;
  designation: string | null;
  error: string | null;
  statusCode: number | null;
};

export async function resolveCompanyAndCheckPermission(userId: number, requiredAction?: "CREATE" | "EDIT" | "DELETE" | "VIEW" | string): Promise<CompanyContext> {
  const [hrProfiles]: any = await db.query(
    `SELECT hr.company_id, hr.permissions, hr.designation, u.status as user_status
     FROM company_hr_profiles hr
     JOIN users u ON hr.user_id = u.id
     WHERE hr.user_id = ?`,
    [userId]
  );

  if (hrProfiles?.length) {
    const hr = hrProfiles[0];
    if (hr.user_status && hr.user_status !== "ACTIVE") {
      return { error: "Forbidden: Account is inactive.", statusCode: 403, companyId: null, roleType: null, designation: null };
    }
    if (requiredAction) {
      let permissions: string[] = [];
      try {
        permissions = typeof hr.permissions === "string" ? JSON.parse(hr.permissions) : (hr.permissions || []);
      } catch {
        permissions = [];
      }
      const aliases: Record<string, string[]> = {
        CREATE: ["Drops Create", "Create Jobs", "Drops View", "Manage Drops"],
        EDIT: ["Drops Edit", "Edit Jobs", "Drops View", "Manage Drops"],
        DELETE: ["Drops Delete", "Delete Jobs", "Drops View", "Manage Drops"],
        VIEW: ["Drops View", "Jobs View", "Dashboard View", "Create Jobs"],
      };
      const accepted = aliases[requiredAction] || [requiredAction, "Drops View", "Drops Create", "Drops Edit", "Drops Delete", "Create Jobs"];
      if (!accepted.some((permission) => permissions.includes(permission))) {
        return { error: `Forbidden: You do not have required permission (${requiredAction}).`, statusCode: 403, companyId: null, roleType: null, designation: null };
      }
    }
    return { companyId: Number(hr.company_id), roleType: "SUB_HR", designation: hr.designation || "Sub HR", error: null, statusCode: null };
  }

  const [profiles]: any = await db.query(
    `SELECT cp.id, u.status as user_status
     FROM company_profiles cp
     JOIN users u ON cp.user_id = u.id
     WHERE cp.user_id = ?`,
    [userId]
  );
  if (profiles?.length) {
    if (profiles[0].user_status && profiles[0].user_status !== "ACTIVE") {
      return { error: "Forbidden: Account is inactive.", statusCode: 403, companyId: null, roleType: null, designation: null };
    }
    return { companyId: Number(profiles[0].id), roleType: "SUPER_HR", designation: "Super HR", error: null, statusCode: null };
  }
  return { error: "Company profile not found for authenticated user.", statusCode: 404, companyId: null, roleType: null, designation: null };
}

export async function resolveCompanyContext(req: any): Promise<CompanyContext> {
  const userId = Number(req.user?.userId);
  if (!userId) return { error: "User is not authenticated.", statusCode: 401, companyId: null, roleType: null, designation: null };
  return resolveCompanyAndCheckPermission(userId);
}

export async function canAccessApplication(req: any, applicationId: number): Promise<boolean> {
  const role = req.user?.role;
  const userId = Number(req.user?.userId);
  if (!userId || !applicationId) return false;
  if (role === "ADMIN" || role === "SUPER_ADMIN") return true;

  const [rows]: any = await db.query(`
    SELECT ja.id, sp.user_id AS student_user_id, j.company_id
    FROM job_applications ja
    JOIN student_profiles sp ON ja.student_id = sp.id
    JOIN jobs j ON ja.job_id = j.id
    WHERE ja.id = ?
    LIMIT 1
  `, [applicationId]);
  if (!rows?.length) return false;

  if (role === "STUDENT") return Number(rows[0].student_user_id) === userId;
  if (role === "COMPANY") {
    const ctx = await resolveCompanyContext(req);
    return !ctx.error && Number(ctx.companyId) === Number(rows[0].company_id);
  }
  return false;
}

export async function requireApplicationAccess(req: any, res: any, next: any) {
  const applicationId = Number(req.params.appId || req.params.applicationId || req.body?.applicationId);
  if (!Number.isInteger(applicationId) || applicationId <= 0) return res.status(400).json({ success: false, message: "Invalid application id" });
  if (!(await canAccessApplication(req, applicationId))) return res.status(403).json({ success: false, message: "Access denied for this application" });
  return next();
}

export async function requireCompanyJobAccess(req: any, res: any, next: any) {
  if (["ADMIN", "SUPER_ADMIN"].includes(req.user?.role)) return next();
  if (req.user?.role !== "COMPANY") return res.status(403).json({ success: false, message: "Company access required" });
  const jobId = Number(req.params.jobId || req.params.id || req.body?.jobId);
  if (!Number.isInteger(jobId) || jobId <= 0) return res.status(400).json({ success: false, message: "Invalid job id" });
  const ctx = await resolveCompanyContext(req);
  if (ctx.error) return res.status(ctx.statusCode || 403).json({ success: false, message: ctx.error });
  const [rows]: any = await db.query("SELECT id FROM jobs WHERE id = ? AND company_id = ? LIMIT 1", [jobId, ctx.companyId]);
  if (!rows?.length) return res.status(403).json({ success: false, message: "Access denied for this job" });
  return next();
}

export async function requireCompanyApplicationsAccess(req: any, res: any, next: any) {
  if (["ADMIN", "SUPER_ADMIN"].includes(req.user?.role)) return next();
  if (req.user?.role !== "COMPANY") return res.status(403).json({ success: false, message: "Company access required" });
  const ids = Array.isArray(req.body?.applicationIds) ? req.body.applicationIds.map(Number).filter(Number.isInteger) : [];
  if (!ids.length) return res.status(400).json({ success: false, message: "applicationIds must be a non-empty array" });
  const ctx = await resolveCompanyContext(req);
  if (ctx.error) return res.status(ctx.statusCode || 403).json({ success: false, message: ctx.error });
  const placeholders = ids.map(() => "?").join(",");
  const [rows]: any = await db.query(`SELECT ja.id FROM job_applications ja JOIN jobs j ON ja.job_id = j.id WHERE ja.id IN (${placeholders}) AND j.company_id = ?`, [...ids, ctx.companyId]);
  if (rows.length !== ids.length) return res.status(403).json({ success: false, message: "One or more applications do not belong to your company" });
  return next();
}

export async function requireStudentRecruitingDataAccess(req: any, res: any, next: any) {
  if (["ADMIN", "SUPER_ADMIN"].includes(req.user?.role)) return next();
  const requested = Number(req.params.studentId);
  if (!Number.isInteger(requested) || requested <= 0) return res.status(400).json({ success: false, message: "Invalid student id" });
  const [profiles]: any = await db.query("SELECT id, user_id, college_id FROM student_profiles WHERE id = ? OR user_id = ? LIMIT 1", [requested, requested]);
  if (!profiles?.length) return res.status(404).json({ success: false, message: "Student profile not found" });
  const student = profiles[0];

  if (req.user?.role === "COMPANY") {
    const ctx = await resolveCompanyContext(req);
    if (ctx.error) return res.status(ctx.statusCode || 403).json({ success: false, message: ctx.error });
    const [applications]: any = await db.query(`SELECT ja.id FROM job_applications ja JOIN jobs j ON ja.job_id = j.id WHERE ja.student_id = ? AND j.company_id = ? LIMIT 1`, [student.id, ctx.companyId]);
    if (!applications?.length) return res.status(403).json({ success: false, message: "Student data is available only for candidates in your recruitment pipeline" });
    return next();
  }

  if (req.user?.role === "TPO") {
    const [tpoRows]: any = await db.query("SELECT college_id FROM tpo_profiles WHERE user_id = ? LIMIT 1", [req.user.userId]);
    if (!tpoRows?.length || Number(tpoRows[0].college_id) !== Number(student.college_id)) return res.status(403).json({ success: false, message: "Student is outside your institution" });
    return next();
  }
  return res.status(403).json({ success: false, message: "Access denied" });
}

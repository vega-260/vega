import db from "../../db.ts";

export const companyRepository = {
  async findHrByUserId(userId: number) {
    const [rows]: any = await db.query("SELECT * FROM company_hr_profiles WHERE user_id = ? LIMIT 1", [userId]);
    return rows[0] || null;
  },
  async findProfileByUserId(userId: number) {
    const [rows]: any = await db.query("SELECT * FROM company_profiles WHERE user_id = ? LIMIT 1", [userId]);
    return rows[0] || null;
  },
  async findProfileById(companyId: number) {
    const [rows]: any = await db.query("SELECT * FROM company_profiles WHERE id = ? LIMIT 1", [companyId]);
    return rows[0] || null;
  },
  async jobBelongsToCompany(jobId: number, companyId: number) {
    const [rows]: any = await db.query("SELECT id FROM jobs WHERE id = ? AND company_id = ? LIMIT 1", [jobId, companyId]);
    return rows.length > 0;
  },
  async testBelongsToCompany(testId: number, companyId: number) {
    const [rows]: any = await db.query("SELECT t.id FROM tests t JOIN jobs j ON t.job_id = j.id WHERE t.id = ? AND j.company_id = ? LIMIT 1", [testId, companyId]);
    return rows.length > 0;
  },
  async insertAudit(input: { companyId: number; actorUserId: number; actorName: string; actorRole: string; actionType: string; module: string; description: string; targetType?: string | null; targetId?: number | null; metadata?: unknown }) {
    const { companyId, actorUserId, actorName, actorRole, actionType, module, description, targetType = null, targetId = null, metadata = null } = input;
    await db.query(`INSERT INTO company_audit_logs (company_id, actor_user_id, actor_name, actor_role, action_type, module, description, target_type, target_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [companyId, actorUserId, actorName, actorRole, actionType, module, description, targetType, targetId, metadata ? JSON.stringify(metadata) : null]);
  },
};

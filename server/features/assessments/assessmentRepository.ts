import db from "../../db.ts";

export const assessmentRepository = {
  async findTpoByUserId(userId: number) {
    const [rows]: any = await db.query("SELECT id FROM tpo_profiles WHERE user_id = ? LIMIT 1", [userId]);
    return rows[0] || null;
  },
  async findTpoCollegeIds(tpoId: number) {
    const [rows]: any = await db.query("SELECT college_id FROM tpo_colleges WHERE tpo_id = ?", [tpoId]);
    return rows.map((row: any) => Number(row.college_id)).filter(Number.isFinite);
  },
  async findFirstBatchCollegeId(tpoId: number) {
    const [rows]: any = await db.query("SELECT college_id FROM batches WHERE assigned_tpo_id = ? LIMIT 1", [tpoId]);
    return rows[0]?.college_id ?? null;
  },
  async findStudentContext(userId: number) {
    const [rows]: any = await db.query(`
      SELECT sp.id, COALESCE(sp.college_id, b.college_id) AS college_id,
             COALESCE(b.batch_name, sp.batch) AS batch,
             COALESCE(b.status, 'ACTIVE') AS batch_status
      FROM student_profiles sp
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      WHERE sp.user_id = ? LIMIT 1
    `, [userId]);
    return rows[0] || null;
  },
  async findCompanyIdForUser(userId: number) {
    const [profiles]: any = await db.query("SELECT id FROM company_profiles WHERE user_id = ? LIMIT 1", [userId]);
    if (profiles[0]?.id) return Number(profiles[0].id);
    const [hrs]: any = await db.query("SELECT company_id FROM company_hr_profiles WHERE user_id = ? LIMIT 1", [userId]);
    return hrs[0]?.company_id ? Number(hrs[0].company_id) : null;
  },
};

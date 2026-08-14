import "dotenv/config";
import db from "../../server/db.ts";

const samples = [
  {
    name: "company-job-pipeline",
    sql: `SELECT ja.id, ja.status, ja.current_stage_id FROM job_applications ja WHERE ja.job_id = 1 AND ja.status = 'IN_PROGRESS' ORDER BY ja.id DESC LIMIT 100`
  },
  {
    name: "student-applications",
    sql: `SELECT ja.id, ja.job_id, ja.status, ja.applied_at FROM job_applications ja WHERE ja.student_id = 1 ORDER BY ja.applied_at DESC LIMIT 100`
  },
  {
    name: "unread-notifications",
    sql: `SELECT id, title, type, created_at FROM notifications WHERE user_id = 1 AND is_read = 0 ORDER BY created_at DESC LIMIT 100`
  },
  {
    name: "assessment-attempts",
    sql: `SELECT id, student_user_id, percentage, submitted_at FROM assessment_attempts WHERE assessment_id = 1 AND submitted_at IS NOT NULL ORDER BY submitted_at DESC LIMIT 100`
  }
];

async function main() {
  if (!db.useMySQL) throw new Error("db-explain-critical requires MySQL");
  for (const sample of samples) {
    const [rows]: any = await db.query(`EXPLAIN FORMAT=JSON ${sample.sql}`);
    console.log(`\n===== ${sample.name} =====`);
    console.log(rows?.[0]?.EXPLAIN || rows);
  }
}
main().finally(() => db.close()).catch((error) => { console.error(error); process.exit(1); });

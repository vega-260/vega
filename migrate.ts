import "dotenv/config";
import { installPhase6SqlObjects } from "./server/database/phase6/sqlObjects.ts";

async function ensureIndex(db: any, table: string, indexName: string, columns: string[]) {
  const [tableRows]: any = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`, [table]
  );
  if (!tableRows?.length) { console.log(`ℹ️ Skipping ${indexName}; table ${table} is not installed`); return; }
  const [columnRows]: any = await db.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?`, [table]
  );
  const available = new Set((columnRows || []).map((r: any) => String(r.column_name)));
  const missing = columns.filter((column) => !available.has(column));
  if (missing.length) { console.log(`ℹ️ Skipping ${indexName}; missing columns ${missing.join(",")}`); return; }
  const [existing]: any = await db.query(
    `SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
    [table, indexName]
  );
  if (existing?.length) return;
  const quoted = columns.map((column) => `\`${column}\``).join(", ");
  await db.query(`CREATE INDEX \`${indexName}\` ON \`${table}\` (${quoted})`);
  console.log(`✅ Created index ${indexName} on ${table}(${columns.join(",")})`);
}

async function migrate() {
  process.env.RUN_DB_MIGRATIONS = "true";
  const { initDb, db } = await import("./server/db.ts");
  if (!db.useMySQL) throw new Error("Production migration command requires MySQL");

  const [lockRows]: any = await db.query("SELECT GET_LOCK('vega_schema_migration', 60) AS acquired");
  if (Number(lockRows?.[0]?.acquired) !== 1) throw new Error("Could not acquire VEGA schema migration lock");

  try {
    await initDb();
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(150) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const migrationId = "20260808_phase3_query_indexes";
    const [done]: any = await db.query("SELECT id FROM schema_migrations WHERE id = ? LIMIT 1", [migrationId]);
    if (!done.length) {
      const indexes: Array<[string, string, string[]]> = [
        ["refresh_tokens", "idx_refresh_tokens_user_token", ["user_id", "token"]],
        ["notifications", "idx_notifications_user_read_created", ["user_id", "is_read", "created_at"]],
        ["jobs", "idx_jobs_company_status_created", ["company_id", "status", "created_at"]],
        ["job_applications", "idx_job_apps_job_status_stage", ["job_id", "status", "current_stage_id"]],
        ["job_applications", "idx_job_apps_student_job", ["student_id", "job_id"]],
        ["job_applications", "idx_job_apps_stage_applied", ["current_stage_id", "status", "applied_at"]],
        ["application_history", "idx_application_history_app_created", ["application_id", "created_at"]],
        ["test_submissions", "idx_test_submissions_app_submitted", ["application_id", "submitted_at"]],
        ["test_submissions", "idx_test_submissions_student_status", ["student_id", "status"]],
        ["interview_schedules", "idx_interviews_application_status_time", ["application_id", "status", "scheduled_at"]],
        ["interview_schedules", "idx_interviews_status_time", ["status", "scheduled_at"]],
        ["security_logs", "idx_security_logs_user_created", ["user_id", "created_at"]],
        ["company_audit_logs", "idx_company_audit_company_created", ["company_id", "created_at"]],
        ["assessment_attempts", "idx_assessment_attempts_student_status", ["student_user_id", "status"]],
        ["assessment_attempts", "idx_assessment_attempts_assessment_status", ["assessment_id", "status"]],
      ];

      for (const [table, name, columns] of indexes) {
        await ensureIndex(db, table, name, columns);
      }
      await db.query("INSERT INTO schema_migrations (id) VALUES (?)", [migrationId]);
    } else {
      console.log(`ℹ️ Migration ${migrationId} already applied`);
    }

    const performanceMigrationId = "20260809_phase5_database_performance";
    const [perfDone]: any = await db.query("SELECT id FROM schema_migrations WHERE id = ? LIMIT 1", [performanceMigrationId]);
    if (!perfDone.length) {
      const performanceIndexes: Array<[string, string, string[]]> = [
        ["users", "idx_users_role_status_created", ["role", "status", "created_at"]],
        ["student_profiles", "idx_student_profiles_college_batch", ["college_id", "batch_id", "id"]],
        ["company_profiles", "idx_company_profiles_status_created", ["status", "created_at"]],
        ["job_stages", "idx_job_stages_job_order", ["job_id", "stage_order", "id"]],
        ["test_questions", "idx_test_questions_stage", ["stage_id", "id"]],
        ["test_schedules", "idx_test_schedules_job_stage_time", ["job_id", "stage_id", "scheduled_at"]],
        ["interview_evaluations", "idx_interview_evaluations_interview", ["interview_id"]],
        ["event_registrations", "idx_event_reg_student_status", ["student_id", "status"]],
        ["talent_scores", "idx_talent_scores_user_score", ["user_id", "overall_score"]],
        ["student_batch", "idx_student_batch_student_batch", ["student_id", "batch_id"]],
        ["batches", "idx_batches_college_status", ["college_id", "status", "id"]],
        ["company_job_assignments", "idx_company_job_assign_scope", ["company_id", "assigned_hr_user_id", "job_id"]],
        ["company_application_assignments", "idx_company_app_assign_scope", ["company_id", "assigned_hr_user_id", "application_id"]],
        ["drops", "idx_drops_company_status_created", ["company_id", "status", "created_at"]],
        ["drop_media", "idx_drop_media_drop_status_created", ["drop_id", "status", "created_at"]],
        ["assessment_assignments", "idx_assessment_assignments_assessment_batch", ["assessment_id", "batch_name"]],
        ["assessment_attempts", "idx_assessment_attempts_assessment_student", ["assessment_id", "student_user_id", "submitted_at"]],
        ["assessment_answers", "idx_assessment_answers_attempt", ["attempt_id"]],
        ["assessment_violations", "idx_assessment_violations_attempt", ["attempt_id"]],
        ["assessment_location", "idx_assessment_location_attempt", ["attempt_id"]],
      ];
      for (const [table, name, columns] of performanceIndexes) await ensureIndex(db, table, name, columns);
      await db.query("INSERT INTO schema_migrations (id) VALUES (?)", [performanceMigrationId]);
    } else {
      console.log(`ℹ️ Migration ${performanceMigrationId} already applied`);
    }

    const architectureMigrationId = "20260809_phase6_database_architecture";
    const [archDone]: any = await db.query("SELECT id FROM schema_migrations WHERE id = ? LIMIT 1", [architectureMigrationId]);
    if (!archDone.length) {
      const architectureIndexes: Array<[string, string, string[]]> = [
        ["refresh_tokens", "idx_refresh_tokens_expiry", ["expires_at", "id"]],
        ["otps", "idx_otps_expiry", ["expires_at", "id"]],
        ["notifications", "idx_notifications_read_created_id", ["is_read", "created_at", "id"]],
        ["job_applications", "idx_job_apps_job_status_id", ["job_id", "status", "id"]],
        ["job_applications", "idx_job_apps_student_applied_id", ["student_id", "applied_at", "id"]],
        ["application_history", "idx_app_history_application_created_id", ["application_id", "created_at", "id"]],
        ["assessment_attempts", "idx_assessment_attempts_assessment_submitted", ["assessment_id", "submitted_at", "student_user_id"]],
        ["assessment_violations", "idx_assessment_violations_attempt_created", ["attempt_id", "created_at"]],
        ["interview_schedules", "idx_interviews_schedule_status_application", ["scheduled_at", "status", "application_id"]],
        ["company_audit_logs", "idx_company_audit_module_created", ["company_id", "module", "created_at"]],
        ["admin_logs", "idx_admin_logs_admin_created", ["admin_id", "created_at"]],
        ["profile_views", "idx_profile_views_student_viewed", ["student_id", "viewed_at"]],
        ["profile_views", "idx_profile_views_company_viewed", ["company_id", "viewed_at"]],
      ];
      for (const [table, name, columns] of architectureIndexes) await ensureIndex(db, table, name, columns);
      await installPhase6SqlObjects(db);
      await db.query("INSERT INTO schema_migrations (id) VALUES (?)", [architectureMigrationId]);
    } else {
      // CREATE OR REPLACE views/routines/triggers are intentionally reconciled on every migration run.
      // This keeps SQL objects aligned with application code while schema_migrations protects table/index DDL.
      await installPhase6SqlObjects(db);
      console.log(`ℹ️ Migration ${architectureMigrationId} already applied; SQL objects reconciled`);
    }

    console.log("✅ VEGA database migration/bootstrap completed");
  } finally {
    await db.query("SELECT RELEASE_LOCK('vega_schema_migration')").catch(() => undefined);
    await db.close();
  }
}

migrate().then(() => process.exit(0)).catch((error) => {
  console.error("Database migration failed:", error);
  process.exit(1);
});

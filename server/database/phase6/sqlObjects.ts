type Db = {
  query: (sql: string, params?: any[]) => Promise<any>;
  migrationRawQuery?: (sql: string) => Promise<any>;
};

async function ddl(db: Db, sql: string) {
  if (db.migrationRawQuery) return db.migrationRawQuery(sql);
  return db.query(sql);
}

async function tableExists(db: Db, table: string) {
  const [rows]: any = await db.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
    [table],
  );
  return rows.length > 0;
}

async function columnExists(db: Db, table: string, column: string) {
  const [rows]: any = await db.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1",
    [table, column],
  );
  return rows.length > 0;
}

async function allPresent(db: Db, spec: Record<string, string[]>) {
  for (const [table, columns] of Object.entries(spec)) {
    if (!(await tableExists(db, table))) return false;
    for (const column of columns) if (!(await columnExists(db, table, column))) return false;
  }
  return true;
}

async function installView(db: Db, name: string, sql: string) {
  await ddl(db, `CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY INVOKER VIEW \`${name}\` AS ${sql}`);
  console.log(`✅ Installed view ${name}`);
}

async function dropRoutine(db: Db, type: "PROCEDURE" | "FUNCTION", name: string) {
  await ddl(db, `DROP ${type} IF EXISTS \`${name}\``);
}

async function installProcedure(db: Db, name: string, sql: string) {
  await dropRoutine(db, "PROCEDURE", name);
  await ddl(db, sql);
  console.log(`✅ Installed procedure ${name}`);
}

async function installTrigger(db: Db, name: string, sql: string) {
  await ddl(db, `DROP TRIGGER IF EXISTS \`${name}\``);
  await ddl(db, sql);
  console.log(`✅ Installed trigger ${name}`);
}

export async function installPhase6SqlObjects(db: Db) {
  // A true persisted aggregate: MySQL normal views are not materialized, so expensive dashboard
  // counts are stored in a small summary table and refreshed set-wise by a procedure/worker.
  if (await allPresent(db, {
    jobs: ["id", "company_id", "status"],
    job_applications: ["id", "job_id", "status"],
  })) {
    await ddl(db, `
      CREATE TABLE IF NOT EXISTS company_job_pipeline_metrics (
        job_id INT NOT NULL PRIMARY KEY,
        company_id INT NOT NULL,
        total_applicants INT UNSIGNED NOT NULL DEFAULT 0,
        active_pipeline INT UNSIGNED NOT NULL DEFAULT 0,
        selected_count INT UNSIGNED NOT NULL DEFAULT 0,
        rejected_count INT UNSIGNED NOT NULL DEFAULT 0,
        withdrawn_count INT UNSIGNED NOT NULL DEFAULT 0,
        refreshed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_pipeline_metrics_company_refreshed (company_id, refreshed_at),
        KEY idx_pipeline_metrics_company_selected (company_id, selected_count)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await installProcedure(db, "sp_refresh_company_job_pipeline_metrics", `
      CREATE PROCEDURE sp_refresh_company_job_pipeline_metrics(IN p_company_id INT)
      SQL SECURITY INVOKER
      MODIFIES SQL DATA
      BEGIN
        INSERT INTO company_job_pipeline_metrics (
          job_id, company_id, total_applicants, active_pipeline,
          selected_count, rejected_count, withdrawn_count, refreshed_at
        )
        SELECT
          j.id,
          j.company_id,
          COUNT(ja.id),
          SUM(CASE WHEN ja.status NOT IN ('SELECTED','HIRED','OFFER_ACCEPTED','REJECTED','CANCELLED','WITHDRAWN') THEN 1 ELSE 0 END),
          SUM(CASE WHEN ja.status IN ('SELECTED','HIRED','OFFER_ACCEPTED','VERIFIED_SELECTION') THEN 1 ELSE 0 END),
          SUM(CASE WHEN ja.status = 'REJECTED' THEN 1 ELSE 0 END),
          SUM(CASE WHEN ja.status IN ('CANCELLED','WITHDRAWN') THEN 1 ELSE 0 END),
          UTC_TIMESTAMP(3)
        FROM jobs j
        LEFT JOIN job_applications ja ON ja.job_id = j.id
        WHERE p_company_id IS NULL OR j.company_id = p_company_id
        GROUP BY j.id, j.company_id
        ON DUPLICATE KEY UPDATE
          company_id = VALUES(company_id),
          total_applicants = VALUES(total_applicants),
          active_pipeline = VALUES(active_pipeline),
          selected_count = VALUES(selected_count),
          rejected_count = VALUES(rejected_count),
          withdrawn_count = VALUES(withdrawn_count),
          refreshed_at = VALUES(refreshed_at);

        DELETE m FROM company_job_pipeline_metrics m
        LEFT JOIN jobs j ON j.id = m.job_id
        WHERE j.id IS NULL OR m.company_id <> j.company_id;
      END
    `);

    await installView(db, "vw_company_job_pipeline_summary", `
      SELECT
        j.company_id,
        j.id AS job_id,
        j.title,
        j.status AS job_status,
        j.deadline,
        COALESCE(m.total_applicants, 0) AS total_applicants,
        COALESCE(m.active_pipeline, 0) AS active_pipeline,
        COALESCE(m.selected_count, 0) AS selected_count,
        COALESCE(m.rejected_count, 0) AS rejected_count,
        COALESCE(m.withdrawn_count, 0) AS withdrawn_count,
        m.refreshed_at AS metrics_refreshed_at
      FROM jobs j
      LEFT JOIN company_job_pipeline_metrics m ON m.job_id = j.id
    `);
  }

  if (await allPresent(db, {
    job_applications: ["id", "job_id", "student_id", "current_stage_id", "status", "applied_at"],
    jobs: ["id", "company_id", "title", "status"],
    student_profiles: ["id", "user_id", "full_name"],
    company_profiles: ["id", "company_name"],
    job_stages: ["id", "stage_name", "stage_type", "stage_order"],
  })) {
    await installView(db, "vw_student_application_overview", `
      SELECT
        ja.id AS application_id,
        sp.user_id AS student_user_id,
        ja.student_id AS student_profile_id,
        sp.full_name AS student_name,
        ja.job_id,
        j.company_id,
        cp.company_name,
        j.title AS job_title,
        j.status AS job_status,
        ja.status AS application_status,
        ja.current_stage_id,
        js.stage_name AS current_stage_name,
        js.stage_type AS current_stage_type,
        js.stage_order AS current_stage_order,
        ja.applied_at
      FROM job_applications ja
      JOIN jobs j ON j.id = ja.job_id
      JOIN student_profiles sp ON sp.id = ja.student_id
      JOIN company_profiles cp ON cp.id = j.company_id
      LEFT JOIN job_stages js ON js.id = ja.current_stage_id
    `);
  }

  if (await allPresent(db, {
    assessment_tests: ["id", "tpo_id", "college_id", "title", "status", "max_marks", "passing_marks", "created_at"],
    assessment_attempts: ["id", "assessment_id", "status", "score", "percentage", "is_passed", "submitted_at"],
  })) {
    await installView(db, "vw_tpo_assessment_summary", `
      SELECT
        t.id AS assessment_id,
        t.tpo_id,
        t.college_id,
        t.title,
        t.status,
        t.max_marks,
        t.passing_marks,
        COUNT(a.id) AS attempt_count,
        SUM(CASE WHEN a.submitted_at IS NOT NULL THEN 1 ELSE 0 END) AS submitted_count,
        SUM(CASE WHEN a.is_passed = 1 THEN 1 ELSE 0 END) AS passed_count,
        ROUND(AVG(CASE WHEN a.submitted_at IS NOT NULL THEN a.percentage END), 2) AS average_percentage,
        MAX(a.submitted_at) AS latest_submission_at,
        t.created_at
      FROM assessment_tests t
      LEFT JOIN assessment_attempts a ON a.assessment_id = t.id
      GROUP BY t.id, t.tpo_id, t.college_id, t.title, t.status, t.max_marks, t.passing_marks, t.created_at
    `);
  }

  if (await allPresent(db, { refresh_tokens: ["id", "expires_at"] })) {
    await installProcedure(db, "sp_purge_expired_refresh_tokens", `
      CREATE PROCEDURE sp_purge_expired_refresh_tokens(IN p_batch_size INT)
      SQL SECURITY INVOKER
      MODIFIES SQL DATA
      BEGIN
        DECLARE v_limit INT DEFAULT 5000;
        SET v_limit = LEAST(GREATEST(COALESCE(p_batch_size, 5000), 100), 20000);
        DELETE FROM refresh_tokens
        WHERE expires_at < UTC_TIMESTAMP()
        ORDER BY expires_at
        LIMIT v_limit;
        SELECT ROW_COUNT() AS deleted_rows;
      END
    `);
  }

  if (await allPresent(db, { otps: ["id", "expires_at"] })) {
    await installProcedure(db, "sp_purge_expired_otps", `
      CREATE PROCEDURE sp_purge_expired_otps(IN p_batch_size INT)
      SQL SECURITY INVOKER
      MODIFIES SQL DATA
      BEGIN
        DECLARE v_limit INT DEFAULT 5000;
        SET v_limit = LEAST(GREATEST(COALESCE(p_batch_size, 5000), 100), 20000);
        DELETE FROM otps
        WHERE expires_at < UTC_TIMESTAMP()
        ORDER BY expires_at
        LIMIT v_limit;
        SELECT ROW_COUNT() AS deleted_rows;
      END
    `);
  }

  // Guardrail triggers run only when somebody attempts to mutate/delete immutable audit evidence.
  // They add no cost to normal INSERT-heavy application traffic.
  if (await allPresent(db, { company_audit_logs: ["id"] })) {
    await installTrigger(db, "trg_company_audit_logs_no_update", `
      CREATE TRIGGER trg_company_audit_logs_no_update
      BEFORE UPDATE ON company_audit_logs FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'company_audit_logs is append-only'
    `);
  }

  if (await allPresent(db, { admin_logs: ["id"] })) {
    await installTrigger(db, "trg_admin_logs_no_update", `
      CREATE TRIGGER trg_admin_logs_no_update
      BEFORE UPDATE ON admin_logs FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'admin_logs is append-only'
    `);
  }
}

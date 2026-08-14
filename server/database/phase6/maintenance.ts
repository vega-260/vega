import db from "../../db.ts";
import logger from "../../services/logger.ts";

async function callMaintenanceProcedure(name: string, batchSize: number) {
  try {
    await db.query(`CALL \`${name}\`(?)`, [batchSize]);
  } catch (error: any) {
    // During rolling deployments an old schema can briefly coexist with new code.
    if (error?.code === "ER_SP_DOES_NOT_EXIST") {
      logger.warn("Database maintenance procedure is not installed yet", { procedure: name });
      return;
    }
    throw error;
  }
}

let lastPipelineSummaryRefreshAt = 0;

export async function runDatabaseMaintenance() {
  if (!db.useMySQL) return;
  const batchSize = Math.max(100, Math.min(Number(process.env.DB_MAINTENANCE_BATCH_SIZE || 5000), 20000));
  await callMaintenanceProcedure("sp_purge_expired_refresh_tokens", batchSize);
  await callMaintenanceProcedure("sp_purge_expired_otps", batchSize);

  if (process.env.DB_REFRESH_PIPELINE_SUMMARY !== "false") {
    const refreshEveryMs = Math.max(5, Math.min(Number(process.env.DB_PIPELINE_SUMMARY_REFRESH_MINUTES || 15), 120)) * 60_000;
    if (Date.now() - lastPipelineSummaryRefreshAt >= refreshEveryMs) {
      try {
        await db.query("CALL sp_refresh_company_job_pipeline_metrics(NULL)");
        lastPipelineSummaryRefreshAt = Date.now();
      } catch (error: any) {
        if (error?.code !== "ER_SP_DOES_NOT_EXIST") throw error;
      }
    }
  }
}

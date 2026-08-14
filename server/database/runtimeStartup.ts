import { db, initDb, ensureAssessmentSchema, ensureTPOAssessmentSchema } from "../db.ts";

/**
 * Runtime database startup is intentionally different from schema migration.
 * Production API/worker processes only verify connectivity and critical schema;
 * DDL is performed by the dedicated migration job.
 */
export async function initializeRuntimeDatabase() {
  if (process.env.NODE_ENV !== "production") {
    await initDb();
    return;
  }

  if (!db.useMySQL) throw new Error("Production runtime requires MySQL");
  await db.query("SELECT 1 AS ok");

  const [companyAssessment, tpoAssessment] = await Promise.all([
    ensureAssessmentSchema(),
    ensureTPOAssessmentSchema(),
  ]);
  if (!companyAssessment.ready) {
    throw new Error(`Company assessment schema is incomplete: ${companyAssessment.missing.join(", ")}`);
  }
  if (!tpoAssessment.ready) {
    throw new Error(`TPO assessment schema is incomplete: ${tpoAssessment.missing.join(", ")}`);
  }
}

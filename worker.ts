import "dotenv/config";
import { initializeRuntimeDatabase } from "./server/database/runtimeStartup.ts";
import { createAssessmentWorker, createEmailWorker, closeQueueConnections, withDistributedLock } from "./server/services/queueService.ts";
import db from "./server/db.ts";
import { checkAndProcessJobExpirations } from "./server/services/jobExpiryService.ts";
import { cleanupOrphanedAndRejectedDropMedia, runStartupRecovery } from "./server/features/drops/dropMediaService.ts";
import { runDatabaseMaintenance } from "./server/database/phase6/maintenance.ts";

async function startWorker() {
  if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL) {
    throw new Error("REDIS_URL is mandatory for the production worker");
  }

  await initializeRuntimeDatabase();
  const assessmentWorker = createAssessmentWorker();
  const emailWorker = createEmailWorker();

  const runMaintenance = async () => {
    await withDistributedLock("worker-maintenance", 10 * 60 * 1000, async () => {
      await Promise.allSettled([
        checkAndProcessJobExpirations(),
        cleanupOrphanedAndRejectedDropMedia(),
        runDatabaseMaintenance(),
      ]);
    });
  };

  await withDistributedLock("drop-startup-recovery", 10 * 60 * 1000, () => runStartupRecovery()).catch((error) => console.error("Drop recovery failed:", error));
  await runMaintenance();
  const timer = setInterval(runMaintenance, 5 * 60 * 1000);

  const shutdown = async (signal: string) => {
    console.log(`Worker received ${signal}; shutting down gracefully.`);
    clearInterval(timer);
    await Promise.all([assessmentWorker.close(), emailWorker.close()]);
    await closeQueueConnections();
    await db.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  console.log("✅ VEGA background worker started");
}

startWorker().catch((error) => {
  console.error("Worker startup failed:", error);
  process.exit(1);
});

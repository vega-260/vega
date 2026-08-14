import "dotenv/config";
import db from "../../server/db.ts";

async function main() {
  if (!db.useMySQL) throw new Error("db:audit requires MySQL");
  const [tables]: any = await db.query(`
    SELECT table_name, table_rows, data_length, index_length,
           ROUND((data_length + index_length) / 1024 / 1024, 2) AS total_mb
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
    ORDER BY (data_length + index_length) DESC
    LIMIT 50
  `);
  console.log("\nLargest tables"); console.table(tables);

  const [indexes]: any = await db.query(`
    SELECT table_name, index_name, non_unique,
           GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns,
           MAX(cardinality) AS cardinality
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    GROUP BY table_name, index_name, non_unique
    ORDER BY table_name, index_name
  `);
  console.log("\nIndexes"); console.table(indexes);

  const [withoutPrimary]: any = await db.query(`
    SELECT t.table_name
    FROM information_schema.tables t
    LEFT JOIN information_schema.table_constraints c
      ON c.table_schema=t.table_schema AND c.table_name=t.table_name AND c.constraint_type='PRIMARY KEY'
    WHERE t.table_schema=DATABASE() AND t.table_type='BASE TABLE' AND c.constraint_name IS NULL
  `);
  if (withoutPrimary.length) console.warn("Tables without primary keys:", withoutPrimary);

  try {
    const [digest]: any = await db.query(`
      SELECT digest_text, count_star, ROUND(sum_timer_wait/1000000000000,3) AS total_seconds,
             ROUND(avg_timer_wait/1000000000,3) AS avg_ms, sum_rows_examined, sum_rows_sent
      FROM performance_schema.events_statements_summary_by_digest
      WHERE schema_name = DATABASE() AND digest_text IS NOT NULL
      ORDER BY sum_timer_wait DESC LIMIT 25
    `);
    console.log("\nTop query digests by total DB time"); console.table(digest);
  } catch {
    console.warn("performance_schema digest statistics are unavailable on this MySQL deployment.");
  }
}

main().finally(() => db.close()).catch((error) => { console.error(error); process.exitCode = 1; });

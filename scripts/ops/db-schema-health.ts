import "dotenv/config";
import db from "../../server/db.ts";

async function main() {
  if (!db.useMySQL) throw new Error("db-schema-health requires MySQL");

  const [tables]: any = await db.query(`
    SELECT table_name, engine, table_rows,
           ROUND((data_length + index_length) / 1024 / 1024, 2) AS total_mb,
           ROUND(index_length / 1024 / 1024, 2) AS index_mb,
           table_collation
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_type='BASE TABLE'
    ORDER BY (data_length + index_length) DESC
  `);

  const [withoutPk]: any = await db.query(`
    SELECT t.table_name
    FROM information_schema.tables t
    LEFT JOIN information_schema.table_constraints c
      ON c.table_schema=t.table_schema AND c.table_name=t.table_name AND c.constraint_type='PRIMARY KEY'
    WHERE t.table_schema=DATABASE() AND t.table_type='BASE TABLE' AND c.constraint_name IS NULL
  `);

  const [indexes]: any = await db.query(`
    SELECT table_name, index_name, non_unique,
           GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_list
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    GROUP BY table_name, index_name, non_unique
    ORDER BY table_name, index_name
  `);

  const duplicateCandidates: any[] = [];
  const grouped = new Map<string, any[]>();
  for (const row of indexes) {
    const arr = grouped.get(row.table_name) || [];
    arr.push(row); grouped.set(row.table_name, arr);
  }
  for (const [table, rows] of grouped) {
    for (const a of rows) for (const b of rows) {
      if (a.index_name >= b.index_name || a.index_name === 'PRIMARY' || b.index_name === 'PRIMARY') continue;
      if (a.columns_list === b.columns_list) duplicateCandidates.push({ table, indexA: a.index_name, indexB: b.index_name, columns: a.columns_list });
    }
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    largestTables: tables.slice(0, 30),
    tablesWithoutPrimaryKey: withoutPk,
    duplicateIndexCandidates: duplicateCandidates,
    recommendations: [
      "Investigate tables with high rows-examined/rows-returned in Performance Schema.",
      "Do not delete an index solely because this report calls it a candidate; validate workload and EXPLAIN ANALYZE first.",
      "Keep application + worker pool capacity below MySQL max_connections with at least 25-35% operational headroom."
    ]
  }, null, 2));
}

main().finally(() => db.close()).catch((error) => { console.error(error); process.exit(1); });

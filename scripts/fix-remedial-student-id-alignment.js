/*
  One-time utility to align remedial/performance student_id values with student.student_id.

  Usage:
    node scripts/fix-remedial-student-id-alignment.js
    node scripts/fix-remedial-student-id-alignment.js --apply

  Safe defaults:
  - Dry-run by default (no updates).
  - Only auto-fixes unambiguous numeric-equivalent IDs (e.g. "00123" -> "123").
*/

const mysql = require("mysql2/promise");

const APPLY = process.argv.includes("--apply");

function isSystemDb(name) {
  return ["information_schema", "mysql", "performance_schema", "sys"].includes(name);
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "RIANA28@eg564",
    database: process.env.DB_DATABASE || process.env.DB_NAME || "rpt-saes_db",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  });

  const [dbRows] = await conn.query("SELECT DATABASE() AS db");
  const activeDb = dbRows[0]?.db;
  if (!activeDb || isSystemDb(activeDb)) {
    throw new Error("No valid active DB selected.");
  }

  const targetTables = ["student_remedial_session", "performance_records"];

  const [tableRows] = await conn.query(`
    SELECT LOWER(table_name) AS table_name
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND LOWER(table_name) IN (${targetTables.map(() => "LOWER(?)").join(",")})
  `, targetTables);

  const existingTables = new Set(tableRows.map((r) => String(r.table_name).toLowerCase()));

  console.log(`[student-id-fix] active database: ${activeDb}`);
  console.log(`[student-id-fix] mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`[student-id-fix] existing target tables: ${Array.from(existingTables).join(", ") || "(none)"}`);

  const hasStudentTable = await hasTable(conn, "student");
  if (!hasStudentTable) {
    throw new Error("student table not found; cannot align IDs.");
  }

  for (const tableName of targetTables) {
    if (!existingTables.has(tableName)) {
      console.log(`[student-id-fix] skip ${tableName}: table missing`);
      continue;
    }

    const hasStudentId = await hasColumn(conn, tableName, "student_id");
    if (!hasStudentId) {
      console.log(`[student-id-fix] skip ${tableName}: student_id column missing`);
      continue;
    }

    const [totalRows] = await conn.query(`SELECT COUNT(*) AS c FROM ${tableName}`);
    const [orphanRows] = await conn.query(`
      SELECT t.student_id, COUNT(*) AS c
      FROM ${tableName} t
      LEFT JOIN student s ON CAST(s.student_id AS CHAR) = CAST(t.student_id AS CHAR)
      WHERE s.student_id IS NULL
      GROUP BY t.student_id
      ORDER BY c DESC
      LIMIT 20
    `);

    console.log(`\n[student-id-fix] ${tableName} total rows: ${totalRows[0].c}`);
    console.log(`[student-id-fix] ${tableName} unmatched student_id sample:`);
    if (!orphanRows.length) {
      console.log("  (none)");
    } else {
      for (const row of orphanRows) {
        console.log(`  - ${row.student_id} (rows: ${row.c})`);
      }
    }

    const [candidateRows] = await conn.query(`
      SELECT
        CAST(t.student_id AS CHAR) AS source_id,
        CAST(s.student_id AS CHAR) AS target_id,
        COUNT(*) AS row_count
      FROM ${tableName} t
      JOIN student s
        ON t.student_id REGEXP '^[0-9]+$'
       AND s.student_id REGEXP '^[0-9]+$'
       AND CAST(t.student_id AS UNSIGNED) = CAST(s.student_id AS UNSIGNED)
      WHERE CAST(t.student_id AS CHAR) <> CAST(s.student_id AS CHAR)
      GROUP BY CAST(t.student_id AS CHAR), CAST(s.student_id AS CHAR)
      ORDER BY row_count DESC
    `);

    console.log(`[student-id-fix] ${tableName} numeric-equivalent remap candidates:`);
    if (!candidateRows.length) {
      console.log("  (none)");
    } else {
      for (const row of candidateRows) {
        console.log(`  - ${row.source_id} -> ${row.target_id} (rows: ${row.row_count})`);
      }
    }

    if (APPLY && candidateRows.length) {
      await conn.beginTransaction();
      try {
        const [updateResult] = await conn.query(`
          UPDATE ${tableName} t
          JOIN student s
            ON t.student_id REGEXP '^[0-9]+$'
           AND s.student_id REGEXP '^[0-9]+$'
           AND CAST(t.student_id AS UNSIGNED) = CAST(s.student_id AS UNSIGNED)
          SET t.student_id = s.student_id
          WHERE CAST(t.student_id AS CHAR) <> CAST(s.student_id AS CHAR)
        `);
        await conn.commit();
        console.log(`[student-id-fix] ${tableName} updated rows: ${updateResult.affectedRows}`);
      } catch (error) {
        await conn.rollback();
        throw error;
      }
    }
  }

  await conn.end();
}

async function hasTable(conn, tableName) {
  const [rows] = await conn.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
    [tableName]
  );
  return rows.length > 0;
}

async function hasColumn(conn, tableName, columnName) {
  const [rows] = await conn.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1",
    [tableName, columnName]
  );
  return rows.length > 0;
}

main().catch((error) => {
  console.error("[student-id-fix] failed:", error);
  process.exit(1);
});

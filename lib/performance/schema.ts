import { query } from "@/lib/db";

let schemaPromise: Promise<void> | null = null;

export async function ensurePerformanceSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS activities (
          activity_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          type VARCHAR(32) NOT NULL,
          subject VARCHAR(64) NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT NULL,
          date DATETIME NOT NULL,
          PRIMARY KEY (activity_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );

      await query(
        `CREATE TABLE IF NOT EXISTS performance_records (
          record_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          student_id VARCHAR(64) NOT NULL,
          activity_id BIGINT UNSIGNED NOT NULL,
          score DECIMAL(6,2) NOT NULL,
          total_items INT NULL,
          grade VARCHAR(32) NULL,
          metadata JSON NULL,
          completed_at DATETIME NULL,
          PRIMARY KEY (record_id),
          INDEX idx_performance_student (student_id),
          INDEX idx_performance_activity (activity_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );

      await query(
        `CREATE TABLE IF NOT EXISTS remarks (
          remark_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          performance_record_id BIGINT UNSIGNED NOT NULL,
          content TEXT NOT NULL,
          teacher_notes TEXT NULL,
          PRIMARY KEY (remark_id),
          INDEX idx_remarks_performance (performance_record_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );
    })();
  }

  await schemaPromise;
}

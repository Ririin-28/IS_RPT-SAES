import { getTableColumns, query } from "@/lib/db";

let schemaPromise: Promise<void> | null = null;

async function ensureTableColumn(tableName: string, columnName: string, definition: string): Promise<void> {
  const columns = await getTableColumns(tableName);
  if (columns.has(columnName)) return;
  await query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

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

      await query(
        `CREATE TABLE IF NOT EXISTS student_remedial_session (
          session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          student_id VARCHAR(64) NOT NULL,
          approved_schedule_id BIGINT UNSIGNED NOT NULL,
          subject_id BIGINT UNSIGNED NOT NULL,
          grade_id BIGINT UNSIGNED NOT NULL,
          phonemic_id BIGINT UNSIGNED NULL,
          material_id BIGINT UNSIGNED NULL,
          overall_average DECIMAL(6,2) NULL,
          ai_remarks TEXT NULL,
          completed_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (session_id),
          UNIQUE KEY uq_student_schedule (student_id, approved_schedule_id),
          INDEX idx_remedial_session_student (student_id),
          INDEX idx_remedial_session_schedule (approved_schedule_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );

      await query(
        `CREATE TABLE IF NOT EXISTS student_remedial_flashcard_performance (
          performance_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          session_id BIGINT UNSIGNED NOT NULL,
          flashcard_index INT NOT NULL,
          expected_text TEXT NULL,
          pronunciation_score DECIMAL(6,2) NOT NULL,
          accuracy_score DECIMAL(6,2) NOT NULL,
          fluency_score DECIMAL(6,2) NOT NULL,
          completeness_score DECIMAL(6,2) NOT NULL,
          reading_speed_wpm DECIMAL(8,2) NOT NULL,
          slide_average DECIMAL(6,2) NOT NULL,
          transcription LONGTEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (performance_id),
          INDEX idx_remedial_perf_session (session_id),
          INDEX idx_remedial_perf_slide (session_id, flashcard_index)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );

      await query(
        `CREATE TABLE IF NOT EXISTS student_phonemic_history (
          history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          student_id VARCHAR(64) NOT NULL,
          subject_id BIGINT UNSIGNED NOT NULL,
          phonemic_id BIGINT UNSIGNED NOT NULL,
          achieved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (history_id),
          UNIQUE KEY uq_student_subject_phonemic (student_id, subject_id, phonemic_id),
          INDEX idx_phonemic_history_student (student_id),
          INDEX idx_phonemic_history_subject (subject_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );

      await ensureTableColumn("student_remedial_session", "overall_average", "DECIMAL(6,2) NULL");
      await ensureTableColumn("student_remedial_session", "ai_remarks", "TEXT NULL");
      await ensureTableColumn("student_remedial_session", "completed_at", "DATETIME NULL");
      await ensureTableColumn("student_remedial_session", "material_id", "BIGINT UNSIGNED NULL");
      await ensureTableColumn("student_remedial_session", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");

      await ensureTableColumn("student_remedial_flashcard_performance", "expected_text", "TEXT NULL");
      await ensureTableColumn("student_remedial_flashcard_performance", "pronunciation_score", "DECIMAL(6,2) NOT NULL DEFAULT 0");
      await ensureTableColumn("student_remedial_flashcard_performance", "accuracy_score", "DECIMAL(6,2) NOT NULL DEFAULT 0");
      await ensureTableColumn("student_remedial_flashcard_performance", "fluency_score", "DECIMAL(6,2) NOT NULL DEFAULT 0");
      await ensureTableColumn("student_remedial_flashcard_performance", "completeness_score", "DECIMAL(6,2) NOT NULL DEFAULT 0");
      await ensureTableColumn("student_remedial_flashcard_performance", "reading_speed_wpm", "DECIMAL(8,2) NOT NULL DEFAULT 0");
      await ensureTableColumn("student_remedial_flashcard_performance", "slide_average", "DECIMAL(6,2) NOT NULL DEFAULT 0");
      await ensureTableColumn("student_remedial_flashcard_performance", "transcription", "LONGTEXT NULL");
      await ensureTableColumn("student_remedial_flashcard_performance", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");

      await ensureTableColumn("student_phonemic_history", "achieved_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    })();
  }

  await schemaPromise;
}

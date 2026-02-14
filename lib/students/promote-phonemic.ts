import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

const ORDER_COLUMN_CANDIDATES = [
  "level_order",
  "sort_order",
  "order_index",
  "sequence",
  "position",
] as const;

export type SubjectName = "English" | "Filipino" | "Math";

type PromotionLevel = {
  phonemic_id: number;
  level_name: string | null;
};

export type PromotionResult = {
  currentLevel: PromotionLevel;
  nextLevel: PromotionLevel;
};

export async function promoteStudentPhonemic(
  studentId: string,
  subject: SubjectName
): Promise<PromotionResult> {
  const requiredTables = ["student_subject_assessment", "phonemic_level", "subject"];
  for (const table of requiredTables) {
    if (!(await tableExists(table))) {
      throw new Error(`Missing required table: ${table}`);
    }
  }

  const [subjectRows] = await query<RowDataPacket[]>(
    "SELECT subject_id FROM subject WHERE LOWER(subject_name) = ?",
    [subject.toLowerCase()],
  );

  if (!subjectRows.length) {
    throw new Error("Subject not found.");
  }

  const subjectId = Number(subjectRows[0].subject_id);
  if (!Number.isFinite(subjectId)) {
    throw new Error("Subject not found.");
  }

  const phonemicColumns = await getTableColumns("phonemic_level");
  const orderColumn = ORDER_COLUMN_CANDIDATES.find((column) => phonemicColumns.has(column)) ?? "phonemic_id";

  const [levels] = await query<RowDataPacket[]>(
    `SELECT phonemic_id, level_name, ${orderColumn} AS level_order
     FROM phonemic_level
     WHERE subject_id = ?
     ORDER BY ${orderColumn} ASC, phonemic_id ASC`,
    [subjectId],
  );

  if (!levels.length) {
    throw new Error("No phonemic levels configured for this subject.");
  }

  const [currentRows] = await query<RowDataPacket[]>(
    `SELECT assessment_id, phonemic_id
     FROM student_subject_assessment
     WHERE student_id = ? AND subject_id = ?
     ORDER BY assessed_at DESC, assessment_id DESC
     LIMIT 1`,
    [studentId, subjectId],
  );

  if (!currentRows.length) {
    throw new Error("Student does not have an assessment record yet.");
  }

  const assessmentId = Number(currentRows[0].assessment_id);
  const currentPhonemicId = Number(currentRows[0].phonemic_id);
  if (!Number.isFinite(assessmentId) || !Number.isFinite(currentPhonemicId)) {
    throw new Error("Student does not have a valid phonemic level yet.");
  }

  const currentIndex = levels.findIndex(
    (level) => Number(level.phonemic_id) === currentPhonemicId,
  );

  if (currentIndex < 0) {
    throw new Error("Current phonemic level not found for this subject.");
  }

  if (currentIndex >= levels.length - 1) {
    throw new Error("Student is already at the highest level.");
  }

  const currentLevel = levels[currentIndex];
  const nextLevel = levels[currentIndex + 1];

  await query(
    "UPDATE student_subject_assessment SET phonemic_id = ?, assessed_at = NOW() WHERE assessment_id = ?",
    [Number(nextLevel.phonemic_id), assessmentId],
  );

  return {
    currentLevel: {
      phonemic_id: Number(currentLevel.phonemic_id),
      level_name: typeof currentLevel.level_name === "string" ? currentLevel.level_name : null,
    },
    nextLevel: {
      phonemic_id: Number(nextLevel.phonemic_id),
      level_name: typeof nextLevel.level_name === "string" ? nextLevel.level_name : null,
    },
  };
}

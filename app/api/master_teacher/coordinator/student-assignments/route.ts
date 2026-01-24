import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getMasterTeacherSessionFromCookies } from "@/lib/server/master-teacher-session";

export const dynamic = "force-dynamic";

const ASSIGNMENT_TABLE = "student_teacher_assignment";
const MASTER_TEACHER_TABLE = "master_teacher";
const SUBJECT_TABLE_CANDIDATES = ["subject", "subjects"] as const;

const ensureAssignmentTable = async () => {
  await query(
    `CREATE TABLE IF NOT EXISTS ${ASSIGNMENT_TABLE} (
      assignment_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      student_id VARCHAR(20) NOT NULL,
      master_teacher_id VARCHAR(20) NULL,
      teacher_id VARCHAR(20) NULL,
      grade_id INT NOT NULL,
      subject_id INT NOT NULL,
      teacher_type ENUM('master_coordinator','master_remedial','regular_teacher') NOT NULL,
      assignment_reason VARCHAR(100) NULL,
      assigned_date DATE NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_student_assignment_student (student_id),
      KEY idx_student_assignment_teacher (teacher_id),
      KEY idx_student_assignment_master (master_teacher_id),
      KEY idx_student_assignment_grade_subject (grade_id, subject_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  );
};

const resolveSubjectTable = async () => {
  for (const table of SUBJECT_TABLE_CANDIDATES) {
    try {
      const columns = await getTableColumns(table);
      const idColumn = columns.has("subject_id") ? "subject_id" : columns.has("id") ? "id" : null;
      const nameColumn = columns.has("subject_name")
        ? "subject_name"
        : columns.has("name")
        ? "name"
        : null;
      if (idColumn && nameColumn) {
        return { table, idColumn, nameColumn };
      }
    } catch {
      continue;
    }
  }
  return null;
};

const resolveSubjectId = async (subjectLabel: string): Promise<number | null> => {
  const lookup = await resolveSubjectTable();
  if (!lookup) return null;
  const [rows] = await query<RowDataPacket[]>(
    `SELECT ${lookup.idColumn} AS subject_id FROM ${lookup.table} WHERE LOWER(TRIM(${lookup.nameColumn})) = ? LIMIT 1`,
    [subjectLabel.toLowerCase()],
  );
  const value = rows[0]?.subject_id;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveMasterTeacherId = async (userId: number | null, fallback?: string | null) => {
  if (fallback && String(fallback).trim().length > 0) {
    return String(fallback).trim();
  }
  if (!userId) return null;
  const [rows] = await query<RowDataPacket[]>(
    `SELECT master_teacher_id FROM ${MASTER_TEACHER_TABLE} WHERE user_id = ? LIMIT 1`,
    [userId],
  );
  const value = rows[0]?.master_teacher_id;
  return value ? String(value).trim() : null;
};

type AssignmentPayload = {
  teacherType: "master_coordinator" | "master_remedial" | "regular_teacher";
  teacherId?: string | null;
  masterTeacherId?: string | null;
  teacherUserId?: number | null;
  students: string[];
};

const VALID_TEACHER_TYPES = new Set<AssignmentPayload["teacherType"]>([
  "master_coordinator",
  "master_remedial",
  "regular_teacher",
]);

export async function POST(request: NextRequest) {
  try {
    const session = await getMasterTeacherSessionFromCookies();
    if (!session) {
      return NextResponse.json({ success: false, error: "Master teacher session not found." }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as {
      gradeId?: number;
      subject?: string;
      assignments?: AssignmentPayload[];
    } | null;

    const gradeId = Number(payload?.gradeId);
    if (!Number.isFinite(gradeId)) {
      return NextResponse.json({ success: false, error: "Invalid gradeId." }, { status: 400 });
    }

    const subjectLabel = typeof payload?.subject === "string" ? payload.subject.trim() : "";
    if (!subjectLabel) {
      return NextResponse.json({ success: false, error: "Subject is required." }, { status: 400 });
    }

    const assignments = Array.isArray(payload?.assignments) ? payload!.assignments : [];
    if (!assignments.length) {
      return NextResponse.json({ success: false, error: "Assignments are required." }, { status: 400 });
    }

    await ensureAssignmentTable();

    const subjectId = await resolveSubjectId(subjectLabel);
    if (!subjectId) {
      return NextResponse.json({ success: false, error: "Subject not found." }, { status: 404 });
    }

    await query(
      `UPDATE ${ASSIGNMENT_TABLE} SET is_active = 0 WHERE grade_id = ? AND subject_id = ? AND is_active = 1`,
      [gradeId, subjectId],
    );

    const rowsToInsert: Array<Array<string | number | null>> = [];

    for (const assignment of assignments) {
      const students = Array.isArray(assignment.students) ? assignment.students : [];
      if (!students.length) {
        continue;
      }

      const teacherType = assignment.teacherType;
      if (!VALID_TEACHER_TYPES.has(teacherType)) {
        return NextResponse.json(
          { success: false, error: "Invalid teacher_type value." },
          { status: 400 },
        );
      }
      const teacherId = typeof assignment.teacherId === "string" ? assignment.teacherId.trim() : null;
      const masterTeacherId = typeof assignment.masterTeacherId === "string" ? assignment.masterTeacherId.trim() : null;
      const teacherUserId = Number(assignment.teacherUserId ?? NaN);
      const resolvedMasterId = teacherType === "regular_teacher"
        ? null
        : await resolveMasterTeacherId(
            Number.isFinite(teacherUserId) ? teacherUserId : null,
            masterTeacherId ?? teacherId,
          );

      for (const studentIdRaw of students) {
        const studentId = typeof studentIdRaw === "string" ? studentIdRaw.trim() : "";
        if (!studentId) {
          continue;
        }

        rowsToInsert.push([
          studentId,
          teacherType === "regular_teacher" ? null : resolvedMasterId,
          teacherType === "regular_teacher" ? teacherId : null,
          gradeId,
          subjectId,
          teacherType,
          "auto-assign",
          new Date().toISOString(),
          1,
        ]);
      }
    }

    if (!rowsToInsert.length) {
      return NextResponse.json({ success: false, error: "No valid assignments were provided." }, { status: 400 });
    }

    const valuesSql = rowsToInsert.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");

    await query<ResultSetHeader>(
      `INSERT INTO ${ASSIGNMENT_TABLE}
        (student_id, master_teacher_id, teacher_id, grade_id, subject_id, teacher_type, assignment_reason, assigned_date, is_active)
       VALUES ${valuesSql}`,
      rowsToInsert.flat(),
    );

    return NextResponse.json({ success: true, inserted: rowsToInsert.length });
  } catch (error) {
    console.error("Failed to save student assignments", error);
    return NextResponse.json({ success: false, error: "Unable to save student assignments." }, { status: 500 });
  }
}

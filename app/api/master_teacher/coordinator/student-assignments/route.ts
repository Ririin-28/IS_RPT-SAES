import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getMasterTeacherSessionFromCookies } from "@/lib/server/master-teacher-session";

export const dynamic = "force-dynamic";

const ASSIGNMENT_TABLE = "student_teacher_assignment";
const MASTER_TEACHER_TABLE = "master_teacher";
const MT_REMEDIAL_HANDLED_TABLE = "mt_remedialteacher_handled";
const SUBJECT_TABLE_CANDIDATES = ["subject", "subjects"] as const;
const GRADE_TABLE = "grade";

const ensureAssignmentTable = async () => {
  await query(
    `CREATE TABLE IF NOT EXISTS ${ASSIGNMENT_TABLE} (
      assignment_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      student_id VARCHAR(20) NOT NULL,
      teacher_id VARCHAR(20) NULL,
      remedial_role_id VARCHAR(20) NULL,
      grade_id INT NOT NULL,
      subject_id INT NOT NULL,
      assigned_by_mt_id VARCHAR(20) NULL,
      assigned_date DATE NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_student_assignment_teacher (teacher_id),
      KEY idx_student_assignment_remedial (remedial_role_id),
      KEY idx_student_assignment_student (student_id),
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

const resolveGradeId = async (gradeLevelRaw: string): Promise<number | null> => {
  const trimmed = gradeLevelRaw.trim();
  if (!trimmed) return null;
  const numericMatch = trimmed.match(/\d+/);
  const numericValue = numericMatch ? Number(numericMatch[0]) : Number(trimmed);

  try {
    const gradeColumns = await getTableColumns(GRADE_TABLE);
    if (gradeColumns.has("grade_id") && gradeColumns.has("grade_level")) {
      const [rows] = await query<RowDataPacket[]>(
        `SELECT grade_id FROM ${GRADE_TABLE} WHERE grade_level = ? LIMIT 1`,
        [trimmed],
      );
      const value = rows[0]?.grade_id;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore and fall back to numeric parsing.
  }

  return Number.isFinite(numericValue) ? numericValue : null;
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

const resolveRemedialRoleId = async (masterTeacherId: string, gradeId: number): Promise<string | null> => {
  if (!masterTeacherId) return null;
  const [rows] = await query<RowDataPacket[]>(
    `SELECT remedial_role_id
     FROM ${MT_REMEDIAL_HANDLED_TABLE}
     WHERE master_teacher_id = ? AND grade_id = ? AND remedial_role_id IS NOT NULL
     LIMIT 1`,
    [masterTeacherId, gradeId],
  );

  const value = rows[0]?.remedial_role_id;
  if (value !== null && value !== undefined && String(value).trim().length > 0) {
    return String(value).trim();
  }

  const [fallbackRows] = await query<RowDataPacket[]>(
    `SELECT remedial_role_id
     FROM ${MT_REMEDIAL_HANDLED_TABLE}
     WHERE master_teacher_id = ? AND remedial_role_id IS NOT NULL
     LIMIT 1`,
    [masterTeacherId],
  );
  const fallbackValue = fallbackRows[0]?.remedial_role_id;
  if (fallbackValue !== null && fallbackValue !== undefined && String(fallbackValue).trim().length > 0) {
    return String(fallbackValue).trim();
  }

  return null;
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

    const assignmentColumns = await getTableColumns(ASSIGNMENT_TABLE).catch(() => new Set<string>());
    const hasRemedialRoleId = assignmentColumns.has("remedial_role_id");
    const hasAssignedByMt = assignmentColumns.has("assigned_by_mt_id");

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

      const remedialRoleId = resolvedMasterId
        ? await resolveRemedialRoleId(resolvedMasterId, gradeId)
        : null;

      for (const studentIdRaw of students) {
        const studentId = typeof studentIdRaw === "string" ? studentIdRaw.trim() : "";
        if (!studentId) {
          continue;
        }

        const row: Array<string | number | null> = [
          studentId,
          teacherType === "regular_teacher" ? teacherId : null,
          teacherType === "regular_teacher" ? null : remedialRoleId,
          gradeId,
          subjectId,
          hasAssignedByMt ? session.masterTeacherId ?? null : null,
          new Date().toISOString().slice(0, 10),
          1,
        ];

        if (!hasAssignedByMt) {
          row.splice(5, 1);
        }
        if (!hasRemedialRoleId) {
          row.splice(2, 1);
        }

        rowsToInsert.push(row);
      }
    }

    if (!rowsToInsert.length) {
      return NextResponse.json({ success: false, error: "No valid assignments were provided." }, { status: 400 });
    }

    const baseColumns = [
      "student_id",
      "teacher_id",
      "remedial_role_id",
      "grade_id",
      "subject_id",
      "assigned_by_mt_id",
      "assigned_date",
      "is_active",
    ];

    if (!hasRemedialRoleId) {
      baseColumns.splice(baseColumns.indexOf("remedial_role_id"), 1);
    }
    if (!hasAssignedByMt) {
      baseColumns.splice(baseColumns.indexOf("assigned_by_mt_id"), 1);
    }

    const valuesSql = rowsToInsert.map(() => `(${baseColumns.map(() => "?").join(", ")})`).join(", ");

    await query<ResultSetHeader>(
      `INSERT INTO ${ASSIGNMENT_TABLE}
        (${baseColumns.join(", ")})
       VALUES ${valuesSql}`,
      rowsToInsert.flat(),
    );

    return NextResponse.json({ success: true, inserted: rowsToInsert.length });
  } catch (error) {
    console.error("Failed to save student assignments", error);
    return NextResponse.json({ success: false, error: "Unable to save student assignments." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectParam = searchParams.get("subject") ?? "";
    const gradeLevelParam = searchParams.get("gradeLevel") ?? "";

    if (!subjectParam.trim()) {
      return NextResponse.json({ success: false, error: "Subject is required." }, { status: 400 });
    }
    if (!gradeLevelParam.trim()) {
      return NextResponse.json({ success: false, error: "Grade level is required." }, { status: 400 });
    }

    await ensureAssignmentTable();

    const subjectId = await resolveSubjectId(subjectParam.trim());
    if (!subjectId) {
      return NextResponse.json({ success: false, error: "Subject not found." }, { status: 404 });
    }

    const gradeId = await resolveGradeId(gradeLevelParam);
    if (!gradeId) {
      return NextResponse.json({ success: false, error: "Grade level not found." }, { status: 404 });
    }

    const assignmentColumns = await getTableColumns(ASSIGNMENT_TABLE).catch(() => new Set<string>());
    const hasIsActive = assignmentColumns.has("is_active");
    const activeClause = hasIsActive ? "AND sta.is_active = 1" : "";

    const [assignedRows] = await query<RowDataPacket[]>(
      `SELECT DISTINCT sta.student_id AS student_id
       FROM ${ASSIGNMENT_TABLE} sta
       WHERE sta.grade_id = ? AND sta.subject_id = ? ${activeClause}`,
      [gradeId, subjectId],
    );

    const assignedStudentIds = Array.isArray(assignedRows)
      ? assignedRows
          .map((row) => (row.student_id != null ? String(row.student_id).trim() : ""))
          .filter((value) => value.length > 0)
      : [];

    const [regularRows] = assignmentColumns.has("teacher_id")
      ? await query<RowDataPacket[]>(
          `SELECT sta.teacher_id AS teacher_id, COUNT(*) AS total
           FROM ${ASSIGNMENT_TABLE} sta
           WHERE sta.grade_id = ? AND sta.subject_id = ? ${activeClause} AND sta.teacher_id IS NOT NULL
           GROUP BY sta.teacher_id`,
          [gradeId, subjectId],
        )
      : [[] as RowDataPacket[]];

    const regularCounts: Record<string, number> = {};
    if (Array.isArray(regularRows)) {
      regularRows.forEach((row) => {
        const teacherId = row.teacher_id != null ? String(row.teacher_id).trim() : "";
        const count = Number(row.total);
        if (teacherId) {
          regularCounts[teacherId] = Number.isFinite(count) ? count : 0;
        }
      });
    }

    const remedialColumns = await getTableColumns(MT_REMEDIAL_HANDLED_TABLE).catch(() => new Set<string>());
    const masterTeacherColumns = await getTableColumns(MASTER_TEACHER_TABLE).catch(() => new Set<string>());
    const canJoinMasterTeacher = masterTeacherColumns.has("master_teacher_id") && masterTeacherColumns.has("user_id");
    const canJoinRemedial = remedialColumns.has("remedial_role_id") && remedialColumns.has("master_teacher_id");

    const [masterRows] = canJoinRemedial && assignmentColumns.has("remedial_role_id")
      ? await query<RowDataPacket[]>(
          `SELECT mrh.master_teacher_id AS master_teacher_id,
                  ${canJoinMasterTeacher ? "mt.user_id" : "NULL"} AS user_id,
                  COUNT(*) AS total
           FROM ${ASSIGNMENT_TABLE} sta
           JOIN ${MT_REMEDIAL_HANDLED_TABLE} mrh ON mrh.remedial_role_id = sta.remedial_role_id
           ${canJoinMasterTeacher ? `LEFT JOIN ${MASTER_TEACHER_TABLE} mt ON mt.master_teacher_id = mrh.master_teacher_id` : ""}
           WHERE sta.grade_id = ? AND sta.subject_id = ? ${activeClause} AND sta.remedial_role_id IS NOT NULL
           GROUP BY mrh.master_teacher_id${canJoinMasterTeacher ? ", mt.user_id" : ""}`,
          [gradeId, subjectId],
        )
      : [[] as RowDataPacket[]];

    const masterCounts = Array.isArray(masterRows)
      ? masterRows.map((row) => ({
          masterTeacherId: row.master_teacher_id != null ? String(row.master_teacher_id).trim() : null,
          userId: row.user_id != null ? Number(row.user_id) : null,
          count: Number.isFinite(Number(row.total)) ? Number(row.total) : 0,
        }))
      : [];

    return NextResponse.json({
      success: true,
      assignedStudentIds,
      counts: {
        regular: regularCounts,
        master: masterCounts,
      },
    });
  } catch (error) {
    console.error("Failed to load assignment status", error);
    return NextResponse.json({ success: false, error: "Unable to load assignment status." }, { status: 500 });
  }
}

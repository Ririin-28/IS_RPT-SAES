import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const TEACHER_TABLE_CANDIDATES = ["teacher", "teachers", "teacher_info"] as const;
const REMEDIAL_TABLE_CANDIDATES = ["remedial_teacher", "remedial_teachers"] as const;
const GRADE_COLUMNS = ["grade", "grade_level", "handled_grade", "gradeLevel", "year_level"] as const;
const SUBJECT_COLUMNS = ["subjects", "handled_subjects", "subject"] as const;
const CONTACT_COLUMNS = ["contact_number", "phone_number", "contact", "phone"] as const;

type TeacherRow = RowDataPacket & {
  user_id: number;
  user_first_name?: string | null;
  user_middle_name?: string | null;
  user_last_name?: string | null;
  user_suffix?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_contact_number?: string | null;
  user_phone_number?: string | null;
  user_role?: string | null;
  teacher_first_name?: string | null;
  teacher_middle_name?: string | null;
  teacher_last_name?: string | null;
  teacher_suffix?: string | null;
  teacher_name?: string | null;
  teacher_email?: string | null;
  teacher_contact_number?: string | null;
  teacher_phone_number?: string | null;
  teacher_grade?: string | null;
  teacher_grade_level?: string | null;
  teacher_handled_grade?: string | null;
  teacher_year_level?: string | null;
  rt_grade?: string | null;
  rt_grade_level?: string | null;
  rt_handled_grade?: string | null;
  rt_year_level?: string | null;
  subjects_value?: string | null;
};

async function safeGetColumns(tableName: string): Promise<Set<string>> {
  try {
    return await getTableColumns(tableName);
  } catch {
    return new Set<string>();
  }
}

async function resolveTeacherTable() {
  for (const candidate of TEACHER_TABLE_CANDIDATES) {
    const columns = await safeGetColumns(candidate);
    if (columns.size > 0 && columns.has("user_id")) {
      return { table: candidate, columns };
    }
  }
  return { table: null, columns: new Set<string>() };
}

async function resolveRemedialTable() {
  for (const candidate of REMEDIAL_TABLE_CANDIDATES) {
    const columns = await safeGetColumns(candidate);
    if (columns.size > 0) {
      return { table: candidate, columns };
    }
  }
  return { table: null, columns: new Set<string>() };
}

function pickFirst<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) continue;
      return trimmed as T;
    }
    return value;
  }
  return null;
}

function formatRole(role?: string | null): string {
  if (!role) return "Teacher";
  const normalized = role.toLowerCase().trim();
  if (normalized === "teacher") return "Teacher";
  if (normalized === "master_teacher" || normalized === "masterteacher") return "Master Teacher";
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

function buildName(
  firstName: string | null,
  middleName: string | null,
  lastName: string | null,
  suffix: string | null,
): string | null {
  const parts = [firstName, middleName, lastName]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .map((part) => part?.trim());
  if (parts.length === 0) return null;
  if (suffix && suffix.trim().length > 0) {
    parts.push(suffix.trim());
  }
  return parts.join(" ");
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userIdParam = url.searchParams.get("userId");

  if (!userIdParam) {
    return NextResponse.json(
      { success: false, error: "Missing userId query parameter." },
      { status: 400 },
    );
  }

  const userId = Number(userIdParam);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid userId value." }, { status: 400 });
  }

  try {
    const userColumns = await safeGetColumns("users");
    if (userColumns.size === 0) {
      return NextResponse.json(
        { success: false, error: "Users table is not accessible." },
        { status: 500 },
      );
    }

    const teacherInfo = await resolveTeacherTable();
    const remedialInfo = await resolveRemedialTable();
    const selectParts: string[] = ["u.user_id AS user_id"];
    const params: Array<number> = [userId];

    const addUserColumn = (column: string, alias: string) => {
      if (userColumns.has(column)) {
        selectParts.push(`u.${column} AS ${alias}`);
      }
    };

    const addTeacherColumn = (column: string, alias: string) => {
      if (teacherInfo.table && teacherInfo.columns.has(column)) {
        selectParts.push(`t.${column} AS ${alias}`);
      }
    };

    const addRemedialColumn = (column: string, alias: string) => {
      if (remedialInfo.table && remedialInfo.columns.has(column)) {
        selectParts.push(`rt.${column} AS ${alias}`);
      }
    };

    addUserColumn("first_name", "user_first_name");
    addUserColumn("middle_name", "user_middle_name");
    addUserColumn("last_name", "user_last_name");
    addUserColumn("suffix", "user_suffix");
    addUserColumn("name", "user_name");
    addUserColumn("email", "user_email");
    addUserColumn("contact_number", "user_contact_number");
    addUserColumn("phone_number", "user_phone_number");
    addUserColumn("role", "user_role");

    if (teacherInfo.table && teacherInfo.columns.size > 0) {
      addTeacherColumn("first_name", "teacher_first_name");
      addTeacherColumn("middle_name", "teacher_middle_name");
      addTeacherColumn("last_name", "teacher_last_name");
      addTeacherColumn("suffix", "teacher_suffix");
      addTeacherColumn("name", "teacher_name");
      addTeacherColumn("email", "teacher_email");
      addTeacherColumn("contact_number", "teacher_contact_number");
      addTeacherColumn("phone_number", "teacher_phone_number");
      addTeacherColumn("grade", "teacher_grade");
      addTeacherColumn("grade_level", "teacher_grade_level");
      addTeacherColumn("handled_grade", "teacher_handled_grade");
      addTeacherColumn("year_level", "teacher_year_level");

      for (const subjectCol of SUBJECT_COLUMNS) {
        if (teacherInfo.columns.has(subjectCol)) {
          selectParts.push(`t.${subjectCol} AS subjects_value`);
          break;
        }
      }
    }

    if (remedialInfo.table && remedialInfo.columns.size > 0) {
      addRemedialColumn("grade", "rt_grade");
      addRemedialColumn("grade_level", "rt_grade_level");
      addRemedialColumn("handled_grade", "rt_handled_grade");
      addRemedialColumn("year_level", "rt_year_level");
    }

    let joinClause = "";
    if (teacherInfo.table) {
      joinClause += `LEFT JOIN \`${teacherInfo.table}\` AS t ON t.user_id = u.user_id`;
    }
    if (remedialInfo.table && remedialInfo.table !== teacherInfo.table) {
      joinClause += ` LEFT JOIN \`${remedialInfo.table}\` AS rt ON rt.user_id = u.user_id`;
    }

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM users AS u
      ${joinClause}
      WHERE u.user_id = ?
      LIMIT 1
    `;

    const [rows] = await query<TeacherRow[]>(sql, params);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Teacher record was not found." },
        { status: 404 },
      );
    }

    const row = rows[0];

    const firstName = pickFirst(row.teacher_first_name, row.user_first_name);
    const middleName = pickFirst(row.teacher_middle_name, row.user_middle_name);
    const lastName = pickFirst(row.teacher_last_name, row.user_last_name);
    const suffix = pickFirst(row.teacher_suffix, row.user_suffix);
    const displayName = pickFirst(
      row.teacher_name,
      row.user_name,
      buildName(firstName, middleName, lastName, suffix),
    );

    const grade = pickFirst(
      row.rt_grade,
      row.rt_grade_level,
      row.rt_handled_grade,
      row.rt_year_level,
      row.teacher_grade,
      row.teacher_grade_level,
      row.teacher_handled_grade,
      row.teacher_year_level,
    );
    const subjects = row.subjects_value?.trim() || null;
    const email = pickFirst(row.teacher_email, row.user_email);
    const contactNumber = pickFirst(
      row.teacher_contact_number,
      row.teacher_phone_number,
      row.user_contact_number,
      row.user_phone_number,
    );

    return NextResponse.json({
      success: true,
      teacher: {
        userId: row.user_id,
        name: displayName,
        lastName,
        email,
        contactNumber,
        gradeLevel: grade,
        subjectsHandled: subjects,
        role: formatRole(row.user_role),
      },
    });
  } catch (error) {
    console.error("Failed to load teacher profile", error);
    return NextResponse.json(
      { success: false, error: "Failed to load teacher profile." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const MASTER_TEACHER_TABLE_CANDIDATES = [
  "master_teacher",
  "master_teachers",
  "masterteacher",
  "master_teacher_info",
  "master_teacher_tbl",
] as const;

const GRADE_COLUMN_CANDIDATES = [
  { column: "grade", alias: "mt_grade" },
  { column: "handled_grade", alias: "mt_handled_grade" },
  { column: "grade_level", alias: "mt_grade_level" },
  { column: "gradeLevel", alias: "mt_gradeLevel" },
  { column: "gradelevel", alias: "mt_gradelevel" },
] as const;

const COORDINATOR_COLUMN_CANDIDATES = [
  { column: "mt_coordinator", alias: "mt_coordinator" },
  { column: "coordinator_subject", alias: "mt_coordinator_subject" },
  { column: "coordinatorSubject", alias: "mt_coordinatorSubject" },
  { column: "coordinator", alias: "mt_coordinator_generic" },
  { column: "coordinator_subject_handled", alias: "mt_coordinator_subject_handled" },
] as const;

const SUBJECT_COLUMN_CANDIDATES = [
  { column: "subjects", alias: "mt_subjects" },
  { column: "handled_subjects", alias: "mt_handled_subjects" },
  { column: "subject", alias: "mt_subject" },
  { column: "remediation_subjects", alias: "mt_remediation_subjects" },
] as const;

const SECTION_COLUMN_CANDIDATES = [
  { column: "section", alias: "mt_section" },
  { column: "section_name", alias: "mt_section_name" },
  { column: "class_section", alias: "mt_class_section" },
] as const;

interface MasterTeacherTableInfo {
  table: string | null;
  columns: Set<string>;
}

async function safeGetColumns(tableName: string): Promise<Set<string>> {
  try {
    return await getTableColumns(tableName);
  } catch {
    return new Set<string>();
  }
}

async function resolveMasterTeacherTable(): Promise<MasterTeacherTableInfo> {
  for (const candidate of MASTER_TEACHER_TABLE_CANDIDATES) {
    const columns = await safeGetColumns(candidate);
    if (columns.size > 0) {
      return { table: candidate, columns } satisfies MasterTeacherTableInfo;
    }
  }
  return { table: null, columns: new Set<string>() } satisfies MasterTeacherTableInfo;
}

function pickFirst<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        continue;
      }
      return trimmed as T;
    }
    return value;
  }
  return null;
}

function buildName(
  firstName: string | null,
  middleName: string | null,
  lastName: string | null,
  suffix: string | null,
): string | null {
  const parts = [firstName, middleName, lastName]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .map((part) => (part ? part.trim() : ""));
  if (parts.length === 0) {
    return null;
  }
  if (suffix && suffix.trim().length > 0) {
    parts.push(suffix.trim());
  }
  return parts.join(" ");
}

type RawCoordinatorRow = RowDataPacket & {
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
  mt_first_name?: string | null;
  mt_middle_name?: string | null;
  mt_last_name?: string | null;
  mt_suffix?: string | null;
  mt_name?: string | null;
  mt_email?: string | null;
  mt_grade?: string | null;
  mt_grade_level?: string | null;
  mt_gradeLevel?: string | null;
  mt_gradelevel?: string | null;
  mt_handled_grade?: string | null;
  mt_coordinator?: string | null;
  mt_coordinator_subject?: string | null;
  mt_coordinatorSubject?: string | null;
  mt_coordinator_generic?: string | null;
  mt_coordinator_subject_handled?: string | null;
  mt_subjects?: string | null;
  mt_handled_subjects?: string | null;
  mt_subject?: string | null;
  mt_remediation_subjects?: string | null;
  mt_section?: string | null;
  mt_section_name?: string | null;
  mt_class_section?: string | null;
};

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

    const masterTeacherInfo = await resolveMasterTeacherTable();

    const selectParts: string[] = [];
    const params: Array<number> = [userId];

    const addUserColumn = (column: string, alias: string) => {
      if (userColumns.has(column)) {
        selectParts.push(`u.${column} AS ${alias}`);
      }
    };

    const addMasterColumn = (column: string, alias: string) => {
      if (masterTeacherInfo.table && masterTeacherInfo.columns.has(column)) {
        selectParts.push(`mt.${column} AS ${alias}`);
      }
    };

    selectParts.push("u.user_id AS user_id");
    addUserColumn("first_name", "user_first_name");
    addUserColumn("middle_name", "user_middle_name");
    addUserColumn("last_name", "user_last_name");
    addUserColumn("suffix", "user_suffix");
    addUserColumn("name", "user_name");
    addUserColumn("email", "user_email");
    addUserColumn("contact_number", "user_contact_number");
    addUserColumn("phone_number", "user_phone_number");
    addUserColumn("role", "user_role");

    if (masterTeacherInfo.table && masterTeacherInfo.columns.size > 0) {
      addMasterColumn("first_name", "mt_first_name");
      addMasterColumn("middle_name", "mt_middle_name");
      addMasterColumn("last_name", "mt_last_name");
      addMasterColumn("suffix", "mt_suffix");
      addMasterColumn("name", "mt_name");
      addMasterColumn("email", "mt_email");

      for (const candidate of GRADE_COLUMN_CANDIDATES) {
        addMasterColumn(candidate.column, candidate.alias);
      }
      for (const candidate of COORDINATOR_COLUMN_CANDIDATES) {
        addMasterColumn(candidate.column, candidate.alias);
      }
      for (const candidate of SUBJECT_COLUMN_CANDIDATES) {
        addMasterColumn(candidate.column, candidate.alias);
      }
      for (const candidate of SECTION_COLUMN_CANDIDATES) {
        addMasterColumn(candidate.column, candidate.alias);
      }
    }

    let joinClause = "";
    const joinStrategies: string[] = [];

    if (masterTeacherInfo.table && masterTeacherInfo.columns.size > 0) {
      const joinConditions: string[] = [];
      if (masterTeacherInfo.columns.has("user_id")) {
        joinConditions.push("mt.user_id = u.user_id");
        joinStrategies.push("user_id");
      }
      if (masterTeacherInfo.columns.has("master_teacher_id")) {
        joinConditions.push("mt.master_teacher_id = u.user_id");
        joinStrategies.push("master_teacher_id");
      }
      if (masterTeacherInfo.columns.has("masterteacher_id")) {
        joinConditions.push("mt.masterteacher_id = u.user_id");
        joinStrategies.push("masterteacher_id");
      }
      if (masterTeacherInfo.columns.has("teacher_id")) {
        joinConditions.push("mt.teacher_id = u.user_id");
        joinStrategies.push("teacher_id");
      }
      if (masterTeacherInfo.columns.has("email") && userColumns.has("email")) {
        joinConditions.push("mt.email = u.email");
        joinStrategies.push("email");
      }
      if (masterTeacherInfo.columns.has("user_email") && userColumns.has("email")) {
        joinConditions.push("mt.user_email = u.email");
        joinStrategies.push("user_email");
      }

      if (joinConditions.length > 0) {
        joinClause = ` LEFT JOIN \`${masterTeacherInfo.table}\` AS mt ON ${joinConditions.join(" OR ")}`;
      } else {
        joinClause = ` LEFT JOIN \`${masterTeacherInfo.table}\` AS mt ON FALSE`;
      }
    }

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM users AS u
      ${joinClause}
      WHERE u.user_id = ?
      LIMIT 1
    `;

    const [rows] = await query<RawCoordinatorRow[]>(sql, params);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Coordinator record was not found." },
        { status: 404 },
      );
    }

    const row = rows[0];

    const grade = pickFirst(
      row.mt_grade,
      row.mt_handled_grade,
      row.mt_grade_level,
      row.mt_gradeLevel,
      row.mt_gradelevel,
    );

    const coordinatorSubject = pickFirst(
      row.mt_coordinator,
      row.mt_coordinator_subject,
      row.mt_coordinatorSubject,
      row.mt_coordinator_generic,
      row.mt_coordinator_subject_handled,
    );

    const subjects = pickFirst(
      row.mt_subjects,
      row.mt_handled_subjects,
      row.mt_subject,
      row.mt_remediation_subjects,
    );

    const section = pickFirst(
      row.mt_section,
      row.mt_section_name,
      row.mt_class_section,
    );

    const firstName = pickFirst(row.mt_first_name, row.user_first_name);
    const middleName = pickFirst(row.mt_middle_name, row.user_middle_name);
    const lastName = pickFirst(row.mt_last_name, row.user_last_name);
    const suffix = pickFirst(row.mt_suffix, row.user_suffix);
    const displayName = pickFirst(row.mt_name, row.user_name, buildName(firstName, middleName, lastName, suffix));

    const email = pickFirst(row.user_email, row.mt_email);
    const contactNumber = pickFirst(row.user_contact_number, row.user_phone_number);

    return NextResponse.json({
      success: true,
      coordinator: {
        userId: row.user_id,
        name: displayName,
        gradeLevel: grade,
        coordinatorSubject,
        subjectsHandled: subjects,
        section,
        email,
        contactNumber,
      },
      activities: [],
      metadata: {
        masterTeacherTable: masterTeacherInfo.table,
        joinStrategies,
        gradeColumnsDetected: GRADE_COLUMN_CANDIDATES.filter((candidate) =>
          masterTeacherInfo.columns.has(candidate.column),
        ).map((candidate) => candidate.column),
        coordinatorColumnsDetected: COORDINATOR_COLUMN_CANDIDATES.filter((candidate) =>
          masterTeacherInfo.columns.has(candidate.column),
        ).map((candidate) => candidate.column),
      },
    });
  } catch (error) {
    console.error("Failed to load coordinator profile", error);
    return NextResponse.json(
      { success: false, error: "Failed to load coordinator profile." },
      { status: 500 },
    );
  }
}

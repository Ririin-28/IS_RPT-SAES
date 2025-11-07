import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import {
  HttpError,
  createMasterTeacher,
  sanitizeEmail,
  sanitizeNamePart,
  sanitizeOptionalNamePart,
  sanitizePhoneNumber,
  sanitizeGrade,
  sanitizeOptionalString,
  sanitizeCoordinatorSubject,
} from "./validation/validation";

export const dynamic = "force-dynamic";

const ROLE_FILTERS = ["master_teacher", "master teacher", "master-teacher"] as const;
const DEFAULT_SUBJECTS_STRING = "English, Filipino, Math";

type RawMasterTeacherRow = RowDataPacket & {
  user_id: number;
  user_first_name?: string | null;
  user_middle_name?: string | null;
  user_last_name?: string | null;
  user_suffix?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_contact_number?: string | null;
  user_phone_number?: string | null;
  user_status?: string | null;
  user_created_at?: Date | null;
  mt_master_teacher_id?: string | null;
  mt_teacher_id?: string | null;
  mt_first_name?: string | null;
  mt_middle_name?: string | null;
  mt_last_name?: string | null;
  mt_suffix?: string | null;
  mt_name?: string | null;
  mt_email?: string | null;
  mt_contact_number?: string | null;
  mt_phone_number?: string | null;
  mt_grade?: string | null;
  mt_section?: string | null;
  mt_subjects?: string | null;
  mt_status?: string | null;
  rt_grade?: string | null;
  rt_handled_grade?: string | null;
  rt_grade_level?: string | null;
  rt_gradeLevel?: string | null;
  mc_subject_handled?: string | null;
  last_login?: Date | null;
};

function coalesce<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string" && value.trim().length === 0) {
      continue;
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
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return null;
  }
  if (suffix && suffix.trim().length > 0) {
    parts.push(suffix.trim());
  }
  return parts.join(" ");
}

async function safeGetColumns(table: string): Promise<Set<string>> {
  try {
    return await getTableColumns(table);
  } catch {
    return new Set<string>();
  }
}

const MASTER_TEACHER_TABLE_CANDIDATES = [
  "master_teacher",
  "master_teachers",
  "masterteacher",
  "master_teacher_info",
  "master_teacher_tbl",
] as const;

const REMEDIAL_TEACHER_TABLE_CANDIDATES = [
  "remedial_teacher",
  "remedial_teachers",
  "remedialteacher",
  "remedial_teacher_info",
  "remedial_teacher_tbl",
] as const;

const MT_COORDINATOR_TABLE_CANDIDATES = [
  "mt_coordinator",
  "mt_coordinators",
  "mtcoordinator",
  "mt_coordinator_info",
  "mt_coordinator_tbl",
] as const;

async function resolveMasterTeacherTable(): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of MASTER_TEACHER_TABLE_CANDIDATES) {
    try {
      const columns = await safeGetColumns(candidate);
      if (columns.size > 0) {
        return { table: candidate, columns };
      }
    } catch {
      // continue to next candidate
    }
  }
  return { table: null, columns: new Set<string>() };
}

async function resolveRemedialTeacherTable(): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of REMEDIAL_TEACHER_TABLE_CANDIDATES) {
    try {
      const columns = await safeGetColumns(candidate);
      if (columns.size > 0) {
        return { table: candidate, columns };
      }
    } catch {
      // continue to next candidate
    }
  }
  return { table: null, columns: new Set<string>() };
}

async function resolveMtCoordinatorTable(): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of MT_COORDINATOR_TABLE_CANDIDATES) {
    try {
      const columns = await safeGetColumns(candidate);
      if (columns.size > 0) {
        return { table: candidate, columns };
      }
    } catch {
      // continue to next candidate
    }
  }
  return { table: null, columns: new Set<string>() };
}

export async function GET() {
  try {
    const userColumns = await safeGetColumns("users");
    if (userColumns.size === 0) {
      return NextResponse.json({ error: "Users table is not accessible." }, { status: 500 });
    }

    const masterTeacherInfo = await resolveMasterTeacherTable();
    const remedialTeacherInfo = await resolveRemedialTeacherTable();
    const mtCoordinatorInfo = await resolveMtCoordinatorTable();
    const accountLogsExists = await tableExists("account_logs");
    const accountLogsColumns = accountLogsExists ? await safeGetColumns("account_logs") : new Set<string>();
    const canJoinAccountLogs = accountLogsExists && accountLogsColumns.has("user_id");

    const selectParts: string[] = ["u.user_id AS user_id"];

    const addUserColumn = (column: string, alias: string) => {
      if (userColumns.has(column)) {
        selectParts.push(`u.${column} AS ${alias}`);
      }
    };

    const addMasterTeacherColumn = (column: string, alias: string) => {
      if (masterTeacherInfo.columns.has(column)) {
        selectParts.push(`mt.${column} AS ${alias}`);
      }
    };

    const addRemedialTeacherColumn = (column: string, alias: string) => {
      if (remedialTeacherInfo.columns.has(column)) {
        selectParts.push(`rt.${column} AS ${alias}`);
      }
    };

    const addMtCoordinatorColumn = (column: string, alias: string) => {
      if (mtCoordinatorInfo.columns.has(column)) {
        selectParts.push(`mc.${column} AS ${alias}`);
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
    addUserColumn("status", "user_status");
    addUserColumn("created_at", "user_created_at");

    addMasterTeacherColumn("master_teacher_id", "mt_master_teacher_id");
    addMasterTeacherColumn("teacher_id", "mt_teacher_id");
    addMasterTeacherColumn("first_name", "mt_first_name");
    addMasterTeacherColumn("middle_name", "mt_middle_name");
    addMasterTeacherColumn("last_name", "mt_last_name");
    addMasterTeacherColumn("suffix", "mt_suffix");
    addMasterTeacherColumn("name", "mt_name");
    addMasterTeacherColumn("email", "mt_email");
    addMasterTeacherColumn("contact_number", "mt_contact_number");
    addMasterTeacherColumn("phone_number", "mt_phone_number");
    addMasterTeacherColumn("remedial_teacher_grade", "mt_remedial_grade");
    addMasterTeacherColumn("grade", "mt_grade");
    addMasterTeacherColumn("section", "mt_section");
    addMasterTeacherColumn("subjects", "mt_subjects");
    addMasterTeacherColumn("subject_handled", "mt_subject_handled");
    addMasterTeacherColumn("mt_coordinator", "mt_coordinator");
    addMasterTeacherColumn("coordinator_subject", "mt_coordinator_subject");
    addMasterTeacherColumn("coordinator", "mt_coordinator_generic");
    addMasterTeacherColumn("coordinatorSubject", "mt_coordinator_camel");
    addMasterTeacherColumn("status", "mt_status");

  addRemedialTeacherColumn("grade", "rt_grade");
  addRemedialTeacherColumn("handled_grade", "rt_handled_grade");
  addRemedialTeacherColumn("grade_level", "rt_grade_level");
  addRemedialTeacherColumn("gradeLevel", "rt_gradeLevel");

    addMtCoordinatorColumn("subject_handled", "mc_subject_handled");

    if (canJoinAccountLogs) {
      if (accountLogsColumns.has("last_login") || accountLogsColumns.has("created_at")) {
        selectParts.push("latest.last_login AS last_login");
      }
    }

    const rolePlaceholders = ROLE_FILTERS.map(() => "?").join(", ");

    let joinClauses = "";

    if (masterTeacherInfo.table && masterTeacherInfo.columns.size > 0) {
      const masterTable = `\`${masterTeacherInfo.table}\``;
      if (masterTeacherInfo.columns.has("user_id")) {
        joinClauses += ` LEFT JOIN ${masterTable} AS mt ON mt.user_id = u.user_id`;
      } else if (masterTeacherInfo.columns.has("master_teacher_id")) {
        joinClauses += ` LEFT JOIN ${masterTable} AS mt ON mt.master_teacher_id = u.user_id`;
      } else if (masterTeacherInfo.columns.has("masterteacher_id")) {
        joinClauses += ` LEFT JOIN ${masterTable} AS mt ON mt.masterteacher_id = u.user_id`;
      }
    }

    if (remedialTeacherInfo.table && remedialTeacherInfo.columns.size > 0) {
      const remedialTable = `\`${remedialTeacherInfo.table}\``;
      if (remedialTeacherInfo.columns.has("user_id")) {
        joinClauses += ` LEFT JOIN ${remedialTable} AS rt ON rt.user_id = u.user_id`;
      } else if (remedialTeacherInfo.columns.has("master_teacher_id")) {
        joinClauses += ` LEFT JOIN ${remedialTable} AS rt ON rt.master_teacher_id = u.user_id`;
      } else if (remedialTeacherInfo.columns.has("teacher_id")) {
        joinClauses += ` LEFT JOIN ${remedialTable} AS rt ON rt.teacher_id = u.user_id`;
      }
    }

    if (mtCoordinatorInfo.table && mtCoordinatorInfo.columns.size > 0) {
      const coordinatorTable = `\`${mtCoordinatorInfo.table}\``;
      if (mtCoordinatorInfo.columns.has("user_id")) {
        joinClauses += ` LEFT JOIN ${coordinatorTable} AS mc ON mc.user_id = u.user_id`;
      } else if (mtCoordinatorInfo.columns.has("master_teacher_id")) {
        joinClauses += ` LEFT JOIN ${coordinatorTable} AS mc ON mc.master_teacher_id = u.user_id`;
      } else if (mtCoordinatorInfo.columns.has("teacher_id")) {
        joinClauses += ` LEFT JOIN ${coordinatorTable} AS mc ON mc.teacher_id = u.user_id`;
      }
    }

    if (canJoinAccountLogs) {
      joinClauses += ` LEFT JOIN (
        SELECT user_id, MAX(COALESCE(last_login, created_at)) AS last_login
        FROM account_logs
        GROUP BY user_id
      ) AS latest ON latest.user_id = u.user_id`;
    }

    const fallbackOrderColumn = userColumns.has("created_at") ? "u.created_at" : "u.user_id";
    const orderByClause = canJoinAccountLogs
      ? `COALESCE(latest.last_login, ${fallbackOrderColumn}) DESC`
      : `${fallbackOrderColumn} DESC`;

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM users AS u
      ${joinClauses}
      WHERE u.role IN (${rolePlaceholders})
      ORDER BY ${orderByClause}
    `;

    const params = [...ROLE_FILTERS];
    const [rows] = await query<RawMasterTeacherRow[]>(sql, params);

    const records = rows.map((row) => {
      const firstName = coalesce(row.mt_first_name, row.user_first_name);
      const middleName = coalesce(row.mt_middle_name, row.user_middle_name);
      const lastName = coalesce(row.mt_last_name, row.user_last_name);
      const suffix = coalesce(row.mt_suffix, row.user_suffix);
      const fallbackName = buildName(firstName, middleName, lastName, suffix);
      const name = coalesce(row.mt_name, row.user_name, fallbackName, row.user_email);
      const email = coalesce(row.user_email, row.mt_email);
      const contactNumber = coalesce(
        row.mt_contact_number,
        row.mt_phone_number,
        row.user_contact_number,
        row.user_phone_number,
      );
  const grade = coalesce(row.rt_grade, row.rt_handled_grade, row.rt_grade_level, row.rt_gradeLevel, row.mt_remedial_grade, row.mt_grade);
      const section = coalesce(row.mt_section);
  const subjects = coalesce(row.mt_subjects) || DEFAULT_SUBJECTS_STRING;
      const subjectHandled = coalesce(row.mt_subject_handled);
      const coordinatorSubject = coalesce(
        row.mc_subject_handled,
        subjectHandled,
        row.mt_coordinator,
        row.mt_coordinator_subject,
        row.mt_coordinator_generic,
        row.mt_coordinator_camel,
      );
      const status = coalesce(row.user_status, row.mt_status, "Active") ?? "Active";
      const createdAt = row.user_created_at instanceof Date ? row.user_created_at.toISOString() : null;
      const lastLogin = row.last_login instanceof Date ? row.last_login.toISOString() : null;
      const masterTeacherId = coalesce(row.mt_master_teacher_id, row.mt_teacher_id, row.user_id != null ? String(row.user_id) : null) ?? String(row.user_id);
      const teacherId = coalesce(row.mt_teacher_id, row.mt_master_teacher_id);

      return {
        userId: row.user_id,
        masterTeacherId,
        teacherId,
        firstName,
        middleName,
        lastName,
        name,
        suffix,
        email,
        contactNumber,
        grade,
        section,
        subjects,
        coordinatorSubject,
        status,
        createdAt,
        lastLogin,
      };
    });

    return NextResponse.json({
      total: records.length,
      records,
      metadata: {
        masterTeacherTableDetected: masterTeacherInfo.table && masterTeacherInfo.columns.size > 0,
        remedialTeacherTableDetected: remedialTeacherInfo.table && remedialTeacherInfo.columns.size > 0,
        mtCoordinatorTableDetected: mtCoordinatorInfo.table && mtCoordinatorInfo.columns.size > 0,
        accountLogsJoined: canJoinAccountLogs,
      },
    });
  } catch (error) {
    console.error("Failed to fetch master teacher accounts", error);
    return NextResponse.json({ error: "Failed to fetch master teacher accounts." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const firstName = sanitizeNamePart(payload?.firstName, "First name");
    const middleName = sanitizeOptionalNamePart(payload?.middleName);
    const lastName = sanitizeNamePart(payload?.lastName, "Last name");
    const suffix = sanitizeOptionalNamePart(payload?.suffix);
    const email = sanitizeEmail(payload?.email);
    const phoneNumber = sanitizePhoneNumber(payload?.phoneNumber ?? "");
    const grade = sanitizeGrade(payload?.grade);
    const section = sanitizeOptionalString(payload?.section);
    const subjects = sanitizeOptionalString(payload?.subjects);
    const coordinatorSubject = sanitizeCoordinatorSubject(payload?.coordinatorSubject);
    const teacherId = sanitizeOptionalString(payload?.teacherId);

    const result = await createMasterTeacher({
      firstName,
      middleName,
      lastName,
      suffix,
      email,
      phoneNumber,
      grade,
      section,
      subjects,
      coordinatorSubject,
      teacherId,
    });

    return NextResponse.json(
      {
        success: true,
        userId: result.userId,
        temporaryPassword: result.temporaryPassword,
        record: result.record,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to add Master Teacher", error);
    return NextResponse.json({ error: "Failed to add Master Teacher." }, { status: 500 });
  }
}
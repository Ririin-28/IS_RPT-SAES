import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import {
  HttpError,
  createTeacher,
  sanitizeEmail,
  sanitizeNamePart,
  sanitizeOptionalNamePart,
  sanitizePhoneNumber,
  sanitizeGrade,
  sanitizeOptionalString,
} from "./validation/validation";

export const dynamic = "force-dynamic";

const ROLE_FILTERS = ["teacher"] as const;

type RawTeacherRow = RowDataPacket & {
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
  teacher_teacher_id?: string | null;
  teacher_first_name?: string | null;
  teacher_middle_name?: string | null;
  teacher_last_name?: string | null;
  teacher_suffix?: string | null;
  teacher_name?: string | null;
  teacher_email?: string | null;
  teacher_contact_number?: string | null;
  teacher_phone_number?: string | null;
  teacher_grade?: string | null;
  teacher_section?: string | null;
  teacher_subjects?: string | null;
  teacher_status?: string | null;
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

const TEACHER_TABLE_CANDIDATES = [
  "teacher",
  "teachers",
  "teacher_info",
  "teacher_accounts",
  "faculty",
  "teacher_tbl",
] as const;

async function resolveTeacherTable(): Promise<{ table: string | null; columns: Set<string> }> {
  for (const candidate of TEACHER_TABLE_CANDIDATES) {
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

  const teacherInfo = await resolveTeacherTable();
    const accountLogsExists = await tableExists("account_logs");
    const accountLogsColumns = accountLogsExists ? await safeGetColumns("account_logs") : new Set<string>();
    const canJoinAccountLogs = accountLogsExists && accountLogsColumns.has("user_id");

    const selectParts: string[] = ["u.user_id AS user_id"];

    const addUserColumn = (column: string, alias: string) => {
      if (userColumns.has(column)) {
        selectParts.push(`u.${column} AS ${alias}`);
      }
    };

    const addTeacherColumn = (column: string, alias: string) => {
      if (teacherInfo.columns.has(column)) {
        selectParts.push(`t.${column} AS ${alias}`);
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

    addTeacherColumn("teacher_id", "teacher_teacher_id");
    addTeacherColumn("first_name", "teacher_first_name");
    addTeacherColumn("middle_name", "teacher_middle_name");
    addTeacherColumn("last_name", "teacher_last_name");
    addTeacherColumn("suffix", "teacher_suffix");
    addTeacherColumn("name", "teacher_name");
    addTeacherColumn("email", "teacher_email");
    addTeacherColumn("contact_number", "teacher_contact_number");
    addTeacherColumn("phone_number", "teacher_phone_number");
    addTeacherColumn("grade", "teacher_grade");
    addTeacherColumn("section", "teacher_section");
    addTeacherColumn("subjects", "teacher_subjects");
    addTeacherColumn("status", "teacher_status");

    if (canJoinAccountLogs) {
      if (accountLogsColumns.has("last_login") || accountLogsColumns.has("created_at")) {
        selectParts.push("latest.last_login AS last_login");
      }
    }

    const rolePlaceholders = ROLE_FILTERS.map(() => "?").join(", ");

    let joinClauses = "";

    if (teacherInfo.table && teacherInfo.columns.size > 0) {
      const teacherTableSql = `\`${teacherInfo.table}\``;
      if (teacherInfo.columns.has("user_id")) {
        joinClauses += ` LEFT JOIN ${teacherTableSql} AS t ON t.user_id = u.user_id`;
      } else if (teacherInfo.columns.has("teacher_id")) {
        joinClauses += ` LEFT JOIN ${teacherTableSql} AS t ON t.teacher_id = u.user_id`;
      } else {
        joinClauses += ` LEFT JOIN ${teacherTableSql} AS t ON t.user_id = u.user_id`;
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
    const [rows] = await query<RawTeacherRow[]>(sql, params);

    const records = rows.map((row) => {
      const firstName = coalesce(row.teacher_first_name, row.user_first_name);
      const middleName = coalesce(row.teacher_middle_name, row.user_middle_name);
      const lastName = coalesce(row.teacher_last_name, row.user_last_name);
      const suffix = coalesce(row.teacher_suffix, row.user_suffix);
      const fallbackName = buildName(firstName, middleName, lastName, suffix);
      const name = coalesce(row.teacher_name, row.user_name, fallbackName, row.user_email);
      const email = coalesce(row.user_email, row.teacher_email);
      const contactNumber = coalesce(
        row.teacher_contact_number,
        row.teacher_phone_number,
        row.user_contact_number,
        row.user_phone_number,
      );
      const grade = coalesce(row.teacher_grade);
      const section = coalesce(row.teacher_section);
      const subjects = coalesce(row.teacher_subjects);
      const status = coalesce(row.user_status, row.teacher_status, "Active") ?? "Active";
      const createdAt = row.user_created_at instanceof Date ? row.user_created_at.toISOString() : null;
      const lastLogin = row.last_login instanceof Date ? row.last_login.toISOString() : null;
      const teacherId = coalesce(row.teacher_teacher_id, row.user_id != null ? String(row.user_id) : null) ?? String(row.user_id);

      return {
        userId: row.user_id,
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
        status,
        createdAt,
        lastLogin,
      };
    });

    return NextResponse.json({
      total: records.length,
      records,
      metadata: {
        teacherTableDetected: teacherInfo.table && teacherInfo.columns.size > 0,
        accountLogsJoined: canJoinAccountLogs,
      },
    });
  } catch (error) {
    console.error("Failed to fetch teacher accounts", error);
    return NextResponse.json({ error: "Failed to fetch teacher accounts." }, { status: 500 });
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
    const teacherId = sanitizeOptionalString(payload?.teacherId);

    const result = await createTeacher({
      firstName,
      middleName,
      lastName,
      suffix,
      email,
      phoneNumber,
      grade,
      section,
      subjects,
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
    console.error("Failed to add Teacher", error);
    return NextResponse.json({ error: "Failed to add Teacher." }, { status: 500 });
  }
}
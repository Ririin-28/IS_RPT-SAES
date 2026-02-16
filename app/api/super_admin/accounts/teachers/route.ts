import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";
import {
  HttpError,
  createTeacher,
  formatTeacherIdentifier,
  sanitizeEmail,
  sanitizeNamePart,
  sanitizeOptionalNamePart,
  sanitizePhoneNumber,
  sanitizeGrade,
  sanitizeOptionalString,
} from "./validation/validation";

export const dynamic = "force-dynamic";

// Normalize collation across dynamic string joins to avoid MySQL "Illegal mix of collations" errors
const STRING_COLLATION = "utf8mb4_general_ci";

const ROLE_FILTERS = ["teacher"] as const;

const REMEDIAL_TEACHER_TABLE_CANDIDATES = [
  "remedial_teacher",
  "remedial_teachers",
  "remedialteacher",
  "remedial_teacher_info",
  "remedial_teacher_tbl",
] as const;

type RawTeacherRow = RowDataPacket & {
  user_id: number;
  user_teacher_id?: string | null;
  user_code?: string | null;
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
  teacher_teacherid?: string | null;
  teacher_employee_id?: string | null;
  teacher_faculty_id?: string | null;
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
  teacher_year_level?: string | null;
  teacher_handled_grade?: string | null;
  teacher_section?: string | null;
  teacher_subjects?: string | null;
  teacher_handled_subjects?: string | null;
  teacher_subject?: string | null;
  teacher_status?: string | null;
  rt_grade?: string | null;
  rt_handled_grade?: string | null;
  rt_grade_level?: string | null;
  rt_gradeLevel?: string | null;
  rt_year_level?: string | null;
  handled_grade_ids?: string | null;
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
  // If we don't have both last name and first name, use fallback
  if (!lastName || !firstName) {
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

  // Format: "Lastname, Firstname MiddleInitial"
  const middleInitial = middleName && middleName.trim().length > 0 
    ? ` ${middleName.trim().charAt(0)}.` 
    : "";
  
  const suffixPart = suffix && suffix.trim().length > 0 
    ? ` ${suffix.trim()}` 
    : "";

  return `${lastName}, ${firstName}${middleInitial}${suffixPart}`;
}

async function safeGetColumns(table: string): Promise<Set<string>> {
  try {
    return await getTableColumns(table);
  } catch {
    return new Set<string>();
  }
}

async function persistTeacherIdentifiers(
  updates: Array<{
    userId: number;
    previousUserTeacherId: string | null;
    previousTeacherTableId: string | null;
    fallbackTeacherId: string | null;
    nextId: string;
  }>,
  options: {
    userHasTeacherIdColumn: boolean;
    teacherTable: {
      name: string | null;
      idColumnName: string | null;
      hasUserIdColumn: boolean;
    };
  },
) {
  if (updates.length === 0) {
    return;
  }

  await Promise.all(
    updates.map(async ({ userId, previousUserTeacherId, previousTeacherTableId, fallbackTeacherId, nextId }) => {
      try {
        const normalizedNext = nextId.trim();
        if (!normalizedNext) {
          return;
        }

        if (options.userHasTeacherIdColumn) {
          await query("UPDATE `users` SET `teacher_id` = ? WHERE `user_id` = ? LIMIT 1", [normalizedNext, userId]);
        }

        if (options.teacherTable.name && options.teacherTable.idColumnName) {
          const tableName = options.teacherTable.name;
          const columnName = options.teacherTable.idColumnName;
          if (options.teacherTable.hasUserIdColumn) {
            await query(
              `UPDATE \`${tableName}\` SET \`${columnName}\` = ? WHERE \`user_id\` = ? LIMIT 1`,
              [normalizedNext, userId],
            );
          } else {
            const matchValue = previousTeacherTableId?.trim().length
              ? previousTeacherTableId.trim()
              : previousUserTeacherId?.trim().length
                ? previousUserTeacherId.trim()
                : fallbackTeacherId?.trim().length
                  ? fallbackTeacherId.trim()
                  : String(userId);
            await query(
              `UPDATE \`${tableName}\` SET \`${columnName}\` = ? WHERE \`${columnName}\` = ? LIMIT 1`,
              [normalizedNext, matchValue],
            );
          }
        }
      } catch (error) {
        console.warn("Failed to persist Teacher identifier", { userId, error });
      }
    }),
  );
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

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:accounts.manage" });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const userColumns = await safeGetColumns("users");
    if (userColumns.size === 0) {
      return NextResponse.json({ error: "Users table is not accessible." }, { status: 500 });
    }

    const teacherInfo = await resolveTeacherTable();
    const remedialTeacherInfo = await resolveRemedialTeacherTable();
    const teacherHandledExists = await tableExists("teacher_handled");
    const teacherHandledColumns = teacherHandledExists ? await safeGetColumns("teacher_handled") : new Set<string>();
    const accountLogsExists = await tableExists("account_logs");
    const accountLogsColumns = accountLogsExists ? await safeGetColumns("account_logs") : new Set<string>();
    const canJoinAccountLogs = accountLogsExists && accountLogsColumns.has("user_id");

    // Determine whether we can safely join teacher/remedial tables before selecting their columns.
    const teacherTableName = teacherInfo.table;
    const teacherHasUserId = teacherInfo.columns.has("user_id");
    const teacherIdColumnName = ["teacher_id", "teacherid", "employee_id", "faculty_id"].find((column) =>
      teacherInfo.columns.has(column),
    ) ?? null;
    const userHasTeacherId = userColumns.has("teacher_id");

    const teacherJoinEnabled = Boolean(
      teacherTableName &&
        teacherInfo.columns.size > 0 &&
        (teacherHasUserId || teacherInfo.columns.has("teacher_id")),
    );

    const remedialJoinEnabled = Boolean(
      remedialTeacherInfo.table &&
        remedialTeacherInfo.columns.size > 0 &&
        remedialTeacherInfo.table !== teacherTableName &&
        (remedialTeacherInfo.columns.has("user_id") || remedialTeacherInfo.columns.has("teacher_id") || remedialTeacherInfo.columns.has("master_teacher_id")),
    );

    const selectParts: string[] = ["u.user_id AS user_id"];

    const addUserColumn = (column: string, alias: string) => {
      if (userColumns.has(column)) {
        selectParts.push(`u.${column} AS ${alias}`);
      }
    };

    const addTeacherColumn = (column: string, alias: string) => {
      if (teacherJoinEnabled && teacherInfo.columns.has(column)) {
        selectParts.push(`t.${column} AS ${alias}`);
      }
    };

    const remedialAlias = remedialTeacherInfo.table && remedialTeacherInfo.table !== teacherInfo.table ? "rt" : "t";

    const addRemedialTeacherColumn = (column: string, alias: string) => {
      if (remedialJoinEnabled && remedialTeacherInfo.columns.has(column)) {
        selectParts.push(`${remedialAlias}.${column} AS ${alias}`);
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
    addUserColumn("teacher_id", "user_teacher_id");
    addUserColumn("user_code", "user_code");

    addTeacherColumn("teacher_id", "teacher_teacher_id");
    addTeacherColumn("teacherid", "teacher_teacherid");
    addTeacherColumn("employee_id", "teacher_employee_id");
    addTeacherColumn("faculty_id", "teacher_faculty_id");
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
  addTeacherColumn("year_level", "teacher_year_level");
  addTeacherColumn("handled_grade", "teacher_handled_grade");
    addTeacherColumn("section", "teacher_section");
    addTeacherColumn("subjects", "teacher_subjects");
  addTeacherColumn("handled_subjects", "teacher_handled_subjects");
  addTeacherColumn("subject", "teacher_subject");
    addTeacherColumn("status", "teacher_status");

    addRemedialTeacherColumn("grade", "rt_grade");
    addRemedialTeacherColumn("handled_grade", "rt_handled_grade");
    addRemedialTeacherColumn("grade_level", "rt_grade_level");
    addRemedialTeacherColumn("gradeLevel", "rt_gradeLevel");
    addRemedialTeacherColumn("year_level", "rt_year_level");

    if (teacherHandledExists && teacherHandledColumns.has("grade_id") && teacherHandledColumns.has("teacher_id")) {
      selectParts.push("th.handled_grade_ids AS handled_grade_ids");
    }

    if (canJoinAccountLogs) {
      if (accountLogsColumns.has("last_login") || accountLogsColumns.has("created_at")) {
        selectParts.push("latest.last_login AS last_login");
      }
    }

    const roleTableColumns = await safeGetColumns("role");
    const teacherRoleIds: number[] = [];
    if (roleTableColumns.has("role_id") && roleTableColumns.has("role_name")) {
      try {
        const placeholders = ROLE_FILTERS.map(() => "?").join(", ");
        const [roleRows] = await query<RowDataPacket[]>(
          `SELECT role_id FROM role WHERE LOWER(role_name) IN (${placeholders})`,
          [...ROLE_FILTERS],
        );
        if (Array.isArray(roleRows)) {
          for (const row of roleRows) {
            const parsed = Number(row.role_id);
            if (Number.isFinite(parsed)) {
              teacherRoleIds.push(parsed);
            }
          }
        }
      } catch {
        // ignore role lookup errors; fall back to text filter
      }
    }

    let joinClauses = "";

    if (teacherJoinEnabled && teacherTableName && teacherInfo.columns.size > 0) {
      const teacherTableSql = `\`${teacherTableName}\``;
      if (teacherHasUserId) {
        joinClauses += ` INNER JOIN ${teacherTableSql} AS t ON t.user_id = u.user_id`;
      } else if (teacherInfo.columns.has("teacher_id") && userHasTeacherId) {
        joinClauses += ` INNER JOIN ${teacherTableSql} AS t ON t.teacher_id = u.teacher_id`;
      } else if (teacherInfo.columns.has("teacher_id")) {
        joinClauses += ` LEFT JOIN ${teacherTableSql} AS t ON t.teacher_id = u.user_id`;
      }
    }

    if (teacherHandledExists && teacherHandledColumns.has("grade_id") && teacherHandledColumns.has("teacher_id")) {
      const handledJoinKey = `COALESCE(
        ${teacherJoinEnabled && teacherInfo.columns.has("teacher_id") ? "t.teacher_id," : ""}
        ${userHasTeacherId ? "u.teacher_id," : ""}
        ${userColumns.has("user_code") ? "u.user_code," : ""}
        CAST(u.user_id AS CHAR)
      ) COLLATE ${STRING_COLLATION}`;

      joinClauses += ` LEFT JOIN (
        SELECT teacher_id, GROUP_CONCAT(grade_id) AS handled_grade_ids
        FROM teacher_handled
        GROUP BY teacher_id
      ) AS th ON th.teacher_id COLLATE ${STRING_COLLATION} = ${handledJoinKey}`;
    }

    if (remedialJoinEnabled && remedialTeacherInfo.table && remedialTeacherInfo.columns.size > 0 && remedialTeacherInfo.table !== teacherInfo.table) {
      const remedialTableSql = `\`${remedialTeacherInfo.table}\``;
      if (remedialTeacherInfo.columns.has("user_id")) {
        joinClauses += ` LEFT JOIN ${remedialTableSql} AS rt ON rt.user_id = u.user_id`;
      } else if (remedialTeacherInfo.columns.has("teacher_id")) {
        joinClauses += ` LEFT JOIN ${remedialTableSql} AS rt ON rt.teacher_id = u.user_id`;
      } else if (remedialTeacherInfo.columns.has("master_teacher_id")) {
        joinClauses += ` LEFT JOIN ${remedialTableSql} AS rt ON rt.master_teacher_id = u.user_id`;
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

    const hasRoleIdColumn = userColumns.has("role_id");
    const hasRoleColumn = userColumns.has("role");

    const useRoleIdFilter = hasRoleIdColumn && teacherRoleIds.length > 0;
    const canTextFilter = hasRoleColumn;

    let roleFilterSql = "1=1";
    let roleParams: Array<string | number> = [];

    if (useRoleIdFilter) {
      roleFilterSql = `u.role_id IN (${teacherRoleIds.map(() => "?").join(", ")})`;
      roleParams = [...teacherRoleIds];
    } else if (canTextFilter) {
      roleFilterSql = `LOWER(u.role) IN (${ROLE_FILTERS.map(() => "?").join(", ")})`;
      roleParams = [...ROLE_FILTERS];
    }

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM users AS u
      ${joinClauses}
      WHERE ${roleFilterSql}
      ORDER BY ${orderByClause}
    `;

    const params = [...roleParams];
    const [rows] = await query<RawTeacherRow[]>(sql, params);

    const pendingTeacherUpdates: Array<{
      userId: number;
      previousUserTeacherId: string | null;
      previousTeacherTableId: string | null;
      fallbackTeacherId: string | null;
      nextId: string;
    }> = [];

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
      const handledGrades = typeof row.handled_grade_ids === "string" && row.handled_grade_ids.trim().length > 0
        ? row.handled_grade_ids.split(",").map((part) => part.trim()).filter((part) => part.length > 0)
        : null;

      const grade = coalesce(
        row.rt_grade,
        row.rt_handled_grade,
        row.rt_grade_level,
        row.rt_gradeLevel,
        row.rt_year_level,
        row.teacher_grade,
        row.teacher_grade_level,
        row.teacher_year_level,
        row.teacher_handled_grade,
        handledGrades && handledGrades.length > 0 ? handledGrades[0] : null,
      );
      const section = coalesce(row.teacher_section);
      const subjects = coalesce(
        row.teacher_subjects,
        row.teacher_handled_subjects,
        row.teacher_subject,
      );
      const status = coalesce(row.user_status, row.teacher_status, "Active") ?? "Active";
      const createdAt = row.user_created_at instanceof Date ? row.user_created_at.toISOString() : null;
      const lastLogin = row.last_login instanceof Date ? row.last_login.toISOString() : null;
      const storedTeacherId = coalesce(
        row.teacher_teacher_id,
        row.teacher_teacherid,
        row.teacher_employee_id,
        row.teacher_faculty_id,
        row.user_teacher_id,
        row.user_code,
        row.user_id != null ? String(row.user_id) : null,
      );
      const teacherId = formatTeacherIdentifier(storedTeacherId, row.user_id);

      const teacherTableIdValue = teacherIdColumnName === "teacher_id"
        ? row.teacher_teacher_id ?? null
        : teacherIdColumnName === "teacherid"
          ? row.teacher_teacherid ?? null
          : teacherIdColumnName === "employee_id"
            ? row.teacher_employee_id ?? null
            : teacherIdColumnName === "faculty_id"
              ? row.teacher_faculty_id ?? null
              : null;

      const needsUserUpdate = userHasTeacherId && (row.user_teacher_id ?? "") !== teacherId;
      const needsTeacherTableUpdate = Boolean(
        teacherTableName &&
          teacherIdColumnName &&
          (teacherTableIdValue ?? "") !== teacherId,
      );

      if (row.user_id != null && (needsUserUpdate || needsTeacherTableUpdate)) {
        pendingTeacherUpdates.push({
          userId: row.user_id,
          previousUserTeacherId: typeof row.user_teacher_id === "string" ? row.user_teacher_id : null,
          previousTeacherTableId: typeof teacherTableIdValue === "string" ? teacherTableIdValue : null,
          fallbackTeacherId: typeof row.teacher_teacher_id === "string"
            ? row.teacher_teacher_id
            : typeof row.teacher_teacherid === "string"
              ? row.teacher_teacherid
              : typeof row.teacher_employee_id === "string"
                ? row.teacher_employee_id
                : typeof row.teacher_faculty_id === "string"
                  ? row.teacher_faculty_id
                  : null,
          nextId: teacherId,
        });
      }

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
        handledGrades,
        section,
        subjects,
        status,
        createdAt,
        lastLogin,
      };
    });

    await persistTeacherIdentifiers(pendingTeacherUpdates, {
      userHasTeacherIdColumn: userHasTeacherId,
      teacherTable: {
        name: teacherTableName,
        idColumnName: teacherIdColumnName,
        hasUserIdColumn: teacherHasUserId,
      },
    });

    return NextResponse.json({
      total: records.length,
      records,
      metadata: {
        teacherTableDetected: Boolean(teacherTableName && teacherInfo.columns.size > 0),
        remedialTeacherTableDetected: Boolean(remedialTeacherInfo.table && remedialTeacherInfo.columns.size > 0),
        accountLogsJoined: canJoinAccountLogs,
      },
    });
  } catch (error) {
    console.error("Failed to fetch teacher accounts", error);
    return NextResponse.json({ error: "Failed to fetch teacher accounts." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:accounts.manage" });
  if (!auth.ok) {
    return auth.response;
  }

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

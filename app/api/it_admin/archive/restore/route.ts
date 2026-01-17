import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

const LEGACY_ARCHIVE_TABLE = "archive_users";
const NEW_ARCHIVE_TABLE = "archived_users";

interface ArchiveRow extends RowDataPacket {
  archive_id: number;
  user_id: number | null;
  role: string | null;
  name: string | null;
  email?: string | null;
  user_email?: string | null;
  username?: string | null;
  contact_number?: string | null;
  phone_number?: string | null;
  timestamp?: Date | null;
  archived_id?: number | null;
  archived_at?: Date | null;
  created_at?: Date | null;
  role_id?: number | null;
  user_code?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix?: string | null;
  password?: string | null;
}

interface RestoredEntry {
  archiveId: number;
  userId: number;
  role: string;
  name: string;
  email: string;
  temporaryPassword?: string;
}

interface OperationError {
  archiveId: number;
  message: string;
}

function parseIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const numeric = Number(item);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    })
    .filter((item): item is number => item !== null);
}

async function fetchTableColumns(connection: PoolConnection, tableName: string): Promise<Set<string>> {
  const [rows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => String(row.Field)));
}

async function resolvePrincipalTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  const candidates = ["principal", "principals", "principal_info"] as const;
  for (const table of candidates) {
    try {
      const columns = await fetchTableColumns(connection, table);
      if (columns.size > 0) {
        return { table, columns };
      }
    } catch {
      // continue
    }
  }
  return { table: null, columns: new Set<string>() };
}

function generateTemporaryPassword(): string {
  const random = Math.random().toString(36).slice(-8);
  return random.padEnd(8, "0");
}

function normalizeWhitespace(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getColumnValue(row: RowDataPacket | null, column: string): any {
  if (!row) {
    return undefined;
  }

  if (column in row) {
    return row[column as keyof typeof row];
  }

  const normalized = column.toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === normalized) {
      return row[key as keyof typeof row];
    }
  }

  return undefined;
}

function normalizeRole(value: string | null | undefined): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return "user";
  }
  const lowered = normalized.toLowerCase();
  if (lowered === "it_admin" || lowered === "it-admin" || lowered === "it admin") {
    return "admin";
  }
  return lowered.replace(/[\s/-]+/g, "_");
}

async function resolveMasterTeacherTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  const candidates = ["master_teacher", "master_teachers", "masterteacher", "master_teacher_info", "master_teacher_tbl"] as const;
  for (const table of candidates) {
    try {
      const columns = await fetchTableColumns(connection, table);
      if (columns.size > 0) {
        return { table, columns };
      }
    } catch {
      // continue
    }
  }
  return { table: null, columns: new Set<string>() };
}

async function resolveTeacherTable(connection: PoolConnection): Promise<{ table: string | null; columns: Set<string> }> {
  const candidates = ["teacher", "teachers", "teacher_info", "teacher_accounts", "faculty", "teacher_tbl"] as const;
  for (const table of candidates) {
    try {
      const columns = await fetchTableColumns(connection, table);
      if (columns.size > 0) {
        return { table, columns };
      }
    } catch {
      // continue
    }
  }
  return { table: null, columns: new Set<string>() };
}

function splitNameParts(name: string | null): {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
} {
  if (!name) {
    return { firstName: null, middleName: null, lastName: null };
  }
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return { firstName: null, middleName: null, lastName: null };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: null, lastName: null };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], middleName: null, lastName: parts[1] };
  }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

async function restoreArchiveEntry(
  connection: PoolConnection,
  archiveId: number,
  userColumns: Set<string>,
  options: {
    legacyExists: boolean;
    newExists: boolean;
    roleNameById: Map<number, string>;
  },
): Promise<{ restored?: RestoredEntry; error?: OperationError }> {
  await connection.beginTransaction();
  try {
    let archiveRow: ArchiveRow | null = null;
    let resolvedArchiveId = archiveId;
    let sourceTable = LEGACY_ARCHIVE_TABLE;
    let idColumn = "archive_id";

    if (options.legacyExists) {
      const [rows] = await connection.query<ArchiveRow[]>(
        `SELECT * FROM ${LEGACY_ARCHIVE_TABLE} WHERE archive_id = ? FOR UPDATE`,
        [archiveId],
      );
      if (rows.length > 0) {
        archiveRow = rows[0];
        resolvedArchiveId = Number(archiveRow.archive_id ?? archiveId);
      }
    }

    if (!archiveRow && options.newExists) {
      const [rows] = await connection.query<ArchiveRow[]>(
        `SELECT * FROM ${NEW_ARCHIVE_TABLE} WHERE archived_id = ? FOR UPDATE`,
        [archiveId],
      );
      if (rows.length > 0) {
        archiveRow = rows[0];
        resolvedArchiveId = Number(archiveRow.archived_id ?? archiveId);
        sourceTable = NEW_ARCHIVE_TABLE;
        idColumn = "archived_id";
      }
    }

    if (!archiveRow) {
      await connection.rollback();
      return {
        error: {
          archiveId,
          message: "Archive entry not found.",
        },
      };
    }

    const rawUserId = typeof archiveRow.user_id === "number" ? archiveRow.user_id : null;
    const roleId = Number.isInteger(archiveRow.role_id) ? (archiveRow.role_id as number) : null;
    const roleFromId = roleId !== null ? options.roleNameById.get(roleId) ?? null : null;
    const role = normalizeRole(archiveRow.role ?? roleFromId);
    const baseName =
      normalizeWhitespace(archiveRow.name) ??
      normalizeWhitespace(archiveRow.username) ??
      normalizeWhitespace(archiveRow.first_name) ??
      null;
    const name = baseName ?? `Restored User ${rawUserId ?? resolvedArchiveId}`;
    const archivedFirst = normalizeWhitespace(archiveRow.first_name);
    const archivedMiddle = normalizeWhitespace(archiveRow.middle_name);
    const archivedLast = normalizeWhitespace(archiveRow.last_name);
    const nameParts = splitNameParts(name);
    const contact = normalizeWhitespace(archiveRow.contact_number) ?? normalizeWhitespace(archiveRow.phone_number);

    const email =
      normalizeWhitespace(archiveRow.email) ??
      normalizeWhitespace(archiveRow.user_email) ??
      (rawUserId ? `restored_user_${rawUserId}@restored.local` : `restored_${resolvedArchiveId}@restored.local`);

    const username = normalizeWhitespace(archiveRow.username) ?? email;

    const [duplicate] = await connection.query<RowDataPacket[]>(
      "SELECT user_id FROM users WHERE user_id = ? OR email = ? LIMIT 1",
      [rawUserId ?? 0, email],
    );

    if (duplicate.length > 0) {
      await connection.rollback();
      return {
        error: {
          archiveId: resolvedArchiveId,
          message: "A user with the same identifier or email already exists.",
        },
      };
    }

    const temporaryPassword = generateTemporaryPassword();
    const insertColumns: string[] = [];
    const insertValues: any[] = [];
    const now = new Date();

    if (userColumns.has("user_id") && rawUserId) {
      insertColumns.push("user_id");
      insertValues.push(rawUserId);
    }

    if (userColumns.has("first_name") && (archivedFirst || nameParts.firstName)) {
      insertColumns.push("first_name");
      insertValues.push(archivedFirst ?? nameParts.firstName);
    }
    if (userColumns.has("middle_name") && (archivedMiddle || nameParts.middleName)) {
      insertColumns.push("middle_name");
      insertValues.push(archivedMiddle ?? nameParts.middleName);
    }
    if (userColumns.has("last_name") && (archivedLast || nameParts.lastName)) {
      insertColumns.push("last_name");
      insertValues.push(archivedLast ?? nameParts.lastName);
    }
    if (userColumns.has("suffix") && normalizeWhitespace(archiveRow.suffix)) {
      insertColumns.push("suffix");
      insertValues.push(normalizeWhitespace(archiveRow.suffix));
    }

    if (userColumns.has("name")) {
      insertColumns.push("name");
      insertValues.push(name);
    }
    if (userColumns.has("email")) {
      insertColumns.push("email");
      insertValues.push(email);
    }
    if (userColumns.has("username") && username) {
      insertColumns.push("username");
      insertValues.push(username);
    }
    if (userColumns.has("role")) {
      insertColumns.push("role");
      insertValues.push(role);
    }
    if (userColumns.has("role_id") && roleId !== null) {
      insertColumns.push("role_id");
      insertValues.push(roleId);
    }
    if (userColumns.has("contact_number") && contact) {
      insertColumns.push("contact_number");
      insertValues.push(contact);
    }
    if (userColumns.has("phone_number") && contact) {
      insertColumns.push("phone_number");
      insertValues.push(contact);
    }
    const userCode = normalizeWhitespace(archiveRow.user_code);
    if (userColumns.has("user_code") && userCode) {
      insertColumns.push("user_code");
      insertValues.push(userCode);
    }
    if (userColumns.has("status")) {
      insertColumns.push("status");
      insertValues.push("Active");
    }
    if (userColumns.has("password")) {
      insertColumns.push("password");
      insertValues.push(temporaryPassword);
    }
    if (userColumns.has("created_at")) {
      insertColumns.push("created_at");
      insertValues.push(now);
    }
    if (userColumns.has("updated_at")) {
      insertColumns.push("updated_at");
      insertValues.push(now);
    }

    if (insertColumns.length === 0) {
      await connection.rollback();
      return {
        error: {
          archiveId: resolvedArchiveId,
          message: "Unable to determine insert columns for users table.",
        },
      };
    }

    const columnSql = insertColumns.map((column) => `\`${column}\``).join(", ");
    const placeholders = insertColumns.map(() => "?").join(", ");

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO users (${columnSql}) VALUES (${placeholders})`,
      insertValues,
    );

    const restoredUserId = rawUserId && userColumns.has("user_id")
      ? rawUserId
      : Number(result.insertId);

    if (!Number.isInteger(restoredUserId) || restoredUserId <= 0) {
      await connection.rollback();
      return {
        error: {
          archiveId: resolvedArchiveId,
          message: "Failed to determine restored user identifier.",
        },
      };
    }

    // Restore it_admin row when possible
    try {
      const itAdminColumns = await fetchTableColumns(connection, "it_admin");
      if (itAdminColumns && itAdminColumns.size > 0) {
        const itAdminInsertColumns: string[] = [];
        const itAdminValues: any[] = [];

        if (itAdminColumns.has("user_id")) {
          itAdminInsertColumns.push("user_id");
          itAdminValues.push(restoredUserId);
        }

        if (userCode && itAdminColumns.has("it_admin_id")) {
          itAdminInsertColumns.push("it_admin_id");
          itAdminValues.push(userCode);
        }
        if (userCode && itAdminColumns.has("admin_id")) {
          itAdminInsertColumns.push("admin_id");
          itAdminValues.push(userCode);
        }

        if (itAdminColumns.has("email") && normalizeWhitespace(archiveRow.email)) {
          itAdminInsertColumns.push("email");
          itAdminValues.push(normalizeWhitespace(archiveRow.email));
        }
        if (itAdminColumns.has("first_name") && normalizeWhitespace(archiveRow.first_name)) {
          itAdminInsertColumns.push("first_name");
          itAdminValues.push(normalizeWhitespace(archiveRow.first_name));
        }
        if (itAdminColumns.has("middle_name") && normalizeWhitespace(archiveRow.middle_name)) {
          itAdminInsertColumns.push("middle_name");
          itAdminValues.push(normalizeWhitespace(archiveRow.middle_name));
        }
        if (itAdminColumns.has("last_name") && normalizeWhitespace(archiveRow.last_name)) {
          itAdminInsertColumns.push("last_name");
          itAdminValues.push(normalizeWhitespace(archiveRow.last_name));
        }
        if (itAdminColumns.has("suffix") && normalizeWhitespace(archiveRow.suffix)) {
          itAdminInsertColumns.push("suffix");
          itAdminValues.push(normalizeWhitespace(archiveRow.suffix));
        }
        if (itAdminColumns.has("phone_number") && normalizeWhitespace(archiveRow.phone_number)) {
          itAdminInsertColumns.push("phone_number");
          itAdminValues.push(normalizeWhitespace(archiveRow.phone_number));
        }
        if (itAdminColumns.has("contact_number") && normalizeWhitespace(archiveRow.phone_number)) {
          itAdminInsertColumns.push("contact_number");
          itAdminValues.push(normalizeWhitespace(archiveRow.phone_number));
        }
        if (itAdminColumns.has("role_id") && roleId !== null) {
          itAdminInsertColumns.push("role_id");
          itAdminValues.push(roleId);
        }

        if (itAdminInsertColumns.length > 0) {
          const colsSql = itAdminInsertColumns.map((column) => `\`${column}\``).join(", ");
          const placeholders = itAdminInsertColumns.map(() => "?").join(", ");
          await connection.query<ResultSetHeader>(
            `INSERT INTO it_admin (${colsSql}) VALUES (${placeholders})`,
            itAdminValues,
          );
        }
      }
    } catch {
      // ignore restore failure for it_admin table
    }

    // Restore principal row when possible
    if (role === "principal") {
      try {
        const { table: principalTable, columns: principalColumns } = await resolvePrincipalTable(connection);
        if (principalTable && principalColumns.size > 0) {
          const principalInsertColumns: string[] = [];
          const principalValues: any[] = [];

          if (principalColumns.has("user_id")) {
            principalInsertColumns.push("user_id");
            principalValues.push(restoredUserId);
          }

          if (userCode && principalColumns.has("principal_id")) {
            principalInsertColumns.push("principal_id");
            principalValues.push(userCode);
          }

          if (principalColumns.has("email") && normalizeWhitespace(archiveRow.email)) {
            principalInsertColumns.push("email");
            principalValues.push(normalizeWhitespace(archiveRow.email));
          }
          if (principalColumns.has("first_name") && normalizeWhitespace(archiveRow.first_name)) {
            principalInsertColumns.push("first_name");
            principalValues.push(normalizeWhitespace(archiveRow.first_name));
          }
          if (principalColumns.has("middle_name") && normalizeWhitespace(archiveRow.middle_name)) {
            principalInsertColumns.push("middle_name");
            principalValues.push(normalizeWhitespace(archiveRow.middle_name));
          }
          if (principalColumns.has("last_name") && normalizeWhitespace(archiveRow.last_name)) {
            principalInsertColumns.push("last_name");
            principalValues.push(normalizeWhitespace(archiveRow.last_name));
          }
          if (principalColumns.has("suffix") && normalizeWhitespace(archiveRow.suffix)) {
            principalInsertColumns.push("suffix");
            principalValues.push(normalizeWhitespace(archiveRow.suffix));
          }
          if (principalColumns.has("phone_number") && normalizeWhitespace(archiveRow.phone_number)) {
            principalInsertColumns.push("phone_number");
            principalValues.push(normalizeWhitespace(archiveRow.phone_number));
          }
          if (principalColumns.has("contact_number") && normalizeWhitespace(archiveRow.phone_number)) {
            principalInsertColumns.push("contact_number");
            principalValues.push(normalizeWhitespace(archiveRow.phone_number));
          }
          if (principalColumns.has("role_id") && roleId !== null) {
            principalInsertColumns.push("role_id");
            principalValues.push(roleId);
          }
          if (principalColumns.has("status")) {
            principalInsertColumns.push("status");
            principalValues.push("Active");
          }

          if (principalInsertColumns.length > 0) {
            const colsSql = principalInsertColumns.map((column) => `\`${column}\``).join(", ");
            const placeholders = principalInsertColumns.map(() => "?").join(", ");
            await connection.query<ResultSetHeader>(
              `INSERT INTO \`${principalTable}\` (${colsSql}) VALUES (${placeholders})`,
              principalValues,
            );
          }
        }
      } catch {
        // ignore restore failure for principal table
      }
    }

    // Restore master teacher row and handled tables when possible
    if (role === "master_teacher") {
      const masterTeacherId = userCode ?? String(restoredUserId);

      try {
        const { table: masterTeacherTable, columns: masterTeacherColumns } = await resolveMasterTeacherTable(connection);
        if (masterTeacherTable && masterTeacherColumns.size > 0) {
          const mtInsertColumns: string[] = [];
          const mtValues: any[] = [];

          if (masterTeacherColumns.has("user_id")) {
            mtInsertColumns.push("user_id");
            mtValues.push(restoredUserId);
          }
          if (masterTeacherColumns.has("master_teacher_id")) {
            mtInsertColumns.push("master_teacher_id");
            mtValues.push(masterTeacherId);
          } else if (masterTeacherColumns.has("masterteacher_id")) {
            mtInsertColumns.push("masterteacher_id");
            mtValues.push(masterTeacherId);
          }

          if (mtInsertColumns.length > 0) {
            const colsSql = mtInsertColumns.map((column) => `\`${column}\``).join(", ");
            const placeholders = mtInsertColumns.map(() => "?").join(", ");
            await connection.query<ResultSetHeader>(
              `INSERT IGNORE INTO \`${masterTeacherTable}\` (${colsSql}) VALUES (${placeholders})`,
              mtValues,
            );
          }
        }
      } catch {
        // ignore restore failure for master_teacher table
      }

      try {
        const coordinatorColumns = await fetchTableColumns(connection, "mt_coordinator_handled").catch(() => new Set<string>());
        const remedialColumns = await fetchTableColumns(connection, "mt_remedialteacher_handled").catch(() => new Set<string>());
        const archivedCoordinatorColumns = await fetchTableColumns(connection, "archived_mt_coordinator_handled").catch(() => new Set<string>());
        const archivedRemedialColumns = await fetchTableColumns(connection, "archived_mt_remedialteacher_handled").catch(() => new Set<string>());

        if (archivedCoordinatorColumns.size > 0 && coordinatorColumns.size > 0) {
          const [rows] = await connection.query<RowDataPacket[]>(
            "SELECT master_teacher_id, grade_id, subject_id FROM archived_mt_coordinator_handled WHERE archived_id = ?",
            [resolvedArchiveId],
          );

          for (const row of rows) {
            const columns: string[] = [];
            const values: any[] = [];
            const pushValue = (column: string, value: any) => {
              columns.push(`\`${column}\``);
              values.push(value);
            };

            if (coordinatorColumns.has("master_teacher_id")) {
              pushValue("master_teacher_id", row.master_teacher_id ?? masterTeacherId);
            }
            if (coordinatorColumns.has("grade_id") && row.grade_id != null) {
              pushValue("grade_id", row.grade_id);
            }
            if (coordinatorColumns.has("subject_id") && row.subject_id != null) {
              pushValue("subject_id", row.subject_id);
            }

            if (columns.length > 0) {
              const placeholders = columns.map(() => "?").join(", ");
              const columnsSql = columns.join(", ");
              await connection.query<ResultSetHeader>(
                `INSERT IGNORE INTO mt_coordinator_handled (${columnsSql}) VALUES (${placeholders})`,
                values,
              );
            }
          }
        }

        if (archivedRemedialColumns.size > 0 && remedialColumns.size > 0) {
          const [rows] = await connection.query<RowDataPacket[]>(
            "SELECT master_teacher_id, grade_id FROM archived_mt_remedialteacher_handled WHERE archived_id = ?",
            [resolvedArchiveId],
          );

          for (const row of rows) {
            const columns: string[] = [];
            const values: any[] = [];
            const pushValue = (column: string, value: any) => {
              columns.push(`\`${column}\``);
              values.push(value);
            };

            if (remedialColumns.has("master_teacher_id")) {
              pushValue("master_teacher_id", row.master_teacher_id ?? masterTeacherId);
            }
            if (remedialColumns.has("grade_id") && row.grade_id != null) {
              pushValue("grade_id", row.grade_id);
            }

            if (columns.length > 0) {
              const placeholders = columns.map(() => "?").join(", ");
              const columnsSql = columns.join(", ");
              await connection.query<ResultSetHeader>(
                `INSERT IGNORE INTO mt_remedialteacher_handled (${columnsSql}) VALUES (${placeholders})`,
                values,
              );
            }
          }
        }

        if (archivedCoordinatorColumns.size > 0) {
          await connection.query<ResultSetHeader>(
            "DELETE FROM archived_mt_coordinator_handled WHERE archived_id = ?",
            [resolvedArchiveId],
          );
        }
        if (archivedRemedialColumns.size > 0) {
          await connection.query<ResultSetHeader>(
            "DELETE FROM archived_mt_remedialteacher_handled WHERE archived_id = ?",
            [resolvedArchiveId],
          );
        }
      } catch {
        // ignore restore failure for master teacher handled tables
      }
    }

    if (role === "teacher") {
      const teacherId = userCode ?? String(restoredUserId);

      try {
        const { table: teacherTable, columns: teacherColumns } = await resolveTeacherTable(connection);
        if (teacherTable && teacherColumns.size > 0) {
          const teacherInsertColumns: string[] = [];
          const teacherValues: any[] = [];

          if (teacherColumns.has("user_id")) {
            teacherInsertColumns.push("user_id");
            teacherValues.push(restoredUserId);
          }
          for (const column of ["teacher_id", "employee_id", "faculty_id", "teacher_code"]) {
            if (teacherColumns.has(column)) {
              teacherInsertColumns.push(column);
              teacherValues.push(teacherId);
              break;
            }
          }

          if (teacherInsertColumns.length > 0) {
            const colsSql = teacherInsertColumns.map((column) => `\`${column}\``).join(", ");
            const placeholders = teacherInsertColumns.map(() => "?").join(", ");
            await connection.query<ResultSetHeader>(
              `INSERT IGNORE INTO \`${teacherTable}\` (${colsSql}) VALUES (${placeholders})`,
              teacherValues,
            );
          }
        }
      } catch {
        // ignore restore failure for teacher table
      }

      try {
        const teacherHandledColumns = await fetchTableColumns(connection, "teacher_handled").catch(() => new Set<string>());
        const archivedTeacherHandledColumns = await fetchTableColumns(connection, "archived_teacher_handled").catch(() => new Set<string>());

        if (archivedTeacherHandledColumns.size > 0 && teacherHandledColumns.size > 0) {
          const [rows] = await connection.query<RowDataPacket[]>(
            "SELECT teacher_id, grade_id FROM archived_teacher_handled WHERE archived_id = ?",
            [resolvedArchiveId],
          );

          for (const row of rows) {
            const columns: string[] = [];
            const values: any[] = [];
            const pushValue = (column: string, value: any) => {
              columns.push(`\`${column}\``);
              values.push(value);
            };

            if (teacherHandledColumns.has("teacher_id")) {
              pushValue("teacher_id", row.teacher_id ?? teacherId);
            } else if (teacherHandledColumns.has("user_id")) {
              pushValue("user_id", restoredUserId);
            }
            if (teacherHandledColumns.has("grade_id") && row.grade_id != null) {
              pushValue("grade_id", row.grade_id);
            }

            if (columns.length > 0) {
              const placeholders = columns.map(() => "?").join(", ");
              const columnsSql = columns.join(", ");
              await connection.query<ResultSetHeader>(
                `INSERT IGNORE INTO teacher_handled (${columnsSql}) VALUES (${placeholders})`,
                values,
              );
            }
          }

          await connection.query<ResultSetHeader>(
            "DELETE FROM archived_teacher_handled WHERE archived_id = ?",
            [resolvedArchiveId],
          );
        }
      } catch {
        // ignore restore failure for teacher handled tables
      }
    }

    await connection.query<ResultSetHeader>(
      `DELETE FROM ${sourceTable} WHERE ${idColumn} = ?`,
      [resolvedArchiveId],
    );

    await connection.commit();

    return {
      restored: {
        archiveId: resolvedArchiveId,
        userId: restoredUserId,
        role,
        name,
        email,
        temporaryPassword,
      },
    };
  } catch (error) {
    await connection.rollback();
    const message = error instanceof Error ? error.message : "Failed to restore archived user.";
    return {
      error: {
        archiveId,
        message,
      },
    };
  }
}

export async function POST(request: NextRequest) {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const archiveIds = parseIdArray(payload?.archiveIds);

  if (archiveIds.length === 0) {
    return NextResponse.json({ error: "At least one archiveId is required." }, { status: 400 });
  }

  try {
    const result = await runWithConnection(async (connection) => {
      let userColumns: Set<string>;
      try {
        userColumns = await fetchTableColumns(connection, "users");
      } catch {
        throw new Error("Users table is not accessible.");
      }

      if (userColumns.size === 0) {
        throw new Error("Users table is not accessible.");
      }

      const legacyExists = await (async () => {
        try {
          await fetchTableColumns(connection, LEGACY_ARCHIVE_TABLE);
          return true;
        } catch {
          return false;
        }
      })();

      const newExists = await (async () => {
        try {
          await fetchTableColumns(connection, NEW_ARCHIVE_TABLE);
          return true;
        } catch {
          return false;
        }
      })();

      const roleNameById = new Map<number, string>();
      try {
        const roleColumns = await fetchTableColumns(connection, "role");
        if (roleColumns.has("role_id") && roleColumns.has("role_name")) {
          const [rows] = await connection.query<RowDataPacket[]>("SELECT role_id, role_name FROM role");
          for (const row of rows) {
            const id = Number(row.role_id);
            const name = typeof row.role_name === "string" ? row.role_name : null;
            if (Number.isInteger(id) && name) {
              roleNameById.set(id, name);
            }
          }
        }
      } catch {
        // ignore role map failures
      }

      const restored: RestoredEntry[] = [];
      const errors: OperationError[] = [];

      for (const archiveId of archiveIds) {
        const outcome = await restoreArchiveEntry(connection, archiveId, userColumns, {
          legacyExists,
          newExists,
          roleNameById,
        });
        if (outcome.restored) {
          restored.push(outcome.restored);
        } else if (outcome.error) {
          errors.push(outcome.error);
        }
      }

      return { restored, errors };
    });

    return NextResponse.json({
      success: result.restored.length > 0,
      restored: result.restored,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Failed to restore archived users", error);
    const message = error instanceof Error ? error.message : "Failed to restore archived users.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

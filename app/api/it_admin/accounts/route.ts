import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, runWithConnection, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLE_VARIANTS = {
  admin: ["admin", "it_admin", "it-admin"],
  principal: ["principal"],
  master_teacher: ["master_teacher", "master-teacher", "masterteacher"],
  teacher: ["teacher", "faculty"],
} as const;

type RoleKey = keyof typeof ROLE_VARIANTS;

type AccountsRow = RowDataPacket & {
  user_id?: number;
  username?: string | null;
  user_email?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  full_name?: string | null;
  contact_number?: string | null;
  contact_no?: string | null;
  contact?: string | null;
  phone?: string | null;
  mobile?: string | null;
  status?: string | null;
  user_status?: string | null;
  account_status?: string | null;
  grade?: string | number | null;
  grade_level?: string | number | null;
  year_level?: string | number | null;
  section?: string | null;
  section_name?: string | null;
  class_section?: string | null;
  school?: string | null;
  school_name?: string | null;
  admin_id?: string | number | null;
  principal_id?: string | number | null;
  master_teacher_id?: string | number | null;
  masterteacher_id?: string | number | null;
  teacher_id?: string | number | null;
  employee_id?: string | number | null;
  last_login?: Date | null;
  user_created_at?: Date | null;
  user_password?: string | null;
};

interface AccountsResponse {
  role: RoleKey;
  total: number;
  records: any[];
  metadata?: {
    resolvedTable?: string | null;
    missingTables?: string[];
  };
}

const ROLE_TABLE_CANDIDATES: Record<RoleKey, string[]> = {
  admin: ["it_admin"],
  principal: ["principal", "principals", "principal_info"],
  master_teacher: ["master_teacher", "master_teachers", "master_teacher_info"],
  teacher: ["teacher", "teachers", "teacher_info"],
};

const STATUS_FALLBACK_BY_ROLE: Record<RoleKey, string> = {
  admin: "Active",
  principal: "Active",
  master_teacher: "Active",
  teacher: "Active",
};

function pickFirst<T extends Record<string, any>>(row: T, keys: string[]): any {
  for (const key of keys) {
    if (key in row && row[key] !== null && row[key] !== undefined) {
      const value = row[key];
      if (typeof value === "string") {
        if (value.trim().length === 0) {
          continue;
        }
        return value;
      }
      return value;
    }
  }
  return null;
}

function resolveName(row: AccountsRow): string | null {
  const fromName = pickFirst(row, ["name", "full_name"]);
  if (fromName) return fromName as string;

  const first = pickFirst(row, ["first_name"]);
  const last = pickFirst(row, ["last_name"]);
  const combined = `${first ?? ""} ${last ?? ""}`.trim();
  if (combined.length > 0) {
    return combined;
  }

  const fallback = pickFirst(row, ["username"]);
  return (fallback as string | null) ?? null;
}

function resolveStatus(row: AccountsRow, role: RoleKey): string {
  const explicit = pickFirst(row, ["status", "user_status", "account_status"]);
  if (explicit) {
    return explicit as string;
  }
  const passwordSet = pickFirst(row, ["user_password"]);
  return passwordSet ? "Active" : STATUS_FALLBACK_BY_ROLE[role];
}

function resolveGrade(row: AccountsRow): string | null {
  const gradeValue = pickFirst(row, ["grade", "grade_level", "year_level"]);
  if (gradeValue === null || gradeValue === undefined) {
    return null;
  }
  return String(gradeValue);
}

function resolveSection(row: AccountsRow): string | null {
  const sectionValue = pickFirst(row, ["section", "section_name", "class_section"]);
  return sectionValue ? String(sectionValue) : null;
}

function resolveContact(row: AccountsRow): string | null {
  const contact = pickFirst(row, [
    "contact_number",
    "contact_no",
    "contact",
    "phone",
    "mobile",
  ]);
  return contact ? String(contact) : null;
}

function resolveEmail(row: AccountsRow): string | null {
  const email = pickFirst(row, ["email", "user_email"]);
  return email ? String(email) : null;
}

function resolveAccountId(row: AccountsRow, role: RoleKey): string | null {
  const candidatesByRole: Record<RoleKey, string[]> = {
    admin: ["admin_id"],
    principal: ["principal_id", "id"],
    master_teacher: ["master_teacher_id", "masterteacher_id", "id"],
    teacher: ["teacher_id", "employee_id", "id"],
  };

  const value = pickFirst(row, candidatesByRole[role]);
  if (value === null || value === undefined) {
    return row.user_id ? String(row.user_id) : null;
  }
  return String(value);
}

function resolveSchool(row: AccountsRow): string | null {
  const school = pickFirst(row, ["school", "school_name"]);
  return school ? String(school) : null;
}

function mapRowToPayload(row: AccountsRow, role: RoleKey) {
  const base = {
    userId: row.user_id ?? null,
    name: resolveName(row),
    email: resolveEmail(row),
    contactNumber: resolveContact(row),
    status: resolveStatus(row, role),
    lastLogin: row.last_login ? row.last_login.toISOString() : null,
    createdAt: row.user_created_at ? row.user_created_at.toISOString() : null,
  };

  if (role === "admin") {
    return {
      ...base,
      adminId: resolveAccountId(row, role),
    };
  }

  if (role === "principal") {
    return {
      ...base,
      principalId: resolveAccountId(row, role),
      school: resolveSchool(row),
    };
  }

  if (role === "master_teacher") {
    return {
      ...base,
      masterTeacherId: resolveAccountId(row, role),
      grade: resolveGrade(row),
      section: resolveSection(row),
    };
  }

  return {
    ...base,
    teacherId: resolveAccountId(row, role),
    grade: resolveGrade(row),
    section: resolveSection(row),
  };
}

async function resolveRoleTable(role: RoleKey) {
  const candidates = ROLE_TABLE_CANDIDATES[role];
  const missing: string[] = [];

  for (const candidate of candidates) {
    const exists = await tableExists(candidate);
    if (!exists) {
      missing.push(candidate);
      continue;
    }

    const columns = await getTableColumns(candidate);
    if (!columns.has("user_id")) {
      missing.push(`${candidate} (missing user_id column)`);
      continue;
    }

    return { table: candidate, columns, missing };
  }

  return { table: null as string | null, columns: new Set<string>(), missing };
}

async function fetchAccounts(role: RoleKey): Promise<AccountsResponse> {
  const roleFilters = ROLE_VARIANTS[role];
  const placeholders = roleFilters.map(() => "?").join(", ");

  const baseSelect = [
    "u.user_id AS user_id",
    "u.username AS username",
    "u.email AS user_email",
    "u.first_name AS first_name",
    "u.last_name AS last_name",
    "u.password AS user_password",
    "u.created_at AS user_created_at",
    "latest.last_login AS last_login",
  ];

  let joinClause = "";
  let resolvedTable: string | null = null;
  let missingTables: string[] = [];

  const { table, columns, missing } = await resolveRoleTable(role);
  resolvedTable = table;
  missingTables = missing;

  if (table) {
    joinClause = `LEFT JOIN \`${table}\` AS t ON t.user_id = u.user_id`;

    const columnAliases: Record<string, string> = {
      admin_id: "admin_id",
      principal_id: "principal_id",
      master_teacher_id: "master_teacher_id",
      masterteacher_id: "masterteacher_id",
      teacher_id: "teacher_id",
      employee_id: "employee_id",
      name: "name",
      full_name: "full_name",
      first_name: "first_name",
      last_name: "last_name",
      email: "email",
      contact_number: "contact_number",
      contact_no: "contact_no",
      contact: "contact",
      phone: "phone",
      mobile: "mobile",
      status: "status",
      user_status: "user_status",
      account_status: "account_status",
      grade: "grade",
      grade_level: "grade_level",
      year_level: "year_level",
      section: "section",
      section_name: "section_name",
      class_section: "class_section",
      school: "school",
      school_name: "school_name",
    };

    for (const [column, alias] of Object.entries(columnAliases)) {
      if (columns.has(column)) {
        baseSelect.push(`t.${column} AS ${alias}`);
      }
    }
  }

  const querySql = `
    SELECT ${baseSelect.join(", ")}
    FROM users u
    ${joinClause}
    LEFT JOIN (
      SELECT user_id, MAX(COALESCE(last_login, created_at)) AS last_login
      FROM account_logs
      GROUP BY user_id
    ) AS latest ON latest.user_id = u.user_id
    WHERE u.role IN (${placeholders})
    ORDER BY COALESCE(latest.last_login, u.created_at) DESC
  `;

  const params = Array.from(roleFilters);
  const [rows] = await query<AccountsRow[]>(querySql, params);

  return {
    role,
    total: rows.length,
    metadata: {
      resolvedTable,
      missingTables: missingTables.length > 0 ? missingTables : undefined,
    },
    records: rows.map((row) => mapRowToPayload(row, role)),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roleParam = searchParams.get("role")?.toLowerCase() ?? "";

  if (!roleParam) {
    return NextResponse.json(
      { error: "Query parameter 'role' is required." },
      { status: 400 }
    );
  }

  if (!Object.keys(ROLE_VARIANTS).includes(roleParam)) {
    return NextResponse.json(
      { error: `Unsupported role '${roleParam}'.` },
      { status: 400 }
    );
  }

  try {
    const result = await fetchAccounts(roleParam as RoleKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Failed to fetch accounts for role ${roleParam}`, error);
    return NextResponse.json(
      { error: `Failed to fetch accounts for role ${roleParam}.` },
      { status: 500 }
    );
  }
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeNamePart(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    throw new HttpError(400, `${field} must be at least 2 characters.`);
  }
  return trimmed;
}

function sanitizeOptionalNamePart(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Email is required.");
  }
  const normalized = value.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    throw new HttpError(400, "Invalid email format.");
  }
  return normalized;
}

function sanitizePhoneNumber(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Phone number is required.");
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) {
    throw new HttpError(400, "Phone number must contain 10 to 11 digits.");
  }
  return digits;
}

function buildFullName(firstName: string, middleName: string | null, lastName: string): string {
  const parts = [firstName, middleName, lastName].filter((part) => part && part.trim().length > 0);
  return parts.join(" ");
}

async function getColumnsForTable(connection: PoolConnection, tableName: string): Promise<Set<string>> {
  const [rows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => String(row.Field)));
}

function generateTemporaryPassword(): string {
  const random = Math.random().toString(36).slice(-8);
  return random.padEnd(8, "0");
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
    const email = sanitizeEmail(payload?.email);
    const phoneNumber = sanitizePhoneNumber(payload?.phoneNumber ?? "");
    const fullName = buildFullName(firstName, middleName, lastName);
    const temporaryPassword = generateTemporaryPassword();

    const result = await runWithConnection(async (connection) => {
      const userColumns = await getColumnsForTable(connection, "users");
      let itAdminColumns: Set<string> | null = null;
      try {
        itAdminColumns = await getColumnsForTable(connection, "it_admin");
      } catch {
        itAdminColumns = null;
      }

      await connection.beginTransaction();
      try {
        const [duplicateEmail] = await connection.query<RowDataPacket[]>(
          "SELECT user_id FROM users WHERE email = ? LIMIT 1",
          [email],
        );
        if (duplicateEmail.length > 0) {
          throw new HttpError(409, "Email already exists.");
        }

        const userInsertColumns: string[] = [];
        const userInsertValues: any[] = [];

        if (userColumns.has("first_name")) {
          userInsertColumns.push("first_name");
          userInsertValues.push(firstName);
        }
        if (userColumns.has("middle_name")) {
          userInsertColumns.push("middle_name");
          userInsertValues.push(middleName);
        }
        if (userColumns.has("last_name")) {
          userInsertColumns.push("last_name");
          userInsertValues.push(lastName);
        }
        if (userColumns.has("name")) {
          userInsertColumns.push("name");
          userInsertValues.push(fullName);
        }
        if (userColumns.has("email")) {
          userInsertColumns.push("email");
          userInsertValues.push(email);
        }
        if (userColumns.has("username")) {
          userInsertColumns.push("username");
          userInsertValues.push(email);
        }
        if (userColumns.has("contact_number")) {
          userInsertColumns.push("contact_number");
          userInsertValues.push(phoneNumber);
        }
        if (userColumns.has("phone_number")) {
          userInsertColumns.push("phone_number");
          userInsertValues.push(phoneNumber);
        }
        if (userColumns.has("role")) {
          userInsertColumns.push("role");
          userInsertValues.push("admin");
        }
        if (userColumns.has("status")) {
          userInsertColumns.push("status");
          userInsertValues.push("Active");
        }
        if (userColumns.has("password")) {
          userInsertColumns.push("password");
          userInsertValues.push(temporaryPassword);
        }
        const now = new Date();
        if (userColumns.has("created_at")) {
          userInsertColumns.push("created_at");
          userInsertValues.push(now);
        }
        if (userColumns.has("updated_at")) {
          userInsertColumns.push("updated_at");
          userInsertValues.push(now);
        }

        if (userInsertColumns.length === 0) {
          throw new HttpError(500, "Unable to determine columns for users table.");
        }

        const userColumnsSql = userInsertColumns.map((column) => `\`${column}\``).join(", ");
        const placeholders = userInsertColumns.map(() => "?").join(", ");

        const [userResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO users (${userColumnsSql}) VALUES (${placeholders})`,
          userInsertValues,
        );

        const userId = userResult.insertId;
        if (!userId) {
          throw new HttpError(500, "Failed to create user record.");
        }

        if (itAdminColumns && itAdminColumns.size > 0) {
          const itAdminInsertColumns: string[] = [];
          const itAdminValues: any[] = [];

          itAdminInsertColumns.push("user_id");
          itAdminValues.push(userId);

          if (itAdminColumns.has("admin_id")) {
            itAdminInsertColumns.push("admin_id");
            itAdminValues.push(String(userId));
          }
          if (itAdminColumns.has("first_name")) {
            itAdminInsertColumns.push("first_name");
            itAdminValues.push(firstName);
          }
          if (itAdminColumns.has("middle_name")) {
            itAdminInsertColumns.push("middle_name");
            itAdminValues.push(middleName);
          }
          if (itAdminColumns.has("last_name")) {
            itAdminInsertColumns.push("last_name");
            itAdminValues.push(lastName);
          }
          if (itAdminColumns.has("name")) {
            itAdminInsertColumns.push("name");
            itAdminValues.push(fullName);
          }
          if (itAdminColumns.has("email")) {
            itAdminInsertColumns.push("email");
            itAdminValues.push(email);
          }
          if (itAdminColumns.has("contact_number")) {
            itAdminInsertColumns.push("contact_number");
            itAdminValues.push(phoneNumber);
          }
          if (itAdminColumns.has("phone_number")) {
            itAdminInsertColumns.push("phone_number");
            itAdminValues.push(phoneNumber);
          }
          if (itAdminColumns.has("status")) {
            itAdminInsertColumns.push("status");
            itAdminValues.push("Active");
          }
          if (itAdminColumns.has("role")) {
            itAdminInsertColumns.push("role");
            itAdminValues.push("admin");
          }
          if (itAdminColumns.has("created_at")) {
            itAdminInsertColumns.push("created_at");
            itAdminValues.push(now);
          }
          if (itAdminColumns.has("updated_at")) {
            itAdminInsertColumns.push("updated_at");
            itAdminValues.push(now);
          }

          const itAdminColumnsSql = itAdminInsertColumns.map((column) => `\`${column}\``).join(", ");
          const itAdminPlaceholders = itAdminInsertColumns.map(() => "?").join(", ");

          await connection.query<ResultSetHeader>(
            `INSERT INTO it_admin (${itAdminColumnsSql}) VALUES (${itAdminPlaceholders})`,
            itAdminValues,
          );
        }

        await connection.commit();

        const record = {
          userId,
          adminId: String(userId),
          firstName,
          middleName,
          lastName,
          name: fullName,
          email,
          contactNumber: phoneNumber,
          status: "Active",
          lastLogin: null,
        };

        return { userId, record, temporaryPassword };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
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
    console.error("Failed to add IT Admin", error);
    return NextResponse.json({ error: "Failed to add IT Admin." }, { status: 500 });
  }
}

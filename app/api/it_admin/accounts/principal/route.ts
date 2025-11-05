import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import {
  HttpError,
  createPrincipal,
  sanitizeEmail,
  sanitizeNamePart,
  sanitizeOptionalNamePart,
  sanitizePhoneNumber,
} from "./validation/validation";

export const dynamic = "force-dynamic";

const ROLE_FILTERS = ["principal"] as const;

type RawPrincipalRow = RowDataPacket & {
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
  principal_principal_id?: string | null;
  principal_first_name?: string | null;
  principal_middle_name?: string | null;
  principal_last_name?: string | null;
  principal_suffix?: string | null;
  principal_name?: string | null;
  principal_email?: string | null;
  principal_contact_number?: string | null;
  principal_phone_number?: string | null;
  principal_status?: string | null;
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

async function resolvePrincipalTable(): Promise<{ table: string | null; columns: Set<string> }> {
  const candidates = ["principal", "principals", "principal_info"];
  for (const table of candidates) {
    try {
      const columns = await safeGetColumns(table);
      if (columns.size > 0) {
        return { table, columns };
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

    const principalInfo = await resolvePrincipalTable();
    const accountLogsExists = await tableExists("account_logs");
    const accountLogsColumns = accountLogsExists ? await safeGetColumns("account_logs") : new Set<string>();
    const canJoinAccountLogs = accountLogsExists && accountLogsColumns.has("user_id");

    const selectParts: string[] = ["u.user_id AS user_id"];

    const addUserColumn = (column: string, alias: string) => {
      if (userColumns.has(column)) {
        selectParts.push(`u.${column} AS ${alias}`);
      }
    };

    const addPrincipalColumn = (column: string, alias: string) => {
      if (principalInfo.columns.has(column)) {
        selectParts.push(`p.${column} AS ${alias}`);
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

    addPrincipalColumn("principal_id", "principal_principal_id");
    addPrincipalColumn("first_name", "principal_first_name");
    addPrincipalColumn("middle_name", "principal_middle_name");
    addPrincipalColumn("last_name", "principal_last_name");
    addPrincipalColumn("suffix", "principal_suffix");
    addPrincipalColumn("name", "principal_name");
    addPrincipalColumn("email", "principal_email");
    addPrincipalColumn("contact_number", "principal_contact_number");
    addPrincipalColumn("phone_number", "principal_phone_number");
    addPrincipalColumn("status", "principal_status");

    if (canJoinAccountLogs) {
      if (accountLogsColumns.has("last_login") || accountLogsColumns.has("created_at")) {
        selectParts.push("latest.last_login AS last_login");
      }
    }

    const rolePlaceholders = ROLE_FILTERS.map(() => "?").join(", ");

    let joinClauses = "";

    if (principalInfo.table && principalInfo.columns.size > 0) {
      if (principalInfo.columns.has("user_id")) {
        joinClauses += " LEFT JOIN `principal` AS p ON p.user_id = u.user_id";
      } else if (principalInfo.columns.has("principal_id")) {
        joinClauses += " LEFT JOIN `principal` AS p ON p.principal_id = u.user_id";
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
    const [rows] = await query<RawPrincipalRow[]>(sql, params);

    const records = rows.map((row) => {
      const firstName = coalesce(row.principal_first_name, row.user_first_name);
      const middleName = coalesce(row.principal_middle_name, row.user_middle_name);
      const lastName = coalesce(row.principal_last_name, row.user_last_name);
      const suffix = coalesce(row.principal_suffix, row.user_suffix);
      const fallbackName = buildName(firstName, middleName, lastName, suffix);
      const name = coalesce(row.principal_name, row.user_name, fallbackName, row.user_email);
      const email = coalesce(row.user_email, row.principal_email);
      const contactNumber = coalesce(
        row.principal_contact_number,
        row.principal_phone_number,
        row.user_contact_number,
        row.user_phone_number,
      );
      const status = coalesce(row.user_status, row.principal_status, "Active") ?? "Active";
      const createdAt = row.user_created_at instanceof Date ? row.user_created_at.toISOString() : null;
      const lastLogin = row.last_login instanceof Date ? row.last_login.toISOString() : null;
      const principalId = coalesce(row.principal_principal_id, row.user_id != null ? String(row.user_id) : null) ?? String(row.user_id);

      return {
        userId: row.user_id,
        principalId,
        firstName,
        middleName,
        lastName,
        name,
        suffix,
        email,
        contactNumber,
        status,
        createdAt,
        lastLogin,
      };
    });

    return NextResponse.json({
      total: records.length,
      records,
      metadata: {
        principalTableDetected: principalInfo.table && principalInfo.columns.size > 0,
        accountLogsJoined: canJoinAccountLogs,
      },
    });
  } catch (error) {
    console.error("Failed to fetch principal accounts", error);
    return NextResponse.json({ error: "Failed to fetch principal accounts." }, { status: 500 });
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

    const result = await createPrincipal({
      firstName,
      middleName,
      lastName,
      suffix,
      email,
      phoneNumber,
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
    console.error("Failed to add Principal", error);
    return NextResponse.json({ error: "Failed to add Principal." }, { status: 500 });
  }
}
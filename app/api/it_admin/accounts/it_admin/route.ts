import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import {
  HttpError,
  createItAdmin,
  formatAdminIdentifier,
  sanitizeEmail,
  sanitizeNamePart,
  sanitizeOptionalNamePart,
  sanitizePhoneNumber,
} from "./validation/validation";

export const dynamic = "force-dynamic";

const ROLE_FILTERS = ["admin", "it_admin", "it-admin"] as const;
const ROLE_FILTER_PARAMS: Array<string | number | null> = [...ROLE_FILTERS];

type RawItAdminRow = RowDataPacket & {
  user_id: number;
  user_admin_id?: string | null;
  user_it_admin_id?: string | null;
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
  user_role_id?: number | null;
  user_created_at?: Date | null;
  admin_admin_id?: string | null;
  admin_it_admin_id?: string | null;
  admin_first_name?: string | null;
  admin_middle_name?: string | null;
  admin_last_name?: string | null;
  admin_suffix?: string | null;
  admin_name?: string | null;
  admin_email?: string | null;
  admin_contact_number?: string | null;
  admin_phone_number?: string | null;
  admin_status?: string | null;
  admin_role_id?: number | null;
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

async function persistAdminIdentifiers(
  updates: Array<{
    userId: number;
    previousUserAdminId: string | null;
    previousUserItAdminId: string | null;
    previousUserCode: string | null;
    previousItAdminId: string | null;
    previousItAdminItId: string | null;
    nextId: string;
  }>,
  options: {
    userHasAdminIdColumn: boolean;
    userHasItAdminIdColumn: boolean;
    userHasUserCodeColumn: boolean;
    itAdmin: { hasTable: boolean; hasAdminIdColumn: boolean; hasItAdminIdColumn: boolean; hasUserIdColumn: boolean };
  },
) {
  if (updates.length === 0) {
    return;
  }

  await Promise.all(
    updates.map(async ({
      userId,
      previousUserAdminId,
      previousUserItAdminId,
      previousUserCode,
      previousItAdminId,
      previousItAdminItId,
      nextId,
    }) => {
      try {
        const normalizedNext = nextId.trim();
        if (!normalizedNext) {
          return;
        }

        if (options.userHasAdminIdColumn) {
          await query("UPDATE `users` SET `admin_id` = ? WHERE `user_id` = ? LIMIT 1", [normalizedNext, userId]);
        }
        if (options.userHasItAdminIdColumn) {
          await query("UPDATE `users` SET `it_admin_id` = ? WHERE `user_id` = ? LIMIT 1", [normalizedNext, userId]);
        }
        if (options.userHasUserCodeColumn) {
          await query("UPDATE `users` SET `user_code` = ? WHERE `user_id` = ? LIMIT 1", [normalizedNext, userId]);
        }

        if (options.itAdmin.hasTable && options.itAdmin.hasAdminIdColumn) {
          if (options.itAdmin.hasUserIdColumn) {
            await query("UPDATE `it_admin` SET `admin_id` = ? WHERE `user_id` = ? LIMIT 1", [normalizedNext, userId]);
          } else {
            const matchValue = previousItAdminId?.trim().length
              ? previousItAdminId.trim()
              : previousUserItAdminId?.trim().length
                ? previousUserItAdminId.trim()
                : previousUserAdminId?.trim().length
                  ? previousUserAdminId.trim()
                  : previousUserCode?.trim().length
                    ? previousUserCode.trim()
                    : String(userId);
            await query("UPDATE `it_admin` SET `admin_id` = ? WHERE `admin_id` = ? LIMIT 1", [normalizedNext, matchValue]);
          }
        }
        // Also update it_admin_id column when present
        if (options.itAdmin.hasTable && options.itAdmin.hasItAdminIdColumn) {
          try {
            if (options.itAdmin.hasUserIdColumn) {
              await query("UPDATE `it_admin` SET `it_admin_id` = ? WHERE `user_id` = ?", [normalizedNext, userId]);
            } else {
              const matchValue = previousItAdminItId?.trim()?.length
                ? previousItAdminItId.trim()
                : previousItAdminId?.trim()?.length
                  ? previousItAdminId.trim()
                  : previousUserItAdminId?.trim()?.length
                    ? previousUserItAdminId.trim()
                    : previousUserAdminId?.trim()?.length
                      ? previousUserAdminId.trim()
                      : previousUserCode?.trim()?.length
                        ? previousUserCode.trim()
                        : String(userId);
              await query("UPDATE `it_admin` SET `it_admin_id` = ? WHERE `it_admin_id` = ? LIMIT 1", [normalizedNext, matchValue]);
            }
          } catch {
            // ignore
          }
        }
      } catch (error) {
        console.warn("Failed to persist IT admin identifier", { userId, error });
      }
    }),
  );
}

export async function GET() {
  try {
    const userColumns = await safeGetColumns("users");
    if (userColumns.size === 0) {
      return NextResponse.json({ error: "Users table is not accessible." }, { status: 500 });
    }

    const userHasAdminId = userColumns.has("admin_id");
    const hasRoleIdColumn = userColumns.has("role_id");
    const hasRoleColumn = userColumns.has("role");

    // Guard: need at least one role indicator
    if (!hasRoleIdColumn && !hasRoleColumn) {
      return NextResponse.json({ error: "Users table must have role_id or role column." }, { status: 500 });
    }

    // Resolve role ids for IT admins if role table exists
    let adminRoleIds: number[] = [];
    try {
      const roleColumns = await safeGetColumns("role");
      if (roleColumns.has("role_id") && roleColumns.has("role_name")) {
        const placeholders = ROLE_FILTERS.map(() => "?").join(", ");
        const [roleRows] = await query<RowDataPacket[]>(
          `SELECT role_id FROM role WHERE LOWER(role_name) IN (${placeholders})`,
          ROLE_FILTER_PARAMS,
        );
        adminRoleIds = roleRows
          .map((r) => Number(r.role_id))
          .filter((id) => Number.isInteger(id) && id > 0);
      }
    } catch {
      adminRoleIds = [];
    }

    const itAdminTableExists = await tableExists("it_admin");
    const itAdminColumns = itAdminTableExists ? await safeGetColumns("it_admin") : new Set<string>();
    const itAdminHasAdminId = itAdminColumns.has("admin_id");
    const itAdminHasUserId = itAdminColumns.has("user_id");
    const itAdminHasItAdminId = itAdminColumns.has("it_admin_id");
    const requireItAdminOnly = itAdminTableExists && itAdminHasUserId;
    const accountLogsExists = await tableExists("account_logs");
    const accountLogsColumns = accountLogsExists ? await safeGetColumns("account_logs") : new Set<string>();
    const canJoinAccountLogs = accountLogsExists && accountLogsColumns.has("user_id");

    const selectParts: string[] = ["u.user_id AS user_id"];
    if (hasRoleIdColumn) {
      selectParts.push("u.role_id AS user_role_id");
    }

    const addUserColumn = (column: string, alias: string) => {
      if (userColumns.has(column)) {
        selectParts.push(`u.${column} AS ${alias}`);
      }
    };

    const addItAdminColumn = (column: string, alias: string) => {
      if (itAdminColumns.has(column)) {
        selectParts.push(`ia.${column} AS ${alias}`);
      }
    };

    addUserColumn("admin_id", "user_admin_id");
    addUserColumn("it_admin_id", "user_it_admin_id");
    addUserColumn("user_code", "user_code");
    addUserColumn("first_name", "user_first_name");
    addUserColumn("middle_name", "user_middle_name");
    addUserColumn("last_name", "user_last_name");
    addUserColumn("suffix", "user_suffix");
    addUserColumn("name", "user_name");
    addUserColumn("email", "user_email");
    addUserColumn("contact_number", "user_contact_number");
    addUserColumn("phone_number", "user_phone_number");
    addUserColumn("status", "user_status");
    addUserColumn("role_id", "user_role_id");
    addUserColumn("created_at", "user_created_at");

    addItAdminColumn("admin_id", "admin_admin_id");
    addItAdminColumn("it_admin_id", "admin_it_admin_id");
    addItAdminColumn("first_name", "admin_first_name");
    addItAdminColumn("middle_name", "admin_middle_name");
    addItAdminColumn("last_name", "admin_last_name");
    addItAdminColumn("suffix", "admin_suffix");
    addItAdminColumn("name", "admin_name");
    addItAdminColumn("email", "admin_email");
    addItAdminColumn("contact_number", "admin_contact_number");
    addItAdminColumn("phone_number", "admin_phone_number");
    addItAdminColumn("status", "admin_status");
    addItAdminColumn("role_id", "admin_role_id");

    if (canJoinAccountLogs) {
      if (accountLogsColumns.has("last_login") || accountLogsColumns.has("created_at")) {
        selectParts.push("latest.last_login AS last_login");
      }
    }

    // Determine role filtering strategy. If role_id exists but no matching ids were found,
    // prefer role_id when we have ids; otherwise use text role when column exists; otherwise no filter.
    const useRoleIdFilter = hasRoleIdColumn && adminRoleIds.length > 0;
    const canTextFilter = hasRoleColumn;

    let roleFilterSql = "1=1";
    let roleParams: Array<string | number> = [];

    if (useRoleIdFilter) {
      roleFilterSql = `u.role_id IN (${adminRoleIds.map(() => "?").join(", ")})`;
      roleParams = [...adminRoleIds];
    } else if (canTextFilter) {
      roleFilterSql = `LOWER(u.role) IN (${ROLE_FILTERS.map(() => "?").join(", ")})`;
      roleParams = [...ROLE_FILTERS];
    }

    let joinClauses = "";

    if (itAdminTableExists && itAdminColumns.size > 0) {
      if (itAdminHasUserId) {
        // Enforce only rows present in it_admin by inner join on user_id
        joinClauses += " INNER JOIN `it_admin` AS ia ON ia.user_id = u.user_id";
      } else if (itAdminHasAdminId && userHasAdminId) {
        // Fall back to matching by admin_id when user_id is absent on it_admin
        joinClauses += " LEFT JOIN `it_admin` AS ia ON ia.admin_id = u.admin_id";
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

    const itAdminPresenceFilter = itAdminTableExists
      ? (itAdminHasUserId ? "" : itAdminHasAdminId ? " AND ia.admin_id IS NOT NULL" : "")
      : "";

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM users AS u
      ${joinClauses}
      WHERE ${roleFilterSql}${itAdminPresenceFilter}
      ORDER BY ${orderByClause}
    `;

    const params = [...roleParams];
    const [rows] = await query<RawItAdminRow[]>(sql, params);

    const pendingAdminIdUpdates: Array<{
      userId: number;
      previousUserAdminId: string | null;
      previousUserItAdminId: string | null;
      previousUserCode: string | null;
      previousItAdminId: string | null;
      previousItAdminItId: string | null;
      nextId: string;
    }> = [];

    const records = rows.map((row) => {
      const firstName = coalesce(row.admin_first_name, row.user_first_name);
      const middleName = coalesce(row.admin_middle_name, row.user_middle_name);
      const lastName = coalesce(row.admin_last_name, row.user_last_name);
      const suffix = coalesce(row.admin_suffix, row.user_suffix);
      const fallbackName = buildName(firstName, middleName, lastName, suffix);
      const name = coalesce(row.admin_name, row.user_name, fallbackName, row.user_email);
      const email = coalesce(row.user_email, row.admin_email);
      const contactNumber = coalesce(
        row.admin_contact_number,
        row.admin_phone_number,
        row.user_contact_number,
        row.user_phone_number,
      );
      const status = coalesce(row.user_status, row.admin_status, "Active") ?? "Active";
      const createdAt = row.user_created_at instanceof Date ? row.user_created_at.toISOString() : null;
      const lastLogin = row.last_login instanceof Date ? row.last_login.toISOString() : null;
      const storedAdminId = coalesce(
        row.user_it_admin_id,
        row.admin_it_admin_id,
        row.user_code,
        row.user_admin_id,
        row.admin_admin_id,
        row.user_id != null ? String(row.user_id) : null,
      );
      const adminId = formatAdminIdentifier(storedAdminId, row.user_id);

      const needsUserUpdate = userHasAdminId && (row.user_admin_id ?? "") !== adminId;
      const needsItAdminUpdate = itAdminHasAdminId && (row.admin_admin_id ?? "") !== adminId;

      if (row.user_id != null && (needsUserUpdate || needsItAdminUpdate)) {
        pendingAdminIdUpdates.push({
          userId: row.user_id,
          previousUserAdminId: typeof row.user_admin_id === "string" ? row.user_admin_id : null,
          previousUserItAdminId: typeof row.user_it_admin_id === "string" ? row.user_it_admin_id : null,
          previousUserCode: typeof row.user_code === "string" ? row.user_code : null,
          previousItAdminId: typeof row.admin_admin_id === "string" ? row.admin_admin_id : null,
          previousItAdminItId: typeof row.admin_it_admin_id === "string" ? row.admin_it_admin_id : null,
          nextId: adminId,
        });
      }

      return {
        userId: row.user_id,
        adminId,
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

    await persistAdminIdentifiers(pendingAdminIdUpdates, {
      userHasAdminIdColumn: userHasAdminId,
      userHasItAdminIdColumn: userColumns.has("it_admin_id"),
      userHasUserCodeColumn: userColumns.has("user_code"),
      itAdmin: {
        hasTable: itAdminTableExists,
        hasAdminIdColumn: itAdminHasAdminId,
        hasItAdminIdColumn: itAdminHasItAdminId,
        hasUserIdColumn: itAdminHasUserId,
      },
    });

    return NextResponse.json({
      total: records.length,
      records,
      metadata: {
        itAdminTableDetected: itAdminTableExists && itAdminColumns.size > 0,
        accountLogsJoined: canJoinAccountLogs,
      },
    });
  } catch (error) {
    console.error("Failed to fetch IT admin accounts", error);
    return NextResponse.json({ error: "Failed to fetch IT admin accounts." }, { status: 500 });
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

    const result = await createItAdmin({
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
    console.error("Failed to add IT Admin", error);
    return NextResponse.json({ error: "Failed to add IT Admin." }, { status: 500 });
  }
}
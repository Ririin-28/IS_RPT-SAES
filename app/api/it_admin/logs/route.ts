import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLE_VARIANTS: Record<string, string[]> = {
  admin: ["admin", "it_admin", "it-admin", "it admin"],
  principal: ["principal"],
  master_teacher: ["master_teacher", "master-teacher", "master teacher", "masterteacher"],
  teacher: ["teacher", "faculty"],
  parent: ["parent", "guardian", "parents"],
  student: ["student", "students", "learner", "pupil"],
};

const ACTIVE_WINDOW_MS = 10 * 60 * 1000;

const ROLE_LOOKUP = (() => {
  const lookup = new Map<string, string>();
  for (const [canonical, variants] of Object.entries(ROLE_VARIANTS)) {
    lookup.set(normalizeRoleIdentifier(canonical), canonical);
    for (const variant of variants) {
      lookup.set(normalizeRoleIdentifier(variant), canonical);
    }
  }
  return lookup;
})();

function normalizeRoleIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizeRoleExpression(expr: string): string {
  return `LOWER(REPLACE(REPLACE(REPLACE(TRIM(${expr}), '-', '_'), ' ', '_'), '/', '_'))`;
}

function canonicalizeRole(role: string | null | undefined): string | undefined {
  if (!role) {
    return undefined;
  }

  const normalized = normalizeRoleIdentifier(role);
  return ROLE_LOOKUP.get(normalized) ?? normalized;
}

function resolveDateValue(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

type LogRow = RowDataPacket & Record<string, any>;

function normalizeName(row: LogRow): string | null {
  const direct = row.name ?? null;
  if (direct && direct.trim().length > 0) {
    return direct;
  }

  const first = row.first_name ?? "";
  const last = row.last_name ?? "";
  const combined = `${first} ${last}`.trim();
  if (combined.length > 0) {
    return combined;
  }

  const username = row.username ?? null;
  return username && username.trim().length > 0 ? username : null;
}

function determineStatusFromIso(
  loginIso: string | null,
  loggedOutIso?: string | null
): "Online" | "Offline" {
  if (loggedOutIso) {
    return "Offline";
  }

  if (!loginIso) {
    return "Offline";
  }

  const timestamp = Date.parse(loginIso);
  if (Number.isNaN(timestamp)) {
    return "Offline";
  }

  return Date.now() - timestamp <= ACTIVE_WINDOW_MS ? "Online" : "Offline";
}

export async function GET(request: NextRequest) {
  try {
    const hasAccountLogs = await tableExists("account_logs");

    if (!hasAccountLogs) {
      return NextResponse.json({
        total: 0,
        records: [],
        metadata: {
          missingTables: ["account_logs"],
        },
      });
    }

    const columns = await getTableColumns("account_logs");
    const userColumns = await getTableColumns("users");

    const accountLogColumns = {
      logId: columns.has("log_id") ? "log_id" : columns.has("id") ? "id" : null,
      userId: columns.has("user_id")
        ? "user_id"
        : columns.has("uesr_id")
          ? "uesr_id"
          : null,
      role: columns.has("role") ? "role" : null,
      createdAt: columns.has("created_at") ? "created_at" : columns.has("createdAt") ? "createdAt" : null,
      lastLogin: columns.has("last_login") ? "last_login" : columns.has("lastLogin") ? "lastLogin" : null,
      loggedOutAt: columns.has("logged_out_at") ? "logged_out_at" : columns.has("loggedOutAt") ? "loggedOutAt" : null,
    } as const;

    const missingColumns: string[] = [];
    if (!accountLogColumns.role) {
      missingColumns.push("role");
    }
    if (!accountLogColumns.createdAt) {
      missingColumns.push("created_at");
    }
    if (!accountLogColumns.lastLogin) {
      missingColumns.push("last_login");
    }
    if (!accountLogColumns.loggedOutAt) {
      missingColumns.push("logged_out_at");
    }

    const selectedUserColumns: string[] = [];
    const missingUserColumns: string[] = [];

    const selectUserColumn = (column: string, alias?: string) => {
      if (userColumns.has(column)) {
        selectedUserColumns.push(alias ? `u.${column} AS ${alias}` : `u.${column}`);
        return true;
      }
      missingUserColumns.push(column);
      return false;
    };

    if (!accountLogColumns.userId) {
      return NextResponse.json(
        {
          total: 0,
          records: [],
          metadata: {
            missingColumns: ["user_id"],
          },
        },
        { status: 500 }
      );
    }

    selectUserColumn("username");
    selectUserColumn("email", "user_email");
    selectUserColumn("role", "user_role");
    selectUserColumn("name");
    selectUserColumn("first_name");
    selectUserColumn("last_name");

    // Check if it_admin, principal, master_teacher, and teacher tables exist
    const hasItAdminTable = await tableExists("it_admin");
    const hasPrincipalTable = await tableExists("principal");
    const hasMasterTeacherTable = await tableExists("master_teacher");
    const hasTeacherTable = await tableExists("teacher");

    const selectFragments = [
      "al.*",
      ...selectedUserColumns,
      ...(hasItAdminTable ? ["ia.it_admin_id"] : []),
      ...(hasPrincipalTable ? ["p.principal_id"] : []),
      ...(hasMasterTeacherTable ? ["mt.master_teacher_id"] : []),
      ...(hasTeacherTable ? ["t.teacher_id"] : []),
    ];

    const orderByClause = (() => {
      const created = accountLogColumns.createdAt
        ? `al.\`${accountLogColumns.createdAt}\``
        : null;
      const lastLogin = accountLogColumns.lastLogin
        ? `al.\`${accountLogColumns.lastLogin}\``
        : null;

      if (lastLogin && created) {
        return `ORDER BY COALESCE(${lastLogin}, ${created}) DESC`;
      }
      if (lastLogin) {
        return `ORDER BY ${lastLogin} DESC`;
      }
      if (created) {
        return `ORDER BY ${created} DESC`;
      }
      return "";
    })();

    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get("role");
    const userIdParam = searchParams.get("userId");
    const limitParam = searchParams.get("limit");

    const filters: string[] = [];
    const params: Array<string | number> = [];

    let appliedRole = "all";

    if (roleParam && roleParam.toLowerCase() !== "all") {
      const normalizedParam = normalizeRoleIdentifier(roleParam);
      const canonicalRole = ROLE_LOOKUP.get(normalizedParam) ?? normalizedParam;
      const variants = ROLE_VARIANTS[canonicalRole] ?? [canonicalRole];
      const normalizedVariants = Array.from(
        new Set(variants.map((variant) => normalizeRoleIdentifier(variant)))
      );

      const rawRoleExpr = accountLogColumns.role
        ? `al.\`${accountLogColumns.role}\``
        : userColumns.has("role")
          ? "u.role"
          : null;

      if (!rawRoleExpr) {
        return NextResponse.json(
          {
            error: "Role filtering is not available: no role column found on account_logs or users.",
            metadata: {
              missingColumns: ["account_logs.role", "users.role"],
            },
          },
          { status: 400 },
        );
      }
      const roleExpr = normalizeRoleExpression(rawRoleExpr);
      const placeholders = normalizedVariants.map(() => "?").join(", ");
      filters.push(`${roleExpr} IN (${placeholders})`);
      params.push(...normalizedVariants);
      appliedRole = canonicalRole;
    }

    if (userIdParam) {
      filters.push(`al.\`${accountLogColumns.userId}\` = ?`);
      params.push(Number(userIdParam));
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 100;
    const effectiveLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 100;

    const [rows] = await query<LogRow[]>(
      `SELECT
        ${selectFragments.join(",\n        ")}
      FROM account_logs al
      LEFT JOIN users u ON u.user_id = al.\`${accountLogColumns.userId}\`
      ${hasItAdminTable ? `LEFT JOIN it_admin ia ON ia.user_id = al.\`${accountLogColumns.userId}\`` : ""}
      ${hasPrincipalTable ? `LEFT JOIN principal p ON p.user_id = al.\`${accountLogColumns.userId}\`` : ""}
      ${hasMasterTeacherTable ? `LEFT JOIN master_teacher mt ON mt.user_id = al.\`${accountLogColumns.userId}\`` : ""}
      ${hasTeacherTable ? `LEFT JOIN teacher t ON t.user_id = al.\`${accountLogColumns.userId}\`` : ""}
      ${whereClause}
      ${orderByClause}
      LIMIT ?`
      , [...params, effectiveLimit]
    );

    const logIdColumn = accountLogColumns.logId;
    const userIdColumn = accountLogColumns.userId!;
    const roleColumn = accountLogColumns.role ?? undefined;
    const createdAtColumn = accountLogColumns.createdAt ?? undefined;
    const lastLoginColumn = accountLogColumns.lastLogin ?? undefined;
    const loggedOutAtColumn = accountLogColumns.loggedOutAt ?? undefined;

    const records = rows.map((row, index) => {
      const logIdValue = logIdColumn ? row[logIdColumn] : null;
      const userIdValue = row[userIdColumn];
      const rawRoleValue = roleColumn ? row[roleColumn] : row.user_role;
      const resolvedRole = canonicalizeRole(rawRoleValue);
      const createdAtValue = createdAtColumn ? resolveDateValue(row[createdAtColumn]) : null;
      const lastLoginValue = lastLoginColumn ? resolveDateValue(row[lastLoginColumn]) : null;
      const loggedOutAtValue = loggedOutAtColumn ? resolveDateValue(row[loggedOutAtColumn]) : null;

      const loginIso = lastLoginValue ?? createdAtValue;
      const status = determineStatusFromIso(loginIso, loggedOutAtValue);

      // Use role-specific ID when available
      const itAdminId = row.it_admin_id ?? null;
      const principalId = row.principal_id ?? null;
      const masterTeacherId = row.master_teacher_id ?? null;
      const teacherId = row.teacher_id ?? null;
      const displayId = (resolvedRole === "admin" && itAdminId) 
        ? itAdminId 
        : (resolvedRole === "principal" && principalId)
          ? principalId
          : (resolvedRole === "master_teacher" && masterTeacherId)
            ? masterTeacherId
            : (resolvedRole === "teacher" && teacherId)
              ? teacherId
              : userIdValue;

      return {
        id: (typeof logIdValue === "number" && !Number.isNaN(logIdValue))
          ? logIdValue
          : typeof userIdValue === "number"
            ? userIdValue
            : index + 1,
        logId: logIdValue ?? null,
        userId: typeof userIdValue === "number" ? userIdValue : userIdValue != null ? Number(userIdValue) : null,
        itAdminId: itAdminId,
        principalId: principalId,
        masterTeacherId: masterTeacherId,
        teacherId: teacherId,
        displayId: displayId,
        role: resolvedRole,
        roleLabel: resolvedRole ? ROLE_VARIANTS[resolvedRole] ?? resolvedRole : (typeof rawRoleValue === "string" ? rawRoleValue : "Unknown"),
        lastLogin: lastLoginValue,
        loginTime: loginIso,
        createdAt: createdAtValue,
        name: normalizeName(row),
        email: row.user_email ?? undefined,
        loggedOutAt: loggedOutAtValue ?? undefined,
        status,
      };
    });

    return NextResponse.json({
      role: appliedRole,
      total: rows.length,
      records,
      metadata: {
        availableColumns: Array.from(columns),
        userColumns: Array.from(userColumns),
        ...(missingColumns.length > 0 ? { missingColumns } : {}),
        ...(missingUserColumns.length > 0 ? { missingUserColumns } : {}),
      },
    });
  } catch (error) {
    console.error("Failed to fetch account logs", error);
    return NextResponse.json(
      { error: "Failed to fetch account logs." },
      { status: 500 }
    );
  }
}

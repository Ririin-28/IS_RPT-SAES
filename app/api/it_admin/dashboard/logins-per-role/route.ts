import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import {
  applyRoleFilter,
  monthInRange,
  normalizeRoleValue,
  parseDateRange,
  parseMonthBounds,
  parseRoleFilter,
  toSqlDateTime,
} from "@/lib/server/it-admin-dashboard";
import { requireItAdmin } from "@/lib/server/it-admin-auth";

export const dynamic = "force-dynamic";

type RoleCountRow = RowDataPacket & { role_value: string | null; total_count: number };

export async function GET(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:dashboard.view" });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const hasAccountLogs = await tableExists("account_logs");
    if (!hasAccountLogs) {
      return NextResponse.json({
        data: [],
        empty: true,
        message: "No login history source found.",
        meta: { missingTables: ["account_logs"] },
      });
    }

    const columns = await getTableColumns("account_logs");
    const timestampColumn = columns.has("last_login") ? "last_login" : columns.has("created_at") ? "created_at" : null;
    const roleColumn = columns.has("role") ? "role" : null;

    if (!timestampColumn || !roleColumn) {
      return NextResponse.json({
        data: [],
        empty: true,
        message: "Login logs are missing required columns.",
        meta: {
          missingColumns: [
            ...(timestampColumn ? [] : ["last_login|created_at"]),
            ...(roleColumn ? [] : ["role"]),
          ],
        },
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateRange = parseDateRange(searchParams);
    const roleFilter = parseRoleFilter(searchParams);
    const { monthFrom, monthTo } = parseMonthBounds(searchParams);

    const [rows] = await query<RoleCountRow[]>(
      `SELECT ${roleColumn} AS role_value, COUNT(*) AS total_count
       FROM account_logs
       WHERE ${timestampColumn} BETWEEN ? AND ?
       GROUP BY ${roleColumn}`,
      [toSqlDateTime(dateRange.start), toSqlDateTime(dateRange.end)],
    );

    const aggregated = new Map<string, number>();
    for (const row of rows) {
      const normalized = normalizeRoleValue(row.role_value ?? "Unknown");
      aggregated.set(normalized, (aggregated.get(normalized) ?? 0) + Number(row.total_count ?? 0));
    }

    let data = Array.from(aggregated.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);

    data = applyRoleFilter(data, roleFilter);

    if (monthFrom && monthTo) {
      const selectedMonth = dateRange.end.getMonth() + 1;
      if (!monthInRange(selectedMonth, monthFrom, monthTo)) {
        data = [];
      }
    }

    return NextResponse.json({
      data,
      empty: data.length === 0,
      meta: {
        dateRange: dateRange.label,
        roleFilter: roleFilter ?? "all",
      },
    });
  } catch (error) {
    console.error("Failed to load login-per-role data", error);
    return NextResponse.json(
      {
        data: [],
        empty: true,
        error: "Failed to load login-per-role data.",
      },
      { status: 500 },
    );
  }
}

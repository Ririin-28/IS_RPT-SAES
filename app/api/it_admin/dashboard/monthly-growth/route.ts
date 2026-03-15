import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import {
  buildMonthBuckets,
  formatMonthLabelFromKey,
  monthInRange,
  normalizeRoleValue,
  parseDateRange,
  parseMonthBounds,
  parseRoleFilter,
  toSqlDateTime,
} from "@/lib/server/it-admin-dashboard";
import { requireItAdmin } from "@/lib/server/it-admin-auth";

export const dynamic = "force-dynamic";

type MonthlyGrowthRow = RowDataPacket & {
  month_key: string;
  role_value: string | null;
  created_count: number;
};

export async function GET(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:dashboard.view" });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const hasUsers = await tableExists("users");
    if (!hasUsers) {
      return NextResponse.json({
        data: [],
        empty: true,
        message: "Users table is unavailable.",
        meta: { missingTables: ["users"] },
      });
    }

    const columns = await getTableColumns("users");
    if (!columns.has("created_at")) {
      return NextResponse.json({
        data: [],
        empty: true,
        message: "users.created_at is required for monthly growth.",
        meta: { missingColumns: ["created_at"] },
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateRange = parseDateRange(searchParams);
    const roleFilter = parseRoleFilter(searchParams);
    const { monthFrom, monthTo } = parseMonthBounds(searchParams);

    const roleSelect = columns.has("role") ? "role" : "NULL";
    const roleGroup = columns.has("role") ? ", role" : "";

    const [rows] = await query<MonthlyGrowthRow[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month_key,
              ${roleSelect} AS role_value,
              COUNT(*) AS created_count
       FROM users
       WHERE created_at BETWEEN ? AND ?
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')${roleGroup}
       ORDER BY month_key ASC`,
      [toSqlDateTime(dateRange.start), toSqlDateTime(dateRange.end)],
    );

    const monthBuckets = buildMonthBuckets(dateRange.start, dateRange.end);
    const monthMap = new Map<string, number>(monthBuckets.map((monthKey) => [monthKey, 0]));

    for (const row of rows) {
      const monthKey = row.month_key;
      if (!monthMap.has(monthKey)) continue;

      if (roleFilter && roleFilter.length > 0) {
        const normalizedRole = normalizeRoleValue(row.role_value ?? "Unknown").toLowerCase();
        if (!roleFilter.includes(normalizedRole)) continue;
      }

      const [yearPart, monthPart] = monthKey.split("-");
      const monthNumber = Number.parseInt(monthPart, 10);
      const yearNumber = Number.parseInt(yearPart, 10);

      if (!Number.isFinite(monthNumber) || !Number.isFinite(yearNumber)) continue;
      if (!monthInRange(monthNumber, monthFrom, monthTo)) continue;

      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + Number(row.created_count ?? 0));
    }

    const data = monthBuckets
      .filter((monthKey) => {
        const monthPart = Number.parseInt(monthKey.split("-")[1] ?? "", 10);
        return monthInRange(monthPart, monthFrom, monthTo);
      })
      .map((monthKey) => ({
        month: formatMonthLabelFromKey(monthKey),
        totalAccounts: monthMap.get(monthKey) ?? 0,
      }));

    return NextResponse.json({
      data,
      empty: data.length === 0,
      meta: {
        dateRange: dateRange.label,
        roleFilter: roleFilter ?? "all",
      },
    });
  } catch (error) {
    console.error("Failed to load monthly growth data", error);
    return NextResponse.json(
      {
        data: [],
        empty: true,
        error: "Failed to load monthly growth data.",
      },
      { status: 500 },
    );
  }
}

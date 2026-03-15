import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import {
  buildDayBuckets,
  buildMonthBuckets,
  findPerformanceLogSource,
  formatMonthLabelFromKey,
  parseDateRange,
  toSqlDateTime,
} from "@/lib/server/it-admin-dashboard";
import { requireItAdmin } from "@/lib/server/it-admin-auth";

export const dynamic = "force-dynamic";

type ResponseRow = RowDataPacket & {
  bucket_key: string;
  avg_response: number;
};

function statusFilterClause(filter: string, column: string): { sql: string; params: Array<string | number> } {
  if (filter === "2xx") return { sql: ` AND ${column} BETWEEN 200 AND 299`, params: [] };
  if (filter === "4xx") return { sql: ` AND ${column} BETWEEN 400 AND 499`, params: [] };
  if (filter === "5xx") return { sql: ` AND ${column} BETWEEN 500 AND 599`, params: [] };
  if (filter === "error") return { sql: ` AND ${column} >= 400`, params: [] };
  if (filter === "success") return { sql: ` AND ${column} BETWEEN 200 AND 399`, params: [] };
  return { sql: "", params: [] };
}

export async function GET(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:dashboard.view" });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const source = await findPerformanceLogSource();
    if (!source) {
      return NextResponse.json({
        data: [],
        empty: true,
        message: "No performance log source found.",
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateRange = parseDateRange(searchParams);
    const endpoint = (searchParams.get("endpoint") ?? "all").trim();
    const statusFilter = (searchParams.get("status") ?? "all").trim().toLowerCase();

    const aggregateByMonth = dateRange.preset === "3m" || dateRange.preset === "6m";
    const bucketExpression = aggregateByMonth
      ? `DATE_FORMAT(${source.timestampColumn}, '%Y-%m')`
      : `DATE(${source.timestampColumn})`;

    const whereParts: string[] = [`${source.timestampColumn} BETWEEN ? AND ?`];
    const params: Array<string | number> = [toSqlDateTime(dateRange.start), toSqlDateTime(dateRange.end)];

    if (endpoint !== "all" && source.endpointColumn) {
      whereParts.push(`LOWER(${source.endpointColumn}) = LOWER(?)`);
      params.push(endpoint);
    }

    if (statusFilter !== "all" && source.statusCodeColumn) {
      const clause = statusFilterClause(statusFilter, source.statusCodeColumn);
      whereParts.push(clause.sql.replace(/^\s+AND\s+/i, ""));
      params.push(...clause.params);
    }

    const [rows] = await query<ResponseRow[]>(
      `SELECT ${bucketExpression} AS bucket_key,
              AVG(${source.responseMsColumn}) AS avg_response
       FROM ${source.table}
       WHERE ${whereParts.join(" AND ")}
       GROUP BY ${bucketExpression}
       ORDER BY bucket_key ASC`,
      params,
    );

    const buckets = aggregateByMonth
      ? buildMonthBuckets(dateRange.start, dateRange.end)
      : buildDayBuckets(dateRange.start, dateRange.end);

    const valueMap = new Map<string, number>();
    for (const row of rows) {
      valueMap.set(row.bucket_key, Number(Number(row.avg_response ?? 0).toFixed(2)));
    }

    const data = buckets.map((bucket) => ({
      time: aggregateByMonth ? formatMonthLabelFromKey(bucket) : bucket,
      responseMs: valueMap.get(bucket) ?? 0,
    }));

    return NextResponse.json({
      data,
      empty: data.every((item) => item.responseMs === 0),
      meta: {
        sourceTable: source.table,
        endpointApplied: endpoint,
        statusApplied: statusFilter,
      },
    });
  } catch (error) {
    console.error("Failed to load response-time data", error);
    return NextResponse.json(
      {
        data: [],
        empty: true,
        error: "Failed to load response-time data.",
      },
      { status: 500 },
    );
  }
}

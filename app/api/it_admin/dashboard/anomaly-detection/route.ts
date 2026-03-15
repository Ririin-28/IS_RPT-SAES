import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import {
  buildDayBuckets,
  computeZScoreAnomalies,
  findPerformanceLogSource,
  parseDateRange,
  toSqlDateTime,
} from "@/lib/server/it-admin-dashboard";
import { requireItAdmin } from "@/lib/server/it-admin-auth";

export const dynamic = "force-dynamic";

type BucketValueRow = RowDataPacket & {
  bucket_key: string;
  metric_value: number;
};

async function getLoginSeries(start: Date, end: Date) {
  const hasAccountLogs = await tableExists("account_logs");
  if (!hasAccountLogs) return [] as Array<{ key: string; label: string; metricName: string; value: number }>;

  const columns = await getTableColumns("account_logs");
  const timestampColumn = columns.has("last_login") ? "last_login" : columns.has("created_at") ? "created_at" : null;
  if (!timestampColumn) return [];

  const [rows] = await query<BucketValueRow[]>(
    `SELECT DATE(${timestampColumn}) AS bucket_key, COUNT(*) AS metric_value
     FROM account_logs
     WHERE ${timestampColumn} BETWEEN ? AND ?
     GROUP BY DATE(${timestampColumn})
     ORDER BY bucket_key ASC`,
    [toSqlDateTime(start), toSqlDateTime(end)],
  );

  return rows.map((row) => ({
    key: row.bucket_key,
    label: row.bucket_key,
    metricName: "login_count",
    value: Number(row.metric_value ?? 0),
  }));
}

async function getResponseSeries(start: Date, end: Date, endpoint: string, statusFilter: string) {
  const source = await findPerformanceLogSource();
  if (!source) return [] as Array<{ key: string; label: string; metricName: string; value: number }>;

  const whereParts: string[] = [`${source.timestampColumn} BETWEEN ? AND ?`];
  const params: Array<string | number> = [toSqlDateTime(start), toSqlDateTime(end)];

  if (endpoint !== "all" && source.endpointColumn) {
    whereParts.push(`LOWER(${source.endpointColumn}) = LOWER(?)`);
    params.push(endpoint);
  }

  if (statusFilter === "2xx" && source.statusCodeColumn) {
    whereParts.push(`${source.statusCodeColumn} BETWEEN 200 AND 299`);
  } else if (statusFilter === "4xx" && source.statusCodeColumn) {
    whereParts.push(`${source.statusCodeColumn} BETWEEN 400 AND 499`);
  } else if (statusFilter === "5xx" && source.statusCodeColumn) {
    whereParts.push(`${source.statusCodeColumn} BETWEEN 500 AND 599`);
  } else if (statusFilter === "error" && source.statusCodeColumn) {
    whereParts.push(`${source.statusCodeColumn} >= 400`);
  } else if (statusFilter === "success" && source.statusCodeColumn) {
    whereParts.push(`${source.statusCodeColumn} BETWEEN 200 AND 399`);
  }

  const [rows] = await query<BucketValueRow[]>(
    `SELECT DATE(${source.timestampColumn}) AS bucket_key,
            AVG(${source.responseMsColumn}) AS metric_value
     FROM ${source.table}
     WHERE ${whereParts.join(" AND ")}
     GROUP BY DATE(${source.timestampColumn})
     ORDER BY bucket_key ASC`,
    params,
  );

  return rows.map((row) => ({
    key: row.bucket_key,
    label: row.bucket_key,
    metricName: "response_ms",
    value: Number(Number(row.metric_value ?? 0).toFixed(2)),
  }));
}

export async function GET(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:dashboard.view" });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const dateRange = parseDateRange(searchParams);
    const anomalyType = (searchParams.get("anomalyType") ?? "all").trim().toLowerCase();
    const endpoint = (searchParams.get("endpoint") ?? "all").trim();
    const statusFilter = (searchParams.get("status") ?? "all").trim().toLowerCase();

    const buckets = buildDayBuckets(dateRange.start, dateRange.end);

    const loginSeries = anomalyType === "all" || anomalyType === "logins" ? await getLoginSeries(dateRange.start, dateRange.end) : [];
    const responseSeries = anomalyType === "all" || anomalyType === "response" ? await getResponseSeries(dateRange.start, dateRange.end, endpoint, statusFilter) : [];

    const baseSeries = responseSeries.length > 0 ? responseSeries : loginSeries;

    if (baseSeries.length === 0) {
      return NextResponse.json({
        data: [],
        empty: true,
        message: "No anomaly source data found for selected filters.",
      });
    }

    const valueMap = new Map(baseSeries.map((point) => [point.key, point]));
    const normalizedSeries = buckets.map((bucket) => {
      const found = valueMap.get(bucket);
      return found ?? { key: bucket, label: bucket, metricName: baseSeries[0].metricName, value: 0 };
    });

    const anomalies = computeZScoreAnomalies(normalizedSeries);

    const data = anomalies.map((entry) => ({
      time: entry.label,
      value: entry.value,
      isAnomaly: entry.anomalyFlag,
      metricName: entry.metricName,
      expectedValue: entry.expectedValue,
      severity: entry.severity,
    }));

    return NextResponse.json({
      data,
      empty: data.length === 0,
      meta: {
        anomalyType,
      },
    });
  } catch (error) {
    console.error("Failed to load anomaly detection data", error);
    return NextResponse.json(
      {
        data: [],
        empty: true,
        error: "Failed to load anomaly detection data.",
      },
      { status: 500 },
    );
  }
}

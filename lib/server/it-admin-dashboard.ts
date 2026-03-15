import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export type DateRangePreset = "daily" | "weekly" | "30d" | "3m" | "6m";

type GenericRow = RowDataPacket & Record<string, unknown>;

type SourceCandidate = {
  table: string;
  timestampColumns: string[];
  valueColumns: string[];
  endpointColumns?: string[];
  statusCodeColumns?: string[];
};

export type PerformanceLogSource = {
  table: string;
  timestampColumn: string;
  responseMsColumn: string;
  endpointColumn: string | null;
  statusCodeColumn: string | null;
};

const DATE_RANGE_PRESETS: DateRangePreset[] = ["daily", "weekly", "30d", "3m", "6m"];

const ROLE_VARIANTS: Record<string, string[]> = {
  "it admin": ["it_admin", "it admin", "admin", "super_admin", "super admin", "it-admin"],
  principal: ["principal"],
  coordinator: ["coordinator"],
  "master teacher": ["master_teacher", "master teacher", "master-teacher", "masterteacher"],
  teacher: ["teacher", "faculty"],
  parent: ["parent", "parents", "guardian"],
  student: ["student", "students", "learner", "pupil"],
};

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

const PERFORMANCE_SOURCE_CANDIDATES: SourceCandidate[] = [
  {
    table: "api_request_logs",
    timestampColumns: ["created_at", "logged_at", "timestamp", "request_time"],
    valueColumns: ["response_ms", "duration_ms", "latency_ms", "response_time_ms"],
    endpointColumns: ["endpoint", "path", "route"],
    statusCodeColumns: ["status_code", "http_status", "status"],
  },
  {
    table: "request_logs",
    timestampColumns: ["created_at", "logged_at", "timestamp", "request_time"],
    valueColumns: ["response_ms", "duration_ms", "latency_ms", "response_time_ms"],
    endpointColumns: ["endpoint", "path", "route"],
    statusCodeColumns: ["status_code", "http_status", "status"],
  },
  {
    table: "api_logs",
    timestampColumns: ["created_at", "logged_at", "timestamp", "request_time"],
    valueColumns: ["response_ms", "duration_ms", "latency_ms", "response_time_ms"],
    endpointColumns: ["endpoint", "path", "route"],
    statusCodeColumns: ["status_code", "http_status", "status"],
  },
  {
    table: "server_logs",
    timestampColumns: ["created_at", "logged_at", "timestamp", "request_time"],
    valueColumns: ["response_ms", "duration_ms", "latency_ms", "response_time_ms"],
    endpointColumns: ["endpoint", "path", "route"],
    statusCodeColumns: ["status_code", "http_status", "status"],
  },
];

function normalizeRoleIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s/\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function normalizeRoleValue(role: string | null | undefined): string {
  if (!role) return "Unknown";
  const normalized = normalizeRoleIdentifier(role);
  return ROLE_LOOKUP.get(normalized) ?? role.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function parseRoleFilter(searchParams: URLSearchParams): string[] | null {
  const rolesRaw = searchParams.get("roles")?.trim();
  if (!rolesRaw || rolesRaw.toLowerCase() === "all") return null;

  const canonical = Array.from(
    new Set(
      rolesRaw
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => normalizeRoleValue(entry).toLowerCase()),
    ),
  );

  return canonical.length > 0 ? canonical : null;
}

export function parseDateRange(searchParams: URLSearchParams): {
  preset: DateRangePreset;
  start: Date;
  end: Date;
  label: string;
  isValid: boolean;
} {
  const presetRaw = (searchParams.get("dateRange") ?? "30d").trim().toLowerCase();
  const preset = DATE_RANGE_PRESETS.includes(presetRaw as DateRangePreset)
    ? (presetRaw as DateRangePreset)
    : "30d";

  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  if (preset === "daily") {
    start.setDate(start.getDate() - 1);
  } else if (preset === "weekly") {
    start.setDate(start.getDate() - 7);
  } else if (preset === "30d") {
    start.setDate(start.getDate() - 30);
  } else if (preset === "3m") {
    start.setDate(start.getDate() - 90);
  } else {
    start.setDate(start.getDate() - 180);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const label =
    preset === "daily"
      ? "Daily"
      : preset === "weekly"
        ? "Weekly"
        : preset === "30d"
          ? "Last 30 Days"
          : preset === "3m"
            ? "Last 3 Months"
            : "Last 6 Months";

  return { preset, start, end, label, isValid: true };
}

export function parseMonthBounds(searchParams: URLSearchParams): {
  monthFrom: number | null;
  monthTo: number | null;
} {
  const parseMonthValue = (value: string | null): number | null => {
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 12) return null;
    return parsed;
  };

  return {
    monthFrom: parseMonthValue(searchParams.get("monthFrom")),
    monthTo: parseMonthValue(searchParams.get("monthTo")),
  };
}

export function monthInRange(month: number, monthFrom: number | null, monthTo: number | null): boolean {
  if (!monthFrom || !monthTo) return true;
  if (monthFrom <= monthTo) return month >= monthFrom && month <= monthTo;
  return month >= monthFrom || month <= monthTo;
}

export function toSqlDateTime(value: Date): string {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function formatDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function formatMonthLabelFromKey(key: string): string {
  const [yearPart, monthPart] = key.split("-");
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return key;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

export function buildDayBuckets(start: Date, end: Date): string[] {
  const buckets: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    buckets.push(formatDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

export function buildMonthBuckets(start: Date, end: Date): string[] {
  const buckets: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const final = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= final) {
    buckets.push(formatMonthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return buckets;
}

export async function findPerformanceLogSource(): Promise<PerformanceLogSource | null> {
  for (const candidate of PERFORMANCE_SOURCE_CANDIDATES) {
    const exists = await tableExists(candidate.table);
    if (!exists) continue;

    const columns = await getTableColumns(candidate.table);

    const timestampColumn = candidate.timestampColumns.find((column) => columns.has(column)) ?? null;
    const responseMsColumn = candidate.valueColumns.find((column) => columns.has(column)) ?? null;

    if (!timestampColumn || !responseMsColumn) continue;

    return {
      table: candidate.table,
      timestampColumn,
      responseMsColumn,
      endpointColumn: candidate.endpointColumns?.find((column) => columns.has(column)) ?? null,
      statusCodeColumn: candidate.statusCodeColumns?.find((column) => columns.has(column)) ?? null,
    };
  }

  return null;
}

export async function aggregateByRole(
  timestampColumn: string,
  roleColumn: string,
  start: Date,
  end: Date,
): Promise<Array<{ role: string; count: number }>> {
  const [rows] = await query<GenericRow[]>(
    `SELECT ${roleColumn} AS role_value, COUNT(*) AS total_count
     FROM account_logs
     WHERE ${timestampColumn} BETWEEN ? AND ?
     GROUP BY ${roleColumn}`,
    [toSqlDateTime(start), toSqlDateTime(end)],
  );

  const roleMap = new Map<string, number>();

  for (const row of rows) {
    const canonical = normalizeRoleValue(String(row.role_value ?? "Unknown"));
    const next = Number(row.total_count ?? 0);
    roleMap.set(canonical, (roleMap.get(canonical) ?? 0) + next);
  }

  return Array.from(roleMap.entries()).map(([role, count]) => ({ role, count }));
}

export function applyRoleFilter<T extends { role: string }>(rows: T[], roleFilter: string[] | null): T[] {
  if (!roleFilter || roleFilter.length === 0) return rows;
  const allowed = new Set(roleFilter.map((entry) => entry.toLowerCase()));
  return rows.filter((row) => allowed.has(row.role.toLowerCase()));
}

export function computeZScoreAnomalies(
  rows: Array<{ key: string; label: string; metricName: string; value: number }>,
): Array<{
  key: string;
  label: string;
  metricName: string;
  value: number;
  expectedValue: number;
  anomalyFlag: boolean;
  severity: "low" | "medium" | "high";
}> {
  if (rows.length === 0) return [];

  const values = rows.map((row) => row.value);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return rows.map((row) => {
    const zScore = stdDev > 0 ? (row.value - mean) / stdDev : 0;
    const deltaRatio = mean > 0 ? row.value / mean : 0;
    const anomalyFlag = stdDev > 0 ? zScore >= 2 : deltaRatio >= 1.8;

    let severity: "low" | "medium" | "high" = "low";
    if (anomalyFlag) {
      if (zScore >= 3 || deltaRatio >= 2.3) {
        severity = "high";
      } else if (zScore >= 2.5 || deltaRatio >= 2.0) {
        severity = "medium";
      }
    }

    return {
      key: row.key,
      label: row.label,
      metricName: row.metricName,
      value: row.value,
      expectedValue: Number(mean.toFixed(2)),
      anomalyFlag,
      severity,
    };
  });
}

import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

class MissingRemedialTableError extends Error {
  constructor() {
    super("Remedial schedule table is not available in the database.");
    this.name = "MissingRemedialTableError";
  }
}

const TABLE_CANDIDATES = [
  "remedial_schedule",
  "remedial_schedules",
  "remedial_period",
  "remedial_periods",
  "remedial_calendar",
  "remedial_windows",
  "remedial_window",
] as const;

const START_COLUMN_CANDIDATES = [
  "start_date",
  "start",
  "start_at",
  "schedule_start",
  "period_start",
  "remedial_start",
  "startDate",
] as const;

const END_COLUMN_CANDIDATES = [
  "end_date",
  "end",
  "end_at",
  "schedule_end",
  "period_end",
  "remedial_end",
  "endDate",
] as const;

const QUARTER_COLUMN_CANDIDATES = [
  "quarter",
  "remedial_quarter",
  "term",
  "segment",
] as const;

const ACTIVE_COLUMN_CANDIDATES = [
  "is_active",
  "active",
  "status",
  "state",
  "enabled",
] as const;

const ID_COLUMN_CANDIDATES = [
  "id",
  "schedule_id",
  "remedial_schedule_id",
  "period_id",
  "remedial_period_id",
] as const;

const UPDATED_AT_COLUMN_CANDIDATES = [
  "updated_at",
  "updatedAt",
  "modified_at",
  "modifiedAt",
  "last_updated",
] as const;

const CREATED_AT_COLUMN_CANDIDATES = [
  "created_at",
  "createdAt",
  "inserted_at",
  "insertedAt",
] as const;

const ACTIVE_TRUE_VALUES = new Set(["1", "true", "active", "enabled", "yes"]);

interface ResolvedTableInfo {
  table: string;
  columns: Set<string>;
  startColumn: string;
  endColumn: string;
  quarterColumn: string | null;
  activeColumn: string | null;
  idColumn: string | null;
  updatedAtColumn: string | null;
  createdAtColumn: string | null;
}

const normalizeColumnName = (value: string) => value.trim().toLowerCase();

function pickColumn(columns: Set<string>, candidates: readonly string[]): string | null {
  const normalizedSet = new Map<string, string>();
  for (const column of columns) {
    normalizedSet.set(normalizeColumnName(column), column);
  }

  for (const candidate of candidates) {
    const normalized = normalizeColumnName(candidate);
    const resolved = normalizedSet.get(normalized);
    if (resolved) {
      return resolved;
    }
  }
  return null;
}

async function safeGetColumns(tableName: string): Promise<Set<string>> {
  try {
    return await getTableColumns(tableName);
  } catch (error) {
    console.warn(`Unable to introspect columns for table ${tableName}`, error);
    return new Set();
  }
}

async function resolveRemedialTable(): Promise<ResolvedTableInfo | null> {
  for (const candidate of TABLE_CANDIDATES) {
    const columns = await safeGetColumns(candidate);
    if (columns.size === 0) {
      continue;
    }
    const startColumn = pickColumn(columns, START_COLUMN_CANDIDATES);
    const endColumn = pickColumn(columns, END_COLUMN_CANDIDATES);
    if (!startColumn || !endColumn) {
      continue;
    }

    return {
      table: candidate,
      columns,
      startColumn,
      endColumn,
      quarterColumn: pickColumn(columns, QUARTER_COLUMN_CANDIDATES),
      activeColumn: pickColumn(columns, ACTIVE_COLUMN_CANDIDATES),
      idColumn: pickColumn(columns, ID_COLUMN_CANDIDATES),
      updatedAtColumn: pickColumn(columns, UPDATED_AT_COLUMN_CANDIDATES),
      createdAtColumn: pickColumn(columns, CREATED_AT_COLUMN_CANDIDATES),
    } satisfies ResolvedTableInfo;
  }
  return null;
}

const interpretActiveValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value).trim().toLowerCase();
  return ACTIVE_TRUE_VALUES.has(normalized);
};

const buildActiveValue = (columnName: string, active: boolean) => {
  const normalized = columnName.toLowerCase();
  if (normalized.includes("status") || normalized.includes("state")) {
    return active ? "active" : "inactive";
  }
  if (normalized.includes("enabled")) {
    return active ? 1 : 0;
  }
  if (normalized.includes("flag")) {
    return active ? 1 : 0;
  }
  if (normalized.includes("is_")) {
    return active ? 1 : 0;
  }
  return active ? 1 : 0;
};

const formatDateValue = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface RawScheduleRow extends RowDataPacket {
  schedule_id?: number;
  id?: number;
  start_date?: string | Date | null;
  end_date?: string | Date | null;
  quarter?: string | null;
  status?: string | null;
  is_active?: number | null;
  active?: number | string | null;
  state?: string | null;
}

const extractDate = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return formatDateValue(value.toISOString());
  }
  const stringValue = String(value).trim();
  if (!stringValue) return null;
  const parsed = new Date(stringValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatDateValue(parsed.toISOString());
};

const buildOrderClause = (info: ResolvedTableInfo) => {
  const orderParts: string[] = [];
  if (info.activeColumn) {
    orderParts.push(
      `CASE WHEN LOWER(CAST(rs.${info.activeColumn} AS CHAR)) IN ('1','true','active','enabled','yes') THEN 0 ELSE 1 END`
    );
  }
  if (info.updatedAtColumn) {
    orderParts.push(`rs.${info.updatedAtColumn} DESC`);
  }
  if (info.createdAtColumn) {
    orderParts.push(`rs.${info.createdAtColumn} DESC`);
  }
  if (info.idColumn) {
    orderParts.push(`rs.${info.idColumn} DESC`);
  }
  if (orderParts.length === 0) {
    orderParts.push(`rs.${info.startColumn} DESC`);
  }
  return orderParts.join(", ");
};

const mapRowToSchedule = (row: RawScheduleRow, info: ResolvedTableInfo) => {
  if (!row) return null;
  const start = extractDate(row[info.startColumn as keyof RawScheduleRow]);
  const end = extractDate(row[info.endColumn as keyof RawScheduleRow]);
  return {
    quarter: info.quarterColumn ? (row[info.quarterColumn as keyof RawScheduleRow] as string | null) ?? null : null,
    startDate: start,
    endDate: end,
    active: info.activeColumn ? interpretActiveValue(row[info.activeColumn as keyof RawScheduleRow]) : true,
    id: info.idColumn ? (row[info.idColumn as keyof RawScheduleRow] as number | null | undefined) ?? null : null,
  };
};

const ensureTable = async (): Promise<ResolvedTableInfo> => {
  const tableInfo = await resolveRemedialTable();
  if (!tableInfo) {
    throw new MissingRemedialTableError();
  }
  return tableInfo;
};

const fetchCurrentSchedule = async (info: ResolvedTableInfo) => {
  const selectParts: string[] = [
    `rs.${info.startColumn} AS start_column`,
    `rs.${info.endColumn} AS end_column`,
  ];
  if (info.quarterColumn) {
    selectParts.push(`rs.${info.quarterColumn} AS quarter_column`);
  }
  if (info.activeColumn) {
    selectParts.push(`rs.${info.activeColumn} AS active_column`);
  }
  if (info.idColumn) {
    selectParts.push(`rs.${info.idColumn} AS id_column`);
  }
  const sql = `SELECT ${selectParts.join(", ")}, rs.* FROM \`${info.table}\` AS rs ORDER BY ${buildOrderClause(info)} LIMIT 1`;
  const [rows] = await query<RawScheduleRow[]>(sql);
  if (rows.length === 0) {
    return null;
  }
  const row = rows[0];
  return {
    quarter: info.quarterColumn ? (row.quarter_column as string | null) ?? null : null,
    startDate: extractDate(row.start_column),
    endDate: extractDate(row.end_column),
    active: info.activeColumn ? interpretActiveValue(row.active_column) : true,
    id: info.idColumn ? (row.id_column as number | null | undefined) ?? null : null,
  };
};

const respondWithSchedule = (schedule: Awaited<ReturnType<typeof fetchCurrentSchedule>>) =>
  NextResponse.json({
    success: true,
    schedule,
  });

export async function GET() {
  try {
    const tableInfo = await ensureTable();
    const schedule = await fetchCurrentSchedule(tableInfo);
    return respondWithSchedule(schedule);
  } catch (error) {
    if (error instanceof MissingRemedialTableError) {
      return NextResponse.json({ success: true, schedule: null }, { status: 404 });
    }
    console.error("Failed to load remedial schedule", error);
    return NextResponse.json({ success: false, error: "Remedial schedule is unavailable." }, { status: 500 });
  }
}

interface UpsertPayload {
  quarter?: string | null;
  startDate: string;
  endDate: string;
}

const normalizePayload = (payload: any): UpsertPayload => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload.");
  }
  const quarter = typeof payload.quarter === "string" ? payload.quarter.trim() : null;
  if (!payload.startDate || !payload.endDate) {
    throw new Error("startDate and endDate are required.");
  }
  const normalizedStart = formatDateValue(String(payload.startDate));
  const normalizedEnd = formatDateValue(String(payload.endDate));
  return {
    quarter,
    startDate: normalizedStart,
    endDate: normalizedEnd,
  } satisfies UpsertPayload;
};

const buildUpsertValues = (
  info: ResolvedTableInfo,
  payload: UpsertPayload,
  active: boolean,
) => {
  const columns: string[] = [];
  const placeholders: string[] = [];
  const values: Array<string | number | null> = [];

  columns.push(info.startColumn);
  placeholders.push("?");
  values.push(payload.startDate);

  columns.push(info.endColumn);
  placeholders.push("?");
  values.push(payload.endDate);

  if (info.quarterColumn) {
    columns.push(info.quarterColumn);
    placeholders.push("?");
    values.push(payload.quarter ?? null);
  }

  if (info.activeColumn) {
    columns.push(info.activeColumn);
    placeholders.push("?");
    values.push(buildActiveValue(info.activeColumn, active));
  }

  return { columns, placeholders, values } as const;
};

export async function POST(request: NextRequest) {
  try {
    const tableInfo = await ensureTable();
    const payload = normalizePayload(await request.json());
    const schedule = await fetchCurrentSchedule(tableInfo);

    const { columns, placeholders, values } = buildUpsertValues(tableInfo, payload, true);

    if (schedule?.id && tableInfo.idColumn) {
      const assignments = columns.map((column) => `\`${column}\` = ?`).join(", ");
      await query(
        `UPDATE \`${tableInfo.table}\` SET ${assignments} WHERE \`${tableInfo.idColumn}\` = ? LIMIT 1`,
        [...values, schedule.id],
      );
    } else if (schedule && tableInfo.activeColumn && !tableInfo.idColumn) {
      const assignments = columns.map((column) => `\`${column}\` = ?`).join(", ");
      await query(`UPDATE \`${tableInfo.table}\` SET ${assignments}`, values);
    } else {
      await query(
        `INSERT INTO \`${tableInfo.table}\` (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES (${placeholders.join(", ")})`,
        values,
      );
    }

    const nextSchedule = await fetchCurrentSchedule(tableInfo);
    return respondWithSchedule(nextSchedule);
  } catch (error) {
    if (error instanceof MissingRemedialTableError) {
      return NextResponse.json({ success: false, error: "Remedial schedule storage is not configured." }, { status: 404 });
    }
    console.error("Failed to save remedial schedule", error);
    return NextResponse.json({ success: false, error: "Unable to save remedial schedule." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const tableInfo = await ensureTable();
    const schedule = await fetchCurrentSchedule(tableInfo);
    if (!schedule) {
      return respondWithSchedule(null);
    }

    if (tableInfo.activeColumn) {
      const inactiveValue = buildActiveValue(tableInfo.activeColumn, false);
      if (schedule.id && tableInfo.idColumn) {
        await query(
          `UPDATE \`${tableInfo.table}\` SET \`${tableInfo.activeColumn}\` = ? WHERE \`${tableInfo.idColumn}\` = ? LIMIT 1`,
          [inactiveValue, schedule.id],
        );
      } else {
        await query(
          `UPDATE \`${tableInfo.table}\` SET \`${tableInfo.activeColumn}\` = ?`,
          [inactiveValue],
        );
      }
    } else if (schedule.id && tableInfo.idColumn) {
      await query(`DELETE FROM \`${tableInfo.table}\` WHERE \`${tableInfo.idColumn}\` = ? LIMIT 1`, [schedule.id]);
    } else {
      await query(
        `UPDATE \`${tableInfo.table}\` SET \`${tableInfo.startColumn}\` = NULL, \`${tableInfo.endColumn}\` = NULL${
          tableInfo.quarterColumn ? `, \`${tableInfo.quarterColumn}\` = NULL` : ""
        }`,
      );
    }

    const nextSchedule = await fetchCurrentSchedule(tableInfo);
    return respondWithSchedule(nextSchedule);
  } catch (error) {
    if (error instanceof MissingRemedialTableError) {
      return NextResponse.json({ success: false, error: "Remedial schedule storage is not configured." }, { status: 404 });
    }
    console.error("Failed to clear remedial schedule", error);
    return NextResponse.json({ success: false, error: "Unable to update remedial schedule." }, { status: 500 });
  }
}

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

const MONTH_TABLE_CANDIDATES = [
  "remedial_schedule_months",
  "remedial_months",
  "remedial_schedule_month",
  "remedial_month_entries",
] as const;

const MONTH_SCHEDULE_ID_COLUMN_CANDIDATES = [
  "schedule_id",
  "remedial_schedule_id",
  "period_id",
  "remedial_period_id",
] as const;

const MONTH_MONTH_COLUMN_CANDIDATES = [
  "month",
  "month_index",
  "month_value",
] as const;

const ACTIVE_TRUE_VALUES = new Set(["1", "true", "active", "enabled", "yes"]);

const QUARTER_VALUES = ["1st Quarter", "2nd Quarter"] as const;
type QuarterValue = (typeof QUARTER_VALUES)[number];
type QuarterMonthsRecord = Record<QuarterValue, number[]>;

const QUARTER_VALUE_SET = new Set<QuarterValue>(QUARTER_VALUES);

const createEmptyQuarterMonths = (): QuarterMonthsRecord => ({
  "1st Quarter": [],
  "2nd Quarter": [],
});

const sanitizeMonthIndex = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const truncated = Math.trunc(numeric);
  if (truncated >= 0 && truncated <= 11) {
    return truncated;
  }
  if (truncated >= 1 && truncated <= 12) {
    return truncated - 1;
  }
  return null;
};

const resolveQuarterKey = (value: unknown): QuarterValue | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("second") || normalized.startsWith("2")) {
    return "2nd Quarter";
  }
  if (normalized.includes("first") || normalized.startsWith("1")) {
    return "1st Quarter";
  }
  if (normalized === "2nd quarter") {
    return "2nd Quarter";
  }
  if (normalized === "1st quarter") {
    return "1st Quarter";
  }
  return null;
};

const normalizeMonthsRecord = (input: unknown): QuarterMonthsRecord => {
  const result = createEmptyQuarterMonths();
  if (!input || typeof input !== "object") {
    return result;
  }

  for (const quarter of QUARTER_VALUES) {
    const candidate = (input as Record<string, unknown>)[quarter];
    const values = Array.isArray(candidate) ? candidate : [];
    const sanitized = values
      .map((value) => sanitizeMonthIndex(value))
      .filter((value): value is number => value !== null);
    const uniqueSorted = Array.from(new Set(sanitized)).sort((a, b) => a - b);
    result[quarter] = uniqueSorted;
  }

  return result;
};

const resolveQuarterValue = (value: string | null | undefined): QuarterValue => {
  return resolveQuarterKey(value) ?? "1st Quarter";
};

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

interface ResolvedMonthTableInfo {
  table: string;
  columns: Set<string>;
  scheduleIdColumn: string;
  monthColumn: string;
  quarterColumn: string | null;
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

async function resolveRemedialMonthTable(): Promise<ResolvedMonthTableInfo | null> {
  for (const candidate of MONTH_TABLE_CANDIDATES) {
    const columns = await safeGetColumns(candidate);
    if (columns.size === 0) {
      continue;
    }

    const scheduleIdColumn = pickColumn(columns, MONTH_SCHEDULE_ID_COLUMN_CANDIDATES);
    const monthColumn = pickColumn(columns, MONTH_MONTH_COLUMN_CANDIDATES);
    if (!scheduleIdColumn || !monthColumn) {
      continue;
    }

    return {
      table: candidate,
      columns,
      scheduleIdColumn,
      monthColumn,
      quarterColumn: pickColumn(columns, QUARTER_COLUMN_CANDIDATES),
    } satisfies ResolvedMonthTableInfo;
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

const fetchScheduleMonths = async (
  scheduleId: number,
  info: ResolvedMonthTableInfo,
  fallbackQuarter: QuarterValue,
): Promise<QuarterMonthsRecord> => {
  const selectParts = [`\`${info.monthColumn}\` AS month_value`];
  if (info.quarterColumn) {
    selectParts.push(`\`${info.quarterColumn}\` AS quarter_value`);
  }
  const orderParts: string[] = [];
  if (info.quarterColumn) {
    orderParts.push(`\`${info.quarterColumn}\``);
  }
  orderParts.push(`\`${info.monthColumn}\``);

  const sql = `SELECT ${selectParts.join(", ")} FROM \`${info.table}\` WHERE \`${info.scheduleIdColumn}\` = ? ORDER BY ${orderParts.join(", ")}`;
  const [rows] = await query<RowDataPacket[]>(sql, [scheduleId]);

  const months = createEmptyQuarterMonths();
  for (const row of rows) {
    const monthIndex = sanitizeMonthIndex((row as Record<string, unknown>).month_value ?? row[info.monthColumn]);
    if (monthIndex === null) {
      continue;
    }

    let targetQuarter: QuarterValue = fallbackQuarter;
    if (info.quarterColumn) {
      const resolved = resolveQuarterKey(
        (row as Record<string, unknown>).quarter_value ?? row[info.quarterColumn]
      );
      if (resolved && QUARTER_VALUE_SET.has(resolved)) {
        targetQuarter = resolved;
      }
    }

    months[targetQuarter].push(monthIndex);
  }

  return normalizeMonthsRecord(months);
};

const replaceScheduleMonths = async (
  scheduleId: number,
  info: ResolvedMonthTableInfo,
  months: QuarterMonthsRecord,
) => {
  await query(`DELETE FROM \`${info.table}\` WHERE \`${info.scheduleIdColumn}\` = ?`, [scheduleId]);

  const normalized = normalizeMonthsRecord(months);
  const entries: Array<Array<string | number>> = [];
  for (const quarter of QUARTER_VALUES) {
    for (const month of normalized[quarter]) {
      const values: Array<string | number> = [scheduleId];
      if (info.quarterColumn) {
        values.push(quarter);
      }
      values.push(month);
      entries.push(values);
    }
  }

  if (entries.length === 0) {
    return;
  }

  const columns = [`\`${info.scheduleIdColumn}\``];
  if (info.quarterColumn) {
    columns.push(`\`${info.quarterColumn}\``);
  }
  columns.push(`\`${info.monthColumn}\``);

  const placeholder = `(${columns.map(() => "?").join(", ")})`;
  const sql = `INSERT INTO \`${info.table}\` (${columns.join(", ")}) VALUES ${entries
    .map(() => placeholder)
    .join(", ")}`;
  const values = entries.flat();
  await query(sql, values);
};

const deleteScheduleMonths = async (scheduleId: number, info: ResolvedMonthTableInfo) => {
  await query(`DELETE FROM \`${info.table}\` WHERE \`${info.scheduleIdColumn}\` = ?`, [scheduleId]);
};

type ScheduleRecord = {
  quarter: string | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  id: number | null;
};

type ScheduleWithMonths = ScheduleRecord & { months: QuarterMonthsRecord };

const enrichScheduleWithMonths = async (
  schedule: ScheduleRecord | null,
  monthInfo: ResolvedMonthTableInfo | null,
): Promise<ScheduleWithMonths | null> => {
  if (!schedule) {
    return null;
  }

  if (!monthInfo || !schedule.id) {
    return {
      ...schedule,
      months: normalizeMonthsRecord(null),
    } satisfies ScheduleWithMonths;
  }

  try {
    const fallbackQuarter = resolveQuarterValue(schedule.quarter);
    const months = await fetchScheduleMonths(schedule.id, monthInfo, fallbackQuarter);
    return {
      ...schedule,
      months,
    } satisfies ScheduleWithMonths;
  } catch (error) {
    console.error("Failed to load remedial schedule months", error);
    return {
      ...schedule,
      months: normalizeMonthsRecord(null),
    } satisfies ScheduleWithMonths;
  }
};

const ensureTable = async (): Promise<ResolvedTableInfo> => {
  const tableInfo = await resolveRemedialTable();
  if (!tableInfo) {
    throw new MissingRemedialTableError();
  }
  return tableInfo;
};

const fetchCurrentSchedule = async (info: ResolvedTableInfo): Promise<ScheduleRecord | null> => {
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
  const activeFilter = info.activeColumn
    ? `WHERE LOWER(CAST(rs.${info.activeColumn} AS CHAR)) IN ('1','true','active','enabled','yes')`
    : "";
  const sql = `SELECT ${selectParts.join(", ")}, rs.* FROM \`${info.table}\` AS rs ${activeFilter} ORDER BY ${buildOrderClause(info)} LIMIT 1`;
  const [rows] = await query<RawScheduleRow[]>(sql);
  if (rows.length === 0) {
    return null;
  }
  const row = rows[0];
  const schedule = {
    quarter: info.quarterColumn ? (row.quarter_column as string | null) ?? null : null,
    startDate: extractDate(row.start_column),
    endDate: extractDate(row.end_column),
    active: info.activeColumn ? interpretActiveValue(row.active_column) : true,
    id: info.idColumn ? (row.id_column as number | null | undefined) ?? null : null,
  } satisfies ScheduleRecord;

  if (info.activeColumn && !schedule.active) {
    return null;
  }

  return schedule;
};

const respondWithSchedule = (schedule: ScheduleWithMonths | null) =>
  NextResponse.json({
    success: true,
    schedule,
  });

export async function GET() {
  try {
    const tableInfo = await ensureTable();
    const monthTableInfo = await resolveRemedialMonthTable();
    const schedule = await fetchCurrentSchedule(tableInfo);
    const enriched = await enrichScheduleWithMonths(schedule, monthTableInfo);
    return respondWithSchedule(enriched);
  } catch (error) {
    if (error instanceof MissingRemedialTableError) {
      return NextResponse.json({ success: true, schedule: null }, { status: 404 });
    }
    console.error("Failed to load remedial schedule", error);
    return NextResponse.json({ success: false, error: "Remedial schedule is unavailable." }, { status: 500 });
  }
}

interface UpsertPayload {
  quarter: QuarterValue;
  startDate: string;
  endDate: string;
  months: QuarterMonthsRecord;
}

const normalizePayload = (payload: unknown): UpsertPayload => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload.");
  }

  const input = payload as Record<string, unknown>;
  const rawQuarter = typeof input.quarter === "string" ? input.quarter.trim() : "";
  const resolvedQuarter = resolveQuarterKey(rawQuarter);
  if (!resolvedQuarter) {
    throw new Error("Quarter selection is required.");
  }

  if (!input.startDate || !input.endDate) {
    throw new Error("startDate and endDate are required.");
  }

  const normalizedStart = formatDateValue(String(input.startDate));
  const normalizedEnd = formatDateValue(String(input.endDate));

  return {
    quarter: resolvedQuarter,
    startDate: normalizedStart,
    endDate: normalizedEnd,
    months: normalizeMonthsRecord(input.months),
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
    values.push(payload.quarter);
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
    const monthTableInfo = await resolveRemedialMonthTable();
    const body = await request.json();
    let payload: UpsertPayload;
    try {
      payload = normalizePayload(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid remedial schedule payload.";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    const schedule = await fetchCurrentSchedule(tableInfo);

    if (schedule) {
      const existingQuarter = schedule.quarter ? resolveQuarterValue(schedule.quarter) : null;
      let existingQuarterActive = true;
      if (schedule.endDate) {
        const endDate = new Date(schedule.endDate);
        if (!Number.isNaN(endDate.getTime())) {
          endDate.setHours(23, 59, 59, 999);
          existingQuarterActive = endDate >= new Date();
        }
      }

      if (
        existingQuarter === "1st Quarter" &&
        payload.quarter !== "1st Quarter" &&
        existingQuarterActive
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Complete or cancel the First Quarter before opening the Second Quarter.",
          },
          { status: 409 },
        );
      }

      if (existingQuarter === "1st Quarter" && existingQuarterActive && payload.quarter === "1st Quarter") {
        payload.months["2nd Quarter"] = [];
      }
    }

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

    if (!nextSchedule) {
      return respondWithSchedule(null);
    }

    if (monthTableInfo && nextSchedule.id) {
      await replaceScheduleMonths(nextSchedule.id, monthTableInfo, payload.months);
      const fallbackQuarter = nextSchedule.quarter
        ? resolveQuarterValue(nextSchedule.quarter)
        : payload.quarter;
      const months = await fetchScheduleMonths(
        nextSchedule.id,
        monthTableInfo,
        fallbackQuarter,
      );
      return respondWithSchedule({
        ...nextSchedule,
        months,
      });
    }

    if (monthTableInfo && !nextSchedule.id) {
      console.warn("Remedial schedule table lacks an identifiable primary key; skipping month persistence.");
    }

    return respondWithSchedule({
      ...nextSchedule,
      months: payload.months,
    });
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
    const monthTableInfo = await resolveRemedialMonthTable();
    const schedule = await fetchCurrentSchedule(tableInfo);
    if (!schedule) {
      return respondWithSchedule(null);
    }

    const scheduleId = schedule.id ?? null;

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

    if (scheduleId && monthTableInfo) {
      await deleteScheduleMonths(scheduleId, monthTableInfo);
    }

    const nextSchedule = await fetchCurrentSchedule(tableInfo);
    const enriched = await enrichScheduleWithMonths(nextSchedule, monthTableInfo);
    return respondWithSchedule(enriched);
  } catch (error) {
    if (error instanceof MissingRemedialTableError) {
      return NextResponse.json({ success: false, error: "Remedial schedule storage is not configured." }, { status: 404 });
    }
    console.error("Failed to clear remedial schedule", error);
    return NextResponse.json({ success: false, error: "Unable to update remedial schedule." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

const SUBJECT_TABLE_MAP: Array<{ keys: string[]; table: string; label: string }> = [
  { keys: ["english"], table: "english_activity_schedule", label: "English" },
  { keys: ["filipino", "filipinx"], table: "filipino_activity_schedule", label: "Filipino" },
  { keys: ["math", "mathematics"], table: "math_activity_schedule", label: "Math" },
];

const TITLE_COLUMNS = ["title", "activity_title", "name", "session_title"] as const;
const DATE_COLUMNS = ["date", "activity_date", "schedule_date", "day_date", "event_date"] as const;
const START_COLUMNS = ["start_time", "start", "startDate", "start_datetime", "time_start", "start_time_value"] as const;
const END_COLUMNS = ["end_time", "end", "endDate", "end_datetime", "time_end", "end_time_value"] as const;
const STATUS_COLUMNS = ["status", "request_status", "approval_status"] as const;
const GRADE_COLUMNS = ["grade_level", "grade", "class_section", "grade_section"] as const;
const SUBJECT_COLUMNS = ["subject", "subject_area", "focus_subject"] as const;
const REQUESTER_COLUMNS = ["requested_by", "submitted_by", "requester", "created_by"] as const;
const REQUESTER_ID_COLUMNS = ["requested_by_id", "requester_id", "teacher_id", "master_teacher_id", "user_id", "coordinator_id", "mt_id"] as const;
const DESCRIPTION_COLUMNS = ["description", "details", "remarks", "notes"] as const;
const DAY_COLUMNS = ["day", "weekday", "day_name"] as const;
const WEEK_REF_COLUMNS = ["week_ref", "weekRef", "week_reference"] as const;
const TIMESTAMP_COLUMNS = ["datestamp", "created_at", "createdAt"] as const;
const UPDATED_COLUMNS = ["updated_at", "updatedAt", "modified_at", "modifiedAt"] as const;
const REQUESTED_AT_COLUMNS = ["requested_at", "submitted_at", "requested_datetime"] as const;
const PLAN_COLUMNS = ["activity_plan_json", "activities_plan", "plan_json"] as const;
const APPROVED_BY_COLUMNS = ["approved_by_id", "approver_id", "approved_by"] as const;

const DEFAULT_STATUS = "Pending";

type IncomingActivity = {
  id?: number | string | null;
  title?: string | null;
  subject?: string | null;
  gradeLevel?: string | null;
  description?: string | null;
  date?: string | null;
  end?: string | null;
  day?: string | null;
  weekRef?: string | null;
};

const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const normalizeSubject = (raw: string | null | undefined): string | null => {
  if (!raw) {
    return null;
  }
  const cleaned = raw.replace(/\s+/g, " ").trim().toLowerCase();
  if (!cleaned) {
    return null;
  }
  for (const entry of SUBJECT_TABLE_MAP) {
    if (entry.keys.some((key) => cleaned === key || cleaned.includes(key) || key.includes(cleaned))) {
      return entry.label;
    }
  }
  return null;
};

const resolveTableForSubject = (subject: string | null | undefined) => {
  if (!subject) {
    return null;
  }
  const normalized = normalizeSubject(subject);
  if (!normalized) {
    return null;
  }
  return SUBJECT_TABLE_MAP.find((entry) => entry.label.toLowerCase() === normalized.toLowerCase()) ?? null;
};

const formatDateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateTime = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const formatTimeOnly = (date: Date) => {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const buildDayLabel = (date: Date, provided: string | null | undefined) => {
  if (provided && provided.trim().length > 0) {
    return provided.trim();
  }
  return date.toLocaleDateString("en-US", { weekday: "long" });
};

const pickColumn = (columns: Set<string>, candidates: readonly string[]): string | null => {
  if (columns.size === 0) {
    return null;
  }
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
    const lowerCandidate = candidate.toLowerCase();
    for (const column of columns) {
      if (column.toLowerCase() === lowerCandidate) {
        return column;
      }
    }
  }
  for (const candidate of candidates) {
    const lowerCandidate = candidate.toLowerCase();
    for (const column of columns) {
      if (column.toLowerCase().includes(lowerCandidate)) {
        return column;
      }
    }
  }
  return null;
};

const parseDateInput = (value: string | null | undefined): Date | null => {
  const text = toNullableString(value);
  if (!text) {
    return null;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    gradeLevel?: string | null;
    coordinatorName?: string | null;
    coordinatorId?: number | string | null;
    subjectFallback?: string | null;
    activities?: IncomingActivity[] | null;
  } | null;

  if (!payload?.activities || payload.activities.length === 0) {
    return NextResponse.json(
      { success: false, error: "No activities were provided for sending." },
      { status: 400 },
    );
  }

  const coordinatorName = toNullableString(payload.coordinatorName);
  const gradeLevel = toNullableString(payload.gradeLevel);
  const subjectFallback = toNullableString(payload.subjectFallback);
  const coordinatorIdRaw = typeof payload.coordinatorId === "number" ? payload.coordinatorId : Number(payload.coordinatorId);
  const coordinatorId = Number.isFinite(coordinatorIdRaw) ? Number(coordinatorIdRaw) : null;

  const grouped = new Map<
    string,
    {
      table: string;
      subjectLabel: string;
      entries: Array<IncomingActivity & {
        startDate: Date;
        endDate: Date;
        gradeLevel: string | null;
        description: string | null;
        dayLabel: string;
      }>;
      records: Array<{
        title: string;
        subjectLabel: string;
        gradeLevel: string | null;
        description: string | null;
        startDate: Date;
        endDate: Date;
        dayLabel: string;
        weekRef: string | null;
      }>;
    }
  >();

  const skipped: Array<{ title: string | null; reason: string }> = [];

  for (const activity of payload.activities) {
    const title = toNullableString(activity.title);
    if (!title) {
      skipped.push({ title: null, reason: "Missing title." });
      continue;
    }

    const subjectEntry = resolveTableForSubject(activity.subject ?? subjectFallback);
    if (!subjectEntry) {
      skipped.push({ title, reason: "Subject is not recognized for batching." });
      continue;
    }

    const startDate = parseDateInput(activity.date);
    if (!startDate) {
      skipped.push({ title, reason: "Invalid or missing date." });
      continue;
    }

    const endDate = parseDateInput(activity.end) ?? new Date(startDate.getTime() + 60 * 60 * 1000);
    if (endDate.getTime() <= startDate.getTime()) {
      endDate.setTime(startDate.getTime() + 60 * 60 * 1000);
    }

    const key = subjectEntry.table;
    if (!grouped.has(key)) {
      grouped.set(key, {
        table: subjectEntry.table,
        subjectLabel: subjectEntry.label,
        entries: [],
        records: [],
      });
    }

    const gradeForRecord = toNullableString(activity.gradeLevel) ?? gradeLevel;
    const description = toNullableString(activity.description);
    const dayLabel = buildDayLabel(startDate, activity.day);

    grouped.get(key)!.entries.push({
      ...activity,
      startDate,
      endDate,
      gradeLevel: gradeForRecord,
      description,
      dayLabel,
    });

    grouped.get(key)!.records.push({
      title,
      subjectLabel: subjectEntry.label,
      gradeLevel: gradeForRecord,
      description,
      startDate,
      endDate,
      dayLabel,
      weekRef: toNullableString(activity.weekRef),
    });
  }

  if (grouped.size === 0) {
    return NextResponse.json(
      { success: false, error: "None of the provided activities could be prepared for sending.", skipped },
      { status: 400 },
    );
  }

  try {
    const insertionSummary: Array<{ table: string; inserted: number }> = [];
    let totalInserted = 0;

    const sentAt = new Date();

    await runWithConnection(async (connection) => {
      for (const group of grouped.values()) {
        let columnRows: RowDataPacket[] = [];
        try {
          [columnRows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${group.table}\``);
        } catch (error) {
          console.warn(`Unable to inspect columns for ${group.table}`, error);
          skipped.push({ title: `${group.subjectLabel} batch`, reason: `Table ${group.table} is not accessible.` });
          continue;
        }

        if (!columnRows.length) {
          skipped.push({ title: `${group.subjectLabel} batch`, reason: `Table ${group.table} has no readable columns.` });
          continue;
        }

        const columns = new Set(columnRows.map((row) => String(row.Field)));

        const titleColumn = pickColumn(columns, TITLE_COLUMNS);
        const dateColumn = pickColumn(columns, DATE_COLUMNS);
        const startColumn = pickColumn(columns, START_COLUMNS);
        const endColumn = pickColumn(columns, END_COLUMNS);

        if (!titleColumn || (!dateColumn && !startColumn)) {
          skipped.push({
            title: `${group.subjectLabel} batch`,
            reason: `The table ${group.table} is missing required columns for title or date fields.`,
          });
          continue;
        }

        const statusColumn = pickColumn(columns, STATUS_COLUMNS);
        const gradeColumn = pickColumn(columns, GRADE_COLUMNS);
        const subjectColumn = pickColumn(columns, SUBJECT_COLUMNS);
        const requesterColumn = pickColumn(columns, REQUESTER_COLUMNS);
        const requesterIdColumn = pickColumn(columns, REQUESTER_ID_COLUMNS);
        const descriptionColumn = pickColumn(columns, DESCRIPTION_COLUMNS);
        const dayColumn = pickColumn(columns, DAY_COLUMNS);
        const weekRefColumn = pickColumn(columns, WEEK_REF_COLUMNS);
        const timestampColumn = pickColumn(columns, TIMESTAMP_COLUMNS);
        const updatedColumn = pickColumn(columns, UPDATED_COLUMNS);
        const requestedAtColumn = pickColumn(columns, REQUESTED_AT_COLUMNS);
        const planColumn = pickColumn(columns, PLAN_COLUMNS);
        const approvedByColumn = pickColumn(columns, APPROVED_BY_COLUMNS);
        const mtIdColumn = columns.has("mt_id") ? "mt_id" : pickColumn(columns, ["master_teacher_id", "coordinator_id"]);

        const insertColumns: string[] = [titleColumn];
        if (dateColumn) insertColumns.push(dateColumn);
        if (startColumn) insertColumns.push(startColumn);
        if (endColumn) insertColumns.push(endColumn);
        if (dayColumn) insertColumns.push(dayColumn);
        if (gradeColumn) insertColumns.push(gradeColumn);
        if (subjectColumn) insertColumns.push(subjectColumn);
        if (descriptionColumn) insertColumns.push(descriptionColumn);
        if (statusColumn) insertColumns.push(statusColumn);
        if (requesterColumn) insertColumns.push(requesterColumn);
        if (requesterIdColumn) insertColumns.push(requesterIdColumn);
        if (weekRefColumn) insertColumns.push(weekRefColumn);
        if (timestampColumn) insertColumns.push(timestampColumn);
        if (updatedColumn && updatedColumn !== timestampColumn) insertColumns.push(updatedColumn);
        if (requestedAtColumn) insertColumns.push(requestedAtColumn);
        if (planColumn) insertColumns.push(planColumn);
        if (mtIdColumn) insertColumns.push(mtIdColumn);
        if (approvedByColumn) insertColumns.push(approvedByColumn);

        const now = new Date();
        const values: Array<string | number | null> = [];
        const placeholders: string[] = [];

        const sortedRecords = [...group.records].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
        const batchUid = `${group.table}-${sentAt.getTime()}-${Math.random().toString(36).slice(2, 10)}`;

        const planPayload = {
          batchId: batchUid,
          subject: group.subjectLabel,
          gradeLevel: group.records[0]?.gradeLevel ?? gradeLevel,
          requestedAt: sentAt.toISOString(),
          activities: sortedRecords.map((record) => ({
            title: record.title,
            description: record.description,
            activityDate: formatDateOnly(record.startDate),
            startTime: formatTimeOnly(record.startDate),
            endTime: formatTimeOnly(record.endDate),
            day: record.dayLabel,
          })),
        } as const;
        const planJson = JSON.stringify(planPayload);

  for (const record of sortedRecords) {
          const rowValues: Array<string | number | null> = [record.title];
          if (dateColumn) {
            rowValues.push(formatDateOnly(record.startDate));
          }
          if (startColumn) {
            rowValues.push(formatDateTime(record.startDate));
          }
          if (endColumn) {
            rowValues.push(formatDateTime(record.endDate));
          }
          if (dayColumn) {
            rowValues.push(record.dayLabel);
          }
          if (gradeColumn) {
            rowValues.push(record.gradeLevel);
          }
          if (subjectColumn) {
            rowValues.push(record.subjectLabel);
          }
          if (descriptionColumn) {
            rowValues.push(record.description);
          }
          if (statusColumn) {
            rowValues.push(DEFAULT_STATUS);
          }
          if (requesterColumn) {
            rowValues.push(coordinatorName);
          }
          if (requesterIdColumn) {
            rowValues.push(coordinatorId);
          }
          if (weekRefColumn) {
            rowValues.push(record.weekRef ?? planPayload.batchId);
          }
          if (timestampColumn) {
            rowValues.push(formatDateTime(now));
          }
          if (updatedColumn && updatedColumn !== timestampColumn) {
            rowValues.push(formatDateTime(now));
          }
          if (requestedAtColumn) {
            rowValues.push(formatDateTime(sentAt));
          }
          if (planColumn) {
            rowValues.push(planJson);
          }
          if (mtIdColumn) {
            rowValues.push(coordinatorId);
          }
          if (approvedByColumn) {
            rowValues.push(null);
          }

          placeholders.push(`(${new Array(rowValues.length).fill("?").join(", ")})`);
          values.push(...rowValues);
        }

        if (!placeholders.length) {
          continue;
        }

        const insertSql = `INSERT INTO \`${group.table}\` (${insertColumns
          .map((column) => `\`${column}\``)
          .join(", ")}) VALUES ${placeholders.join(", ")}`;

        try {
          const [result] = await connection.query<ResultSetHeader>(insertSql, values);
          insertionSummary.push({ table: group.table, inserted: result.affectedRows });
          totalInserted += result.affectedRows;
        } catch (error) {
          console.error(`Failed to insert records into ${group.table}`, error);
          skipped.push({
            title: `${group.subjectLabel} batch`,
            reason: `Unable to insert activities into ${group.table}.`,
          });
        }
      }
    });

    if (totalInserted === 0) {
      return NextResponse.json({
        success: true,
        inserted: 0,
        tables: insertionSummary,
        skipped,
        message: "No new activities were added. Review skipped entries for details.",
      });
    }

    return NextResponse.json({
      success: true,
      inserted: totalInserted,
      tables: insertionSummary,
      skipped,
    });
  } catch (error) {
    console.error("Failed to push master teacher activities", error);
    return NextResponse.json(
      { success: false, error: "Failed to send activities to the principal." },
      { status: 500 },
    );
  }
}

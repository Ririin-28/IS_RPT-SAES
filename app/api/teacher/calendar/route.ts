import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const SUBJECT_ACTIVITY_TABLES: Array<{ table: string; subject: string }> = [
  { table: "english_activity_schedule", subject: "English" },
  { table: "filipino_activity_schedule", subject: "Filipino" },
  { table: "math_activity_schedule", subject: "Math" },
];

const ID_COLUMNS = [
  "id",
  "schedule_id",
  "request_id",
  "calendar_request_id",
  "activity_id",
  "identifier",
] as const;

const TITLE_COLUMNS = [
  "title",
  "activity_title",
  "name",
  "session_title",
] as const;

const GRADE_COLUMNS = [
  "grade_level",
  "grade",
  "class",
  "section",
  "grade_section",
] as const;

const SUBJECT_COLUMNS = [
  "subject",
  "subject_area",
  "focus_subject",
] as const;

const STATUS_COLUMNS = [
  "status",
  "request_status",
  "approval_status",
  "state",
  "is_approved",
] as const;

const DATE_COLUMNS = [
  "date",
  "activity_date",
  "schedule_date",
  "day_date",
] as const;

const START_COLUMNS = [
  "start_time",
  "start",
  "startDate",
  "start_datetime",
  "time_start",
] as const;

const END_COLUMNS = [
  "end_time",
  "end",
  "endDate",
  "end_datetime",
  "time_end",
] as const;

const DESCRIPTION_COLUMNS = [
  "description",
  "details",
  "remarks",
  "notes",
] as const;

const DAY_COLUMNS = [
  "day",
  "weekday",
  "day_name",
] as const;

const ORDER_COLUMNS = [
  "updated_at",
  "updatedAt",
  "modified_at",
  "modifiedAt",
  "datestamp",
  "created_at",
  "createdAt",
  "date",
] as const;

const MAX_ACTIVITIES_PER_TABLE = 150;

type ColumnName = string;

type ActivityColumnMap = {
  id: ColumnName;
  title: ColumnName | null;
  grade: ColumnName | null;
  subject: ColumnName | null;
  status: ColumnName | null;
  date: ColumnName | null;
  start: ColumnName | null;
  end: ColumnName | null;
  description: ColumnName | null;
  day: ColumnName | null;
  order: ColumnName | null;
};

const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const normalizeStatus = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.toLowerCase();
  if (
    ["1", "approved", "accept", "accepted", "granted", "true", "yes", "ok"].includes(normalized) ||
    normalized.includes("approve")
  ) {
    return "Approved";
  }
  if (
    ["0", "pending", "awaiting", "waiting", "submitted", "for approval"].includes(normalized) ||
    normalized.includes("pending") ||
    normalized.includes("await") ||
    normalized.includes("for approval")
  ) {
    return "Pending";
  }
  if (
    ["rejected", "declined", "denied", "cancelled", "canceled"].includes(normalized) ||
    normalized.includes("reject") ||
    normalized.includes("declin") ||
    normalized.includes("denied") ||
    normalized.includes("cancel") ||
    normalized.includes("void")
  ) {
    return "Declined";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const GRADE_WORD_TO_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const ROMAN_NUMERAL_TO_NUMBER: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
};

const deriveGradeNumber = (value: string | null): number | null => {
  if (!value) {
    return null;
  }
  const digitsMatch = value.match(/(\d+)/);
  if (digitsMatch) {
    const parsed = Number(digitsMatch[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const romanMatch = value.match(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/i);
  if (romanMatch) {
    const parsed = ROMAN_NUMERAL_TO_NUMBER[romanMatch[1].toLowerCase()];
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const wordMatch = value.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  if (wordMatch) {
    const parsed = GRADE_WORD_TO_NUMBER[wordMatch[1].toLowerCase()];
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeGradeValue = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const gradeNumber = deriveGradeNumber(trimmed);
  if (Number.isFinite(gradeNumber) && gradeNumber !== null) {
    return `Grade ${gradeNumber}`;
  }

  const match = trimmed.match(/grade\s*(\d+)/i);
  if (match) {
    return `Grade ${match[1]}`;
  }

  return trimmed;
};

const buildGradeSearchVariants = (value: string | null): string[] => {
  if (!value) {
    return [];
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const variants = new Set<string>([trimmed]);
  const gradeNumber = deriveGradeNumber(trimmed);

  if (Number.isFinite(gradeNumber) && gradeNumber !== null) {
    variants.add(`Grade ${gradeNumber}`);
    variants.add(String(gradeNumber));
    const romanEntry = Object.entries(ROMAN_NUMERAL_TO_NUMBER).find(([, num]) => num === gradeNumber);
    if (romanEntry) {
      const [roman] = romanEntry;
      variants.add(`Grade ${roman.toUpperCase()}`);
      variants.add(`Grade ${roman}`);
      variants.add(roman.toUpperCase());
      variants.add(roman);
    }

    const wordEntry = Object.entries(GRADE_WORD_TO_NUMBER).find(([, num]) => num === gradeNumber);
    if (wordEntry) {
      const [word] = wordEntry;
      variants.add(`Grade ${word}`);
      variants.add(word);
    }
  }

  if (!trimmed.toLowerCase().startsWith("grade")) {
    variants.add(`Grade ${trimmed}`);
  }

  return Array.from(variants).filter((variant) => variant.trim().length > 0);
};

const buildColumnLookup = (columns: Set<string>) => {
  const lookup = new Map<string, string>();
  for (const column of columns) {
    lookup.set(column.toLowerCase(), column);
  }
  return lookup;
};

const pickColumn = (columns: Set<string>, candidates: readonly string[]): string | null => {
  if (columns.size === 0) {
    return null;
  }
  const lookup = buildColumnLookup(columns);
  for (const candidate of candidates) {
    const resolved = lookup.get(candidate.toLowerCase());
    if (resolved) {
      return resolved;
    }
  }
  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();
    for (const column of columns) {
      if (column.toLowerCase().includes(normalized)) {
        return column;
      }
    }
  }
  return null;
};

const parseDateOnly = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
};

const parseDateTime = (value: string | null): { date: string | null; time: string | null } => {
  if (!value) {
    return { date: null, time: null };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { date: null, time: null };
  }
  const normalized = trimmed.replace("T", " ");
  const [datePart, timePart] = normalized.split(" ");
  const date = parseDateOnly(datePart ?? null);
  const time = timePart ? timePart.trim() : null;
  return { date, time };
};

const resolveActivityTables = async (): Promise<Array<ActivityColumnMap & { name: string; defaultSubject: string }>> => {
  const resolved: Array<ActivityColumnMap & { name: string; defaultSubject: string }> = [];

  for (const entry of SUBJECT_ACTIVITY_TABLES) {
    let columns: Set<string>;
    try {
      columns = await getTableColumns(entry.table);
    } catch (error) {
      console.warn(`Unable to inspect columns for ${entry.table}`, error);
      continue;
    }

    if (!columns.size) {
      continue;
    }

    const idColumn = pickColumn(columns, ID_COLUMNS);
    if (!idColumn) {
      continue;
    }

    const map: ActivityColumnMap = {
      id: idColumn,
      title: pickColumn(columns, TITLE_COLUMNS),
      grade: pickColumn(columns, GRADE_COLUMNS),
      subject: pickColumn(columns, SUBJECT_COLUMNS),
      status: pickColumn(columns, STATUS_COLUMNS),
      date: pickColumn(columns, DATE_COLUMNS),
      start: pickColumn(columns, START_COLUMNS),
      end: pickColumn(columns, END_COLUMNS),
      description: pickColumn(columns, DESCRIPTION_COLUMNS),
      day: pickColumn(columns, DAY_COLUMNS),
      order: pickColumn(columns, ORDER_COLUMNS),
    };

    resolved.push({ ...map, name: entry.table, defaultSubject: entry.subject });
  }

  return resolved;
};

type TeacherActivity = {
  id: string;
  title: string | null;
  subject: string | null;
  grade: string | null;
  status: string | null;
  activityDate: string | null;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  day: string | null;
  sourceTable: string;
};

const fetchActivitiesForTable = async (
  table: ActivityColumnMap & { name: string; defaultSubject: string },
  gradeFilter: string | null,
): Promise<TeacherActivity[]> => {
  const selectParts: string[] = [`\`${table.id}\` AS id_value`];

  const pushColumn = (column: string | null, alias: string) => {
    if (column) {
      selectParts.push(`\`${column}\` AS ${alias}`);
    } else {
      selectParts.push(`NULL AS ${alias}`);
    }
  };

  pushColumn(table.title, "title_value");
  pushColumn(table.grade, "grade_value");
  pushColumn(table.subject, "subject_value");
  pushColumn(table.status, "status_value");
  pushColumn(table.date, "date_value");
  pushColumn(table.start, "start_value");
  pushColumn(table.end, "end_value");
  pushColumn(table.description, "description_value");
  pushColumn(table.day, "day_value");

  const orderColumn = table.order ?? table.start ?? table.date ?? table.id;
  const filters: string[] = [];
  const params: Array<string | number> = [];

  if (gradeFilter && table.grade) {
    const gradeVariants = buildGradeSearchVariants(gradeFilter);
    if (gradeVariants.length) {
      const gradeConditions = gradeVariants.map(() => `LOWER(\`${table.grade}\`) LIKE ?`);
      filters.push(`(${gradeConditions.join(" OR ")})`);
      for (const variant of gradeVariants) {
        params.push(`%${variant.toLowerCase()}%`);
      }
    }
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const limit = Math.max(25, Math.min(MAX_ACTIVITIES_PER_TABLE, 300));

  const sql = `
    SELECT ${selectParts.join(", ")}
    FROM \`${table.name}\`
    ${whereClause}
    ORDER BY \`${orderColumn}\` DESC
    LIMIT ${limit}
  `;

  const [rows] = await query<RowDataPacket[]>(sql, params);
  const activities: TeacherActivity[] = [];

  for (const row of rows) {
    const id = toNullableString(row.id_value);
    if (!id) {
      continue;
    }

    const status = normalizeStatus(toNullableString(row.status_value));
    if (status && status !== "Approved") {
      continue;
    }

    const { date: startDateFromStart, time: startTimeFromStart } = parseDateTime(toNullableString(row.start_value));
    const { date: endDateFromEnd, time: endTimeFromEnd } = parseDateTime(toNullableString(row.end_value));
    const dateFromDateColumn = parseDateOnly(toNullableString(row.date_value));

    const rawGrade = toNullableString(row.grade_value);

    const activity: TeacherActivity = {
      id,
      title: toNullableString(row.title_value),
      subject: toNullableString(row.subject_value) ?? table.defaultSubject ?? null,
      grade: normalizeGradeValue(rawGrade) ?? rawGrade,
      status: status ?? "Approved",
      activityDate: startDateFromStart ?? dateFromDateColumn,
      startTime: startTimeFromStart,
      endTime: endTimeFromEnd,
      description: toNullableString(row.description_value),
      day: toNullableString(row.day_value),
      sourceTable: table.name,
    };

    if (!activity.activityDate && dateFromDateColumn) {
      activity.activityDate = dateFromDateColumn;
    }

    activities.push(activity);
  }

  return activities;
};

export async function GET(request: NextRequest) {
  try {
    const gradeFilter = toNullableString(request.nextUrl.searchParams.get("grade"));
    const tables = await resolveActivityTables();

    if (!tables.length) {
      return NextResponse.json({ success: true, activities: [], metadata: { tables: [] } });
    }

    const allActivities: TeacherActivity[] = [];
    const tableSummaries: Array<{ table: string; subject: string; count: number }> = [];

    for (const table of tables) {
      const activities = await fetchActivitiesForTable(table, gradeFilter);
      allActivities.push(...activities);
      tableSummaries.push({ table: table.name, subject: table.defaultSubject, count: activities.length });
    }

    allActivities.sort((a, b) => {
      const aKey = a.activityDate ? new Date(`${a.activityDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
      const bKey = b.activityDate ? new Date(`${b.activityDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
      return bKey - aKey;
    });

    return NextResponse.json({
      success: true,
      activities: allActivities,
      metadata: {
        gradeFilter,
        tables: tableSummaries,
      },
    });
  } catch (error) {
    console.error("Failed to load teacher calendar activities", error);
    return NextResponse.json(
      { success: false, error: "Unable to load teacher calendar activities." },
      { status: 500 },
    );
  }
}

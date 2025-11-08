import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const REMEDIAL_TABLE = "remedial_teachers" as const;
const COORDINATOR_TABLE = "mt_coordinator" as const;

const MASTER_TEACHER_TABLE_CANDIDATES = [
  "master_teacher",
  "master_teachers",
  "masterteacher",
  "master_teacher_info",
  "master_teacher_tbl",
] as const;

const SUBJECT_ACTIVITY_TABLES: Array<{ table: string; subject: string }> = [
  { table: "english_activity_schedule", subject: "English" },
  { table: "filipino_activity_schedule", subject: "Filipino" },
  { table: "math_activity_schedule", subject: "Math" },
];

const ACTIVITY_ID_COLUMNS = [
  "id",
  "schedule_id",
  "request_id",
  "calendar_request_id",
  "activity_id",
  "identifier",
] as const;

const ACTIVITY_TITLE_COLUMNS = [
  "title",
  "activity_title",
  "session_title",
  "name",
  "event_title",
] as const;

const ACTIVITY_GRADE_COLUMNS = [
  "grade_level",
  "grade",
  "class",
  "section",
  "grade_section",
] as const;

const ACTIVITY_SUBJECT_COLUMNS = [
  "subject",
  "subject_area",
  "focus_subject",
] as const;

const ACTIVITY_STATUS_COLUMNS = [
  "status",
  "request_status",
  "approval_status",
  "state",
  "is_approved",
] as const;

const ACTIVITY_DATE_COLUMNS = [
  "date",
  "activity_date",
  "schedule_date",
  "day_date",
] as const;

const ACTIVITY_START_COLUMNS = [
  "start_time",
  "start",
  "start_datetime",
  "startDate",
  "time_start",
] as const;

const ACTIVITY_END_COLUMNS = [
  "end_time",
  "end",
  "end_datetime",
  "endDate",
  "time_end",
] as const;

const ACTIVITY_DESCRIPTION_COLUMNS = [
  "description",
  "details",
  "remarks",
  "notes",
] as const;

const ACTIVITY_DAY_COLUMNS = [
  "day",
  "weekday",
  "day_name",
] as const;

const ACTIVITY_REQUESTER_COLUMNS = [
  "requested_by",
  "submitted_by",
  "requester",
  "coordinator",
  "teacher",
] as const;

const ACTIVITY_REQUESTER_ID_COLUMNS = [
  "requested_by_id",
  "requester_id",
  "submitted_by_id",
  "teacher_id",
  "user_id",
] as const;

const ACTIVITY_MT_ID_COLUMNS = [
  "mt_id",
  "master_teacher_id",
  "coordinator_id",
  "masterteacher_id",
] as const;

const ACTIVITY_REQUESTED_AT_COLUMNS = [
  "requested_at",
  "submitted_at",
  "datestamp",
  "created_at",
  "createdAt",
] as const;

const ACTIVITY_UPDATED_AT_COLUMNS = [
  "updated_at",
  "updatedAt",
  "modified_at",
  "modifiedAt",
] as const;

const ACTIVITY_APPROVED_AT_COLUMNS = [
  "approved_at",
  "approval_timestamp",
  "approvedAt",
] as const;

const ACTIVITY_APPROVED_BY_COLUMNS = [
  "approved_by",
  "approved_by_id",
  "approver_id",
] as const;

const ACTIVITY_PLAN_COLUMNS = [
  "activity_plan_json",
  "activities_plan",
  "plan_json",
] as const;

const ACTIVITY_WEEK_REF_COLUMNS = [
  "week_ref",
  "weekRef",
  "week_reference",
  "plan_batch_id",
  "request_batch",
] as const;

const MAX_ACTIVITIES_PER_TABLE = 300;

const GRADE_COLUMN_CANDIDATES = [
  { column: "grade", alias: "mt_grade" },
  { column: "handled_grade", alias: "mt_handled_grade" },
  { column: "grade_level", alias: "mt_grade_level" },
  { column: "gradeLevel", alias: "mt_gradeLevel" },
  { column: "gradelevel", alias: "mt_gradelevel" },
] as const;

const REMEDIAL_GRADE_COLUMN_CANDIDATES = [
  { column: "grade", alias: "rt_grade" },
  { column: "grade_level", alias: "rt_grade_level" },
  { column: "handled_grade", alias: "rt_handled_grade" },
  { column: "gradelevel", alias: "rt_gradelevel" },
  { column: "gradeLevel", alias: "rt_gradeLevel" },
] as const;

const COORDINATOR_COLUMN_CANDIDATES = [
  { column: "mt_coordinator", alias: "mt_coordinator" },
  { column: "coordinator_subject", alias: "mt_coordinator_subject" },
  { column: "coordinatorSubject", alias: "mt_coordinatorSubject" },
  { column: "coordinator", alias: "mt_coordinator_generic" },
  { column: "coordinator_subject_handled", alias: "mt_coordinator_subject_handled" },
] as const;

const COORDINATOR_TABLE_SUBJECT_CANDIDATES = [
  { column: "subject_handled", alias: "mc_subject_handled" },
  { column: "coordinator_subject", alias: "mc_coordinator_subject" },
  { column: "coordinator_subject_handled", alias: "mc_coordinator_subject_handled" },
  { column: "subject", alias: "mc_subject" },
  { column: "subjects", alias: "mc_subjects" },
  { column: "handled_subjects", alias: "mc_handled_subjects" },
] as const;

const SUBJECT_COLUMN_CANDIDATES = [
  { column: "subjects", alias: "mt_subjects" },
  { column: "handled_subjects", alias: "mt_handled_subjects" },
  { column: "subject", alias: "mt_subject" },
  { column: "remediation_subjects", alias: "mt_remediation_subjects" },
] as const;

const SECTION_COLUMN_CANDIDATES = [
  { column: "section", alias: "mt_section" },
  { column: "section_name", alias: "mt_section_name" },
  { column: "class_section", alias: "mt_class_section" },
] as const;

interface MasterTeacherTableInfo {
  table: string | null;
  columns: Set<string>;
}

type CoordinatorActivityColumnMap = {
  id: string;
  title: string | null;
  grade: string | null;
  subject: string | null;
  status: string | null;
  date: string | null;
  start: string | null;
  end: string | null;
  description: string | null;
  day: string | null;
  requester: string | null;
  requesterId: string | null;
  mtId: string | null;
  requestedAt: string | null;
  updatedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  plan: string | null;
  weekRef: string | null;
};

type CoordinatorActivity = {
  id: string;
  title: string | null;
  subject: string | null;
  gradeLevel: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  date: string | null;
  day: string | null;
  description: string | null;
  requestedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  planBatchId: string | null;
  weekRef: string | null;
  requester: string | null;
  sourceTable: string;
  subjectFallback: string | null;
};

const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const normalizeStatusValue = (value: string | null): string | null => {
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
    ["rejected", "declined", "denied", "cancelled", "canceled", "void"].includes(normalized) ||
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

const parseDateOnly = (value: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const candidate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }
  return candidate;
};

const parseDateTimeValue = (value: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace("T", " ");
  const candidate = new Date(normalized);
  if (!Number.isNaN(candidate.getTime())) {
    return candidate;
  }
  const fallback = new Date(`${trimmed}T00:00:00`);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }
  return null;
};

const ensureTimeFormat = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
};

const combineDateAndTime = (dateValue: string | null, timeValue: string | null): Date | null => {
  const date = toNullableString(dateValue);
  if (!date) {
    return null;
  }
  const time = ensureTimeFormat(timeValue) ?? "08:00:00";
  const candidate = new Date(`${date}T${time}`);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }
  return candidate;
};

const normalizeSubjectLabel = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const cleaned = value
    .replace(/(coordinator|subject|subjects|teacher|handled)/gi, "")
    .replace(/grade\s*\d+\b/gi, "")
    .replace(/[-_]+/g, " ")
    .replace(/and/gi, ",")
    .replace(/&/g, ",")
    .replace(/\+/g, ",")
    .replace(/\//g, ",")
    .replace(/;/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
};

const deriveSubjectList = (...values: Array<string | null>): string[] => {
  const subjects = new Set<string>();

  const pushValue = (raw: string | null) => {
    if (!raw) {
      return;
    }
    const normalized = raw
      .replace(/and/gi, ",")
      .replace(/&/g, ",")
      .replace(/\+/g, ",")
      .replace(/\//g, ",")
      .replace(/;/g, ",")
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);

    for (const token of normalized) {
      const subject = normalizeSubjectLabel(token);
      if (subject) {
        subjects.add(subject);
      }
    }
  };

  for (const value of values) {
    pushValue(value);
  }

  return Array.from(subjects.values());
};

async function safeGetColumns(tableName: string): Promise<Set<string>> {
  try {
    return await getTableColumns(tableName);
  } catch {
    return new Set<string>();
  }
}

const buildCoordinatorActivityColumnMap = (columns: Set<string>): CoordinatorActivityColumnMap | null => {
  const id = pickColumn(columns, ACTIVITY_ID_COLUMNS);
  if (!id) {
    return null;
  }

  return {
    id,
    title: pickColumn(columns, ACTIVITY_TITLE_COLUMNS),
    grade: pickColumn(columns, ACTIVITY_GRADE_COLUMNS),
    subject: pickColumn(columns, ACTIVITY_SUBJECT_COLUMNS),
    status: pickColumn(columns, ACTIVITY_STATUS_COLUMNS),
    date: pickColumn(columns, ACTIVITY_DATE_COLUMNS),
    start: pickColumn(columns, ACTIVITY_START_COLUMNS),
    end: pickColumn(columns, ACTIVITY_END_COLUMNS),
    description: pickColumn(columns, ACTIVITY_DESCRIPTION_COLUMNS),
    day: pickColumn(columns, ACTIVITY_DAY_COLUMNS),
    requester: pickColumn(columns, ACTIVITY_REQUESTER_COLUMNS),
    requesterId: pickColumn(columns, ACTIVITY_REQUESTER_ID_COLUMNS),
    mtId: pickColumn(columns, ACTIVITY_MT_ID_COLUMNS),
    requestedAt: pickColumn(columns, ACTIVITY_REQUESTED_AT_COLUMNS),
    updatedAt: pickColumn(columns, ACTIVITY_UPDATED_AT_COLUMNS),
    approvedAt: pickColumn(columns, ACTIVITY_APPROVED_AT_COLUMNS),
    approvedBy: pickColumn(columns, ACTIVITY_APPROVED_BY_COLUMNS),
    plan: pickColumn(columns, ACTIVITY_PLAN_COLUMNS),
    weekRef: pickColumn(columns, ACTIVITY_WEEK_REF_COLUMNS),
  } satisfies CoordinatorActivityColumnMap;
};

const buildActivitySelectClause = (map: CoordinatorActivityColumnMap) => {
  const selectParts: string[] = [`\`${map.id}\` AS id_value`];

  const push = (column: string | null, alias: string) => {
    if (column) {
      selectParts.push(`\`${column}\` AS ${alias}`);
    } else {
      selectParts.push(`NULL AS ${alias}`);
    }
  };

  push(map.title, "title_value");
  push(map.grade, "grade_value");
  push(map.subject, "subject_value");
  push(map.status, "status_value");
  push(map.date, "date_value");
  push(map.start, "start_value");
  push(map.end, "end_value");
  push(map.description, "description_value");
  push(map.day, "day_value");
  push(map.requester, "requester_value");
  push(map.requesterId, "requester_id_value");
  push(map.mtId, "mt_id_value");
  push(map.requestedAt, "requested_at_value");
  push(map.updatedAt, "updated_at_value");
  push(map.approvedAt, "approved_at_value");
  push(map.approvedBy, "approved_by_value");
  push(map.plan, "plan_value");
  push(map.weekRef, "week_ref_value");

  return selectParts;
};

const resolveActivityOrderColumn = (map: CoordinatorActivityColumnMap): string =>
  map.updatedAt ?? map.requestedAt ?? map.start ?? map.date ?? map.id;

const parsePlanBatchId = (planRaw: string | null): { batchId: string | null } => {
  if (!planRaw) {
    return { batchId: null };
  }

  try {
    const parsed = JSON.parse(planRaw) as { batchId?: string | null } | null;
    if (parsed && typeof parsed.batchId === "string") {
      const trimmed = parsed.batchId.trim();
      if (trimmed.length > 0) {
        return { batchId: trimmed };
      }
    }
  } catch (error) {
    console.warn("Unable to parse activity plan JSON for coordinator schedule", error);
  }

  return { batchId: null };
};

const toISO = (value: Date | null): string | null => {
  if (!value) {
    return null;
  }
  const timestamp = value.getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return value.toISOString();
};

const mapCoordinatorActivityRow = (
  row: RowDataPacket,
  map: CoordinatorActivityColumnMap,
  table: { table: string; subject: string },
  gradeFallback: string | null,
): CoordinatorActivity | null => {
  const id = toNullableString(row.id_value);
  if (!id) {
    return null;
  }

  const status = normalizeStatusValue(toNullableString(row.status_value));
  const gradeRaw = toNullableString(row.grade_value) ?? gradeFallback;
  const gradeLevel = normalizeGradeValue(gradeRaw);
  const subjectRaw = toNullableString(row.subject_value) ?? table.subject;
  const subject = subjectRaw ? subjectRaw.trim() : null;
  const description = toNullableString(row.description_value);
  const day = toNullableString(row.day_value);
  const requester = toNullableString(row.requester_value);

  const startCandidate = parseDateTimeValue(toNullableString(row.start_value));
  const dateCandidate = parseDateOnly(toNullableString(row.date_value));
  const requestedAt = toNullableString(row.requested_at_value);
  const approvedAt = toNullableString(row.approved_at_value);
  const approvedBy = toNullableString(row.approved_by_value);
  const { batchId } = parsePlanBatchId(toNullableString(row.plan_value));
  const weekRef = toNullableString(row.week_ref_value);

  const endCandidate = parseDateTimeValue(toNullableString(row.end_value));
  const derivedStart = startCandidate ?? (dateCandidate ? combineDateAndTime(dateCandidate.toISOString().slice(0, 10), null) : null);
  const derivedEnd = endCandidate ?? (derivedStart ? new Date(derivedStart.getTime() + 60 * 60 * 1000) : null);

  const fallbackDate = derivedStart ?? dateCandidate;
  const dateIso = toISO(fallbackDate);
  const dayLabel = day ?? (fallbackDate ? fallbackDate.toLocaleDateString("en-US", { weekday: "long" }) : null);

  return {
    id,
    title: toNullableString(row.title_value),
    subject,
    gradeLevel,
    status,
    startDate: toISO(derivedStart),
    endDate: toISO(derivedEnd),
    date: dateIso,
    day: dayLabel,
    description,
    requestedAt,
    approvedAt,
    approvedBy,
    planBatchId: batchId ?? weekRef,
    weekRef,
    requester,
    sourceTable: table.table,
    subjectFallback: table.subject,
  } satisfies CoordinatorActivity;
};

const loadCoordinatorActivities = async (
  coordinatorId: number | null,
  coordinatorName: string | null,
  grade: string | null,
  allowedSubjects: string[],
): Promise<CoordinatorActivity[]> => {
  const results: CoordinatorActivity[] = [];

  for (const table of SUBJECT_ACTIVITY_TABLES) {
    let columns: Set<string>;
    try {
      columns = await getTableColumns(table.table);
    } catch (error) {
      console.warn(`Unable to read columns for ${table.table}`, error);
      continue;
    }

    if (!columns.size) {
      continue;
    }

    const map = buildCoordinatorActivityColumnMap(columns);
    if (!map) {
      continue;
    }

    const selectParts = buildActivitySelectClause(map);
    const orderColumn = resolveActivityOrderColumn(map);

    const filters: string[] = [];
    const params: Array<string | number> = [];

    if (grade && map.grade) {
      const gradeVariants = buildGradeSearchVariants(grade);
      if (gradeVariants.length) {
        const gradeFilters = gradeVariants.map(() => `LOWER(\`${map.grade}\`) LIKE ?`);
        filters.push(`(${gradeFilters.join(" OR ")})`);
        for (const variant of gradeVariants) {
          params.push(`%${variant.toLowerCase()}%`);
        }
      }
    }

    let coordinatorFilterApplied = false;

    if (coordinatorId !== null) {
      if (map.requesterId) {
        filters.push(`\`${map.requesterId}\` = ?`);
        params.push(coordinatorId);
        coordinatorFilterApplied = true;
      } else if (map.mtId) {
        filters.push(`\`${map.mtId}\` = ?`);
        params.push(coordinatorId);
        coordinatorFilterApplied = true;
      }
    }

    if (!coordinatorFilterApplied && coordinatorName && map.requester) {
      filters.push(`\`${map.requester}\` LIKE ?`);
      params.push(`%${coordinatorName}%`);
    }

    if (allowedSubjects.length > 0 && map.subject) {
      const subjectConditions: string[] = [];
      for (const subject of allowedSubjects) {
        subjectConditions.push(`\`${map.subject}\` LIKE ?`);
        params.push(`%${subject}%`);
      }
      if (subjectConditions.length) {
        filters.push(`(${subjectConditions.join(" OR ")})`);
      }
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const limit = Math.max(50, Math.min(MAX_ACTIVITIES_PER_TABLE, 500));

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM \`${table.table}\`
      ${whereClause}
      ORDER BY \`${orderColumn}\` DESC
      LIMIT ${limit}
    `;

    let rows: RowDataPacket[];
    try {
      [rows] = await query<RowDataPacket[]>(sql, params);
    } catch (error) {
      console.warn(`Unable to query coordinator activities from ${table.table}`, error);
      continue;
    }

    for (const row of rows) {
      const activity = mapCoordinatorActivityRow(row, map, table, grade);
      if (activity) {
        results.push(activity);
      }
    }
  }

  results.sort((a, b) => {
    const aDate = a.startDate ?? a.date ?? "";
    const bDate = b.startDate ?? b.date ?? "";
    return bDate.localeCompare(aDate);
  });

  return results;
};

async function resolveMasterTeacherTable(): Promise<MasterTeacherTableInfo> {
  for (const candidate of MASTER_TEACHER_TABLE_CANDIDATES) {
    const columns = await safeGetColumns(candidate);
    if (columns.size > 0) {
      return { table: candidate, columns } satisfies MasterTeacherTableInfo;
    }
  }
  return { table: null, columns: new Set<string>() } satisfies MasterTeacherTableInfo;
}

function pickFirst<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        continue;
      }
      return trimmed as T;
    }
    return value;
  }
  return null;
}

function buildName(
  firstName: string | null,
  middleName: string | null,
  lastName: string | null,
  suffix: string | null,
): string | null {
  const parts = [firstName, middleName, lastName]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .map((part) => (part ? part.trim() : ""));
  if (parts.length === 0) {
    return null;
  }
  if (suffix && suffix.trim().length > 0) {
    parts.push(suffix.trim());
  }
  return parts.join(" ");
}

type RawCoordinatorRow = RowDataPacket & {
  user_id: number;
  user_first_name?: string | null;
  user_middle_name?: string | null;
  user_last_name?: string | null;
  user_suffix?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_contact_number?: string | null;
  user_phone_number?: string | null;
  user_role?: string | null;
  rt_grade?: string | null;
  rt_grade_level?: string | null;
  rt_handled_grade?: string | null;
  rt_gradelevel?: string | null;
  rt_gradeLevel?: string | null;
  mt_first_name?: string | null;
  mt_middle_name?: string | null;
  mt_last_name?: string | null;
  mt_suffix?: string | null;
  mt_name?: string | null;
  mt_email?: string | null;
  mt_grade?: string | null;
  mt_grade_level?: string | null;
  mt_gradeLevel?: string | null;
  mt_gradelevel?: string | null;
  mt_handled_grade?: string | null;
  mt_coordinator?: string | null;
  mt_coordinator_subject?: string | null;
  mt_coordinatorSubject?: string | null;
  mt_coordinator_generic?: string | null;
  mt_coordinator_subject_handled?: string | null;
  mt_subjects?: string | null;
  mt_handled_subjects?: string | null;
  mt_subject?: string | null;
  mt_remediation_subjects?: string | null;
  mt_section?: string | null;
  mt_section_name?: string | null;
  mt_class_section?: string | null;
  mc_subject_handled?: string | null;
  mc_coordinator_subject?: string | null;
  mc_coordinator_subject_handled?: string | null;
  mc_subject?: string | null;
  mc_subjects?: string | null;
  mc_handled_subjects?: string | null;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userIdParam = url.searchParams.get("userId");

  if (!userIdParam) {
    return NextResponse.json(
      { success: false, error: "Missing userId query parameter." },
      { status: 400 },
    );
  }

  const userId = Number(userIdParam);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid userId value." }, { status: 400 });
  }

  try {
    const userColumns = await safeGetColumns("users");
    if (userColumns.size === 0) {
      return NextResponse.json(
        { success: false, error: "Users table is not accessible." },
        { status: 500 },
      );
    }

    const masterTeacherInfo = await resolveMasterTeacherTable();
    const remedialColumns = await safeGetColumns(REMEDIAL_TABLE);
    const coordinatorColumns = await safeGetColumns(COORDINATOR_TABLE);

    const selectParts: string[] = [];
    const params: Array<number> = [userId];

    const addUserColumn = (column: string, alias: string) => {
      if (userColumns.has(column)) {
        selectParts.push(`u.${column} AS ${alias}`);
      }
    };

    const addMasterColumn = (column: string, alias: string) => {
      if (masterTeacherInfo.table && masterTeacherInfo.columns.has(column)) {
        selectParts.push(`mt.${column} AS ${alias}`);
      }
    };

    const addRemedialColumn = (column: string, alias: string) => {
      if (remedialColumns.has(column)) {
        selectParts.push(`rt.${column} AS ${alias}`);
      }
    };

    const addCoordinatorTableColumn = (column: string, alias: string) => {
      if (coordinatorColumns.has(column)) {
        selectParts.push(`mc.${column} AS ${alias}`);
      }
    };

    selectParts.push("u.user_id AS user_id");
    addUserColumn("first_name", "user_first_name");
    addUserColumn("middle_name", "user_middle_name");
    addUserColumn("last_name", "user_last_name");
    addUserColumn("suffix", "user_suffix");
    addUserColumn("name", "user_name");
    addUserColumn("email", "user_email");
    addUserColumn("contact_number", "user_contact_number");
    addUserColumn("phone_number", "user_phone_number");
    addUserColumn("role", "user_role");

    if (masterTeacherInfo.table && masterTeacherInfo.columns.size > 0) {
      addMasterColumn("first_name", "mt_first_name");
      addMasterColumn("middle_name", "mt_middle_name");
      addMasterColumn("last_name", "mt_last_name");
      addMasterColumn("suffix", "mt_suffix");
      addMasterColumn("name", "mt_name");
      addMasterColumn("email", "mt_email");

      for (const candidate of GRADE_COLUMN_CANDIDATES) {
        addMasterColumn(candidate.column, candidate.alias);
      }
      for (const candidate of COORDINATOR_COLUMN_CANDIDATES) {
        addMasterColumn(candidate.column, candidate.alias);
      }
      for (const candidate of SUBJECT_COLUMN_CANDIDATES) {
        addMasterColumn(candidate.column, candidate.alias);
      }
      for (const candidate of SECTION_COLUMN_CANDIDATES) {
        addMasterColumn(candidate.column, candidate.alias);
      }
      for (const candidate of REMEDIAL_GRADE_COLUMN_CANDIDATES) {
        addRemedialColumn(candidate.column, candidate.alias);
      }
      for (const candidate of COORDINATOR_TABLE_SUBJECT_CANDIDATES) {
        addCoordinatorTableColumn(candidate.column, candidate.alias);
      }
    }

    const joinClauses: string[] = [];
    const joinStrategies: string[] = [];

    if (masterTeacherInfo.table && masterTeacherInfo.columns.size > 0) {
      const joinConditions: string[] = [];
      if (masterTeacherInfo.columns.has("user_id")) {
        joinConditions.push("mt.user_id = u.user_id");
        joinStrategies.push("user_id");
      }
      if (masterTeacherInfo.columns.has("master_teacher_id")) {
        joinConditions.push("mt.master_teacher_id = u.user_id");
        joinStrategies.push("master_teacher_id");
      }
      if (masterTeacherInfo.columns.has("masterteacher_id")) {
        joinConditions.push("mt.masterteacher_id = u.user_id");
        joinStrategies.push("masterteacher_id");
      }
      if (masterTeacherInfo.columns.has("teacher_id")) {
        joinConditions.push("mt.teacher_id = u.user_id");
        joinStrategies.push("teacher_id");
      }
      if (masterTeacherInfo.columns.has("email") && userColumns.has("email")) {
        joinConditions.push("mt.email = u.email");
        joinStrategies.push("email");
      }
      if (masterTeacherInfo.columns.has("user_email") && userColumns.has("email")) {
        joinConditions.push("mt.user_email = u.email");
        joinStrategies.push("user_email");
      }

      if (joinConditions.length > 0) {
        joinClauses.push(`LEFT JOIN \`${masterTeacherInfo.table}\` AS mt ON ${joinConditions.join(" OR ")}`);
      } else {
        joinClauses.push(`LEFT JOIN \`${masterTeacherInfo.table}\` AS mt ON FALSE`);
      }
    }

    if (remedialColumns.size > 0) {
      const conditions: string[] = [];
      if (remedialColumns.has("user_id")) {
        conditions.push("rt.user_id = u.user_id");
      }
      if (remedialColumns.has("teacher_id")) {
        conditions.push("rt.teacher_id = u.user_id");
      }
      if (remedialColumns.has("master_teacher_id")) {
        conditions.push("rt.master_teacher_id = u.user_id");
      }
      if (remedialColumns.has("remedial_teacher_id")) {
        conditions.push("rt.remedial_teacher_id = u.user_id");
      }
      if (remedialColumns.has("email") && userColumns.has("email")) {
        conditions.push("rt.email = u.email");
      }
      joinClauses.push(`LEFT JOIN \`${REMEDIAL_TABLE}\` AS rt ON ${conditions.join(" OR ") || "FALSE"}`);
    }

    if (coordinatorColumns.size > 0) {
      const conditions: string[] = [];
      if (coordinatorColumns.has("user_id")) {
        conditions.push("mc.user_id = u.user_id");
      }
      if (coordinatorColumns.has("master_teacher_id")) {
        conditions.push("mc.master_teacher_id = u.user_id");
      }
      if (coordinatorColumns.has("coordinator_id")) {
        conditions.push("mc.coordinator_id = u.user_id");
      }
      if (coordinatorColumns.has("email") && userColumns.has("email")) {
        conditions.push("mc.email = u.email");
      }
      joinClauses.push(`LEFT JOIN \`${COORDINATOR_TABLE}\` AS mc ON ${conditions.join(" OR ") || "FALSE"}`);
    }

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM users AS u
      ${joinClauses.map((clause) => clause ? ` ${clause}` : "").join(" ")}
      WHERE u.user_id = ?
      LIMIT 1
    `;

    const [rows] = await query<RawCoordinatorRow[]>(sql, params);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Coordinator record was not found." },
        { status: 404 },
      );
    }

    const row = rows[0];

    const grade = pickFirst(
      row.rt_grade,
      row.rt_grade_level,
      row.rt_handled_grade,
      row.rt_gradeLevel,
      row.rt_gradelevel,
      row.mt_grade,
      row.mt_handled_grade,
      row.mt_grade_level,
      row.mt_gradeLevel,
      row.mt_gradelevel,
    );

    const coordinatorSubject = pickFirst(
      row.mc_subject_handled,
      row.mc_coordinator_subject,
      row.mc_coordinator_subject_handled,
      row.mc_subject,
      row.mc_subjects,
      row.mc_handled_subjects,
      row.mt_coordinator,
      row.mt_coordinator_subject,
      row.mt_coordinatorSubject,
      row.mt_coordinator_generic,
      row.mt_coordinator_subject_handled,
    );

    const subjects = pickFirst(
      row.mt_subjects,
      row.mt_handled_subjects,
      row.mt_subject,
      row.mt_remediation_subjects,
      row.mc_subjects,
      row.mc_handled_subjects,
    );

    const section = pickFirst(
      row.mt_section,
      row.mt_section_name,
      row.mt_class_section,
    );

    const firstName = pickFirst(row.mt_first_name, row.user_first_name);
    const middleName = pickFirst(row.mt_middle_name, row.user_middle_name);
    const lastName = pickFirst(row.mt_last_name, row.user_last_name);
    const suffix = pickFirst(row.mt_suffix, row.user_suffix);
    const displayName = pickFirst(row.mt_name, row.user_name, buildName(firstName, middleName, lastName, suffix));

    const email = pickFirst(row.user_email, row.mt_email);
    const contactNumber = pickFirst(row.user_contact_number, row.user_phone_number);

    const normalizedGrade = normalizeGradeValue(grade);
    const allowedSubjects = deriveSubjectList(coordinatorSubject, subjects);
    const coordinatorIdForActivities = Number.isFinite(row.user_id) ? Number(row.user_id) : null;
    const coordinatorActivities = await loadCoordinatorActivities(
      coordinatorIdForActivities,
      displayName,
      normalizedGrade,
      allowedSubjects,
    );

    return NextResponse.json({
      success: true,
      coordinator: {
        userId: row.user_id,
        name: displayName,
        gradeLevel: grade,
        coordinatorSubject,
        subjectsHandled: subjects,
        section,
        email,
        contactNumber,
      },
      activities: coordinatorActivities,
      metadata: {
        masterTeacherTable: masterTeacherInfo.table,
        joinStrategies,
        gradeColumnsDetected: GRADE_COLUMN_CANDIDATES.filter((candidate) =>
          masterTeacherInfo.columns.has(candidate.column),
        ).map((candidate) => candidate.column),
        coordinatorColumnsDetected: COORDINATOR_COLUMN_CANDIDATES.filter((candidate) =>
          masterTeacherInfo.columns.has(candidate.column),
        ).map((candidate) => candidate.column),
        gradeNormalized: normalizedGrade,
        subjectFilters: allowedSubjects,
        activitySources: SUBJECT_ACTIVITY_TABLES.map((entry) => entry.table),
      },
    });
  } catch (error) {
    console.error("Failed to load coordinator profile", error);
    return NextResponse.json(
      { success: false, error: "Failed to load coordinator profile." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const SUBJECT_SCHEDULE_TABLES: Array<{ table: string; subject: string }> = [
  { table: "english_activity_schedule", subject: "English" },
  { table: "filipino_activity_schedule", subject: "Filipino" },
  { table: "math_activity_schedule", subject: "Math" },
];

const STATIC_TABLE_CANDIDATES = [
  "calendar_requests",
  "calendar_request",
  "calendar_activity_requests",
  "calendar_activity_request",
  "activity_requests",
  "activity_request",
  "master_teacher_calendar_requests",
  "master_teacher_calendar_request",
  "mt_calendar_requests",
  "mt_calendar_request",
  "english_activity_requests",
  "filipino_activity_requests",
  "math_activity_requests",
  "remedial_activity_requests",
  "remedial_calendar_requests",
  ...SUBJECT_SCHEDULE_TABLES.map((entry) => entry.table),
] as const;

const ID_COLUMNS = [
  "request_id",
  "calendar_request_id",
  "activity_request_id",
  "calendar_activity_request_id",
  "mt_request_id",
  "id",
  "identifier",
] as const;

const TITLE_COLUMNS = [
  "title",
  "activity_title",
  "event_title",
  "request_title",
  "activity",
  "name",
] as const;

const REQUESTER_COLUMNS = [
  "requested_by",
  "submitted_by",
  "requester",
  "mt_name",
  "teacher_name",
  "created_by",
  "author",
  "created_by_name",
  "creator_name",
  "master_teacher_name",
  "masterteacher_name",
] as const;

const REQUESTER_ID_COLUMNS = [
  "requested_by_id",
  "requester_id",
  "submitted_by_id",
  "requesterId",
  "mt_id",
  "master_teacher_id",
  "coordinator_id",
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
  "activity_subject",
  "focus_subject",
  "discipline",
] as const;

const STATUS_COLUMNS = [
  "status",
  "request_status",
  "approval_status",
  "principal_status",
  "state",
  "is_approved",
] as const;

const DATE_COLUMNS = [
  "requested_date",
  "date_requested",
  "date_submitted",
  "submitted_at",
  "created_at",
  "createdAt",
  "request_date",
  "datestamp",
  "requested_at",
] as const;

const START_TIME_COLUMNS = [
  "start_time",
  "start",
  "start_datetime",
  "startTime",
  "start_time_value",
] as const;

const END_TIME_COLUMNS = [
  "end_time",
  "end",
  "end_datetime",
  "endTime",
  "end_time_value",
] as const;

const PLAN_COLUMNS = [
  "activity_plan_json",
  "activities_plan",
  "plan_json",
] as const;

const WEEK_REF_COLUMNS = [
  "week_ref",
  "weekRef",
  "week_reference",
  "plan_batch_id",
  "planBatchId",
  "request_batch",
  "request_batch_id",
] as const;

const DAY_COLUMNS = [
  "day",
  "weekday",
  "day_name",
] as const;

const APPROVED_AT_COLUMNS = [
  "approved_at",
  "approval_timestamp",
  "approvedAt",
] as const;

const APPROVED_BY_COLUMNS = [
  "approved_by_id",
  "approved_by",
  "approver_id",
] as const;

const UPDATED_AT_COLUMNS = [
  "updated_at",
  "updatedAt",
  "modified_at",
  "modifiedAt",
] as const;

const TYPE_COLUMNS = [
  "type",
  "request_type",
  "activity_type",
  "category",
] as const;

const DESCRIPTION_COLUMNS = [
  "description",
  "details",
  "remarks",
  "justification",
  "note",
  "activities",
  "activity_details",
  "activity_list",
  "activity_plan",
  "schedule_details",
] as const;

const START_COLUMNS = [
  "start_date",
  "start_time",
  "event_date",
  "day",
  "schedule_date",
  "activity_date",
  "date",
] as const;

const END_COLUMNS = [
  "end_date",
  "end_time",
  "finish",
  "completion_date",
  "deadline",
] as const;

const ORDER_COLUMNS = [
  "updated_at",
  "updatedAt",
  "modified_at",
  "modifiedAt",
  "submitted_at",
  "date_submitted",
  "requested_date",
  "date_requested",
  "created_at",
  "createdAt",
] as const;

const MAX_REQUESTS_PER_TABLE = 25;

type ColumnName = string;

type ColumnMap = {
  id: ColumnName;
  title: ColumnName | null;
  requester: ColumnName | null;
  requesterId: ColumnName | null;
  grade: ColumnName | null;
  subject: ColumnName | null;
  status: ColumnName | null;
  requestedDate: ColumnName | null;
  type: ColumnName | null;
  description: ColumnName | null;
  startDate: ColumnName | null;
  endDate: ColumnName | null;
  startTime: ColumnName | null;
  endTime: ColumnName | null;
  plan: ColumnName | null;
  weekRef: ColumnName | null;
  day: ColumnName | null;
  approvedAt: ColumnName | null;
  approvedBy: ColumnName | null;
  updatedAt: ColumnName | null;
};

type ResolvedRequestTable = {
  name: string;
  columns: Set<string>;
  columnMap: ColumnMap;
  orderColumn: ColumnName | null;
  defaultSubject?: string | null;
};

type CalendarRequestRecord = {
  id: string;
  title: string | null;
  requester: string | null;
  requesterId: string | null;
  grade: string | null;
  subject: string | null;
  status: string | null;
  requestedDate: string | null;
  requestedTimestamp: number | null;
  type: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  activitiesPlan: Array<{
    title: string | null;
    description: string | null;
    activityDate: string | null;
    startTime: string | null;
    endTime: string | null;
    day: string | null;
  }> | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  updatedAt?: string | null;
  displayLabel: string;
  displayStatus: string | null;
  sourceTable: string;
  relatedRowIds: string[];
  planBatchId: string | null;
};

type RequestPayload = {
  payload: CalendarRequestRecord;
  sortKey: number;
};

type ActivitiesPlanItem = NonNullable<CalendarRequestRecord["activitiesPlan"]>[number];

const toNormalizedString = (value: string) => value.trim().toLowerCase();

const safeGetColumns = async (tableName: string): Promise<Set<string>> => {
  try {
    return await getTableColumns(tableName);
  } catch (error) {
    console.warn(`Unable to read columns for table ${tableName}`, error);
    return new Set();
  }
};

const buildColumnLookup = (columns: Set<string>) => {
  const lookup = new Map<string, string>();
  for (const column of columns) {
    lookup.set(toNormalizedString(column), column);
  }
  return lookup;
};

const pickColumn = (
  columns: Set<string>,
  candidates: readonly string[],
  { allowPartial = true }: { allowPartial?: boolean } = {},
): string | null => {
  if (columns.size === 0) {
    return null;
  }

  const lookup = buildColumnLookup(columns);
  for (const candidate of candidates) {
    const normalized = toNormalizedString(candidate);
    const resolved = lookup.get(normalized);
    if (resolved) {
      return resolved;
    }
  }

  if (!allowPartial) {
    return null;
  }

  for (const candidate of candidates) {
    const normalized = toNormalizedString(candidate);
    for (const column of columns) {
      if (toNormalizedString(column).includes(normalized)) {
        return column;
      }
    }
  }

  return null;
};

const discoverRequestTables = async (): Promise<string[]> => {
  const sql = `
    SELECT table_name AS tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND (table_name LIKE '%request%' OR table_name LIKE '%calendar%request%')
    ORDER BY table_name
  `;

  const [rows] = await query<RowDataPacket[]>(sql);
  return rows
    .map((row) => row.tableName as string)
    .filter((name): name is string => typeof name === "string" && name.length > 0);
};

const resolveRequestTables = async (): Promise<ResolvedRequestTable[]> => {
  const candidateNames = new Set<string>(STATIC_TABLE_CANDIDATES);
  for (const tableName of await discoverRequestTables()) {
    candidateNames.add(tableName);
  }

  const resolved: ResolvedRequestTable[] = [];

  for (const candidate of candidateNames) {
    const columns = await safeGetColumns(candidate);
    if (!columns.size) {
      continue;
    }

    const idColumn = pickColumn(columns, ID_COLUMNS);
    if (!idColumn) {
      continue;
    }

    const titleColumn = pickColumn(columns, TITLE_COLUMNS);
    const requesterColumn = pickColumn(columns, REQUESTER_COLUMNS);
    const statusColumn = pickColumn(columns, STATUS_COLUMNS);
    const requestedDateColumn = pickColumn(columns, DATE_COLUMNS);

    if (!titleColumn && !requesterColumn && !statusColumn && !requestedDateColumn) {
      continue;
    }

    const columnMap: ColumnMap = {
      id: idColumn,
      title: titleColumn,
      requester: requesterColumn,
      requesterId: pickColumn(columns, REQUESTER_ID_COLUMNS),
      grade: pickColumn(columns, GRADE_COLUMNS),
      subject: pickColumn(columns, SUBJECT_COLUMNS),
      status: statusColumn,
      requestedDate: requestedDateColumn,
      type: pickColumn(columns, TYPE_COLUMNS),
      description: pickColumn(columns, DESCRIPTION_COLUMNS),
      startDate: pickColumn(columns, START_COLUMNS),
      endDate: pickColumn(columns, END_COLUMNS),
      startTime: pickColumn(columns, START_TIME_COLUMNS),
      endTime: pickColumn(columns, END_TIME_COLUMNS),
      plan: pickColumn(columns, PLAN_COLUMNS),
      weekRef: pickColumn(columns, WEEK_REF_COLUMNS),
      day: pickColumn(columns, DAY_COLUMNS),
      approvedAt: pickColumn(columns, APPROVED_AT_COLUMNS),
      approvedBy: pickColumn(columns, APPROVED_BY_COLUMNS),
      updatedAt: pickColumn(columns, UPDATED_AT_COLUMNS),
    };

    const orderColumn = pickColumn(columns, ORDER_COLUMNS) ?? columnMap.requestedDate ?? columnMap.id;

    const scheduleEntry = SUBJECT_SCHEDULE_TABLES.find((entry) => entry.table === candidate);

    resolved.push({
      name: candidate,
      columns,
      columnMap,
      orderColumn,
      defaultSubject: scheduleEntry?.subject ?? null,
    });
  }

  return resolved;
};

const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
};

const normalizeSentenceCase = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const normalizeStatus = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  if (["1", "approved", "accepted", "granted", "true", "yes", "ok"].includes(normalized)) {
    return "Approved";
  }
  if (["0", "pending", "awaiting", "waiting", "in review", "submitted", "for approval"].includes(normalized)) {
    return "Pending";
  }
  if (["rejected", "declined", "denied", "cancelled", "canceled", "void", "closed"].includes(normalized)) {
    return "Declined";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const toISODate = (value: unknown): { formatted: string | null; timestamp: number } => {
  if (!value) {
    return { formatted: null, timestamp: Number.NaN };
  }
  if (value instanceof Date) {
    const time = value.getTime();
    if (Number.isNaN(time)) {
      return { formatted: null, timestamp: Number.NaN };
    }
    return { formatted: value.toISOString().slice(0, 10), timestamp: time };
  }

  const text = String(value).trim();
  if (!text) {
    return { formatted: null, timestamp: Number.NaN };
  }

  const parsed = new Date(text);
  const timestamp = parsed.getTime();
  if (Number.isNaN(timestamp)) {
    return { formatted: null, timestamp: Number.NaN };
  }

  return { formatted: parsed.toISOString().slice(0, 10), timestamp };
};

const deriveWeekdayFromISO = (isoDate: string | null): string | null => {
  if (!isoDate) {
    return null;
  }

  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString("en-US", { weekday: "long" });
};

const mergeActivityLists = (
  existing: ActivitiesPlanItem[] | null | undefined,
  additions: Array<ActivitiesPlanItem[] | ActivitiesPlanItem | null | undefined>,
): ActivitiesPlanItem[] => {
  const normalizedMap = new Map<string, ActivitiesPlanItem>();

  const addItem = (item: ActivitiesPlanItem | null | undefined) => {
    if (!item) {
      return;
    }

    const normalized: ActivitiesPlanItem = {
      title: toNullableString(item.title),
      description: toNullableString(item.description),
      activityDate: toNullableString(item.activityDate),
      startTime: toNullableString(item.startTime),
      endTime: toNullableString(item.endTime),
      day: toNullableString(item.day),
    };

    const key = [
      normalized.activityDate ?? "",
      normalized.startTime ?? "",
      normalized.endTime ?? "",
      normalized.day ?? "",
      normalized.title ?? "",
    ].join("::");

    if (!normalizedMap.has(key)) {
      normalizedMap.set(key, normalized);
    }
  };

  if (Array.isArray(existing)) {
    existing.forEach(addItem);
  }

  for (const addition of additions) {
    if (!addition) {
      continue;
    }
    if (Array.isArray(addition)) {
      addition.forEach(addItem);
    } else {
      addItem(addition);
    }
  }

  const merged = Array.from(normalizedMap.values());

  merged.sort((a, b) => {
    const dateA = a.activityDate ?? "";
    const dateB = b.activityDate ?? "";
    if (dateA && dateB && dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    const dayA = a.day ?? "";
    const dayB = b.day ?? "";
    if (dayA && dayB && dayA !== dayB) {
      return dayA.localeCompare(dayB);
    }

    const startA = a.startTime ?? "";
    const startB = b.startTime ?? "";
    if (startA && startB && startA !== startB) {
      return startA.localeCompare(startB);
    }

    return (a.title ?? "").localeCompare(b.title ?? "");
  });

  return merged;
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

const buildSelectList = (info: ResolvedRequestTable): string[] => {
  const selectParts: string[] = [`\`${info.columnMap.id}\` AS id_value`];

  const mapEntries: Array<[keyof ColumnMap, string]> = [
    ["title", "title_value"],
    ["requester", "requester_value"],
    ["requesterId", "requester_id_value"],
    ["grade", "grade_value"],
    ["subject", "subject_value"],
    ["status", "status_value"],
    ["requestedDate", "requested_date_value"],
    ["type", "type_value"],
    ["description", "description_value"],
    ["startDate", "start_value"],
    ["endDate", "end_value"],
    ["startTime", "start_time_value"],
    ["endTime", "end_time_value"],
    ["plan", "plan_value"],
    ["weekRef", "week_ref_value"],
    ["day", "day_value"],
    ["approvedAt", "approved_at_value"],
    ["approvedBy", "approved_by_value"],
    ["updatedAt", "updated_at_value"],
  ];

  for (const [key, alias] of mapEntries) {
    const column = info.columnMap[key];
    selectParts.push(column ? `\`${column}\` AS ${alias}` : `NULL AS ${alias}`);
  }

  return selectParts;
};

const buildOrderClause = (info: ResolvedRequestTable) => {
  const column = info.orderColumn ?? info.columnMap.id;
  return `\`${column}\` DESC`;
};

const fetchRequestsFromTable = async (
  info: ResolvedRequestTable,
): Promise<{ table: string; columnMap: ColumnMap; rows: RequestPayload[] }> => {
  const selectClause = buildSelectList(info).join(", ");
  const orderClause = buildOrderClause(info);
  const limit = Math.max(1, Math.min(MAX_REQUESTS_PER_TABLE, 100));

  const sql = `
    SELECT ${selectClause}
    FROM \`${info.name}\`
    ORDER BY ${orderClause}
    LIMIT ${limit}
  `;

  const [rows] = await query<RowDataPacket[]>(sql);

  const grouped = new Map<
    string,
    {
      payload: CalendarRequestRecord;
      sortCandidates: number[];
    }
  >();

  for (const row of rows) {
    const id = toNullableString(row.id_value);
    if (!id) {
      continue;
    }

    const title = toNullableString(row.title_value);
    const requester = toNullableString(row.requester_value);
    const requesterId = toNullableString(row.requester_id_value);
    const grade = toNullableString(row.grade_value);
    const subject = toNullableString(row.subject_value) ?? info.defaultSubject ?? null;
    const normalizedGrade = grade ? normalizeSentenceCase(grade) : null;
    const normalizedSubject = subject
      ? normalizeSentenceCase(subject)
      : normalizeSentenceCase(info.defaultSubject ?? null);
    const status = normalizeStatus(toNullableString(row.status_value));
    const type = toNullableString(row.type_value);
    const description = toNullableString(row.description_value);

    const requestedDateResult = toISODate(row.requested_date_value);
    const startDateResult = toISODate(row.start_value);
    const endDateResult = toISODate(row.end_value);
    const startTime = toNullableString(row.start_time_value);
    const endTime = toNullableString(row.end_time_value);
    const dayName = toNullableString(row.day_value);
    const weekRefValue = toNullableString(row.week_ref_value);
    const approvedAtValue = toNullableString(row.approved_at_value);
    const approvedByValue = toNullableString(row.approved_by_value);
    const updatedAtValue = toNullableString(row.updated_at_value);

    const planRaw = toNullableString(row.plan_value);
    let activitiesPlan: CalendarRequestRecord["activitiesPlan"] = null;
    let planBatchId: string | null = null;

    if (planRaw) {
      try {
        const parsed = JSON.parse(planRaw) as {
          batchId?: string;
          activities?: Array<{
            title?: string | null;
            description?: string | null;
            activityDate?: string | null;
            startTime?: string | null;
            endTime?: string | null;
            day?: string | null;
          }>;
        } | null;

        if (parsed?.activities && Array.isArray(parsed.activities)) {
          planBatchId = toNullableString(parsed.batchId);
          activitiesPlan = parsed.activities.map((activity) => ({
            title: activity.title ?? null,
            description: activity.description ?? null,
            activityDate: activity.activityDate ?? null,
            startTime: activity.startTime ?? null,
            endTime: activity.endTime ?? null,
            day: activity.day ?? null,
          }));
        }
      } catch (error) {
        console.warn(`Unable to parse activity_plan_json for table ${info.name}`, error);
      }
    }

    if (!planBatchId && weekRefValue) {
      planBatchId = weekRefValue;
    }

    const activityDate = startDateResult.formatted ?? endDateResult.formatted;
    const derivedDayLabel = dayName ?? deriveWeekdayFromISO(activityDate);

    const fallbackActivity: ActivitiesPlanItem = {
      title: title ?? normalizedSubject ?? null,
      description,
      activityDate,
      startTime,
      endTime,
      day: derivedDayLabel,
    };

    const mergedActivities = mergeActivityLists(activitiesPlan, [fallbackActivity]);
    const normalizedActivities = mergedActivities.length ? mergedActivities : [fallbackActivity];
    const resolvedActivities = normalizedActivities.length ? normalizedActivities : null;

    const labelParts: string[] = [];
    if (normalizedSubject) {
      labelParts.push(normalizedSubject);
    }
    if (normalizedGrade) {
      labelParts.push(normalizedGrade);
    }
    const displayLabel = labelParts.length ? labelParts.join(" • ") : title ?? `Request #${id}`;

    const payload: CalendarRequestRecord = {
      id,
      title,
      requester,
      requesterId,
      grade: normalizedGrade,
      subject: normalizedSubject,
      status,
      requestedDate: requestedDateResult.formatted,
      requestedTimestamp: Number.isFinite(requestedDateResult.timestamp)
        ? requestedDateResult.timestamp
        : null,
      type,
      description,
      startDate: startDateResult.formatted,
      endDate: endDateResult.formatted,
      activitiesPlan: resolvedActivities,
      approvedAt: approvedAtValue,
      approvedBy: approvedByValue,
      updatedAt: updatedAtValue,
      displayLabel,
      displayStatus: status,
      sourceTable: info.name,
      relatedRowIds: [id],
      planBatchId,
    };

    const sortCandidates = [
      requestedDateResult.timestamp,
      startDateResult.timestamp,
      endDateResult.timestamp,
    ].filter((value) => Number.isFinite(value)) as number[];

    const groupingKey = planBatchId ?? `${info.name}::${id}`;
    const existing = grouped.get(groupingKey);

    if (existing) {
      const mergedIds = new Set(existing.payload.relatedRowIds);
      mergedIds.add(id);
      existing.payload.relatedRowIds = Array.from(mergedIds);

      const aggregatedActivities = mergeActivityLists(existing.payload.activitiesPlan, [resolvedActivities ?? undefined]);
      if (aggregatedActivities.length) {
        existing.payload.activitiesPlan = aggregatedActivities;
      }

      if (!existing.payload.title && title) {
        existing.payload.title = title;
      }

      if (!existing.payload.subject && normalizedSubject) {
        existing.payload.subject = normalizedSubject;
        existing.payload.displayLabel = normalizedSubject;
      }

      if (!existing.payload.grade && normalizedGrade) {
        existing.payload.grade = normalizedGrade;
      }

      if (!existing.payload.planBatchId && planBatchId) {
        existing.payload.planBatchId = planBatchId;
      }

      existing.sortCandidates.push(...sortCandidates);
      continue;
    }

    grouped.set(groupingKey, { payload, sortCandidates });
  }

  const results: RequestPayload[] = [];

  for (const { payload, sortCandidates } of grouped.values()) {
    const filtered = sortCandidates.filter((value) => Number.isFinite(value)) as number[];
    const sortKey = filtered.length ? Math.max(...filtered) : Number.NaN;
    results.push({ payload, sortKey });
  }

  return { table: info.name, columnMap: info.columnMap, rows: results };
};

export async function GET() {
  try {
    const tables = await resolveRequestTables();

    if (!tables.length) {
      return NextResponse.json({
        success: true,
        requests: [],
        metadata: {
          sources: [],
          message: "No calendar request tables were found.",
        },
      });
    }

    const tableResults = await Promise.all(tables.map(fetchRequestsFromTable));

    const aggregated: RequestPayload[] = [];
    for (const { rows } of tableResults) {
      aggregated.push(...rows);
    }

    aggregated.sort((a, b) => {
      const aKey = Number.isFinite(a.sortKey) ? a.sortKey : Number.NEGATIVE_INFINITY;
      const bKey = Number.isFinite(b.sortKey) ? b.sortKey : Number.NEGATIVE_INFINITY;
      return bKey - aKey;
    });

    const requests = aggregated.map((entry) => entry.payload);

    return NextResponse.json({
      success: true,
      requests,
      metadata: {
        sources: tableResults.map(({ table, columnMap, rows }) => ({
          table,
          rows: rows.length,
          columnMap,
          defaultSubject: tables.find((entry) => entry.name === table)?.defaultSubject ?? null,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to load principal calendar requests", error);
    return NextResponse.json(
      { success: false, error: "Unable to load calendar requests." },
      { status: 500 },
    );
  }
}

type UpdateAction = "approve" | "reject";

const ACTION_STATUS_LABEL: Record<UpdateAction, string> = {
  approve: "Approved",
  reject: "Declined",
};

const normalizeUpdateValue = (
  desiredLabel: string,
  currentValue: unknown,
  action: UpdateAction,
): string | number => {
  if (typeof currentValue === "number") {
    return action === "approve" ? 1 : 0;
  }
  if (typeof currentValue === "boolean") {
    return action === "approve" ? 1 : 0;
  }
  if (currentValue !== null && currentValue !== undefined) {
    const normalized = String(currentValue).trim().toLowerCase();
    if (normalized === "1" || normalized === "0") {
      return action === "approve" ? 1 : 0;
    }
  }
  return desiredLabel;
};

export async function PATCH(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => null)) as {
      requestId?: string | number;
      sourceTable?: string;
      action?: string;
      approverId?: number | string | null;
      approverName?: string | null;
      relatedRowIds?: Array<string | number | null>;
      planBatchId?: string | null;
    } | null;

    const requestId = payload?.requestId;
    const sourceTable = payload?.sourceTable;
    const actionRaw = payload?.action ?? "";

    if (!requestId || !sourceTable || typeof actionRaw !== "string") {
      return NextResponse.json({ success: false, error: "Missing requestId, sourceTable, or action." }, { status: 400 });
    }

    const normalizedAction = actionRaw.toLowerCase() as UpdateAction;
    if (!Object.prototype.hasOwnProperty.call(ACTION_STATUS_LABEL, normalizedAction)) {
      return NextResponse.json({ success: false, error: "Unsupported action." }, { status: 400 });
    }

    const approverName = toNullableString(payload?.approverName ?? null);
    const rawApproverId = payload?.approverId;
    let approverId: number | null = null;
    const targetIds = new Set<string>();
    targetIds.add(String(requestId));

    if (Array.isArray(payload?.relatedRowIds)) {
      for (const related of payload.relatedRowIds) {
        if (related === null || related === undefined) {
          continue;
        }
        const text = String(related).trim();
        if (text.length) {
          targetIds.add(text);
        }
      }
    }

    if (typeof rawApproverId === "number") {
      approverId = Number.isFinite(rawApproverId) ? rawApproverId : null;
    } else if (typeof rawApproverId === "string") {
      const parsed = Number(rawApproverId);
      approverId = Number.isFinite(parsed) ? parsed : null;
    }

    const tables = await resolveRequestTables();
    const tableInfo = tables.find((entry) => entry.name === sourceTable);
    if (!tableInfo) {
      return NextResponse.json({ success: false, error: "Request source table was not found." }, { status: 404 });
    }

    const idColumn = tableInfo.columnMap.id;
    const statusColumn = tableInfo.columnMap.status;
    const approvedAtColumn = tableInfo.columnMap.approvedAt;
    const approvedByColumn = tableInfo.columnMap.approvedBy;
    const updatedAtColumn = tableInfo.columnMap.updatedAt;

    if (!statusColumn) {
      return NextResponse.json({ success: false, error: "This request cannot be updated." }, { status: 400 });
    }

    const selectParts = [`\`${statusColumn}\` AS status_value`];
    if (approvedAtColumn) {
      selectParts.push(`\`${approvedAtColumn}\` AS approved_at_value`);
    }
    if (approvedByColumn) {
      selectParts.push(`\`${approvedByColumn}\` AS approved_by_value`);
    }
    if (updatedAtColumn) {
      selectParts.push(`\`${updatedAtColumn}\` AS updated_at_value`);
    }

    const selectSql = `SELECT ${selectParts.join(", ")} FROM \`${sourceTable}\` WHERE \`${idColumn}\` = ? LIMIT 1`;
    const [rows] = await query<RowDataPacket[]>(selectSql, [requestId]);

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "Request record not found." }, { status: 404 });
    }

    const currentValue = rows[0]?.status_value ?? null;
    const statusLabel = ACTION_STATUS_LABEL[normalizedAction];
    const updateValue = normalizeUpdateValue(statusLabel, currentValue, normalizedAction);

    const updates: string[] = [`\`${statusColumn}\` = ?`];
    const params: Array<string | number | null> = [updateValue];

    const now = new Date();
    const timestamp = formatDateTime(now);

    if (approvedAtColumn) {
      updates.push(`\`${approvedAtColumn}\` = ?`);
      params.push(normalizedAction === "approve" ? timestamp : null);
    }

    if (approvedByColumn) {
      const columnLower = approvedByColumn.toLowerCase();
      let shouldUpdate = normalizedAction !== "approve";
      let approvedByValue: string | number | null = null;

      if (normalizedAction === "approve") {
        if (columnLower.includes("_id")) {
          if (approverId !== null) {
            approvedByValue = approverId;
            shouldUpdate = true;
          }
        } else {
          approvedByValue = approverName ?? (approverId !== null ? String(approverId) : null);
          if (approvedByValue) {
            shouldUpdate = true;
          }
        }
      } else {
        approvedByValue = null;
      }

      if (shouldUpdate) {
        updates.push(`\`${approvedByColumn}\` = ?`);
        params.push(approvedByValue);
      }
    }

    if (updatedAtColumn) {
      updates.push(`\`${updatedAtColumn}\` = ?`);
      params.push(timestamp);
    }

    const idValues = Array.from(targetIds).map((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : value;
    });
    const idPlaceholders = idValues.map(() => "?").join(", ");
    const updateSql = `UPDATE \`${sourceTable}\` SET ${updates.join(", ")} WHERE \`${idColumn}\` IN (${idPlaceholders})`;
    params.push(...idValues);
    const [result] = await query<ResultSetHeader>(updateSql, params);

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, error: "No rows were updated." }, { status: 404 });
    }

    return NextResponse.json({ success: true, status: statusLabel });
  } catch (error) {
    console.error("Failed to update calendar request status", error);
    return NextResponse.json(
      { success: false, error: "Unable to update the request status." },
      { status: 500 },
    );
  }
}


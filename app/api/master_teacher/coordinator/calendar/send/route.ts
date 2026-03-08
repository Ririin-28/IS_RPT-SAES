import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getMasterTeacherSessionFromCookies } from "@/lib/server/master-teacher-session";

export const dynamic = "force-dynamic";

const WEEKLY_SUBJECT_TABLE = "weekly_subject_schedule";
const MT_HANDLED_TABLE = "mt_coordinator_handled";
const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
const REQUEST_REMEDIAL_TABLE = "request_remedial_schedule";
const PRINCIPAL_NOTIFICATION_TABLE = "principal_notifications";
const SUBJECT_TABLE_CANDIDATES = ["subjects", "subject"] as const;

const PRINCIPAL_TABLE_CANDIDATES = [
  "principal",
  "principals",
  "principal_info",
  "principal_profile",
  "principal_profiles",
] as const;

const PRINCIPAL_ID_COLUMNS = ["principal_id", "user_code", "user_id"] as const;

type IncomingActivity = {
  title?: string | null;
  date?: string | null;
  day?: string | null;
  subject?: string | null;
};

type QuarterRow = RowDataPacket & {
  quarter_id: number;
  school_year: string;
  quarter_name: string;
  start_month: number | null;
  end_month: number | null;
};

const toText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeSubjectLookupKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const addSubjectLookupAlias = (map: Map<string, number>, key: string, subjectId: number) => {
  const trimmed = key.trim();
  if (!trimmed.length) return;
  if (!map.has(trimmed)) {
    map.set(trimmed, subjectId);
  }
};

const addCommonSubjectAliases = (map: Map<string, number>, normalizedName: string, subjectId: number) => {
  if (normalizedName.includes("english")) {
    addSubjectLookupAlias(map, "english", subjectId);
    addSubjectLookupAlias(map, "eng", subjectId);
    addSubjectLookupAlias(map, "engl", subjectId);
  }
  if (normalizedName.includes("filipino")) {
    addSubjectLookupAlias(map, "filipino", subjectId);
    addSubjectLookupAlias(map, "fil", subjectId);
  }
  if (normalizedName.includes("math") || normalizedName.includes("mathematics")) {
    addSubjectLookupAlias(map, "math", subjectId);
    addSubjectLookupAlias(map, "maths", subjectId);
    addSubjectLookupAlias(map, "mathematics", subjectId);
  }
  if (normalizedName.includes("assessment")) {
    addSubjectLookupAlias(map, "assessment", subjectId);
  }
};

const WEEKDAYS = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);

const parseActivityDate = (value: string): Date | null => {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const resolveSchoolYearFromDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth();
  return month >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

// const parseSchoolYear = (schoolYear: string): { startYear: number; endYear: number } | null => {
//   const [start, end] = schoolYear.split("-").map((part) => Number(part));
//   if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
//   return { startYear: start, endYear: end };
// };

const monthInRange = (month: number, start: number, end: number): boolean => {
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
};


const resolveSubjectLookup = async (): Promise<{ table: string; idColumn: string; nameColumn: string } | null> => {
  for (const table of SUBJECT_TABLE_CANDIDATES) {
    const columns = await getTableColumns(table).catch(() => new Set<string>());
    if (!columns.size) continue;
    const idColumn = columns.has("subject_id") ? "subject_id" : columns.has("id") ? "id" : null;
    const nameColumn = columns.has("name")
      ? "name"
      : columns.has("subject_name")
      ? "subject_name"
      : null;
    if (idColumn && nameColumn) {
      return { table, idColumn, nameColumn };
    }
  }
  return null;
};

const loadSubjectNameMap = async (): Promise<Map<string, number>> => {
  const map = new Map<string, number>();
  const lookup = await resolveSubjectLookup();
  if (!lookup) return map;

  const [rows] = await query<RowDataPacket[]>(
    `SELECT ${lookup.idColumn} AS subject_id, ${lookup.nameColumn} AS subject_name FROM ${lookup.table}`,
  );
  for (const row of rows) {
    const id = toNumber(row.subject_id);
    const name = toText(row.subject_name);
    if (id && name) {
      const lowered = name.toLowerCase();
      const normalized = normalizeSubjectLookupKey(name);
      addSubjectLookupAlias(map, lowered, id);
      addSubjectLookupAlias(map, normalized, id);
      addCommonSubjectAliases(map, normalized, id);
    }
  }
  return map;
};

const resolveProvidedSubjectId = (
  providedSubjectName: string | null,
  subjectNameMap: Map<string, number>,
): number | null => {
  if (!providedSubjectName) {
    return null;
  }

  const lowered = providedSubjectName.toLowerCase();
  const normalized = normalizeSubjectLookupKey(providedSubjectName);
  const directMatch =
    subjectNameMap.get(lowered) ??
    subjectNameMap.get(normalized) ??
    null;
  if (directMatch) {
    return directMatch;
  }

  if (normalized.includes("english")) {
    return subjectNameMap.get("english") ?? null;
  }
  if (normalized.includes("filipino")) {
    return subjectNameMap.get("filipino") ?? null;
  }
  if (normalized.includes("math") || normalized.includes("mathematics")) {
    return subjectNameMap.get("math") ?? subjectNameMap.get("mathematics") ?? null;
  }
  if (normalized.includes("assessment")) {
    return subjectNameMap.get("assessment") ?? null;
  }

  return null;
};

const loadWeeklySubjectMap = async (gradeId: number | null): Promise<Map<string, number>> => {
  const columns = await getTableColumns(WEEKLY_SUBJECT_TABLE).catch(() => new Set<string>());
  const hasGradeId = columns.has("grade_id");
  const [rows] = await query<RowDataPacket[]>(
    hasGradeId && gradeId
      ? `SELECT day_of_week, subject_id FROM ${WEEKLY_SUBJECT_TABLE} WHERE grade_id = ?`
      : `SELECT day_of_week, subject_id FROM ${WEEKLY_SUBJECT_TABLE}`,
    hasGradeId && gradeId ? [gradeId] : [],
  );
  const map = new Map<string, number>();
  for (const row of rows) {
    const day = row.day_of_week ? String(row.day_of_week).trim() : "";
    const subjectId = toNumber(row.subject_id);
    if (day && subjectId) {
      map.set(day, subjectId);
    }
  }
  return map;
};

const loadHandledAssignments = async (
  masterTeacherIds: Array<string | number>,
  gradeId: number | null,
  coordinatorRoleId: string | null,
) => {
  const columns = await getTableColumns(MT_HANDLED_TABLE).catch(() => new Set<string>());
  const canUseRoleId = Boolean(coordinatorRoleId) && columns.has("coordinator_role_id");
  const hasMasterTeacherColumn = columns.has("master_teacher_id");
  const hasUserIdColumn = columns.has("user_id");

  const normalizedMasterTeacherIds = Array.from(
    new Set(
      masterTeacherIds
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );

  const normalizedUserIds = Array.from(
    new Set(
      masterTeacherIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  );

  const gradeFilter = gradeId && Number.isFinite(gradeId) ? " AND grade_id = ?" : "";

  if (canUseRoleId) {
    const roleParams: Array<string | number> = [coordinatorRoleId as string];
    let roleWhere = "coordinator_role_id = ?";

    if (hasMasterTeacherColumn && normalizedMasterTeacherIds.length) {
      roleWhere += ` AND master_teacher_id IN (${normalizedMasterTeacherIds.map(() => "?").join(", ")})`;
      roleParams.push(...normalizedMasterTeacherIds);
    } else if (hasUserIdColumn && normalizedUserIds.length) {
      roleWhere += ` AND user_id IN (${normalizedUserIds.map(() => "?").join(", ")})`;
      roleParams.push(...normalizedUserIds);
    }

    if (gradeFilter) {
      roleParams.push(gradeId as number);
    }

    const [roleRows] = await query<RowDataPacket[]>(
      `SELECT subject_id, grade_id FROM ${MT_HANDLED_TABLE} WHERE ${roleWhere}${gradeFilter}`,
      roleParams,
    );

    if (roleRows.length) {
      return roleRows
        .map((row) => ({
          subject_id: Number(row.subject_id),
          grade_id: Number(row.grade_id),
        }))
        .filter((row) => Number.isFinite(row.subject_id));
    }
  }

  const fallbackColumn = hasMasterTeacherColumn ? "master_teacher_id" : hasUserIdColumn ? "user_id" : null;
  if (!fallbackColumn) {
    return [] as Array<{ subject_id: number; grade_id: number }>;
  }

  const fallbackIds = fallbackColumn === "user_id" ? normalizedUserIds : normalizedMasterTeacherIds;
  if (!fallbackIds.length) {
    return [] as Array<{ subject_id: number; grade_id: number }>;
  }

  const fallbackParams: Array<string | number> = [...fallbackIds];
  if (gradeFilter) {
    fallbackParams.push(gradeId as number);
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT subject_id, grade_id FROM ${MT_HANDLED_TABLE} WHERE ${fallbackColumn} IN (${fallbackIds.map(() => "?").join(", ")})${gradeFilter}`,
    fallbackParams,
  );

  return rows
    .map((row) => ({
      subject_id: Number(row.subject_id),
      grade_id: Number(row.grade_id),
    }))
    .filter((row) => Number.isFinite(row.subject_id));
};


const loadQuarterForDate = async (date: Date): Promise<QuarterRow | null> => {
  const schoolYear = resolveSchoolYearFromDate(date);
  const [rows] = await query<QuarterRow[]>(
    `SELECT quarter_id, school_year, quarter_name, start_month, end_month FROM ${REMEDIAL_QUARTER_TABLE} WHERE school_year = ?`,
    [schoolYear],
  );
  const month = date.getMonth() + 1;
  for (const row of rows) {
    const start = toNumber(row.start_month);
    const end = toNumber(row.end_month);
    if (!start || !end) continue;
    if (monthInRange(month, start, end)) {
      return row;
    }
  }
  return null;
};

const ensurePrincipalNotificationsTable = async () => {
  await query(
    `CREATE TABLE IF NOT EXISTS ${PRINCIPAL_NOTIFICATION_TABLE} (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      principal_id VARCHAR(64) NULL,
      message TEXT NOT NULL,
      status ENUM('unread', 'read') NOT NULL DEFAULT 'unread',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_principal_notifications_principal (principal_id),
      KEY idx_principal_notifications_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  );
};

const resolvePrincipalIds = async (): Promise<string[]> => {
  for (const table of PRINCIPAL_TABLE_CANDIDATES) {
    const columns = await getTableColumns(table).catch(() => new Set<string>());
    if (!columns.size) continue;
    const idColumn = PRINCIPAL_ID_COLUMNS.find((candidate) => columns.has(candidate));
    if (!idColumn) continue;

    const [rows] = await query<RowDataPacket[]>(
      `SELECT DISTINCT ${idColumn} AS principal_id FROM ${table} WHERE ${idColumn} IS NOT NULL`,
    );
    const ids = rows
      .map((row) => String(row.principal_id ?? "").trim())
      .filter((value) => value.length > 0);
    if (ids.length) {
      return ids;
    }
  }

  return [];
};

const insertPrincipalNotification = async (message: string) => {
  await ensurePrincipalNotificationsTable();
  const principalIds = await resolvePrincipalIds();

  if (!principalIds.length) {
    await query(
      `INSERT INTO ${PRINCIPAL_NOTIFICATION_TABLE} (principal_id, message, status)
       VALUES (?, ?, 'unread')`,
      [null, message],
    );
    return;
  }

  const placeholders = principalIds.map(() => "(?, ?, 'unread')").join(", ");
  const values = principalIds.flatMap((id) => [id, message]);
  await query(
    `INSERT INTO ${PRINCIPAL_NOTIFICATION_TABLE} (principal_id, message, status)
     VALUES ${placeholders}`,
    values,
  );
};

export async function POST(request: NextRequest) {
  try {
    const session = await getMasterTeacherSessionFromCookies();
    if (!session) {
      return NextResponse.json({ success: false, error: "Master teacher session not found." }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as {
      gradeLevel?: string | null;
      activities?: IncomingActivity[] | null;
    } | null;

    if (!payload?.activities || payload.activities.length === 0) {
      return NextResponse.json(
        { success: false, error: "No activities were provided for sending." },
        { status: 400 },
      );
    }

    const gradeId = payload.gradeLevel ? Number(String(payload.gradeLevel).match(/(\d+)/)?.[1]) : null;
    const coordinatorRoleId = session.coordinatorRoleId ? String(session.coordinatorRoleId) : null;
    const handledIds = [String(session.masterTeacherId), String(session.userId)].filter((value): value is string => {
      if (value === null || value === undefined) return false;
      return String(value).trim().length > 0;
    });

    const assignments = await loadHandledAssignments(handledIds, gradeId ?? null, coordinatorRoleId);
    if (!assignments.length) {
      return NextResponse.json({ success: false, error: "No subject assignment found for this master teacher." }, { status: 403 });
    }

    const assignmentBySubject = new Map<number, number>();
    const gradeBySubject = new Map<number, number>();
    for (const assignment of assignments) {
      assignmentBySubject.set(assignment.subject_id, assignment.subject_id);
      gradeBySubject.set(assignment.subject_id, assignment.grade_id);
    }
    const assignmentSubjectIds = Array.from(assignmentBySubject.keys());

    const resolvedGradeId = gradeId ?? assignments[0]?.grade_id ?? null;
    if (!resolvedGradeId) {
      return NextResponse.json({ success: false, error: "Grade could not be resolved for this schedule." }, { status: 400 });
    }

    const weeklySubjectMap = await loadWeeklySubjectMap(resolvedGradeId);
    if (!weeklySubjectMap.size) {
      return NextResponse.json({ success: false, error: "Weekly subject schedule is not configured yet." }, { status: 400 });
    }
    const subjectNameMap = await loadSubjectNameMap();

    const submittedBy = String(session.masterTeacherId ?? session.userId ?? "");
    const masterTeacherId = String(session.masterTeacherId ?? "").trim();
    const skipped: Array<{ title: string | null; reason: string }> = [];
    let inserted = 0;

    for (const activity of payload.activities) {
      const title = toText(activity.title);
      if (!title) {
        skipped.push({ title: null, reason: "Missing title." });
        continue;
      }

      const dateText = toText(activity.date);
      if (!dateText) {
        skipped.push({ title, reason: "Invalid or missing date." });
        continue;
      }

      const parsedDate = parseActivityDate(dateText);
      if (!parsedDate) {
        skipped.push({ title, reason: "Invalid or missing date." });
        continue;
      }

      const incomingDay = toText(activity.day);
      const weekday =
        incomingDay && WEEKDAYS.has(incomingDay)
          ? incomingDay
          : parsedDate.toLocaleDateString("en-US", { weekday: "long" });
      const weeklySubjectId = weeklySubjectMap.get(weekday) ?? null;
      const providedSubjectName = toText(activity.subject);
      const providedSubjectId = resolveProvidedSubjectId(providedSubjectName, subjectNameMap);
      let subjectId = providedSubjectId ?? weeklySubjectId;

      // If subject labels are noisy (e.g., "Eng"), prefer the coordinator's single assignment
      // instead of falling back to a potentially unrelated weekday subject.
      if (
        providedSubjectName &&
        (!subjectId || !assignmentBySubject.has(subjectId)) &&
        assignmentSubjectIds.length === 1
      ) {
        subjectId = assignmentSubjectIds[0] ?? subjectId;
      }

      if (!subjectId) {
        skipped.push({ title, reason: `No subject assigned for ${weekday}.` });
        continue;
      }

      const subjectHandled = assignmentBySubject.get(subjectId);
      if (!subjectHandled) {
        if (providedSubjectName && !providedSubjectId) {
          skipped.push({
            title,
            reason: `Unable to match "${providedSubjectName}" to your assigned subject.`,
          });
          continue;
        }
        skipped.push({ title, reason: `You are not assigned to the subject scheduled on ${weekday}.` });
        continue;
      }

      const assignmentGradeId = gradeBySubject.get(subjectId) ?? resolvedGradeId;

      const quarter = await loadQuarterForDate(parsedDate);
      if (!quarter) {
        skipped.push({ title, reason: "No remedial quarter found for this date." });
        continue;
      }

      const scheduleDate = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;
      const [existing] = await query<RowDataPacket[]>(
        `SELECT request_id FROM ${REQUEST_REMEDIAL_TABLE}
         WHERE quarter_id = ? AND schedule_date = ? AND subject_id = ? AND grade_id = ? AND title = ? AND submitted_by = ? AND master_teacher_id = ?
         LIMIT 1`,
        [
          Number(quarter.quarter_id),
          scheduleDate,
          subjectId,
          assignmentGradeId,
          title,
          submittedBy,
          masterTeacherId,
        ],
      );

      if (existing.length > 0) {
        skipped.push({ title, reason: "Activity already submitted for this week." });
        continue;
      }

      await query<ResultSetHeader>(
        `INSERT INTO ${REQUEST_REMEDIAL_TABLE}
          (quarter_id, schedule_date, day, subject_id, grade_id, title, submitted_by, master_teacher_id, status, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          Number(quarter.quarter_id),
          scheduleDate,
          weekday,
          subjectId,
          assignmentGradeId,
          title,
          submittedBy,
          masterTeacherId,
          "Pending",
        ],
      );

      inserted += 1;
    }

    if (inserted > 0) {
      await insertPrincipalNotification(
        "An MT Coordinator requested a remedial activities. See full details in Requests",
      );
    }

    return NextResponse.json({ success: true, inserted, skipped });
  } catch (error) {
    console.error("Failed to send coordinator activities", error);
    return NextResponse.json(
      { success: false, error: "Unable to send activities at this time." },
      { status: 500 },
    );
  }
}

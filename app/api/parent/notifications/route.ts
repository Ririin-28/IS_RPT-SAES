import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import { getParentSessionFromCookies } from "@/lib/server/parent-session";
import { formatScheduleDateLabel, getSchoolTodayDateKey, getScheduleDateKey } from "@/lib/remedial-schedule";

export const dynamic = "force-dynamic";

const ensuredTable = { value: false };
const APPROVED_REMEDIAL_TABLE = "approved_remedial_schedule" as const;
const ATTENDANCE_SESSION_TABLE = "attendance_session" as const;
const ATTENDANCE_RECORD_TABLE = "attendance_record" as const;
const STUDENT_REMEDIAL_SESSION_TABLE = "student_remedial_session" as const;
const STUDENT_REMEDIAL_FLASHCARD_PERFORMANCE_TABLE = "student_remedial_flashcard_performance" as const;
const STUDENT_SUBJECT_ASSESSMENT_TABLE = "student_subject_assessment" as const;
const SUBJECT_TABLE_CANDIDATES = ["subject", "subjects"] as const;
const APPROVED_DATE_COLUMN_CANDIDATES = ["schedule_date", "activity_date", "date"] as const;
const APPROVED_SUBJECT_COLUMN_CANDIDATES = ["subject_id", "subject"] as const;
const APPROVED_GRADE_COLUMN_CANDIDATES = ["grade_id", "grade", "grade_level"] as const;

const ensureNotificationsTable = async () => {
  if (ensuredTable.value) {
    return;
  }

  await query(
    `CREATE TABLE IF NOT EXISTS parent_notifications (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id INT NOT NULL,
      subject VARCHAR(100) NOT NULL,
      date DATE NOT NULL,
      message TEXT NOT NULL,
      status ENUM('unread', 'read') NOT NULL DEFAULT 'unread',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_parent_notification (student_id, subject, date),
      KEY idx_parent_notification_student (student_id),
      KEY idx_parent_notification_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  );

  ensuredTable.value = true;
};

type NotificationRow = RowDataPacket & {
  id: number;
  student_id: number;
  subject: string;
  date: Date | string;
  message: string;
  status: "unread" | "read";
  created_at: Date | string;
  updated_at: Date | string;
};

type ParentIdRow = RowDataPacket & {
  parent_id: string | number;
};

type ParentStudentRow = RowDataPacket & {
  student_id: string | number;
};

type StudentGradeRow = RowDataPacket & {
  student_id: string | number;
  grade_id: number | null;
};

type ExplicitAttendanceRow = RowDataPacket & {
  student_id: string | number;
  date: Date | string | null;
  subject_id: number | null;
  status: string | null;
};

type CompletedAttendanceRow = RowDataPacket & {
  student_id: string | number;
  date: Date | string | null;
  subject_id: number | null;
};

type ApprovedScheduleRow = RowDataPacket & {
  activity_date: Date | string | null;
  subject_id: number | null;
  grade_id: number | null;
};

type AssessmentSubjectRow = RowDataPacket & {
  student_id: string | number;
  subject_id: number | null;
};

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const toIsoDate = (value: Date | string): string => getScheduleDateKey(value) ?? new Date(value).toISOString().slice(0, 10);

const toIsoDateTime = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
};

const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
};

const parseDateValue = (value: Date | string | null | undefined): Date | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : new Date(timestamp);
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const normalized = text.replace(" ", "T");
  const fallback = new Date(normalized);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return null;
};

const safeGetColumns = async (table: string): Promise<Set<string>> => {
  try {
    return await getTableColumns(table);
  } catch {
    return new Set<string>();
  }
};

const pickColumn = (columns: Set<string>, candidates: readonly string[]): string | null => {
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }

  const lookup = new Map<string, string>();
  for (const column of columns) {
    lookup.set(column.toLowerCase(), column);
  }

  for (const candidate of candidates) {
    const resolved = lookup.get(candidate.toLowerCase());
    if (resolved) {
      return resolved;
    }
  }

  for (const candidate of candidates) {
    const needle = candidate.toLowerCase();
    for (const column of columns) {
      if (column.toLowerCase().includes(needle)) {
        return column;
      }
    }
  }

  return null;
};

const normalizeDate = (value: Date | string | null | undefined): string | null => getScheduleDateKey(value);

const normalizeSubjectName = (value: string | null | undefined): string | null => {
  const text = toNullableString(value);
  if (!text) {
    return null;
  }

  const normalized = text.toLowerCase();
  if (normalized === "math" || normalized === "mathematics") {
    return "Math";
  }
  if (normalized === "english") {
    return "English";
  }
  if (normalized === "filipino") {
    return "Filipino";
  }

  return text;
};

const formatAbsentDate = (iso: string): string => {
  return formatScheduleDateLabel(iso) ?? iso;
};

const buildParentAbsentMessage = (iso: string): string =>
  `Dear Parent, your child was marked absent on ${formatAbsentDate(iso)}.`;

const buildNotificationKey = (studentId: string, subjectName: string, date: string) =>
  `${studentId}:${normalizeSubjectName(subjectName) ?? subjectName}:${date}`;

const normalizeRequestStatus = (value: string | null | undefined): string | null => {
  const raw = toNullableString(value);
  if (!raw) {
    return null;
  }
  const normalized = raw.toLowerCase();
  if (["1", "approved", "accept", "accepted", "granted", "true", "yes", "ok"].includes(normalized)) {
    return "Approved";
  }
  if (["0", "pending", "awaiting", "waiting", "submitted", "for approval"].includes(normalized)) {
    return "Pending";
  }
  if (["rejected", "declined", "denied", "cancelled", "canceled", "void"].includes(normalized)) {
    return "Declined";
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const hashStringToInt = (input: string): number => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

const resolveParentStudentIds = async (userId: number): Promise<string[]> => {
  const [parentRows] = await query<ParentIdRow[]>(
    `SELECT parent_id FROM parent WHERE user_id = ? LIMIT 1`,
    [userId],
  );

  if (!parentRows.length) {
    return [];
  }

  const parentId = String(parentRows[0].parent_id ?? "").trim();
  if (!parentId) {
    return [];
  }

  const [rows] = await query<ParentStudentRow[]>(
    `SELECT student_id FROM parent_student WHERE parent_id = ? ORDER BY parent_student_id ASC`,
    [parentId],
  );

  return rows
    .map((row) => String(row.student_id ?? "").trim())
    .filter((value) => value.length > 0);
};

const fetchSubjectMap = async (): Promise<Map<number, string>> => {
  for (const table of SUBJECT_TABLE_CANDIDATES) {
    try {
      const columns = await getTableColumns(table);
      const idColumn = columns.has("subject_id") ? "subject_id" : columns.has("id") ? "id" : null;
      const nameColumn = columns.has("subject_name") ? "subject_name" : columns.has("name") ? "name" : null;
      if (!idColumn || !nameColumn) {
        continue;
      }

      const [rows] = await query<RowDataPacket[]>(
        `SELECT ${idColumn} AS subject_id, ${nameColumn} AS subject_name FROM ${table}`,
      );

      const map = new Map<number, string>();
      for (const row of rows) {
        const id = Number(row.subject_id);
        const name = normalizeSubjectName(toNullableString(row.subject_name));
        if (Number.isFinite(id) && name) {
          map.set(id, name);
        }
      }

      return map;
    } catch {
      continue;
    }
  }

  return new Map<number, string>();
};

const loadAssessedSubjectIdsByStudent = async (studentIds: string[]): Promise<Map<string, Set<number>>> => {
  const uniqueStudentIds = Array.from(new Set(studentIds.map((value) => value.trim()).filter(Boolean)));
  const assessmentColumns = await safeGetColumns(STUDENT_SUBJECT_ASSESSMENT_TABLE);
  if (
    uniqueStudentIds.length === 0 ||
    !assessmentColumns.has("student_id") ||
    !assessmentColumns.has("subject_id")
  ) {
    return new Map<string, Set<number>>();
  }

  const placeholders = uniqueStudentIds.map(() => "?").join(",");
  const [rows] = await query<AssessmentSubjectRow[]>(
    `SELECT student_id, subject_id
     FROM ${STUDENT_SUBJECT_ASSESSMENT_TABLE}
     WHERE student_id IN (${placeholders})`,
    uniqueStudentIds,
  );

  const assessedSubjectIdsByStudent = new Map<string, Set<number>>();
  for (const row of rows ?? []) {
    const studentId = String(row.student_id ?? "").trim();
    const subjectId = Number(row.subject_id);
    if (!studentId || !Number.isFinite(subjectId)) {
      continue;
    }

    if (!assessedSubjectIdsByStudent.has(studentId)) {
      assessedSubjectIdsByStudent.set(studentId, new Set<number>());
    }

    assessedSubjectIdsByStudent.get(studentId)!.add(subjectId);
  }

  return assessedSubjectIdsByStudent;
};

const syncScheduledAbsenceNotifications = async (studentIds: string[]): Promise<Set<string>> => {
  const uniqueStudentIds = Array.from(new Set(studentIds.map((value) => value.trim()).filter(Boolean)));
  const validAbsenceKeys = new Set<string>();
  if (uniqueStudentIds.length === 0) {
    return validAbsenceKeys;
  }

  const approvedColumns = await safeGetColumns(APPROVED_REMEDIAL_TABLE);
  const sessionColumns = await safeGetColumns(STUDENT_REMEDIAL_SESSION_TABLE);
  const performanceColumns = await safeGetColumns(STUDENT_REMEDIAL_FLASHCARD_PERFORMANCE_TABLE);

  const subjectColumn = pickColumn(approvedColumns, APPROVED_SUBJECT_COLUMN_CANDIDATES);
  const gradeColumn = pickColumn(approvedColumns, APPROVED_GRADE_COLUMN_CANDIDATES);
  const dateColumn = pickColumn(approvedColumns, APPROVED_DATE_COLUMN_CANDIDATES);

  if (!subjectColumn || !gradeColumn || !dateColumn) {
    return validAbsenceKeys;
  }

  const assessedSubjectIdsByStudent = await loadAssessedSubjectIdsByStudent(uniqueStudentIds);
  if (!assessedSubjectIdsByStudent.size) {
    return validAbsenceKeys;
  }

  const studentPlaceholders = uniqueStudentIds.map(() => "?").join(",");
  const [studentRows] = await query<StudentGradeRow[]>(
    `SELECT student_id, grade_id
     FROM student
     WHERE student_id IN (${studentPlaceholders})`,
    uniqueStudentIds,
  );

  if (!studentRows.length) {
    return validAbsenceKeys;
  }

  const studentGradeMap = new Map<string, number>();
  for (const row of studentRows) {
    const studentId = String(row.student_id ?? "").trim();
    const gradeId = Number(row.grade_id);
    if (studentId && Number.isFinite(gradeId)) {
      studentGradeMap.set(studentId, gradeId);
    }
  }

  if (!studentGradeMap.size) {
    return validAbsenceKeys;
  }

  const gradeIds = Array.from(new Set(studentGradeMap.values()));
  const gradePlaceholders = gradeIds.map(() => "?").join(",");
  const whereParts = [`${gradeColumn} IN (${gradePlaceholders})`, `${dateColumn} IS NOT NULL`];
  if (approvedColumns.has("is_archived")) {
    whereParts.push("COALESCE(is_archived, 0) = 0");
  }

  const schoolTodayKey = getSchoolTodayDateKey();
  const [scheduledRows] = await query<ApprovedScheduleRow[]>(
    `SELECT DISTINCT DATE(${dateColumn}) AS activity_date,
            ${subjectColumn} AS subject_id,
            ${gradeColumn} AS grade_id
     FROM ${APPROVED_REMEDIAL_TABLE}
     WHERE ${whereParts.join(" AND ")}
       AND DATE(${dateColumn}) < ?
     ORDER BY activity_date ASC`,
    [...gradeIds, schoolTodayKey],
  );

  if (!scheduledRows.length) {
    return validAbsenceKeys;
  }

  const subjectMap = await fetchSubjectMap();

  const [explicitAttendanceRows] = await query<ExplicitAttendanceRow[]>(
    `SELECT ar.student_id,
            sess.session_date AS date,
            sess.subject_id AS subject_id,
            ar.status AS status
     FROM ${ATTENDANCE_RECORD_TABLE} ar
     JOIN ${ATTENDANCE_SESSION_TABLE} sess ON sess.session_id = ar.session_id
     WHERE ar.student_id IN (${studentPlaceholders})`,
    uniqueStudentIds,
  );

  const presentKeys = new Set<string>();
  for (const row of explicitAttendanceRows) {
    const studentId = String(row.student_id ?? "").trim();
    const subjectId = Number(row.subject_id);
    const date = normalizeDate(row.date);
    const status = String(row.status ?? "").trim().toLowerCase();
    if (!studentId || !Number.isFinite(subjectId) || !date) {
      continue;
    }
    const subjectName = normalizeSubjectName(subjectMap.get(subjectId) ?? `Subject ${subjectId}`) ?? `Subject ${subjectId}`;
    const assessedSubjectIds = assessedSubjectIdsByStudent.get(studentId);

    if (status === "absent") {
      if (assessedSubjectIds?.has(subjectId)) {
        validAbsenceKeys.add(buildNotificationKey(studentId, subjectName, date));
      }
      continue;
    }

    if (status !== "") {
      presentKeys.add(`${studentId}:${subjectId}:${date}`);
    }
  }

  if (
    sessionColumns.has("student_id") &&
    sessionColumns.has("session_id") &&
    sessionColumns.has("subject_id") &&
    sessionColumns.has("completed_at") &&
    performanceColumns.has("session_id")
  ) {
    const approvedIdColumn = approvedColumns.has("request_id")
      ? "request_id"
      : approvedColumns.has("activity_id")
        ? "activity_id"
        : approvedColumns.has("id")
          ? "id"
          : null;
    const hasApprovedJoin = Boolean(approvedIdColumn && sessionColumns.has("approved_schedule_id"));
    const dateSelect = hasApprovedJoin ? `COALESCE(a.${dateColumn}, s.completed_at)` : "s.completed_at";

    const [completedRows] = await query<CompletedAttendanceRow[]>(
      `SELECT DISTINCT
              s.student_id AS student_id,
              ${dateSelect} AS date,
              s.subject_id AS subject_id
       FROM ${STUDENT_REMEDIAL_SESSION_TABLE} s
       ${hasApprovedJoin ? `LEFT JOIN ${APPROVED_REMEDIAL_TABLE} a ON a.${approvedIdColumn} = s.approved_schedule_id` : ""}
       WHERE s.student_id IN (${studentPlaceholders})
         AND s.completed_at IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM ${STUDENT_REMEDIAL_FLASHCARD_PERFORMANCE_TABLE} p
           WHERE p.session_id = s.session_id
           LIMIT 1
         )`,
      uniqueStudentIds,
    );

    for (const row of completedRows) {
      const studentId = String(row.student_id ?? "").trim();
      const subjectId = Number(row.subject_id);
      const date = normalizeDate(row.date);
      if (!studentId || !Number.isFinite(subjectId) || !date) {
        continue;
      }
      presentKeys.add(`${studentId}:${subjectId}:${date}`);
    }
  }

  const insertValues: Array<string | number> = [];

  for (const row of scheduledRows) {
    const subjectId = Number(row.subject_id);
    const gradeId = Number(row.grade_id);
    const date = normalizeDate(row.activity_date);
    if (!Number.isFinite(subjectId) || !Number.isFinite(gradeId) || !date) {
      continue;
    }

    for (const [studentId, studentGradeId] of studentGradeMap.entries()) {
      if (studentGradeId !== gradeId) {
        continue;
      }

      const assessedSubjectIds = assessedSubjectIdsByStudent.get(studentId);
      if (!assessedSubjectIds?.has(subjectId)) {
        continue;
      }

      if (presentKeys.has(`${studentId}:${subjectId}:${date}`)) {
        continue;
      }

      const subjectLabel = normalizeSubjectName(subjectMap.get(subjectId) ?? `Subject ${subjectId}`) ?? `Subject ${subjectId}`;
      validAbsenceKeys.add(buildNotificationKey(studentId, subjectLabel, date));
      insertValues.push(studentId, subjectLabel, date, buildParentAbsentMessage(date));
    }
  }

  if (!insertValues.length) {
    return validAbsenceKeys;
  }

  const rowPlaceholders = Array.from({ length: insertValues.length / 4 }, () => "(?, ?, ?, ?, 'unread')").join(", ");
  await query(
    `INSERT IGNORE INTO parent_notifications (student_id, subject, date, message, status)
     VALUES ${rowPlaceholders}`,
    insertValues,
  );

  return validAbsenceKeys;
};

type NormalizedNotification = {
  id: number;
  studentId: string;
  subject: string;
  date: string;
  message: string;
  status: "unread" | "read";
  createdAt: string;
};

type ApprovedActivityRow = RowDataPacket & {
  request_id: number;
  plan_batch_id: string | null;
  week_ref: string | null;
  title: string | null;
  grade_level: string | null;
  subject: string | null;
  status: string | null;
  start_date: Date | string | null;
  end_date: Date | string | null;
  approved_at: Date | string | null;
  approved_by: string | null;
  requested_at: Date | string | null;
  updated_at: Date | string | null;
};

const APPROVED_STATUS_TOKENS = ["approved", "accept", "accepted", "granted", "true", "yes", "ok", "1"] as const;

// Surface approved calendar activities from master teacher requests as read-only parent notifications.
const buildApprovedActivityNotifications = async (): Promise<NormalizedNotification[]> => {
  if (!(await tableExists("mt_calendar_requests"))) {
    return [];
  }

  const placeholders = APPROVED_STATUS_TOKENS.map(() => "?").join(",");
  const [rows] = await query<ApprovedActivityRow[]>(
    `SELECT request_id, plan_batch_id, week_ref, title, grade_level, subject, status, start_date, end_date, approved_at, approved_by, requested_at, updated_at
     FROM mt_calendar_requests
     WHERE status IS NOT NULL AND TRIM(LOWER(status)) IN (${placeholders})
     ORDER BY request_id DESC
     LIMIT 200`,
    [...APPROVED_STATUS_TOKENS],
  );

  if (!rows.length) {
    return [];
  }

  const grouped = new Map<string, ApprovedActivityRow[]>();

  for (const row of rows) {
    const status = normalizeRequestStatus(row.status);
    if (status !== "Approved") {
      continue;
    }

    const planBatchId = toNullableString(row.plan_batch_id);
    const weekRef = toNullableString(row.week_ref);
    const groupingKey = planBatchId ? `plan:${planBatchId}` : weekRef ? `week:${weekRef}` : `request:${row.request_id}`;

    if (!grouped.has(groupingKey)) {
      grouped.set(groupingKey, []);
    }
    grouped.get(groupingKey)!.push(row);
  }

  const notifications: NormalizedNotification[] = [];

  for (const [groupKey, groupRows] of grouped.entries()) {
    if (!groupRows.length) {
      continue;
    }

    const primary = groupRows[0];
    const title = toNullableString(primary.title);
    const grade = toNullableString(primary.grade_level);
    const subject = toNullableString(primary.subject);
    const approvedBy = toNullableString(primary.approved_by);

    const startDates: Date[] = [];
    const endDates: Date[] = [];
    const approvalDates: Date[] = [];
    const updatedDates: Date[] = [];
    const requestedDates: Date[] = [];

    for (const row of groupRows) {
      const start = parseDateValue(row.start_date);
      if (start) {
        startDates.push(start);
      }

      const end = parseDateValue(row.end_date);
      if (end) {
        endDates.push(end);
      }

      const approvedAt = parseDateValue(row.approved_at);
      if (approvedAt) {
        approvalDates.push(approvedAt);
      }

      const updatedAt = parseDateValue(row.updated_at);
      if (updatedAt) {
        updatedDates.push(updatedAt);
      }

      const requestedAt = parseDateValue(row.requested_at);
      if (requestedAt) {
        requestedDates.push(requestedAt);
      }
    }

    const rangeStart = startDates.length
      ? new Date(Math.min(...startDates.map((date) => date.getTime())))
      : requestedDates.length
        ? new Date(Math.min(...requestedDates.map((date) => date.getTime())))
        : null;

    const rangeEnd = endDates.length
      ? new Date(Math.max(...endDates.map((date) => date.getTime())))
      : rangeStart;

    const createdDate = approvalDates.length
      ? new Date(Math.max(...approvalDates.map((date) => date.getTime())))
      : updatedDates.length
        ? new Date(Math.max(...updatedDates.map((date) => date.getTime())))
        : requestedDates.length
          ? new Date(Math.max(...requestedDates.map((date) => date.getTime())))
          : rangeStart ?? new Date();

  const createdAtIso = createdDate.toISOString();
  const scheduledStartIso = rangeStart ? toIsoDate(rangeStart) : null;
  const scheduledEndIso = rangeEnd ? toIsoDate(rangeEnd) : null;
  const hasScheduledRange = Boolean(scheduledStartIso || scheduledEndIso);

    const descriptorTokens: string[] = [];
    if (grade) {
      descriptorTokens.push(grade);
    }
    if (subject) {
      descriptorTokens.push(subject);
    }

    const descriptor = descriptorTokens.length ? ` for ${descriptorTokens.join(" • ")}` : "";

    let message = `${title ?? subject ?? "Calendar activity"} has been approved${descriptor}`;
    if (approvedBy) {
      message += ` by ${approvedBy}`;
    }

    if (hasScheduledRange && scheduledStartIso && scheduledEndIso) {
      if (scheduledStartIso === scheduledEndIso) {
        message += `. Scheduled on ${scheduledStartIso}.`;
      } else {
        message += `. Scheduled from ${scheduledStartIso} to ${scheduledEndIso}.`;
      }
    } else if (hasScheduledRange && scheduledStartIso) {
      message += `. Scheduled on ${scheduledStartIso}.`;
    } else {
      message += ".";
    }

    const planBatchId = toNullableString(primary.plan_batch_id) ?? toNullableString(primary.week_ref);
    const numericRequestId = Number(primary.request_id);
    const hashedId = planBatchId ? hashStringToInt(planBatchId) : hashStringToInt(`${groupKey}`);
    const normalizedId = Number.isFinite(numericRequestId) && numericRequestId > 0
      ? -Math.abs(numericRequestId)
      : -Math.abs(hashedId || hashStringToInt(`${groupKey}:${createdAtIso}`));

    notifications.push({
      id: normalizedId,
      studentId: "",
      subject: subject ?? title ?? "Approved Activity",
  date: scheduledStartIso ?? createdAtIso.slice(0, 10),
      message,
      status: "unread",
      createdAt: createdAtIso,
    });
  }

  return notifications;
};

export async function GET(request: NextRequest) {
  const session = await getParentSessionFromCookies();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  await ensureNotificationsTable();

  const url = new URL(request.url);
  const studentIdsParam = url.searchParams.get("studentIds");
  const statusParam = url.searchParams.get("status");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const requestedStudentIds: string[] = [];
  if (studentIdsParam) {
    for (const part of studentIdsParam.split(",")) {
      const trimmed = part.trim();
      if (trimmed) {
        requestedStudentIds.push(trimmed);
      }
    }
  }

  const allowedStudentIds = await resolveParentStudentIds(session.userId);
  if (!allowedStudentIds.length) {
    return NextResponse.json({ success: true, notifications: [], unreadCount: 0 });
  }

  const allowedLookup = new Set(allowedStudentIds);
  const studentIds = Array.from(
    new Set(
      (requestedStudentIds.length ? requestedStudentIds : allowedStudentIds)
        .filter((studentId) => allowedLookup.has(studentId)),
    ),
  );

  if (!studentIds.length) {
    return NextResponse.json({ success: true, notifications: [], unreadCount: 0 });
  }

  const validAbsenceKeys = await syncScheduledAbsenceNotifications(studentIds);

  const validStatuses = new Set(["unread", "read"] as const);
  const statusFilter = statusParam && validStatuses.has(statusParam as "unread" | "read") ? statusParam : null;

  const params: Array<string | number> = [];
  let sql = `SELECT id, student_id, subject, date, message, status, created_at, updated_at FROM parent_notifications`;

  const conditions: string[] = [];
  const placeholders = studentIds.map(() => "?").join(",");
  conditions.push(`student_id IN (${placeholders})`);
  params.push(...studentIds);

  if (statusFilter) {
    conditions.push(`status = ?`);
    params.push(statusFilter);
  }

  if (fromParam && ISO_DATE_REGEX.test(fromParam)) {
    conditions.push(`date >= ?`);
    params.push(fromParam);
  }

  if (toParam && ISO_DATE_REGEX.test(toParam)) {
    conditions.push(`date <= ?`);
    params.push(toParam);
  }

  if (conditions.length) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  sql += ` ORDER BY date DESC, created_at DESC`;

  const [rows] = await query<NotificationRow[]>(sql, params);

  const baseNotifications: NormalizedNotification[] = rows
    .map((row) => {
      const createdAt = toIsoDateTime(row.created_at);
      const createdAtIso = createdAt ?? new Date().toISOString();
      const primaryDate = toIsoDate(row.date);
      const fallbackDate = primaryDate ?? createdAtIso.slice(0, 10);

      return {
        id: Number(row.id),
        studentId: String(row.student_id ?? "").trim(),
        subject: row.subject,
        date: fallbackDate,
        message: row.message,
        status: row.status,
        createdAt: createdAtIso,
      } satisfies NormalizedNotification;
    })
    .filter((notification) => {
      const isAbsenceNotification = notification.message
        .toLowerCase()
        .startsWith("dear parent, your child was marked absent on");

      if (!isAbsenceNotification) {
        return true;
      }

      return validAbsenceKeys.has(buildNotificationKey(notification.studentId, notification.subject, notification.date));
    });

  const derivedNotifications = await buildApprovedActivityNotifications();

  const combined = [...baseNotifications, ...derivedNotifications];

  combined.sort((a, b) => {
    const aTime = parseDateValue(a.createdAt)?.getTime() ?? Number.NEGATIVE_INFINITY;
    const bTime = parseDateValue(b.createdAt)?.getTime() ?? Number.NEGATIVE_INFINITY;
    return bTime - aTime;
  });

  const unreadCount = baseNotifications.reduce(
    (count, notification) => count + (notification.status === "unread" ? 1 : 0),
    0,
  );

  return NextResponse.json({ success: true, notifications: combined, unreadCount });
}

type PatchPayload = {
  id?: number | string | null;
  markAll?: boolean | null;
};

export async function PATCH(request: NextRequest) {
  try {
    const session = await getParentSessionFromCookies();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await ensureNotificationsTable();

    const studentIds = await resolveParentStudentIds(session.userId);
    if (!studentIds.length) {
      return NextResponse.json({ success: true, affectedRows: 0 });
    }

    const placeholders = studentIds.map(() => "?").join(",");
    const payload = (await request.json().catch(() => null)) as PatchPayload | null;
    const noteId = Number(payload?.id ?? NaN);

    if (Number.isFinite(noteId) && noteId > 0) {
      await query(
        `UPDATE parent_notifications
         SET status = 'read'
         WHERE id = ?
           AND status = 'unread'
           AND student_id IN (${placeholders})`,
        [noteId, ...studentIds],
      );

      return NextResponse.json({ success: true, mode: "single" });
    }

    if (payload?.markAll === false) {
      return NextResponse.json({ success: false, error: "Nothing to update." }, { status: 400 });
    }

    await query(
      `UPDATE parent_notifications
       SET status = 'read'
       WHERE status = 'unread'
         AND student_id IN (${placeholders})`,
      [...studentIds],
    );

    return NextResponse.json({ success: true, mode: "all" });
  } catch (error) {
    console.error("Failed to update parent notifications", error);
    return NextResponse.json({ success: false, error: "Unable to update notifications." }, { status: 500 });
  }
}

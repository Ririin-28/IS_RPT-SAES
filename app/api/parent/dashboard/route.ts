import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

const PHONEMIC_LEVEL_TABLE = "phonemic_level" as const;
const STUDENT_SUBJECT_ASSESSMENT_TABLE = "student_subject_assessment" as const;
const STUDENT_PHONEMIC_HISTORY_TABLE = "student_phonemic_history" as const;
const STUDENT_REMEDIAL_SESSION_TABLE = "student_remedial_session" as const;
const STUDENT_REMEDIAL_FLASHCARD_PERFORMANCE_TABLE = "student_remedial_flashcard_performance" as const;
const STUDENT_TEACHER_ASSIGNMENT_TABLE = "student_teacher_assignment" as const;
const TEACHER_TABLE = "teacher" as const;
const USERS_TABLE = "users" as const;

// const SCHEDULE_DAYS = [
//   { key: "monday_subject", label: "Monday" },
//   { key: "tuesday_subject", label: "Tuesday" },
//   { key: "wednesday_subject", label: "Wednesday" },
//   { key: "thursday_subject", label: "Thursday" },
//   { key: "friday_subject", label: "Friday" },
// ] as const;

type ParentRow = RowDataPacket & {
  parent_id: string | number;
  student_id: string | number;
  relationship: string | null;
};

type ChildRow = RowDataPacket & {
  student_id: string | number;
  relationship: string | null;
  grade_id: number | null;
  section: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
};

type StudentRow = {
  student_id: string | number;
  grade_id: number | null;
  section: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
};

type AttendanceRowDb = RowDataPacket & {
  date: string | Date | null;
  subject: string | null;
  status: string | null;
};

type AttendanceRow = {
  date: string | Date | null;
  subject: string | null;
  status: string | null;
};

type WeeklyScheduleRow = RowDataPacket & {
  day_of_week: string | null;
  subject_id: number | null;
  start_time: string | null;
  end_time: string | null;
};

type AttendanceRecord = {
  date: string;
  subject: string | null;
  present: boolean;
};

type AttendanceSummary = {
  records: AttendanceRecord[];
  totalSessions: number;
  presentSessions: number;
  absentSessions: number;
  attendanceRate: number | null;
};

type ScheduleEntry = {
  day: string;
  subject: string;
  timeRange: string | null;
};

const SUBJECT_TABLE_CANDIDATES = ["subject", "subjects"] as const;

const TEACHER_IDENTIFIER_COLUMNS = ["teacher_id", "id", "employee_id", "faculty_id", "user_code"] as const;
const TEACHER_NAME_COLUMNS = ["name", "full_name", "teacher_name"] as const;
const NAME_COLUMNS = ["first_name", "middle_name", "last_name"] as const;
const USER_NAME_COLUMNS = ["name", "full_name", "display_name"] as const;
const USER_FIRST_COLUMNS = ["first_name"] as const;
const USER_MIDDLE_COLUMNS = ["middle_name"] as const;
const USER_LAST_COLUMNS = ["last_name"] as const;
const USER_EMAIL_COLUMNS = ["email"] as const;
const PHONEMIC_LABEL_COLUMNS = [
  "phonemic_level_name",
  "phonemic_level",
  "level_name",
  "name",
  "level",
] as const;
const PHONEMIC_ORDER_COLUMNS = [
  "level_order",
  "order",
  "rank",
  "sequence",
  "level_rank",
  "sort_order",
] as const;
const SESSION_TEACHER_COMMENT_COLUMNS = [
  "teacher_comment",
  "teacher_comments",
  "teacher_remarks",
  "remarks",
  "teacher_feedback",
] as const;

type SubjectProgressPayload = {
  currentLevel: string;
  startingLevel: string;
  improvement: string;
  teacherComments: string;
  aiRecommendation: string;
  teacher: string;
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

  const lowerLookup = new Map<string, string>();
  for (const column of columns) {
    lowerLookup.set(column.toLowerCase(), column);
  }

  for (const candidate of candidates) {
    const resolved = lowerLookup.get(candidate.toLowerCase());
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

const sanitizeText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const buildName = (first?: unknown, middle?: unknown, last?: unknown): string | null => {
  const safeFirst = sanitizeText(first);
  const safeLast = sanitizeText(last);
  const middleText = sanitizeText(middle);
  const middleInitial = middleText ? `${middleText[0].toUpperCase()}.` : null;
  const parts = [safeFirst, middleInitial, safeLast].filter(Boolean) as string[];
  return parts.length ? parts.join(" ") : null;
};

const parseDateValue = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const candidate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
};

function formatTimeValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = new Date(`1970-01-01T${trimmed}`);
  if (!Number.isNaN(candidate.getTime())) {
    return candidate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return trimmed;
}

function buildTimeRange(startTime: string | null, endTime: string | null): string | null {
  const start = formatTimeValue(startTime);
  const end = formatTimeValue(endTime);
  if (start && end) {
    return `${start} - ${end}`;
  }
  return start ?? end ?? null;
}

function normalizeDate(value: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const candidate = new Date(trimmed);
  if (!Number.isNaN(candidate.getTime())) {
    return candidate.toISOString().slice(0, 10);
  }
  return trimmed.slice(0, 10);
}

function mapAttendance(rows: AttendanceRow[]): AttendanceSummary {
  const records: AttendanceRecord[] = [];

  for (const row of rows) {
    const date = normalizeDate(row.date);
    if (!date) continue;
    const status = String(row.status ?? "").toLowerCase();
    const present = status !== "absent" && status !== "";
    records.push({
      date,
      subject: row.subject,
      present,
    });
  }

  const totalSessions = records.length;
  const presentSessions = records.filter((record) => record.present).length;
  const absentSessions = totalSessions - presentSessions;
  const attendanceRate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : null;

  return {
    records,
    totalSessions,
    presentSessions,
    absentSessions,
    attendanceRate,
  };
}

function dedupeAttendanceByDate(rows: AttendanceRow[]): AttendanceRow[] {
  const priority: Record<string, number> = {
    absent: 4,
    late: 3,
    excused: 2,
    present: 1,
  };

  const map = new Map<string, { status: string; subjects: Set<string> }>();

  for (const row of rows) {
    const date = normalizeDate(row.date);
    if (!date) continue;
    const status = String(row.status ?? "").toLowerCase();
    const subject = row.subject ?? null;
    const current = map.get(date);
    if (!current) {
      const subjects = new Set<string>();
      if (subject) subjects.add(subject);
      map.set(date, { status, subjects });
      continue;
    }
    if (subject) current.subjects.add(subject);
    const currentScore = priority[current.status] ?? 0;
    const nextScore = priority[status] ?? 0;
    if (nextScore > currentScore) {
      current.status = status;
    }
  }

  const records: AttendanceRow[] = [];
  for (const [date, value] of map.entries()) {
    let subject: string | null = null;
    if (value.subjects.size === 1) {
      subject = Array.from(value.subjects)[0];
    } else if (value.subjects.size > 1) {
      subject = "Multiple Subjects";
    }
    records.push({ date, subject, status: value.status });
  }

  records.sort((a, b) => {
    const left = normalizeDate(a.date) ?? "";
    const right = normalizeDate(b.date) ?? "";
    return left.localeCompare(right);
  });

  return records;
}

function buildSchedule(rows: WeeklyScheduleRow[], subjectMap: Map<number, string>): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];

  for (const row of rows) {
    const day = row.day_of_week ? String(row.day_of_week) : "";
    if (!day) continue;
    const subjectId = row.subject_id ?? null;
    const subject = subjectId && subjectMap.has(subjectId)
      ? subjectMap.get(subjectId)!
      : subjectId
      ? `Subject ${subjectId}`
      : "";
    if (!subject) continue;
    const timeRange = buildTimeRange(row.start_time ?? null, row.end_time ?? null);
    entries.push({ day, subject, timeRange });
  }

  return entries;
}

async function fetchSubjectMap(): Promise<Map<number, string>> {
  for (const table of SUBJECT_TABLE_CANDIDATES) {
    try {
      const columns = await getTableColumns(table);
      const idCol = columns.has("subject_id") ? "subject_id" : columns.has("id") ? "id" : null;
      const nameCol = columns.has("subject_name") ? "subject_name" : columns.has("name") ? "name" : null;
      if (!idCol || !nameCol) continue;
      const [rows] = await query<RowDataPacket[]>(
        `SELECT ${idCol} AS subject_id, ${nameCol} AS subject_name FROM ${table}`,
      );
      const map = new Map<number, string>();
      for (const row of rows) {
        const id = Number(row.subject_id);
        const name = typeof row.subject_name === "string" ? row.subject_name.trim() : "";
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
}

async function fetchPhonemicLevels(): Promise<Map<number, { label: string; order: number }>> {
  const columns = await safeGetColumns(PHONEMIC_LEVEL_TABLE);
  if (!columns.size) return new Map();

  const idColumn = columns.has("phonemic_id") ? "phonemic_id" : columns.has("id") ? "id" : null;
  if (!idColumn) return new Map();

  const labelColumn = pickColumn(columns, PHONEMIC_LABEL_COLUMNS);
  const orderColumn = pickColumn(columns, PHONEMIC_ORDER_COLUMNS);
  const selectParts = [
    `${idColumn} AS phonemic_id`,
    labelColumn ? `${labelColumn} AS label` : "NULL AS label",
    orderColumn ? `${orderColumn} AS sort_order` : "NULL AS sort_order",
  ];

  const [rows] = await query<RowDataPacket[]>(
    `SELECT ${selectParts.join(", ")} FROM ${PHONEMIC_LEVEL_TABLE}`,
  );

  const map = new Map<number, { label: string; order: number }>();
  for (const row of rows ?? []) {
    const id = Number(row.phonemic_id);
    if (!Number.isFinite(id)) continue;
    const label = sanitizeText(row.label) ?? `Level ${id}`;
    const order = orderColumn ? Number(row.sort_order) : id;
    map.set(id, { label, order: Number.isFinite(order) ? order : id });
  }

  return map;
}

async function fetchTeacherNames(
  teacherIds: string[],
  teacherColumns: Set<string>,
  userColumns: Set<string>,
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  if (!teacherIds.length || !teacherColumns.size) return resolved;

  const teacherIdColumn = pickColumn(teacherColumns, TEACHER_IDENTIFIER_COLUMNS);
  if (!teacherIdColumn) return resolved;

  const nameColumn = pickColumn(teacherColumns, TEACHER_NAME_COLUMNS);
  const firstNameColumn = pickColumn(teacherColumns, [NAME_COLUMNS[0]]);
  const middleNameColumn = pickColumn(teacherColumns, [NAME_COLUMNS[1]]);
  const lastNameColumn = pickColumn(teacherColumns, [NAME_COLUMNS[2]]);
  const userIdColumn = teacherColumns.has("user_id") ? "user_id" : null;

  const userNameColumn = pickColumn(userColumns, USER_NAME_COLUMNS);
  const userFirstColumn = pickColumn(userColumns, USER_FIRST_COLUMNS);
  const userMiddleColumn = pickColumn(userColumns, USER_MIDDLE_COLUMNS);
  const userLastColumn = pickColumn(userColumns, USER_LAST_COLUMNS);
  const userEmailColumn = pickColumn(userColumns, USER_EMAIL_COLUMNS);

  const selectParts = [
    `t.${teacherIdColumn} AS teacher_identifier`,
    nameColumn ? `t.${nameColumn} AS teacher_name` : "NULL AS teacher_name",
    firstNameColumn ? `t.${firstNameColumn} AS teacher_first_name` : "NULL AS teacher_first_name",
    middleNameColumn ? `t.${middleNameColumn} AS teacher_middle_name` : "NULL AS teacher_middle_name",
    lastNameColumn ? `t.${lastNameColumn} AS teacher_last_name` : "NULL AS teacher_last_name",
  ];

  if (userIdColumn) {
    selectParts.push(`t.${userIdColumn} AS user_id`);
  }

  const joinUsers = Boolean(userIdColumn && userColumns.has("user_id"));
  if (joinUsers) {
    selectParts.push(
      userNameColumn ? `u.${userNameColumn} AS user_name` : "NULL AS user_name",
      userFirstColumn ? `u.${userFirstColumn} AS user_first_name` : "NULL AS user_first_name",
      userMiddleColumn ? `u.${userMiddleColumn} AS user_middle_name` : "NULL AS user_middle_name",
      userLastColumn ? `u.${userLastColumn} AS user_last_name` : "NULL AS user_last_name",
      userEmailColumn ? `u.${userEmailColumn} AS user_email` : "NULL AS user_email",
    );
  }

  const placeholders = teacherIds.map(() => "?").join(", ");
  const sql = `
    SELECT ${selectParts.join(", ")}
    FROM ${TEACHER_TABLE} t
    ${joinUsers ? `LEFT JOIN ${USERS_TABLE} u ON u.user_id = t.${userIdColumn}` : ""}
    WHERE t.${teacherIdColumn} IN (${placeholders})
  `;

  const [rows] = await query<RowDataPacket[]>(sql, teacherIds);
  for (const row of rows ?? []) {
    const teacherId = sanitizeText(row.teacher_identifier);
    if (!teacherId) continue;
    const teacherName =
      buildName(row.user_first_name, row.user_middle_name, row.user_last_name) ??
      buildName(row.teacher_first_name, row.teacher_middle_name, row.teacher_last_name) ??
      sanitizeText(row.teacher_name) ??
      sanitizeText(row.user_name) ??
      sanitizeText(row.user_email) ??
      `Teacher ${teacherId}`;
    resolved.set(teacherId, teacherName);
  }

  return resolved;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userIdParam = url.searchParams.get("userId");
  const selectedStudentIdParam = url.searchParams.get("studentId");

  if (!userIdParam) {
    return NextResponse.json({ error: "Missing userId query parameter" }, { status: 400 });
  }

  const userId = Number(userIdParam);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  try {
    const [parentRows] = await query<ParentRow[]>(
      `SELECT parent_id FROM parent WHERE user_id = ? LIMIT 1`,
      [userId],
    );

    if (parentRows.length === 0) {
      return NextResponse.json({ error: "Parent profile not found" }, { status: 404 });
    }

    const parent = parentRows[0];

    const [childRows] = await query<ChildRow[]>(
      `SELECT ps.student_id, ps.relationship, s.grade_id, s.section,
              s.first_name, s.middle_name, s.last_name
       FROM parent_student ps
       JOIN student s ON s.student_id = ps.student_id
       WHERE ps.parent_id = ?
       ORDER BY ps.parent_student_id ASC`,
      [parent.parent_id],
    );

    if (childRows.length === 0) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const normalizedSelectedId = selectedStudentIdParam ? selectedStudentIdParam.trim() : "";
    const selectedChild = normalizedSelectedId
      ? childRows.find((child) => String(child.student_id) === normalizedSelectedId)
      : childRows[0];

    if (!selectedChild) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const student: StudentRow = {
      student_id: selectedChild.student_id,
      grade_id: selectedChild.grade_id,
      section: selectedChild.section,
      first_name: selectedChild.first_name,
      middle_name: selectedChild.middle_name,
      last_name: selectedChild.last_name,
    };

    const subjectMap = await fetchSubjectMap();
    const phonemicLevels = await fetchPhonemicLevels();

    const [attendanceRows] = await query<AttendanceRowDb[]>(
      `SELECT sess.session_date AS date, sess.subject_id AS subject_id, ar.status AS status
       FROM attendance_record ar
       JOIN attendance_session sess ON sess.session_id = ar.session_id
       WHERE ar.student_id = ?
       ORDER BY sess.session_date ASC`,
      [student.student_id],
    );

    const attendance = mapAttendance(
      dedupeAttendanceByDate(
        attendanceRows.map((row) => ({
          date: row.date,
          status: row.status,
          subject: row.subject_id
            ? subjectMap.get(Number(row.subject_id)) ?? `Subject ${row.subject_id}`
            : null,
        })) as AttendanceRow[],
      ),
    );

    const [scheduleRows] = await query<WeeklyScheduleRow[]>(
      `SELECT day_of_week, subject_id, start_time, end_time
       FROM weekly_subject_schedule`,
    );

    const schedule = buildSchedule(scheduleRows, subjectMap);

    const assessmentColumns = await safeGetColumns(STUDENT_SUBJECT_ASSESSMENT_TABLE);
    const historyColumns = await safeGetColumns(STUDENT_PHONEMIC_HISTORY_TABLE);
    const sessionColumns = await safeGetColumns(STUDENT_REMEDIAL_SESSION_TABLE);
    const performanceColumns = await safeGetColumns(STUDENT_REMEDIAL_FLASHCARD_PERFORMANCE_TABLE);
    const assignmentColumns = await safeGetColumns(STUDENT_TEACHER_ASSIGNMENT_TABLE);
    const teacherColumns = await safeGetColumns(TEACHER_TABLE);
    const userColumns = await safeGetColumns(USERS_TABLE);

    const subjectIds = new Set<number>();

    const assessmentRows: RowDataPacket[] = [];
    if (assessmentColumns.has("student_id") && assessmentColumns.has("subject_id") && assessmentColumns.has("phonemic_id")) {
      const assessedAtColumn = assessmentColumns.has("assessed_at") ? "assessed_at" : null;
      const selectParts = [
        "subject_id",
        "phonemic_id",
        assessedAtColumn ? `${assessedAtColumn} AS assessed_at` : "NULL AS assessed_at",
      ];
      const [rows] = await query<RowDataPacket[]>(
        `SELECT ${selectParts.join(", ")}
         FROM ${STUDENT_SUBJECT_ASSESSMENT_TABLE}
         WHERE student_id = ?`,
        [student.student_id],
      );
      rows.forEach((row) => {
        const subjectId = Number(row.subject_id);
        if (Number.isFinite(subjectId)) subjectIds.add(subjectId);
        assessmentRows.push(row);
      });
    }

    const historyRows: RowDataPacket[] = [];
    if (historyColumns.has("student_id") && historyColumns.has("subject_id") && historyColumns.has("phonemic_id")) {
      const achievedAtColumn = historyColumns.has("achieved_at") ? "achieved_at" : null;
      const selectParts = [
        "subject_id",
        "phonemic_id",
        achievedAtColumn ? `${achievedAtColumn} AS achieved_at` : "NULL AS achieved_at",
      ];
      const [rows] = await query<RowDataPacket[]>(
        `SELECT ${selectParts.join(", ")}
         FROM ${STUDENT_PHONEMIC_HISTORY_TABLE}
         WHERE student_id = ?
         ORDER BY ${achievedAtColumn ?? "phonemic_id"} ASC`,
        [student.student_id],
      );
      rows.forEach((row) => {
        const subjectId = Number(row.subject_id);
        if (Number.isFinite(subjectId)) subjectIds.add(subjectId);
        historyRows.push(row);
      });
    }

    const sessionRows: RowDataPacket[] = [];
    if (sessionColumns.has("student_id") && sessionColumns.has("subject_id")) {
      const commentColumn = pickColumn(sessionColumns, SESSION_TEACHER_COMMENT_COLUMNS);
      const selectParts = [
        "session_id",
        "subject_id",
        sessionColumns.has("phonemic_id") ? "phonemic_id" : "NULL AS phonemic_id",
        sessionColumns.has("ai_remarks") ? "ai_remarks" : "NULL AS ai_remarks",
        sessionColumns.has("completed_at") ? "completed_at" : "NULL AS completed_at",
        sessionColumns.has("created_at") ? "created_at" : "NULL AS created_at",
        commentColumn ? `${commentColumn} AS teacher_comment` : "NULL AS teacher_comment",
      ];
      const performanceFilter = performanceColumns.has("session_id")
        ? `AND EXISTS (SELECT 1 FROM ${STUDENT_REMEDIAL_FLASHCARD_PERFORMANCE_TABLE} p WHERE p.session_id = s.session_id)`
        : "";
      const [rows] = await query<RowDataPacket[]>(
        `SELECT ${selectParts.join(", ")}
         FROM ${STUDENT_REMEDIAL_SESSION_TABLE} s
         WHERE s.student_id = ?
         ${performanceFilter}
         ORDER BY COALESCE(s.completed_at, s.created_at) DESC`,
        [student.student_id],
      );
      rows.forEach((row) => {
        const subjectId = Number(row.subject_id);
        if (Number.isFinite(subjectId)) subjectIds.add(subjectId);
        sessionRows.push(row);
      });
    }

    const assignmentRows: RowDataPacket[] = [];
    if (assignmentColumns.has("student_id") && assignmentColumns.has("subject_id") && assignmentColumns.has("teacher_id")) {
      const isActiveColumn = assignmentColumns.has("is_active") ? "is_active" : null;
      const assignedDateColumn = assignmentColumns.has("assigned_date")
        ? "assigned_date"
        : assignmentColumns.has("created_at")
          ? "created_at"
          : assignmentColumns.has("updated_at")
            ? "updated_at"
            : null;
      const selectParts = [
        "subject_id",
        "teacher_id",
        assignedDateColumn ? `${assignedDateColumn} AS assigned_date` : "NULL AS assigned_date",
      ];
      const [rows] = await query<RowDataPacket[]>(
        `SELECT ${selectParts.join(", ")}
         FROM ${STUDENT_TEACHER_ASSIGNMENT_TABLE}
         WHERE student_id = ?
         ${isActiveColumn ? `AND ${isActiveColumn} = 1` : ""}
         ORDER BY ${assignedDateColumn ?? "subject_id"} DESC`,
        [student.student_id],
      );
      rows.forEach((row) => {
        const subjectId = Number(row.subject_id);
        if (Number.isFinite(subjectId)) subjectIds.add(subjectId);
        assignmentRows.push(row);
      });
    }

    const orderedSubjectIds = Array.from(subjectIds).filter(Number.isFinite).sort((a, b) => a - b);
    const subjects = orderedSubjectIds.map((subjectId) => subjectMap.get(subjectId) ?? `Subject ${subjectId}`);

    const assignmentBySubject = new Map<number, string>();
    for (const row of assignmentRows) {
      const subjectId = Number(row.subject_id);
      const teacherId = sanitizeText(row.teacher_id);
      if (!Number.isFinite(subjectId) || !teacherId) continue;
      if (!assignmentBySubject.has(subjectId)) {
        assignmentBySubject.set(subjectId, teacherId);
      }
    }

    const teacherNames = await fetchTeacherNames(
      Array.from(new Set(Array.from(assignmentBySubject.values()))),
      teacherColumns,
      userColumns,
    );

    const historyBySubject = new Map<number, Array<{ phonemicId: number; achievedAt: Date | null }>>();
    for (const row of historyRows) {
      const subjectId = Number(row.subject_id);
      const phonemicId = Number(row.phonemic_id);
      if (!Number.isFinite(subjectId) || !Number.isFinite(phonemicId)) continue;
      const achievedAt = parseDateValue(row.achieved_at ?? null);
      const list = historyBySubject.get(subjectId) ?? [];
      list.push({ phonemicId, achievedAt });
      historyBySubject.set(subjectId, list);
    }
    historyBySubject.forEach((list) => {
      list.sort((a, b) => {
        const left = a.achievedAt?.getTime() ?? 0;
        const right = b.achievedAt?.getTime() ?? 0;
        return left - right;
      });
    });

    const assessmentBySubject = new Map<number, Array<{ phonemicId: number; assessedAt: Date | null }>>();
    for (const row of assessmentRows) {
      const subjectId = Number(row.subject_id);
      const phonemicId = Number(row.phonemic_id);
      if (!Number.isFinite(subjectId) || !Number.isFinite(phonemicId)) continue;
      const assessedAt = parseDateValue(row.assessed_at ?? null);
      const list = assessmentBySubject.get(subjectId) ?? [];
      list.push({ phonemicId, assessedAt });
      assessmentBySubject.set(subjectId, list);
    }
    assessmentBySubject.forEach((list) => {
      list.sort((a, b) => {
        const left = a.assessedAt?.getTime() ?? 0;
        const right = b.assessedAt?.getTime() ?? 0;
        return left - right;
      });
    });

    const sessionBySubject = new Map<number, RowDataPacket>();
    for (const row of sessionRows) {
      const subjectId = Number(row.subject_id);
      if (!Number.isFinite(subjectId)) continue;
      if (!sessionBySubject.has(subjectId)) {
        sessionBySubject.set(subjectId, row);
      }
    }

    const resolveLevelLabel = (phonemicId: number | null): string => {
      if (phonemicId === null || !Number.isFinite(phonemicId)) return "—";
      return phonemicLevels.get(phonemicId)?.label ?? `Level ${phonemicId}`;
    };

    const resolveLevelOrder = (phonemicId: number | null): number | null => {
      if (phonemicId === null || !Number.isFinite(phonemicId)) return null;
      return phonemicLevels.get(phonemicId)?.order ?? phonemicId;
    };

    const progressDetails: Record<string, SubjectProgressPayload> = {};
    const currentLevelBySubject: Record<string, string> = {};

    for (const subjectId of orderedSubjectIds) {
      const subjectName = subjectMap.get(subjectId) ?? `Subject ${subjectId}`;
      if (!subjectName) continue;

      const history = historyBySubject.get(subjectId) ?? [];
      const assessments = assessmentBySubject.get(subjectId) ?? [];
      const session = sessionBySubject.get(subjectId);

      const startingPhonemicId = history.length
        ? history[0].phonemicId
        : assessments.length
          ? assessments[0].phonemicId
          : Number(session?.phonemic_id ?? NaN);

      const latestPhonemicId = history.length
        ? history[history.length - 1].phonemicId
        : Number(session?.phonemic_id ?? assessments[assessments.length - 1]?.phonemicId ?? NaN);

      const startingLabel = resolveLevelLabel(Number.isFinite(startingPhonemicId) ? startingPhonemicId : null);
      const currentLabel = resolveLevelLabel(Number.isFinite(latestPhonemicId) ? latestPhonemicId : null);

      const startOrder = resolveLevelOrder(Number.isFinite(startingPhonemicId) ? startingPhonemicId : null);
      const currentOrder = resolveLevelOrder(Number.isFinite(latestPhonemicId) ? latestPhonemicId : null);
      const improvementCount =
        startOrder !== null && currentOrder !== null ? Math.max(0, currentOrder - startOrder) : null;
      const improvement =
        improvementCount === null
          ? "—"
          : `${improvementCount} level${improvementCount === 1 ? "" : "s"}`;

      const teacherId = assignmentBySubject.get(subjectId) ?? null;
      const teacherName = teacherId ? teacherNames.get(teacherId) ?? `Teacher ${teacherId}` : "—";

      const aiRecommendation = sanitizeText(session?.ai_remarks) ?? "—";
      const teacherComments = sanitizeText(session?.teacher_comment) ?? "—";

      progressDetails[subjectName] = {
        currentLevel: currentLabel,
        startingLevel: startingLabel,
        improvement,
        teacherComments,
        aiRecommendation,
        teacher: teacherName,
      };
      currentLevelBySubject[subjectName] = currentLabel;
    }

    return NextResponse.json({
      parent: {
        parentId: parent.parent_id,
        relationship: selectedChild.relationship,
      },
      children: childRows.map((child) => ({
        studentId: String(child.student_id),
        userId: 0,
        firstName: child.first_name ?? "",
        middleName: child.middle_name,
        lastName: child.last_name ?? "",
        grade: child.grade_id != null ? `Grade ${child.grade_id}` : null,
        section: child.section,
        relationship: child.relationship,
        subjects: [],
      })),
      child: {
        studentId: String(student.student_id),
        firstName: student.first_name ?? "",
        middleName: student.middle_name,
        lastName: student.last_name ?? "",
        grade: student.grade_id != null ? `Grade ${student.grade_id}` : null,
        section: student.section,
        relationship: selectedChild.relationship,
        subjects,
        currentLevel: currentLevelBySubject,
        progressDetails,
      },
      attendance,
      schedule,
    });
  } catch (error) {
    console.error("Failed to load parent dashboard data", error);
    return NextResponse.json({ error: "Failed to load parent dashboard data" }, { status: 500 });
  }
}

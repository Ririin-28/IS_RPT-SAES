import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, runWithConnection } from "@/lib/db";
import { getTeacherSessionFromCookies } from "@/lib/server/teacher-session";

export const dynamic = "force-dynamic";

const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
const WEEKLY_SUBJECT_TABLE = "weekly_subject_schedule";
const ATTENDANCE_SESSION_TABLE = "attendance_session";
const ATTENDANCE_RECORD_TABLE = "attendance_record";
const PARENT_NOTIFICATIONS_TABLE = "parent_notifications";
const SUBJECT_TABLE_CANDIDATES = ["subject", "subjects"] as const;
const STUDENT_TEACHER_ASSIGNMENT_TABLE = "student_teacher_assignment";
const TEACHER_TABLE = "teacher";

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type NormalizedEntry = { studentId: string; date: string; present: "Yes" | "No" | null };

const resolveSchoolYear = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return month >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const parseIsoDate = (value: unknown): { year: number; month: number; day: number; iso: string } | null => {
  if (!value) return null;
  const text = String(value).trim();
  if (!ISO_DATE_REGEX.test(text)) return null;
  const match = ISO_DATE_REGEX.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day, iso: `${match[1]}-${match[2]}-${match[3]}` };
};

const sanitizeSubjectKey = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === "math" || trimmed === "mathematics") return "Math";
  if (trimmed === "english") return "English";
  if (trimmed === "filipino") return "Filipino";
  return null;
};

const resolveSubjectLookup = async () => {
  for (const table of SUBJECT_TABLE_CANDIDATES) {
    const columns = await getTableColumns(table).catch(() => new Set<string>());
    if (!columns.size) continue;
    const idCol = columns.has("subject_id") ? "subject_id" : columns.has("id") ? "id" : null;
    const nameCol = columns.has("subject_name") ? "subject_name" : columns.has("name") ? "name" : null;
    if (idCol && nameCol) {
      return { table, idCol, nameCol };
    }
  }
  return null;
};

const resolveSubjectId = async (subjectLabel: string): Promise<number | null> => {
  const lookup = await resolveSubjectLookup();
  if (!lookup) return null;
  const [rows] = await query<RowDataPacket[]>(
    `SELECT ${lookup.idCol} AS subject_id FROM ${lookup.table} WHERE LOWER(TRIM(${lookup.nameCol})) = LOWER(TRIM(?)) LIMIT 1`,
    [subjectLabel],
  );
  if (!rows.length) return null;
  const id = Number(rows[0]?.subject_id);
  return Number.isFinite(id) ? id : null;
};

const loadRemedialMonths = async (): Promise<Set<number>> => {
  const schoolYear = resolveSchoolYear();
  const [rows] = await query<RowDataPacket[]>(
    `SELECT start_month, end_month FROM ${REMEDIAL_QUARTER_TABLE} WHERE school_year = ?`,
    [schoolYear],
  );
  const months = new Set<number>();
  for (const row of rows) {
    const start = Number(row.start_month);
    const end = Number(row.end_month);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start < 1 || end < 1) continue;
    if (start > end) continue;
    for (let m = start; m <= end; m += 1) {
      if (m >= 1 && m <= 12) months.add(m);
    }
  }
  return months;
};

const loadAllowedWeekdays = async (subjectId: number): Promise<Set<string>> => {
  const [rows] = await query<RowDataPacket[]>(
    `SELECT day_of_week FROM ${WEEKLY_SUBJECT_TABLE} WHERE subject_id = ?`,
    [subjectId],
  );
  const days = new Set<string>();
  for (const row of rows) {
    const value = row.day_of_week ? String(row.day_of_week).trim() : "";
    if (value) days.add(value);
  }
  return days;
};

const isAllowedDate = (iso: string, months: Set<number>, weekdays: Set<string>): boolean => {
  const parsed = parseIsoDate(iso);
  if (!parsed) return false;
  if (!months.has(parsed.month)) return false;
  const date = new Date(parsed.iso + "T00:00:00");
  const weekday = WEEKDAY_LABELS[date.getDay()];
  return weekdays.size === 0 ? false : weekdays.has(weekday);
};

const formatAbsentDate = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${weekday}, ${month}-${day}-${year}`;
};

type StudentNameRow = RowDataPacket & {
  student_id: string | number;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix?: string | null;
};

const buildStudentName = (row: StudentNameRow | undefined): string => {
  if (!row) return "";
  const parts = [row.first_name, row.middle_name, row.last_name, row.suffix]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return parts.join(" ").trim();
};

const buildParentAbsentMessage = (_studentName: string, iso: string): string => {
  const dateLabel = formatAbsentDate(iso);
  return `Dear Parent, your child was marked absent on ${dateLabel}.`;
};

const loadStudentNameMap = async (
  connection: import("mysql2/promise").PoolConnection,
  studentIds: string[],
): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  const uniqueIds = Array.from(new Set(studentIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return map;
  }

  const [rows] = await connection.query<StudentNameRow[]>(
    `SELECT student_id, first_name, middle_name, last_name, suffix
     FROM student
     WHERE student_id IN (${uniqueIds.map(() => "?").join(",")})`,
    uniqueIds,
  );

  for (const row of rows) {
    const id = row.student_id ? String(row.student_id).trim() : "";
    if (!id) continue;
    const name = buildStudentName(row);
    if (name) {
      map.set(id, name);
    }
  }

  return map;
};

const normalizeEntries = async (entries: unknown): Promise<NormalizedEntry[]> => {
  if (!Array.isArray(entries)) return [];

  const normalized: NormalizedEntry[] = [];
  const studentIdMap = new Map<number, string>();

  const numericIds: number[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const studentId = Number((entry as { studentId?: unknown }).studentId);
    if (Number.isFinite(studentId) && studentId > 0) {
      numericIds.push(studentId);
    }
  }

  if (numericIds.length > 0) {
    const studentColumns = await getTableColumns("student").catch(() => new Set<string>());

    if (studentColumns.has("student_id")) {
      const numericStrings = numericIds.map((id) => String(id));
      const [rows] = await query<RowDataPacket[]>(
        `SELECT student_id FROM student WHERE student_id IN (${numericStrings.map(() => "?").join(",")})`,
        numericStrings,
      );
      for (const row of rows) {
        const studentId = row.student_id ? String(row.student_id).trim() : "";
        const numeric = Number(studentId);
        if (studentId && Number.isFinite(numeric)) {
          studentIdMap.set(numeric, studentId);
        }
      }

      const paddedCandidates = numericIds.map((id) => `S-${String(id).padStart(5, "0")}`);
      const [paddedRows] = await query<RowDataPacket[]>(
        `SELECT student_id FROM student WHERE student_id IN (${paddedCandidates.map(() => "?").join(",")})`,
        paddedCandidates,
      );
      const candidateMap = new Map<string, number>();
      for (const id of numericIds) {
        candidateMap.set(`S-${String(id).padStart(5, "0")}`, id);
      }
      for (const row of paddedRows) {
        const studentId = row.student_id ? String(row.student_id).trim() : "";
        const numeric = candidateMap.get(studentId);
        if (numeric && studentId) {
          studentIdMap.set(numeric, studentId);
        }
      }
    }
  }

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const rawStudentId = (entry as { studentId?: unknown }).studentId;
    const studentIdText = String(rawStudentId ?? "").trim();
    if (!studentIdText) continue;

    const numericStudentId = Number(studentIdText);
    const actualStudentId = Number.isFinite(numericStudentId) && numericStudentId > 0
      ? studentIdMap.get(numericStudentId) ?? String(numericStudentId)
      : studentIdText;

    const parsedDate = parseIsoDate((entry as { date?: unknown }).date);
    if (!parsedDate) continue;

    const presentRaw = (entry as { present?: unknown }).present;
    let present: "Yes" | "No" | null = null;
    if (presentRaw === "Yes" || presentRaw === "No") {
      present = presentRaw;
    }

    normalized.push({ studentId: String(actualStudentId), date: parsedDate.iso, present });
  }

  return normalized;
};

const resolveStudentIdFilters = async (rawIds: string[]): Promise<string[]> => {
  const cleaned = rawIds.map((value) => value.trim()).filter((value) => value.length > 0);
  if (!cleaned.length) return [];

  const directIds: string[] = [];
  const numericIds: number[] = [];

  for (const value of cleaned) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0 && String(numeric) === value) {
      numericIds.push(numeric);
    } else {
      directIds.push(value);
    }
  }

  const resolved = new Set<string>(directIds);

  if (!numericIds.length) {
    return Array.from(resolved);
  }

  const studentColumns = await getTableColumns("student").catch(() => new Set<string>());
  if (!studentColumns.has("student_id")) {
    numericIds.forEach((id) => resolved.add(String(id)));
    return Array.from(resolved);
  }

  const numericStrings = numericIds.map((id) => String(id));
  const paddedCandidates = numericIds.map((id) => `S-${String(id).padStart(5, "0")}`);
  const candidates = Array.from(new Set([...numericStrings, ...paddedCandidates]));

  const [rows] = await query<RowDataPacket[]>(
    `SELECT student_id FROM student WHERE student_id IN (${candidates.map(() => "?").join(",")})`,
    candidates,
  );

  for (const row of rows) {
    const studentId = row.student_id ? String(row.student_id).trim() : "";
    if (studentId) resolved.add(studentId);
  }

  if (!rows.length) {
    numericIds.forEach((id) => resolved.add(String(id)));
  }

  return Array.from(resolved);
};

const ensureParentNotificationsTable = async () => {
  await query(
    `CREATE TABLE IF NOT EXISTS ${PARENT_NOTIFICATIONS_TABLE} (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id VARCHAR(20) NOT NULL,
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  );

  try {
    await query(`ALTER TABLE ${PARENT_NOTIFICATIONS_TABLE} MODIFY COLUMN student_id VARCHAR(20) NOT NULL`);
  } catch (error) {
    console.warn("Unable to alter parent_notifications.student_id column", error);
  }
};

const resolveTeacherId = async (userId: number | null): Promise<string | null> => {
  if (!userId || !Number.isFinite(userId)) return null;
  const [rows] = await query<RowDataPacket[]>(
    `SELECT teacher_id FROM ${TEACHER_TABLE} WHERE user_id = ? LIMIT 1`,
    [userId],
  );
  const value = rows[0]?.teacher_id;
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const resolveTeacherGradeId = async (subjectId: number, teacherId: string | null): Promise<number | null> => {
  if (!Number.isFinite(subjectId) || !teacherId) return null;

  const assignmentColumns = await getTableColumns(STUDENT_TEACHER_ASSIGNMENT_TABLE).catch(() => new Set<string>());
  if (!assignmentColumns.size || !assignmentColumns.has("grade_id") || !assignmentColumns.has("subject_id")) {
    return null;
  }

  const statusFilter = assignmentColumns.has("is_active") ? " AND is_active = 1" : "";

  const [rows] = await query<RowDataPacket[]>(
    `SELECT grade_id FROM ${STUDENT_TEACHER_ASSIGNMENT_TABLE}
     WHERE subject_id = ? AND teacher_id = ?${statusFilter}
     AND grade_id IS NOT NULL
     LIMIT 1`,
    [subjectId, teacherId],
  );

  const gradeId = Number(rows[0]?.grade_id);
  return Number.isFinite(gradeId) ? gradeId : null;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const subjectLabel = sanitizeSubjectKey(url.searchParams.get("subject"));
  const startRaw = url.searchParams.get("start");
  const endRaw = url.searchParams.get("end");
  const studentIdsParam = url.searchParams.get("studentIds");

  if (!subjectLabel) {
    return NextResponse.json({ success: false, error: "Invalid subject." }, { status: 400 });
  }

  const startDate = startRaw ? new Date(startRaw) : null;
  const endDate = endRaw ? new Date(endRaw) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ success: false, error: "Invalid start date." }, { status: 400 });
  }
  if (!endDate || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ success: false, error: "Invalid end date." }, { status: 400 });
  }

  const subjectId = await resolveSubjectId(subjectLabel);
  if (!subjectId) {
    return NextResponse.json({ success: true, records: [] });
  }

  const [allowedMonths, allowedWeekdays] = await Promise.all([
    loadRemedialMonths(),
    loadAllowedWeekdays(subjectId),
  ]);

  if (!allowedMonths.size || !allowedWeekdays.size) {
    return NextResponse.json({ success: true, records: [] });
  }

  const params: Array<string | number> = [subjectId, startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)];
  const monthPlaceholders = Array.from(allowedMonths).map(() => "?").join(",");
  const weekdayPlaceholders = Array.from(allowedWeekdays).map(() => "?").join(",");
  params.push(...Array.from(allowedMonths));
  params.push(...Array.from(allowedWeekdays));

  let sql = `
    SELECT r.student_id, DATE_FORMAT(s.session_date, '%Y-%m-%d') AS session_date, r.status
    FROM ${ATTENDANCE_RECORD_TABLE} r
    JOIN ${ATTENDANCE_SESSION_TABLE} s ON s.session_id = r.session_id
    WHERE s.subject_id = ?
      AND s.session_date BETWEEN ? AND ?
      AND MONTH(s.session_date) IN (${monthPlaceholders})
      AND DAYNAME(s.session_date) IN (${weekdayPlaceholders})
  `;

  const studentIds: string[] = [];
  if (studentIdsParam) {
    for (const part of studentIdsParam.split(",")) {
      const trimmed = part.trim();
      if (trimmed) {
        studentIds.push(trimmed);
      }
    }
  }
  if (studentIds.length) {
    const resolvedIds = await resolveStudentIdFilters(studentIds);
    if (resolvedIds.length) {
      sql += ` AND r.student_id IN (${resolvedIds.map(() => "?").join(",")})`;
      params.push(...resolvedIds);
    }
  }

  const [rows] = await query<RowDataPacket[]>(sql, params);
  const records = rows.map((row) => {
    const status = row.status ? String(row.status).toLowerCase() : "";
    const present = status === "absent" ? "No" : "Yes";
    const date = row.session_date ? String(row.session_date).slice(0, 10) : "";
    return {
      studentId: row.student_id ? String(row.student_id) : "",
      date,
      present,
    };
  });

  return NextResponse.json({ success: true, records });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, error: "Invalid payload." }, { status: 400 });
  }

  const subjectLabel = sanitizeSubjectKey((body as { subject?: unknown }).subject);
  if (!subjectLabel) {
    return NextResponse.json({ success: false, error: "Invalid subject." }, { status: 400 });
  }

  const entries = await normalizeEntries((body as { entries?: unknown }).entries);
  if (!entries.length) {
    return NextResponse.json({ success: true, updated: 0, reason: "No valid entries to process." });
  }

  const subjectId = await resolveSubjectId(subjectLabel);
  if (!subjectId) {
    return NextResponse.json({ success: true, updated: 0, reason: "Subject not found." });
  }

  const [allowedMonths, allowedWeekdays, session] = await Promise.all([
    loadRemedialMonths(),
    loadAllowedWeekdays(subjectId),
    getTeacherSessionFromCookies(),
  ]);

  if (!allowedMonths.size || !allowedWeekdays.size) {
    return NextResponse.json({
      success: true,
      updated: 0,
      reason: "Remedial schedule is not configured for this subject.",
    });
  }

  let teacherId = session?.teacherId ?? null;
  if (!teacherId) {
    teacherId = await resolveTeacherId(session?.userId ?? null);
  }

  if (!teacherId) {
    return NextResponse.json({ success: false, error: "Teacher assignment is missing." }, { status: 400 });
  }

  const gradeId = await resolveTeacherGradeId(subjectId, teacherId);
  if (!gradeId) {
    return NextResponse.json(
      { success: false, error: "Grade assignment is missing for this teacher." },
      { status: 400 },
    );
  }

  const createdBy = teacherId ?? (session?.userId ? String(session.userId) : "0");
  const sessionColumns = await getTableColumns(ATTENDANCE_SESSION_TABLE).catch(() => new Set<string>());

  const sessionIdByDate = new Map<string, number>();
  let updated = 0;
  let skippedNotAllowed = 0;
  let skippedNoSession = 0;

  await ensureParentNotificationsTable();

  await runWithConnection(async (connection) => {
    await connection.beginTransaction();
    try {
      const studentNameMap = await loadStudentNameMap(
        connection,
        entries.map((entry) => entry.studentId),
      );
      for (const entry of entries) {
        if (!isAllowedDate(entry.date, allowedMonths, allowedWeekdays)) {
          skippedNotAllowed += 1;
          continue;
        }

        let sessionId: number | undefined = sessionIdByDate.get(entry.date);
        if (!sessionId) {
          const [existingRows] = await connection.query<RowDataPacket[]>(
            `SELECT session_id FROM ${ATTENDANCE_SESSION_TABLE} 
             WHERE session_date = ? AND subject_id = ? AND grade_id = ? 
             LIMIT 1`,
            [entry.date, subjectId, gradeId],
          );
          const existingId = Number(existingRows?.[0]?.session_id);
          if (Number.isFinite(existingId) && existingId > 0) {
            sessionId = existingId;
          } else {
            const insertColumns: string[] = [];
            const insertValues: Array<string | number | null> = [];

            insertColumns.push("session_date");
            insertValues.push(entry.date);

            if (sessionColumns.has("grade_id")) {
              insertColumns.push("grade_id");
              insertValues.push(gradeId);
            }
            if (sessionColumns.has("subject_id")) {
              insertColumns.push("subject_id");
              insertValues.push(subjectId);
            }
            if (sessionColumns.has("week_id")) {
              insertColumns.push("week_id");
              insertValues.push(null);
            }
            if (sessionColumns.has("activity_id")) {
              insertColumns.push("activity_id");
              insertValues.push(null);
            }
            if (sessionColumns.has("created_by_user_id")) {
              insertColumns.push("created_by_user_id");
              insertValues.push(createdBy);
            }
            if (sessionColumns.has("approved_schedule_id")) {
              insertColumns.push("approved_schedule_id");
              insertValues.push(null);
            }

            const placeholders = insertColumns.map(() => "?").join(", ");
            const [result] = await connection.query<RowDataPacket[]>(
              `INSERT INTO ${ATTENDANCE_SESSION_TABLE} (${insertColumns.join(", ")}) VALUES (${placeholders})`,
              insertValues,
            );
            const insertId = Number((result as unknown as { insertId?: number }).insertId);
            sessionId = Number.isFinite(insertId) ? insertId : undefined;
          }

          if (sessionId) {
            sessionIdByDate.set(entry.date, sessionId);
          }
        }

        if (!sessionId) {
          skippedNoSession += 1;
          continue;
        }

        if (entry.present === null) {
          await connection.query(
            `DELETE FROM ${ATTENDANCE_RECORD_TABLE} WHERE session_id = ? AND student_id = ?`,
            [sessionId, entry.studentId],
          );
        } else {
          const status = entry.present === "Yes" ? "Present" : "Absent";
          await connection.query(
            `INSERT INTO ${ATTENDANCE_RECORD_TABLE} (session_id, student_id, status, remarks, recorded_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks), recorded_at = NOW()`,
            [sessionId, entry.studentId, status, null],
          );

          if (entry.present === "No") {
            const studentName = studentNameMap.get(entry.studentId) ?? "";
            const message = buildParentAbsentMessage(studentName, entry.date);
            await connection.query(
              `INSERT INTO ${PARENT_NOTIFICATIONS_TABLE} (student_id, subject, date, message, status)
               VALUES (?, ?, ?, ?, 'unread')
               ON DUPLICATE KEY UPDATE message = VALUES(message), status = 'unread', updated_at = CURRENT_TIMESTAMP`,
              [entry.studentId, subjectLabel, entry.date, message],
            );
          }
        }

        updated += 1;
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });

  const reasonParts: string[] = [];
  if (skippedNotAllowed > 0) {
    reasonParts.push("Some dates are outside the allowed remedial schedule.");
  }
  if (skippedNoSession > 0) {
    reasonParts.push("Some sessions could not be created or found.");
  }

  return NextResponse.json({
    success: true,
    updated,
    skippedNotAllowed,
    skippedNoSession,
    reason: reasonParts.length ? reasonParts.join(" ") : undefined,
  });
}

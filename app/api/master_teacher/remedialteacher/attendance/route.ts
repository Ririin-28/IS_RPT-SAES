import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, runWithConnection } from "@/lib/db";
import { getMasterTeacherSessionFromCookies } from "@/lib/server/master-teacher-session";

export const dynamic = "force-dynamic";

const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
const WEEKLY_SUBJECT_TABLE = "weekly_subject_schedule";
const ATTENDANCE_SESSION_TABLE = "attendance_session";
const ATTENDANCE_RECORD_TABLE = "attendance_record";
const PARENT_NOTIFICATIONS_TABLE = "parent_notifications";
const SUBJECT_TABLE_CANDIDATES = ["subject", "subjects"] as const;
const MT_REMEDIAL_HANDLED_TABLE = "mt_remedialteacher_handled";
const STUDENT_TEACHER_ASSIGNMENT_TABLE = "student_teacher_assignment";

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


// const resolveRemedialGradeId = async (
//   masterTeacherId: string | null,
//   userId: number | null,
// ): Promise<number | null> => {
//   let resolvedMasterTeacherId = masterTeacherId?.trim() ?? "";
//
//   if (!resolvedMasterTeacherId && userId) {
//     resolvedMasterTeacherId = (await resolveMasterTeacherId(userId)) ?? "";
//   }
//
//   if (!resolvedMasterTeacherId) return null;
//
//   const columns = await getTableColumns(MT_REMEDIAL_HANDLED_TABLE).catch(() => new Set<string>());
//   if (!columns.size || !columns.has("grade_id") || !columns.has("master_teacher_id")) {
//     return null;
//   }
//
//   const [rows] = await query<RowDataPacket[]>(
//     `SELECT grade_id FROM ${MT_REMEDIAL_HANDLED_TABLE} WHERE master_teacher_id = ? AND grade_id IS NOT NULL LIMIT 1`,
//     [resolvedMasterTeacherId],
//   );
//
//   const gradeId = Number(rows[0]?.grade_id);
//   return Number.isFinite(gradeId) ? gradeId : null;
// };

// const resolveAssignmentGradeId = async (
//   subjectId: number,
//   session: { masterTeacherId?: string | null; remedialRoleId?: string | null; userId?: number | null } | null,
// ): Promise<number | null> => {
//   if (!Number.isFinite(subjectId)) return null;
//
//   const assignmentColumns = await getTableColumns(STUDENT_TEACHER_ASSIGNMENT_TABLE).catch(() => new Set<string>());
//   if (!assignmentColumns.size || !assignmentColumns.has("grade_id") || !assignmentColumns.has("subject_id")) {
//     return null;
//   }
//
//   const filters: string[] = [];
//   const params: Array<string | number> = [subjectId];
//
//   if (assignmentColumns.has("remedial_role_id") && session?.remedialRoleId) {
//     filters.push("remedial_role_id = ?");
//     params.push(String(session.remedialRoleId));
//   }
//
//   if (assignmentColumns.has("teacher_id") && session?.masterTeacherId) {
//     filters.push("teacher_id = ?");
//     params.push(String(session.masterTeacherId));
//   }
//
//   if (assignmentColumns.has("assigned_by_mt_id") && session?.masterTeacherId) {
//     filters.push("assigned_by_mt_id = ?");
//     params.push(String(session.masterTeacherId));
//   }
//
//   if (!filters.length) return null;
//
//   const statusFilter = assignmentColumns.has("is_active") ? " AND is_active = 1" : "";
//
//   const [rows] = await query<RowDataPacket[]>(
//     `SELECT grade_id FROM ${STUDENT_TEACHER_ASSIGNMENT_TABLE}
//      WHERE subject_id = ? AND (${filters.join(" OR ")})${statusFilter}
//      LIMIT 1`,
//     params,
//   );
//
//   const gradeId = Number(rows[0]?.grade_id);
//   return Number.isFinite(gradeId) ? gradeId : null;
// };

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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  );

  try {
    await query(`ALTER TABLE ${PARENT_NOTIFICATIONS_TABLE} MODIFY COLUMN student_id VARCHAR(20) NOT NULL`);
  } catch (error) {
    console.warn("Unable to alter parent_notifications.student_id column", error);
  }
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
  console.log("=== PUT ATTENDANCE START ===");
  console.log("Request URL:", request.url);
  const body = await request.json().catch(() => null);
  console.log("Request body:", body);
  if (!body || typeof body !== "object") {
    console.error("Invalid body:", body);
    return NextResponse.json({ success: false, error: "Invalid payload." }, { status: 400 });
  }

  const subjectLabel = sanitizeSubjectKey((body as { subject?: unknown }).subject);
  if (!subjectLabel) {
    return NextResponse.json({ success: false, error: "Invalid subject." }, { status: 400 });
  }
  console.log("Subject label:", subjectLabel);

  const entries = await normalizeEntries((body as { entries?: unknown }).entries);
  console.log("Entries count:", entries.length);
  if (entries.length > 0) {
    console.log("First entry sample:", entries[0]);
  }
  if (!entries.length) {
    return NextResponse.json({ success: false, updated: 0, reason: "No valid entries to process." });
  }

  const subjectId = await resolveSubjectId(subjectLabel);
  console.log("Subject ID:", subjectId);
  if (!subjectId) {
    return NextResponse.json({ success: true, updated: 0, reason: "Subject not found." });
  }

  const [allowedMonths, allowedWeekdays, session] = await Promise.all([
    loadRemedialMonths(),
    loadAllowedWeekdays(subjectId),
    getMasterTeacherSessionFromCookies(),
  ]);
  console.log("Allowed months:", Array.from(allowedMonths));
  console.log("Allowed weekdays:", Array.from(allowedWeekdays));
  console.log("Session data:", session);

  if (!allowedMonths.size || !allowedWeekdays.size) {
    return NextResponse.json({
      success: true,
      updated: 0,
      reason: "Remedial schedule is not configured for this subject.",
    });
  }

  // =================== FIXED GRADE ID RESOLUTION ===================
  console.log("=== GRADE ID RESOLUTION DEBUG ===");
  console.log("Session data:", session);
  console.log("Subject ID:", subjectId);

  let gradeId: number | null = null;

  // 1. Try student_teacher_assignment table first
  if (session?.masterTeacherId || session?.remedialRoleId) {
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (session?.masterTeacherId) {
      conditions.push("(teacher_id = ? OR assigned_by_mt_id = ?)");
      params.push(session.masterTeacherId, session.masterTeacherId);
    }

    if (session?.remedialRoleId) {
      conditions.push("remedial_role_id = ?");
      params.push(session.remedialRoleId);
    }

    const whereClause = conditions.length > 0
      ? `(${conditions.join(" OR ")}) AND subject_id = ?`
      : "subject_id = ?";

    params.push(subjectId);

    console.log("Checking student_teacher_assignment with:", { whereClause, params });

    const [assignmentRows] = await query<RowDataPacket[]>(
      `SELECT DISTINCT grade_id FROM ${STUDENT_TEACHER_ASSIGNMENT_TABLE} 
       WHERE ${whereClause} AND grade_id IS NOT NULL 
       LIMIT 1`,
      params,
    );

    if (assignmentRows.length > 0) {
      gradeId = Number(assignmentRows[0].grade_id);
      console.log("Found grade_id from assignment table:", gradeId);
    }
  }

  // 2. Fallback to mt_remedialteacher_handled table
  if (!gradeId && session?.masterTeacherId) {
    const [remedialRows] = await query<RowDataPacket[]>(
      `SELECT grade_id FROM ${MT_REMEDIAL_HANDLED_TABLE} 
       WHERE master_teacher_id = ? AND grade_id IS NOT NULL 
       LIMIT 1`,
      [session.masterTeacherId],
    );

    if (remedialRows.length > 0) {
      gradeId = Number(remedialRows[0].grade_id);
      console.log("Found grade_id from remedial table:", gradeId);
    }
  }

  // 3. Last resort: Get ANY grade for this subject
  if (!gradeId) {
    const [anyGradeRows] = await query<RowDataPacket[]>(
      `SELECT DISTINCT grade_id FROM ${STUDENT_TEACHER_ASSIGNMENT_TABLE} 
       WHERE subject_id = ? AND grade_id IS NOT NULL 
       LIMIT 1`,
      [subjectId],
    );

    if (anyGradeRows.length > 0) {
      gradeId = Number(anyGradeRows[0].grade_id);
      console.log("Found ANY grade_id for subject:", gradeId);
    }
  }

  // 4. If still no grade_id, we MUST fail since it's NOT NULL
  if (!gradeId) {
    console.error("CRITICAL: No grade_id found for subject:", subjectLabel, "subjectId:", subjectId);

    // Diagnostic query to help debug
    const [diagnostic] = await query<RowDataPacket[]>(
      "SHOW TABLES LIKE '%grade%'",
    );
    console.log("Grade tables found:", diagnostic);

    return NextResponse.json(
      {
        success: false,
        error: "Cannot determine grade assignment. Please ensure you are assigned to a grade for this subject.",
        debug: {
          subjectId,
          subjectLabel,
          masterTeacherId: session?.masterTeacherId,
          remedialRoleId: session?.remedialRoleId,
          userId: session?.userId,
        },
      },
      { status: 400 },
    );
  }

  console.log("=== USING GRADE ID:", gradeId, "===");
  console.log("Grade ID resolved:", gradeId);
  // =================== END GRADE ID RESOLUTION ===================

  if (gradeId) {
    const [gradeCheck] = await query<RowDataPacket[]>(
      "SELECT grade_id FROM grade WHERE grade_id = ? LIMIT 1",
      [gradeId],
    );

    if (!gradeCheck.length) {
      console.error(`Grade ID ${gradeId} does not exist in grade table`);
      return NextResponse.json(
        { success: false, error: `Invalid grade ID: ${gradeId}` },
        { status: 400 },
      );
    }
  }

  // =================== FIXED USER ID RESOLUTION ===================
  console.log("=== USER ID RESOLUTION DEBUG ===");

  const [existingFormats] = await query<RowDataPacket[]>(
    `SELECT created_by_user_id, COUNT(*) as count 
     FROM ${ATTENDANCE_SESSION_TABLE} 
     WHERE created_by_user_id IS NOT NULL AND created_by_user_id != ''
     GROUP BY created_by_user_id 
     ORDER BY count DESC 
     LIMIT 5`,
  );

  console.log("Existing created_by_user_id formats in DB:", existingFormats);

  let expectedFormat = "unknown";
  if (existingFormats.length > 0) {
    const mostCommon = String(existingFormats[0].created_by_user_id);
    if (mostCommon.includes("MT-")) {
      expectedFormat = "master_teacher_id";
    } else if (mostCommon.includes("TEA-")) {
      expectedFormat = "teacher_id";
    } else if (mostCommon.includes("U-") || mostCommon.includes("USER-")) {
      expectedFormat = "user_id";
    } else if (/^\d+$/.test(mostCommon)) {
      expectedFormat = "numeric_id";
    }
    console.log("Most common format:", mostCommon, "Type:", expectedFormat);
  }

  let createdBy = "0";

  if (expectedFormat === "master_teacher_id" && session?.masterTeacherId) {
    createdBy = String(session.masterTeacherId);
    console.log("Using masterTeacherId (matches DB format):", createdBy);
  } else if (expectedFormat === "numeric_id" && session?.userId) {
    createdBy = String(session.userId);
    console.log("Using userId (numeric format):", createdBy);
  } else if (session?.masterTeacherId) {
    createdBy = String(session.masterTeacherId);
    console.log("Fallback to masterTeacherId:", createdBy);
  } else if (session?.userId) {
    createdBy = String(session.userId);
    console.log("Fallback to userId:", createdBy);
  } else {
    createdBy = "SYSTEM";
    console.log("Using SYSTEM as fallback");
  }

  if (createdBy.length > 20) {
    console.warn(`Warning: created_by_user_id "${createdBy}" exceeds 20 chars, truncating`);
    createdBy = createdBy.substring(0, 20);
  }

  if (!createdBy || createdBy.trim() === "") {
    createdBy = "0";
    console.warn("Warning: created_by_user_id was empty, using '0'");
  }

  console.log("Final created_by_user_id:", createdBy, "Length:", createdBy.length);
  console.log("=== END USER ID RESOLUTION ===");
  // =================== END FIX ===================
  console.log("Created by user ID:", createdBy);

  await ensureParentNotificationsTable();

  const sessionIdByDate = new Map<string, number>();
  let updated = 0;
  let skippedNotAllowed = 0;
  let skippedNoSession = 0;
  let sessionsCreated = 0;
  let sessionsExisting = 0;

  await runWithConnection(async (connection) => {
    await connection.beginTransaction();
    console.log("Transaction started");
    try {
      console.log(`Processing ${entries.length} entries...`);
      const studentNameMap = await loadStudentNameMap(
        connection,
        entries.map((entry) => entry.studentId),
      );
      for (const entry of entries) {
        console.log("Entry:", {
          studentId: entry.studentId,
          date: entry.date,
          present: entry.present,
          isAllowed: isAllowedDate(entry.date, allowedMonths, allowedWeekdays),
        });
        if (!isAllowedDate(entry.date, allowedMonths, allowedWeekdays)) {
          console.log(`Skipped ${entry.date}: not in allowed schedule`);
          skippedNotAllowed += 1;
          continue;
        }

        let sessionId: number | undefined = sessionIdByDate.get(entry.date);

        // Check if session exists
        if (!sessionId) {
          const [existingRows] = await connection.query<RowDataPacket[]>(
            `SELECT session_id FROM ${ATTENDANCE_SESSION_TABLE} 
             WHERE session_date = ? AND subject_id = ? AND grade_id = ? 
             LIMIT 1`,
            [entry.date, subjectId, gradeId],
          );

          if (existingRows.length > 0) {
            sessionId = Number(existingRows[0].session_id);
            sessionsExisting += 1;
            console.log(`Existing session found for ${entry.date}:`, sessionId);
          } else {
            // Create new session with ALL required fields
            const insertValues: Array<string | number | null> = [
              entry.date, // session_date
              gradeId, // grade_id - REQUIRED
              subjectId, // subject_id - REQUIRED
              null, // week_id
              null, // activity_id
              createdBy ? String(createdBy) : "0", // created_by_user_id - REQUIRED
              null, // approved_schedule_id
            ];

            console.log(`Creating session for ${entry.date} with grade_id:`, gradeId);

            try {
              const [result] = await connection.query<RowDataPacket[]>(
                `INSERT INTO ${ATTENDANCE_SESSION_TABLE} 
                 (session_date, grade_id, subject_id, week_id, activity_id, created_by_user_id, approved_schedule_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                insertValues,
              );
              console.log("Session INSERT result:", result);

              const insertId = Number((result as unknown as { insertId?: number }).insertId);
              console.log("Insert ID:", insertId);
              if (Number.isFinite(insertId) && insertId > 0) {
                sessionId = insertId;
                sessionsCreated += 1;
                console.log("Created new session ID:", sessionId);
              } else {
                throw new Error("Failed to get insert ID from session creation");
              }
            } catch (error) {
              console.error(`Failed to create session for ${entry.date}:`, error);
              console.error("Insert values:", insertValues);
              skippedNoSession += 1;
              continue;
            }
          }

          if (sessionId) {
            sessionIdByDate.set(entry.date, sessionId);
          }
        }

        if (!sessionId) {
          console.error(`Failed to get/create session for ${entry.date}`);
          skippedNoSession += 1;
          continue;
        }

        // Handle attendance record
        if (entry.present === null) {
          // Delete record if present is null
          await connection.query(
            `DELETE FROM ${ATTENDANCE_RECORD_TABLE} WHERE session_id = ? AND student_id = ?`,
            [sessionId, entry.studentId],
          );
          console.log(`Deleted attendance for student ${entry.studentId} on ${entry.date}`);
        } else {
          const status = entry.present === "Yes" ? "Present" : "Absent";

          console.log(`Setting ${status} for student ${entry.studentId}`);
          const attendanceResult = await connection.query(
            `INSERT INTO ${ATTENDANCE_RECORD_TABLE} (session_id, student_id, status, remarks, recorded_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE 
               status = VALUES(status), 
               remarks = VALUES(remarks), 
               recorded_at = NOW()`,
            [sessionId, entry.studentId, status, null],
          );
          console.log("Attendance INSERT result:", attendanceResult);

          console.log(`Set ${status} for student ${entry.studentId} on ${entry.date}`);

          // Send parent notification for absences
          if (entry.present === "No") {
            const studentName = studentNameMap.get(entry.studentId) ?? "";
            const message = buildParentAbsentMessage(studentName, entry.date);
            await connection.query(
              `INSERT INTO ${PARENT_NOTIFICATIONS_TABLE} (student_id, subject, date, message, status)
               VALUES (?, ?, ?, ?, 'unread')
               ON DUPLICATE KEY UPDATE 
                 message = VALUES(message), 
                 status = 'unread', 
                 updated_at = CURRENT_TIMESTAMP`,
              [entry.studentId, subjectLabel, entry.date, message],
            );
          }
        }

        updated += 1;
      }

      await connection.commit();
      console.log("Transaction committed successfully");
    } catch (error) {
      await connection.rollback();
      console.error("Transaction ROLLED BACK due to error:", error);
      throw error;
    }
  });

  const reasonParts: string[] = [];
  if (skippedNotAllowed > 0) {
    reasonParts.push(`${skippedNotAllowed} dates outside allowed schedule.`);
  }
  if (skippedNoSession > 0) {
    reasonParts.push(`${skippedNoSession} sessions could not be created.`);
  }

  console.log("=== PUT ATTENDANCE END ===");
  console.log("Summary:", {
    updated,
    sessionsCreated,
    sessionsExisting,
    skippedNotAllowed,
    skippedNoSession,
  });

  return NextResponse.json({
    success: true,
    updated,
    sessionsCreated,
    sessionsExisting,
    skippedNotAllowed,
    skippedNoSession,
    gradeIdUsed: gradeId,
    reason: reasonParts.length ? reasonParts.join(" ") : "All entries processed.",
    debug: {
      entriesProcessed: entries.length,
      sessionData: {
        masterTeacherId: session?.masterTeacherId,
        userId: session?.userId,
      },
      validation: {
        allowedMonths: Array.from(allowedMonths),
        allowedWeekdays: Array.from(allowedWeekdays),
        subjectId,
        gradeId,
      },
    },
  });
}

export async function POST() {
  try {
    console.log("=== DEBUG ENDPOINT CALLED ===");

    const session = await getMasterTeacherSessionFromCookies();
    console.log("Session:", JSON.stringify(session, null, 2));

    const testSubjects = ["Math", "English", "Filipino"];
    const subjectResults: Array<{ subject: string; id: number | null }> = [];
    for (const subj of testSubjects) {
      const id = await resolveSubjectId(subj);
      subjectResults.push({ subject: subj, id });
    }

    let gradeAssignmentInfo: RowDataPacket[] = [];
    if (session?.masterTeacherId) {
      const [assignments] = await query<RowDataPacket[]>(
        `SELECT teacher_id, subject_id, grade_id 
         FROM ${STUDENT_TEACHER_ASSIGNMENT_TABLE} 
         WHERE teacher_id = ? OR assigned_by_mt_id = ? OR remedial_role_id = ? 
         LIMIT 10`,
        [session.masterTeacherId, session.masterTeacherId, session?.remedialRoleId || ""],
      );
      gradeAssignmentInfo = assignments;
    }

    const [existingSessions] = await query<RowDataPacket[]>(
      `SELECT created_by_user_id, session_date, subject_id, grade_id 
       FROM ${ATTENDANCE_SESSION_TABLE} 
       ORDER BY session_date DESC 
       LIMIT 5`,
    );

    const [grades] = await query<RowDataPacket[]>(
      "SELECT grade_id, grade_name FROM grade LIMIT 10",
    );

    return NextResponse.json({
      success: true,
      debug: {
        session: {
          exists: !!session,
          masterTeacherId: session?.masterTeacherId,
          userId: session?.userId,
          remedialRoleId: session?.remedialRoleId,
        },
        subjects: subjectResults,
        gradeAssignments: gradeAssignmentInfo,
        existingSessions,
        availableGrades: grades,
        systemTime: new Date().toISOString(),
      },
      recommendation: !session
        ? "⚠️ No session found - check authentication"
        : !session.masterTeacherId && !session.userId
          ? "⚠️ No user ID in session"
          : "✅ Session looks good",
    });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}

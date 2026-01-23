import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, runWithConnection } from "@/lib/db";
import { getMasterTeacherSessionFromCookies } from "@/lib/server/master-teacher-session";

export const dynamic = "force-dynamic";

const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
const WEEKLY_SUBJECT_TABLE = "weekly_subject_schedule";
const ATTENDANCE_SESSION_TABLE = "attendance_session";
const ATTENDANCE_RECORD_TABLE = "attendance_record";
const SUBJECT_TABLE_CANDIDATES = ["subject", "subjects"] as const;

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type NormalizedEntry = { studentId: number; date: string; present: "Yes" | "No" | null };

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

const normalizeEntries = (entries: unknown): NormalizedEntry[] => {
  if (!Array.isArray(entries)) return [];
  const normalized: NormalizedEntry[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const studentId = Number((entry as { studentId?: unknown }).studentId);
    if (!Number.isFinite(studentId) || studentId <= 0) continue;
    const parsedDate = parseIsoDate((entry as { date?: unknown }).date);
    if (!parsedDate) continue;
    const presentRaw = (entry as { present?: unknown }).present;
    let present: "Yes" | "No" | null = null;
    if (presentRaw === "Yes" || presentRaw === "No") {
      present = presentRaw;
    }
    normalized.push({ studentId, date: parsedDate.iso, present });
  }
  return normalized;
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
    SELECT r.student_id, s.session_date, r.status
    FROM ${ATTENDANCE_RECORD_TABLE} r
    JOIN ${ATTENDANCE_SESSION_TABLE} s ON s.session_id = r.session_id
    WHERE s.subject_id = ?
      AND s.session_date BETWEEN ? AND ?
      AND MONTH(s.session_date) IN (${monthPlaceholders})
      AND DAYNAME(s.session_date) IN (${weekdayPlaceholders})
  `;

  const studentIds: number[] = [];
  if (studentIdsParam) {
    for (const part of studentIdsParam.split(",")) {
      const parsed = Number(part.trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        studentIds.push(parsed);
      }
    }
  }
  if (studentIds.length) {
    sql += ` AND r.student_id IN (${studentIds.map(() => "?").join(",")})`;
    params.push(...studentIds);
  }

  const [rows] = await query<RowDataPacket[]>(sql, params);
  const records = rows.map((row) => {
    const status = row.status ? String(row.status).toLowerCase() : "";
    const present = status === "absent" ? "No" : "Yes";
    const date = row.session_date instanceof Date
      ? row.session_date.toISOString().slice(0, 10)
      : String(row.session_date).slice(0, 10);
    return {
      studentId: Number(row.student_id),
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

  const entries = normalizeEntries((body as { entries?: unknown }).entries);
  if (!entries.length) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  const subjectId = await resolveSubjectId(subjectLabel);
  if (!subjectId) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  const [allowedMonths, allowedWeekdays, session] = await Promise.all([
    loadRemedialMonths(),
    loadAllowedWeekdays(subjectId),
    getMasterTeacherSessionFromCookies(),
  ]);

  if (!allowedMonths.size || !allowedWeekdays.size) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  const createdBy = session?.masterTeacherId ?? session?.userId ?? null;
  const sessionColumns = await getTableColumns(ATTENDANCE_SESSION_TABLE).catch(() => new Set<string>());

  const sessionIdByDate = new Map<string, number>();
  let updated = 0;

  await runWithConnection(async (connection) => {
    await connection.beginTransaction();
    try {
      for (const entry of entries) {
        if (!isAllowedDate(entry.date, allowedMonths, allowedWeekdays)) {
          continue;
        }

        let sessionId = sessionIdByDate.get(entry.date);
        if (!sessionId) {
          const [existingRows] = await connection.query<RowDataPacket[]>(
            `SELECT session_id FROM ${ATTENDANCE_SESSION_TABLE} WHERE session_date = ? AND subject_id = ? LIMIT 1`,
            [entry.date, subjectId],
          );
          const existingId = Number(existingRows?.[0]?.session_id);
          if (Number.isFinite(existingId) && existingId > 0) {
            sessionId = existingId;
          } else {
            const insertColumns: string[] = [];
            const insertValues: Array<string | number | null> = [];

            insertColumns.push("session_date");
            insertValues.push(entry.date);

            if (sessionColumns.has("subject_id")) {
              insertColumns.push("subject_id");
              insertValues.push(subjectId);
            }
            if (sessionColumns.has("grade_id")) {
              insertColumns.push("grade_id");
              insertValues.push(null);
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
              insertValues.push(createdBy ? String(createdBy) : null);
            }

            const placeholders = insertColumns.map(() => "?").join(", ");
            const [result] = await connection.query<RowDataPacket[]>(
              `INSERT INTO ${ATTENDANCE_SESSION_TABLE} (${insertColumns.join(", ")}) VALUES (${placeholders})`,
              insertValues,
            );
            const insertId = Number((result as unknown as { insertId?: number }).insertId);
            sessionId = Number.isFinite(insertId) ? insertId : null;
          }

          if (sessionId) {
            sessionIdByDate.set(entry.date, sessionId);
          }
        }

        if (!sessionId) {
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
        }

        updated += 1;
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });

  return NextResponse.json({ success: true, updated });
}
            await connection.execute(
              `DELETE FROM \`${tableName}\` WHERE student_id = ? AND subject = ? AND date = ?`,
              [entry.studentId, subject, entry.date]
            );
          } else {
            await connection.execute(
              `INSERT INTO \`${tableName}\` (student_id, subject, date, present)
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE present = VALUES(present), updated_at = CURRENT_TIMESTAMP`,
              [entry.studentId, subject, entry.date, entry.present]
            );
            if (entry.present === "No") {
              const message = `Your child was absent on ${formatForMessage(entry.date)} for ${subjectLabel}.`;
              await connection.execute(
                `INSERT INTO parent_notifications (student_id, subject, date, message, status)
                 VALUES (?, ?, ?, ?, 'unread')
                 ON DUPLICATE KEY UPDATE message = VALUES(message), status = 'unread', updated_at = CURRENT_TIMESTAMP`,
                [entry.studentId, subject, entry.date, message]
              );
            }
          }
          updatedCount += 1;
        }
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });

  return NextResponse.json({ success: true, updated: updatedCount });
}

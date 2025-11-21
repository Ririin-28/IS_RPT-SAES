import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query, runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

const MONTH_TABLE_MAP: Record<number, string> = {
  2: "feb_attendance",
  3: "march_attendance",
  9: "sept_attendance",
  10: "oct_attendance",
  12: "dec_attendance",
};

const SUBJECT_LABELS: Record<string, string> = {
  english: "English",
  filipino: "Filipino",
  math: "Mathematics",
};

const PRESENT_VALUES = new Set(["Yes", "No"] as const);

const ensuredAttendanceTables = new Set<string>();
let notificationsTableEnsured = false;

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const buildKey = (studentId: number, date: string) => `${studentId}|${date}`;

const sanitizeSubject = (subject: unknown): string | null => {
  if (typeof subject !== "string") {
    return null;
  }
  const trimmed = subject.trim().toLowerCase();
  if (!(trimmed in SUBJECT_LABELS)) {
    return null;
  }
  return trimmed;
};

const parseIsoDate = (value: unknown): { year: number; month: number; day: number; iso: string } | null => {
  if (typeof value !== "string") {
    return null;
  }
  const match = ISO_DATE_REGEX.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day, iso: `${match[1]}-${match[2]}-${match[3]}` };
};

const toDate = ({ year, month, day }: { year: number; month: number; day: number }) => {
  return new Date(Date.UTC(year, month - 1, day));
};

const ensureAttendanceTable = async (tableName: string) => {
  if (ensuredAttendanceTables.has(tableName)) {
    return;
  }

  await query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id INT NOT NULL,
      subject VARCHAR(100) NOT NULL,
      date DATE NOT NULL,
      present ENUM('Yes', 'No') NOT NULL DEFAULT 'Yes',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_${tableName}_attendance (student_id, subject, date),
      KEY idx_${tableName}_date (date),
      KEY idx_${tableName}_student (student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  );

  ensuredAttendanceTables.add(tableName);
};

const ensureNotificationsTable = async () => {
  if (notificationsTableEnsured) {
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

  notificationsTableEnsured = true;
};

const resolveAttendanceTable = (month: number): string | null => {
  return MONTH_TABLE_MAP[month] ?? null;
};

const formatForMessage = (isoDate: string) => {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    return isoDate;
  }
  const date = toDate(parsed);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

type AttendanceRow = RowDataPacket & {
  student_id: number;
  subject: string;
  date: Date | string;
  present: "Yes" | "No";
};

const normalizeRowDate = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && ISO_DATE_REGEX.test(value)) {
    return value.slice(0, 10);
  }
  return new Date(value).toISOString().slice(0, 10);
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const startOfMonth = (date: Date) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
};

const endOfMonth = (date: Date) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
};

const clampDate = (value: Date, min: Date, max: Date) => {
  if (value < min) return new Date(min.getTime());
  if (value > max) return new Date(max.getTime());
  return value;
};

const collectMonthRanges = (start: Date, end: Date): Array<{ table: string; start: Date; end: Date }> => {
  const ranges: Array<{ table: string; start: Date; end: Date }> = [];
  let cursor = startOfMonth(start);

  while (cursor <= end) {
    const table = resolveAttendanceTable(cursor.getUTCMonth() + 1);
    if (table) {
      const monthStart = startOfMonth(cursor);
      const monthEnd = endOfMonth(cursor);
      const rangeStart = clampDate(monthStart, start, end);
      const rangeEnd = clampDate(monthEnd, start, end);
      ranges.push({ table, start: rangeStart, end: rangeEnd });
    }
    cursor = addMonths(cursor, 1);
  }

  return ranges;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const subject = sanitizeSubject(url.searchParams.get("subject"));
  const startParam = parseIsoDate(url.searchParams.get("start"));
  const endParam = parseIsoDate(url.searchParams.get("end"));
  const studentIdsParam = url.searchParams.get("studentIds");

  if (!subject) {
    return NextResponse.json({ success: false, error: "Invalid subject." }, { status: 400 });
  }

  if (!startParam || !endParam) {
    return NextResponse.json({ success: false, error: "Invalid start or end date." }, { status: 400 });
  }

  const startDate = toDate(startParam);
  const endDate = toDate(endParam);

  if (startDate > endDate) {
    return NextResponse.json({ success: false, error: "Start date must be before end date." }, { status: 400 });
  }

  const studentIds: number[] = [];
  if (studentIdsParam) {
    for (const part of studentIdsParam.split(",")) {
      const parsed = Number(part.trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        studentIds.push(parsed);
      }
    }
  }

  const monthRanges = collectMonthRanges(startDate, endDate);

  if (!monthRanges.length) {
    return NextResponse.json({ success: true, records: [] });
  }

  const records: Array<{ studentId: number; subject: string; date: string; present: "Yes" | "No" }> = [];

  for (const range of monthRanges) {
    await ensureAttendanceTable(range.table);
    const params: Array<string | number> = [subject, range.start.toISOString().slice(0, 10), range.end.toISOString().slice(0, 10)];
    let sql = `SELECT student_id, subject, date, present FROM \`${range.table}\` WHERE subject = ? AND date BETWEEN ? AND ?`;
    if (studentIds.length) {
      const placeholders = studentIds.map(() => "?").join(",");
      sql += ` AND student_id IN (${placeholders})`;
      params.push(...studentIds);
    }

    const [rows] = await query<AttendanceRow[]>(sql, params);
    for (const row of rows) {
      records.push({
        studentId: Number(row.student_id),
        subject: row.subject,
        date: normalizeRowDate(row.date),
        present: row.present,
      });
    }
  }

  // Deduplicate records by student/date, preferring latest month iteration
  const deduped = new Map<string, { studentId: number; subject: string; date: string; present: "Yes" | "No" }>();
  for (const record of records) {
    deduped.set(buildKey(record.studentId, record.date), record);
  }

  return NextResponse.json({ success: true, records: Array.from(deduped.values()) });
}

type IncomingAttendanceEntry = {
  studentId?: unknown;
  date?: unknown;
  present?: unknown;
};

type NormalizedEntry = {
  studentId: number;
  date: string;
  present: "Yes" | "No" | null;
};

const normalizeEntries = (entries: unknown): NormalizedEntry[] => {
  if (!Array.isArray(entries)) {
    return [];
  }

  const normalized: NormalizedEntry[] = [];

  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const { studentId, date, present } = entry as IncomingAttendanceEntry;
    const idNumber = typeof studentId === "number" ? studentId : Number(studentId);
    if (!Number.isFinite(idNumber) || idNumber <= 0) {
      continue;
    }
    const parsedDate = parseIsoDate(date);
    if (!parsedDate) {
      continue;
    }
    let normalizedPresent: "Yes" | "No" | null = null;
    if (typeof present === "string") {
      const trimmed = present.trim();
      if (PRESENT_VALUES.has(trimmed as "Yes" | "No")) {
        normalizedPresent = trimmed as "Yes" | "No";
      }
    } else if (typeof present === "boolean") {
      normalizedPresent = present ? "Yes" : "No";
    } else if (present === null) {
      normalizedPresent = null;
    }

    normalized.push({ studentId: idNumber, date: parsedDate.iso, present: normalizedPresent });
  }

  return normalized;
};

const groupEntriesByTable = (entries: NormalizedEntry[]): Map<string, NormalizedEntry[]> => {
  const groups = new Map<string, NormalizedEntry[]>();
  for (const entry of entries) {
    const parsed = parseIsoDate(entry.date);
    if (!parsed) {
      continue;
    }
    const table = resolveAttendanceTable(parsed.month);
    if (!table) {
      continue;
    }
    if (!groups.has(table)) {
      groups.set(table, []);
    }
    groups.get(table)!.push(entry);
  }
  return groups;
};

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, error: "Invalid payload." }, { status: 400 });
  }

  const subject = sanitizeSubject((body as { subject?: unknown }).subject);
  if (!subject) {
    return NextResponse.json({ success: false, error: "Invalid subject." }, { status: 400 });
  }

  const entries = normalizeEntries((body as { entries?: unknown }).entries);
  if (!entries.length) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  const grouped = groupEntriesByTable(entries);

  if (!grouped.size) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  for (const tableName of grouped.keys()) {
    await ensureAttendanceTable(tableName);
  }
  await ensureNotificationsTable();

  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  let updatedCount = 0;

  await runWithConnection(async (connection) => {
    await connection.beginTransaction();
    try {
      for (const [tableName, tableEntries] of grouped.entries()) {
        for (const entry of tableEntries) {
          if (entry.present === null) {
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

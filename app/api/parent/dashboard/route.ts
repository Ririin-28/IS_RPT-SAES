import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const SCHEDULE_DAYS = [
  { key: "monday_subject", label: "Monday" },
  { key: "tuesday_subject", label: "Tuesday" },
  { key: "wednesday_subject", label: "Wednesday" },
  { key: "thursday_subject", label: "Thursday" },
  { key: "friday_subject", label: "Friday" },
] as const;

type ParentRow = RowDataPacket & {
  parent_id: string | number;
  student_id: string | number;
  relationship: string | null;
};

type StudentRow = RowDataPacket & {
  student_id: string | number;
  user_id: number;
  grade: string | null;
  section: string | null;
  english: string | null;
  filipino: string | null;
  math: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
};

type AttendanceRow = RowDataPacket & {
  date: string | Date | null;
  subject: string | null;
  present: string | null;
};

type SubjectScheduleRow = RowDataPacket & {
  monday_subject: string | null;
  tuesday_subject: string | null;
  wednesday_subject: string | null;
  thursday_subject: string | null;
  friday_subject: string | null;
};

type TimeScheduleRow = RowDataPacket & Record<string, string | null>;

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

const ATTENDANCE_TABLES = [
  "sept_attendance",
  "oct_attendance",
] as const;

function parseGradeNumber(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

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

function listAvailableGradeKeys(timeRow: TimeScheduleRow): number[] {
  const grades = new Set<number>();
  for (const key of Object.keys(timeRow)) {
    const match = key.match(/^gr(\d+)_starttime$/i);
    if (!match) continue;
    const gradeNumber = Number(match[1]);
    if (Number.isFinite(gradeNumber)) {
      grades.add(gradeNumber);
    }
  }
  return [...grades].sort((a, b) => a - b);
}

function resolveGradeKey(timeRow: TimeScheduleRow, grade: string | null): number | null {
  const availableGrades = listAvailableGradeKeys(timeRow);
  if (availableGrades.length === 0) {
    return null;
  }

  const gradeNumber = parseGradeNumber(grade);
  if (!gradeNumber) {
    return availableGrades[0];
  }

  if (availableGrades.includes(gradeNumber)) {
    return gradeNumber;
  }

  // Try to find the closest lower grade, otherwise fall back to the smallest defined grade.
  for (let candidate = gradeNumber - 1; candidate >= 1; candidate -= 1) {
    if (availableGrades.includes(candidate)) {
      return candidate;
    }
  }

  return availableGrades[0];
}

function buildTimeRange(timeRow: TimeScheduleRow | undefined, grade: string | null): string | null {
  if (!timeRow) return null;
  const resolvedGrade = resolveGradeKey(timeRow, grade);
  if (!resolvedGrade) return null;

  const startKey = `gr${resolvedGrade}_starttime`;
  const endKey = `gr${resolvedGrade}_endtime`;
  const start = formatTimeValue(timeRow[startKey]);
  const end = formatTimeValue(timeRow[endKey]);

  if (start && end) {
    return `${start} - ${end}`;
  }
  return start ?? end ?? null;
}

function normalizeDate(value: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
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
    const present = String(row.present ?? "").toLowerCase() === "yes";
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

function extractSubjects(student: StudentRow): string[] {
  const subjects: string[] = [];
  if (String(student.english ?? "").toLowerCase() === "yes") {
    subjects.push("English");
  }
  if (String(student.filipino ?? "").toLowerCase() === "yes") {
    subjects.push("Filipino");
  }
  if (String(student.math ?? "").toLowerCase() === "yes") {
    subjects.push("Math");
  }
  return subjects;
}

function buildSchedule(
  scheduleRow: SubjectScheduleRow | undefined,
  timeRow: TimeScheduleRow | undefined,
  grade: string | null,
): ScheduleEntry[] {
  if (!scheduleRow) return [];
  const timeRange = buildTimeRange(timeRow, grade);
  const entries: ScheduleEntry[] = [];

  for (const { key, label } of SCHEDULE_DAYS) {
    const subject = scheduleRow[key];
    if (!subject) continue;
    entries.push({ day: label, subject, timeRange });
  }

  return entries;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userIdParam = url.searchParams.get("userId");

  if (!userIdParam) {
    return NextResponse.json({ error: "Missing userId query parameter" }, { status: 400 });
  }

  const userId = Number(userIdParam);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  try {
    const [parentRows] = await query<ParentRow[]>(
      `SELECT parent_id, student_id, relationship FROM parent WHERE user_id = ? LIMIT 1`,
      [userId],
    );

    if (parentRows.length === 0) {
      return NextResponse.json({ error: "Parent profile not found" }, { status: 404 });
    }

    const parent = parentRows[0];

    const [studentRows] = await query<StudentRow[]>(
      `SELECT s.student_id, s.user_id, s.grade, s.section, s.english, s.filipino, s.math,
              u.first_name, u.middle_name, u.last_name
       FROM student s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.student_id = ?
       LIMIT 1`,
      [parent.student_id],
    );

    if (studentRows.length === 0) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const student = studentRows[0];

    const attendanceChunks: AttendanceRow[] = [];
    for (const table of ATTENDANCE_TABLES) {
      const [rows] = await query<AttendanceRow[]>(
        `SELECT date, subject, present FROM ${table} WHERE student_id = ?`,
        [student.student_id],
      );
      attendanceChunks.push(...rows);
    }
    attendanceChunks.sort((a, b) => {
      const left = normalizeDate(a.date) ?? "";
      const right = normalizeDate(b.date) ?? "";
      return left.localeCompare(right);
    });
    const attendance = mapAttendance(attendanceChunks);

    const [scheduleRows] = await query<SubjectScheduleRow[]>(
      `SELECT monday_subject, tuesday_subject, wednesday_subject, thursday_subject, friday_subject
       FROM subject_schedule
       LIMIT 1`,
    );

    const [timeRows] = await query<TimeScheduleRow[]>(
      `SELECT * FROM time_schedule LIMIT 1`,
    );

    const schedule = buildSchedule(scheduleRows[0], timeRows[0], student.grade);

    const subjects = extractSubjects(student);

    return NextResponse.json({
      parent: {
        parentId: parent.parent_id,
        relationship: parent.relationship,
      },
      child: {
        studentId: student.student_id,
        userId: student.user_id,
        firstName: student.first_name ?? "",
        middleName: student.middle_name,
        lastName: student.last_name ?? "",
        grade: student.grade,
        section: student.section,
        relationship: parent.relationship,
        subjects,
      },
      attendance,
      schedule,
    });
  } catch (error) {
    console.error("Failed to load parent dashboard data", error);
    return NextResponse.json({ error: "Failed to load parent dashboard data" }, { status: 500 });
  }
}

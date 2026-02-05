import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";

export const dynamic = "force-dynamic";

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

    const subjects = [] as string[];

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
      },
      attendance,
      schedule,
    });
  } catch (error) {
    console.error("Failed to load parent dashboard data", error);
    return NextResponse.json({ error: "Failed to load parent dashboard data" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const STUDENT_TABLE_CANDIDATES = ["student", "students", "student_info"] as const;
const TEACHER_TABLE_CANDIDATES = ["teacher", "teachers", "teacher_info"] as const;
const MASTER_TEACHER_TABLE_CANDIDATES = [
  "master_teacher",
  "master_teachers",
  "master_teacher_info",
] as const;
const REPORT_TABLE_CANDIDATES = [
  "teacher_reports",
  "reports",
  "monthly_reports",
  "progress_reports",
  "remedial_reports",
] as const;

const REPORT_DATE_CANDIDATES = [
  "submitted_at",
  "created_at",
  "updated_at",
  "report_date",
  "date_submitted",
  "sent_at",
  "timestamp",
  "submitted_on",
] as const;

const REPORT_STATUS_CANDIDATES = [
  "status",
  "report_status",
  "submission_status",
  "is_submitted",
  "submitted",
  "state",
] as const;

const SUBMITTED_KEYWORDS = [
  "submitted",
  "complete",
  "completed",
  "done",
  "approved",
  "sent",
  "1",
  "true",
  "yes",
  "submitted (late)",
  "on time",
  "on-time",
  "pass",
] as const;

const TRACKED_MONTHS = [
  { month: 9, label: "September" },
  { month: 10, label: "October" },
  { month: 12, label: "December" },
  { month: 2, label: "February" },
  { month: 3, label: "March" },
] as const;

const SUBJECT_NAMES = ["English", "Filipino", "Math"] as const;
type SubjectName = (typeof SUBJECT_NAMES)[number];

type SubjectProgressPayload = {
  gradeData: Record<string, Record<string, number>>;
  percentageData: Record<string, Record<string, number>>;
  gradeTotals: Record<string, number>;
};

type MonthStat = {
  label: string;
  month: number;
  year: number | null;
  total: number;
  submitted: number;
  pending: number;
};

type ResolvedTable = {
  name: string;
  columns: Set<string>;
};

async function resolveTable(candidates: readonly string[]): Promise<ResolvedTable | null> {
  for (const candidate of candidates) {
    if (!(await tableExists(candidate))) {
      continue;
    }
    const columns = await getTableColumns(candidate);
    return { name: candidate, columns };
  }
  return null;
}

async function countRows(tableInfo: ResolvedTable | null): Promise<number> {
  if (!tableInfo) return 0;
  const [rows] = await query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM \`${tableInfo.name}\``);
  const total = rows[0]?.total;
  return typeof total === "number" ? total : Number(total ?? 0);
}

function normalizeStatus(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim().toLowerCase();
}

function isSubmittedStatus(value: unknown): boolean {
  const normalized = normalizeStatus(value);
  if (!normalized) return false;
  if (SUBMITTED_KEYWORDS.includes(normalized as typeof SUBMITTED_KEYWORDS[number])) {
    return true;
  }
  if (normalized.startsWith("submitted")) return true;
  if (normalized.startsWith("complete")) return true;
  if (normalized.startsWith("done")) return true;
  if (normalized.startsWith("approved")) return true;
  if (normalized === "1" || normalized === "yes" || normalized === "true") return true;
  return false;
}

function pickLatestYear(entryA: MonthStat, entryB: MonthStat): MonthStat {
  if ((entryA.year ?? 0) >= (entryB.year ?? 0)) {
    return entryA;
  }
  return entryB;
}

async function fetchReportStats(): Promise<{
  monthStats: MonthStat[];
  currentMonth: MonthStat;
  metadata: { sourceTable: string | null; dateColumn: string | null; statusColumn: string | null };
}> {
  const resolvedTable = await resolveTable(REPORT_TABLE_CANDIDATES);
  if (!resolvedTable) {
    return {
      monthStats: TRACKED_MONTHS.map(({ month, label }) => ({
        label,
        month,
        year: null,
        total: 0,
        submitted: 0,
        pending: 0,
      })),
      currentMonth: {
        label: new Date().toLocaleString("en-US", { month: "long" }),
        month: new Date().getMonth() + 1,
        year: null,
        total: 0,
        submitted: 0,
        pending: 0,
      },
      metadata: { sourceTable: null, dateColumn: null, statusColumn: null },
    };
  }

  const dateColumn = REPORT_DATE_CANDIDATES.find((column) => resolvedTable.columns.has(column)) ?? null;
  if (!dateColumn) {
    return {
      monthStats: TRACKED_MONTHS.map(({ month, label }) => ({
        label,
        month,
        year: null,
        total: 0,
        submitted: 0,
        pending: 0,
      })),
      currentMonth: {
        label: new Date().toLocaleString("en-US", { month: "long" }),
        month: new Date().getMonth() + 1,
        year: null,
        total: 0,
        submitted: 0,
        pending: 0,
      },
      metadata: { sourceTable: resolvedTable.name, dateColumn: null, statusColumn: null },
    };
  }

  const statusColumn = REPORT_STATUS_CANDIDATES.find((column) => resolvedTable.columns.has(column)) ?? null;

  const selectParts = [
    `YEAR(${dateColumn}) AS year_value`,
    `MONTH(${dateColumn}) AS month_value`,
  ];

  if (statusColumn) {
    selectParts.push(`${statusColumn} AS status_value`);
  } else {
    selectParts.push(`NULL AS status_value`);
  }

  const sql = `
    SELECT ${selectParts.join(", ")}
    FROM \`${resolvedTable.name}\`
    WHERE ${dateColumn} IS NOT NULL
  `;

  const [rows] = await query<RowDataPacket[]>(sql);

  const statsByMonth = new Map<number, MonthStat>();

  for (const { month_value: monthValue, year_value: yearValue, status_value: statusValue } of rows) {
    const monthNumber = typeof monthValue === "number" ? monthValue : Number(monthValue ?? 0);
    if (!Number.isFinite(monthNumber)) {
      continue;
    }

    const tracked = TRACKED_MONTHS.find(({ month }) => month === monthNumber);
    if (!tracked) {
      continue;
    }

    const yearNumber = typeof yearValue === "number" ? yearValue : Number(yearValue ?? 0);
    const key = monthNumber;

    const existing = statsByMonth.get(key);
    const submittedIncrement = isSubmittedStatus(statusValue) || !statusColumn ? 1 : 0;

    if (existing) {
      const updated: MonthStat = {
        label: tracked.label,
        month: monthNumber,
        year: yearNumber || existing.year,
        total: existing.total + 1,
        submitted: existing.submitted + submittedIncrement,
        pending: 0,
      };
      updated.pending = Math.max(updated.total - updated.submitted, 0);
      statsByMonth.set(key, updated);
    } else {
      const initial: MonthStat = {
        label: tracked.label,
        month: monthNumber,
        year: Number.isFinite(yearNumber) ? yearNumber : null,
        total: 1,
        submitted: submittedIncrement,
        pending: 0,
      };
      initial.pending = Math.max(initial.total - initial.submitted, 0);
      statsByMonth.set(key, initial);
    }
  }

  const monthStats: MonthStat[] = TRACKED_MONTHS.map(({ month, label }) => {
    const entry = statsByMonth.get(month);
    if (entry) {
      entry.pending = Math.max(entry.total - entry.submitted, 0);
      return entry;
    }
    return {
      label,
      month,
      year: null,
      total: 0,
      submitted: 0,
      pending: 0,
    };
  });

  const currentMonthNumber = new Date().getMonth() + 1;
  const currentTracked = TRACKED_MONTHS.find(({ month }) => month === currentMonthNumber);
  const defaultCurrent: MonthStat = {
    label: currentTracked?.label ?? new Date().toLocaleString("en-US", { month: "long" }),
    month: currentMonthNumber,
    year: null,
    total: 0,
    submitted: 0,
    pending: 0,
  };

  const currentMonthStat = monthStats
    .filter((entry) => entry.month === currentMonthNumber)
    .reduce((latest, entry) => pickLatestYear(entry, latest), defaultCurrent);
  currentMonthStat.pending = Math.max(currentMonthStat.total - currentMonthStat.submitted, 0);

  return {
    monthStats,
    currentMonth: currentMonthStat,
    metadata: {
      sourceTable: resolvedTable.name,
      dateColumn,
      statusColumn,
    },
  };
}

async function fetchSubjectIds(): Promise<Map<SubjectName, number>> {
  const subjectIds = new Map<SubjectName, number>();
  if (!(await tableExists("subject"))) {
    return subjectIds;
  }

  const [rows] = await query<RowDataPacket[]>(
    "SELECT subject_id, subject_name FROM subject WHERE subject_name IN (?, ?, ?)",
    [...SUBJECT_NAMES],
  );

  for (const row of rows) {
    const name = typeof row.subject_name === "string" ? row.subject_name : null;
    const id = Number(row.subject_id);
    if (!name || !Number.isFinite(id)) {
      continue;
    }
    const matched = SUBJECT_NAMES.find((subject) => subject.toLowerCase() === name.toLowerCase());
    if (matched) {
      subjectIds.set(matched, id);
    }
  }

  return subjectIds;
}

async function fetchSubjectProgressByGrade(subjectId: number): Promise<SubjectProgressPayload> {
  const empty: SubjectProgressPayload = { gradeData: {}, percentageData: {}, gradeTotals: {} };

  const requiredTables = ["student", "grade", "student_subject_assessment", "phonemic_level"];
  for (const table of requiredTables) {
    if (!(await tableExists(table))) {
      return empty;
    }
  }

  const [totalRows] = await query<RowDataPacket[]>(
    `
      SELECT g.grade_level, COUNT(DISTINCT s.student_id) as total
      FROM student s
      INNER JOIN grade g ON s.grade_id = g.grade_id
      GROUP BY g.grade_level
      ORDER BY g.grade_level
    `,
  );

  const [rows] = await query<RowDataPacket[]>(
    `
      SELECT
        g.grade_level,
        pl.level_name,
        COUNT(DISTINCT s.student_id) as student_count
      FROM student s
      INNER JOIN grade g ON s.grade_id = g.grade_id
      LEFT JOIN (
        SELECT student_id, subject_id, MAX(assessed_at) AS latest_assessed
        FROM student_subject_assessment
        WHERE subject_id = ?
        GROUP BY student_id, subject_id
      ) latest ON latest.student_id = s.student_id AND latest.subject_id = ?
      LEFT JOIN student_subject_assessment ssa
        ON ssa.student_id = latest.student_id
        AND ssa.subject_id = latest.subject_id
        AND ssa.assessed_at = latest.latest_assessed
      LEFT JOIN phonemic_level pl ON ssa.phonemic_id = pl.phonemic_id AND pl.subject_id = ?
      GROUP BY g.grade_level, pl.level_name
      ORDER BY g.grade_level, pl.level_name
    `,
    [subjectId, subjectId, subjectId],
  );

  const gradeData: Record<string, Record<string, number>> = {};
  const gradeTotals: Record<string, number> = {};

  totalRows.forEach((row) => {
    const gradeKey = row.grade_level != null ? String(row.grade_level) : "";
    if (!gradeKey) {
      return;
    }
    gradeTotals[gradeKey] = Number(row.total ?? 0);
    gradeData[gradeKey] = {};
  });

  rows.forEach((row) => {
    const gradeKey = row.grade_level != null ? String(row.grade_level) : "";
    if (!gradeKey) {
      return;
    }
    const levelName = typeof row.level_name === "string" && row.level_name.trim().length > 0
      ? row.level_name
      : "Not Assessed";
    const count = Number(row.student_count ?? 0);
    if (!gradeData[gradeKey]) {
      gradeData[gradeKey] = {};
    }
    gradeData[gradeKey][levelName] = count;
  });

  const percentageData: Record<string, Record<string, number>> = {};
  Object.keys(gradeData).forEach((gradeKey) => {
    percentageData[gradeKey] = {};
    const total = gradeTotals[gradeKey] || 1;
    Object.keys(gradeData[gradeKey]).forEach((level) => {
      percentageData[gradeKey][level] = Math.round((gradeData[gradeKey][level] / total) * 100);
    });
  });

  return { gradeData, percentageData, gradeTotals };
}

export async function GET() {
  try {
    const [studentTable, teacherTable, masterTeacherTable] = await Promise.all([
      resolveTable(STUDENT_TABLE_CANDIDATES),
      resolveTable(TEACHER_TABLE_CANDIDATES),
      resolveTable(MASTER_TEACHER_TABLE_CANDIDATES),
    ]);

    const [studentCount, teacherCount, masterTeacherCount, reportStats, subjectIds] = await Promise.all([
      countRows(studentTable),
      countRows(teacherTable),
      countRows(masterTeacherTable),
      fetchReportStats(),
      fetchSubjectIds(),
    ]);

    const totalTeachers = teacherCount + masterTeacherCount;

    const progressBySubject: Partial<Record<SubjectName, SubjectProgressPayload>> = {};
    for (const subject of SUBJECT_NAMES) {
      const subjectId = subjectIds.get(subject);
      if (!subjectId) {
        continue;
      }
      progressBySubject[subject] = await fetchSubjectProgressByGrade(subjectId);
    }

    return NextResponse.json({
      totals: {
        students: studentCount,
        teachers: totalTeachers,
        breakdown: {
          teachers: teacherCount,
          masterTeachers: masterTeacherCount,
        },
      },
      reports: {
        monthStats: reportStats.monthStats,
        currentMonth: reportStats.currentMonth,
      },
      progress: progressBySubject,
      metadata: {
        studentTable: studentTable?.name ?? null,
        teacherTable: teacherTable?.name ?? null,
        masterTeacherTable: masterTeacherTable?.name ?? null,
        reportSource: reportStats.metadata,
      },
    });
  } catch (error) {
    console.error("Failed to load principal dashboard data", error);
    return NextResponse.json({ error: "Failed to load principal dashboard data." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const STUDENT_TABLE_CANDIDATES = ["student", "students", "student_info"] as const;
const TEACHER_TABLE_CANDIDATES = ["teacher", "teachers", "teacher_info"] as const;
const MASTER_TEACHER_TABLE_CANDIDATES = ["master_teacher", "master_teachers", "master_teacher_info"] as const;
const REPORT_TABLE_CANDIDATES = ["teacher_reports", "reports", "monthly_reports", "progress_reports", "remedial_reports"] as const;

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

const REPORT_STATUS_CANDIDATES = ["status", "report_status", "submission_status", "is_submitted", "submitted", "state"] as const;

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

type ResolvedTable = {
  name: string;
  columns: Set<string>;
};

type MonthStat = {
  label: string;
  month: number;
  year: number | null;
  total: number;
  submitted: number;
  pending: number;
};

type AnalyticsPayload = {
  remedialAverageHeatmap: Array<{ grade: string; subject: SubjectName; averageScore: number }>;
  performanceTrend: Array<{
    period: string;
    allSubjects: number;
    english: number;
    filipino: number;
    math: number;
  }>;
  averageStudentsPerSubject: Array<{ subject: SubjectName; students: number; percentage: number }>;
};

const pickColumn = (columns: Set<string>, candidates: readonly string[]): string | null => {
  for (const candidate of candidates) {
    if (columns.has(candidate)) return candidate;
  }

  const lowerMap = new Map<string, string>();
  for (const column of columns) {
    lowerMap.set(column.toLowerCase(), column);
  }

  for (const candidate of candidates) {
    const resolved = lowerMap.get(candidate.toLowerCase());
    if (resolved) return resolved;
  }

  return null;
};

const normalizeStatus = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
};

const isSubmittedStatus = (value: unknown): boolean => {
  const normalized = normalizeStatus(value);
  if (!normalized) return false;
  if (SUBMITTED_KEYWORDS.includes(normalized as (typeof SUBMITTED_KEYWORDS)[number])) return true;
  if (normalized.startsWith("submitted")) return true;
  if (normalized.startsWith("complete")) return true;
  if (normalized.startsWith("done")) return true;
  if (normalized.startsWith("approved")) return true;
  if (normalized === "1" || normalized === "yes" || normalized === "true") return true;
  return false;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const normalizeSubject = (value: unknown): SubjectName | null => {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;
  if (text.includes("english")) return "English";
  if (text.includes("filipino")) return "Filipino";
  if (text.includes("math")) return "Math";
  return null;
};

const normalizeGrade = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = text.match(/(\d+)/);
  if (!match) return null;
  return `Grade ${match[1]}`;
};

const monthKey = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const buildRecentMonthKeys = (count = 12): Array<{ key: string; label: string }> => {
  const now = new Date();
  const keys: Array<{ key: string; label: string }> = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    keys.push({
      key: monthKey(date),
      label: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    });
  }
  return keys;
};

async function resolveTable(candidates: readonly string[]): Promise<ResolvedTable | null> {
  for (const candidate of candidates) {
    if (!(await tableExists(candidate))) continue;
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

function applyArchiveFilter(baseWhere: string[], columns: Set<string>, alias?: string): void {
  if (!columns.has("is_archived")) return;
  const prefix = alias ? `${alias}.` : "";
  baseWhere.push(`COALESCE(${prefix}is_archived, 0) = 0`);
}

async function fetchReportStats(): Promise<{ monthStats: MonthStat[]; currentMonth: MonthStat }> {
  const resolvedTable = await resolveTable(REPORT_TABLE_CANDIDATES);
  if (!resolvedTable) {
    const emptyStats = TRACKED_MONTHS.map(({ month, label }) => ({ label, month, year: null, total: 0, submitted: 0, pending: 0 }));
    return {
      monthStats: emptyStats,
      currentMonth: {
        label: new Date().toLocaleString("en-US", { month: "long" }),
        month: new Date().getMonth() + 1,
        year: null,
        total: 0,
        submitted: 0,
        pending: 0,
      },
    };
  }

  const dateColumn = pickColumn(resolvedTable.columns, REPORT_DATE_CANDIDATES);
  if (!dateColumn) {
    const emptyStats = TRACKED_MONTHS.map(({ month, label }) => ({ label, month, year: null, total: 0, submitted: 0, pending: 0 }));
    return {
      monthStats: emptyStats,
      currentMonth: {
        label: new Date().toLocaleString("en-US", { month: "long" }),
        month: new Date().getMonth() + 1,
        year: null,
        total: 0,
        submitted: 0,
        pending: 0,
      },
    };
  }

  const statusColumn = pickColumn(resolvedTable.columns, REPORT_STATUS_CANDIDATES);
  const whereParts = [`${dateColumn} IS NOT NULL`];
  applyArchiveFilter(whereParts, resolvedTable.columns);

  const [rows] = await query<RowDataPacket[]>(
    `SELECT YEAR(${dateColumn}) AS year_value, MONTH(${dateColumn}) AS month_value, ${statusColumn ? `${statusColumn} AS status_value` : `NULL AS status_value`}
     FROM \`${resolvedTable.name}\`
     WHERE ${whereParts.join(" AND ")}`,
  );

  const monthMap = new Map<number, MonthStat>();
  for (const row of rows) {
    const monthNumber = Number(row.month_value ?? 0);
    if (!Number.isFinite(monthNumber)) continue;
    const tracked = TRACKED_MONTHS.find((entry) => entry.month === monthNumber);
    if (!tracked) continue;

    const submittedIncrement = statusColumn ? (isSubmittedStatus(row.status_value) ? 1 : 0) : 1;
    const yearNumber = Number(row.year_value ?? 0);

    const existing = monthMap.get(monthNumber);
    if (existing) {
      existing.total += 1;
      existing.submitted += submittedIncrement;
      existing.pending = Math.max(existing.total - existing.submitted, 0);
      if (Number.isFinite(yearNumber)) {
        existing.year = existing.year === null ? yearNumber : Math.max(existing.year, yearNumber);
      }
      continue;
    }

    monthMap.set(monthNumber, {
      label: tracked.label,
      month: monthNumber,
      year: Number.isFinite(yearNumber) ? yearNumber : null,
      total: 1,
      submitted: submittedIncrement,
      pending: Math.max(1 - submittedIncrement, 0),
    });
  }

  const monthStats = TRACKED_MONTHS.map(({ month, label }) => monthMap.get(month) ?? {
    label,
    month,
    year: null,
    total: 0,
    submitted: 0,
    pending: 0,
  });

  const currentMonthNumber = new Date().getMonth() + 1;
  const fallback = monthStats.find((entry) => entry.month === currentMonthNumber) ?? {
    label: new Date().toLocaleString("en-US", { month: "long" }),
    month: currentMonthNumber,
    year: null,
    total: 0,
    submitted: 0,
    pending: 0,
  };

  return { monthStats, currentMonth: fallback };
}

async function fetchPerformanceAnalytics(): Promise<AnalyticsPayload> {
  const empty: AnalyticsPayload = {
    remedialAverageHeatmap: [],
    performanceTrend: [],
    averageStudentsPerSubject: SUBJECT_NAMES.map((subject) => ({ subject, students: 0, percentage: 0 })),
  };

  const [performanceExists, activitiesExists, studentExists, gradeExists, subjectExists, sessionExists] = await Promise.all([
    tableExists("performance_records"),
    tableExists("activities"),
    tableExists("student"),
    tableExists("grade"),
    tableExists("subject"),
    tableExists("student_remedial_session"),
  ]);

  if (!performanceExists || !activitiesExists) {
    return empty;
  }

  const [prColumns, activityColumns, studentColumns, gradeColumns, subjectColumns, sessionColumns] = await Promise.all([
    getTableColumns("performance_records"),
    getTableColumns("activities"),
    studentExists ? getTableColumns("student") : Promise.resolve(new Set<string>()),
    gradeExists ? getTableColumns("grade") : Promise.resolve(new Set<string>()),
    subjectExists ? getTableColumns("subject") : Promise.resolve(new Set<string>()),
    sessionExists ? getTableColumns("student_remedial_session") : Promise.resolve(new Set<string>()),
  ]);

  const prScoreCol = pickColumn(prColumns, ["score"]);
  const prCompletedCol = pickColumn(prColumns, ["completed_at", "updated_at", "created_at"]);
  const prActivityCol = pickColumn(prColumns, ["activity_id"]);
  const prStudentCol = pickColumn(prColumns, ["student_id"]);
  const prGradeCol = pickColumn(prColumns, ["grade", "grade_level"]);
  const activityIdCol = pickColumn(activityColumns, ["activity_id", "id"]);
  const activitySubjectCol = pickColumn(activityColumns, ["subject", "subject_name"]);

  if (!prScoreCol || !prCompletedCol || !prActivityCol || !activityIdCol || !activitySubjectCol) {
    return empty;
  }

  const whereParts: string[] = [`pr.${prScoreCol} IS NOT NULL`, `pr.${prCompletedCol} IS NOT NULL`];
  applyArchiveFilter(whereParts, prColumns, "pr");
  applyArchiveFilter(whereParts, activityColumns, "a");

  const joins: string[] = [
    `INNER JOIN activities a ON a.${activityIdCol} = pr.${prActivityCol}`,
  ];

  let gradeExpression = prGradeCol ? `pr.${prGradeCol}` : "NULL";
  if (studentExists && prStudentCol && studentColumns.has("student_id")) {
    joins.push("LEFT JOIN student s ON s.student_id = pr.student_id");
    applyArchiveFilter(whereParts, studentColumns, "s");

    if (gradeExists && studentColumns.has("grade_id") && gradeColumns.has("grade_id") && gradeColumns.has("grade_level")) {
      joins.push("LEFT JOIN grade g ON g.grade_id = s.grade_id");
      applyArchiveFilter(whereParts, gradeColumns, "g");
      gradeExpression = `COALESCE(g.grade_level, ${prGradeCol ? `pr.${prGradeCol}` : "NULL"})`;
    } else if (studentColumns.has("grade_level")) {
      gradeExpression = `COALESCE(s.grade_level, ${prGradeCol ? `pr.${prGradeCol}` : "NULL"})`;
    }
  }

  const [performanceRows] = await query<RowDataPacket[]>(
    `SELECT pr.${prScoreCol} AS score_value,
            pr.${prCompletedCol} AS completed_value,
            a.${activitySubjectCol} AS subject_value,
            ${gradeExpression} AS grade_value
     FROM performance_records pr
     ${joins.join("\n")}
     WHERE ${whereParts.join(" AND ")}`,
  );

  const heatmapAccumulator = new Map<string, { sum: number; count: number }>();
  const trendAccumulator = new Map<string, Record<SubjectName | "All", { sum: number; count: number }>>();

  for (const row of performanceRows) {
    const subject = normalizeSubject(row.subject_value);
    if (!subject) continue;

    const score = Number(row.score_value ?? NaN);
    if (!Number.isFinite(score)) continue;

    const completedAt = new Date(String(row.completed_value));
    if (Number.isNaN(completedAt.getTime())) continue;

    const grade = normalizeGrade(row.grade_value) ?? "Grade 0";

    const heatKey = `${grade}|${subject}`;
    const existingHeat = heatmapAccumulator.get(heatKey) ?? { sum: 0, count: 0 };
    existingHeat.sum += score;
    existingHeat.count += 1;
    heatmapAccumulator.set(heatKey, existingHeat);

    const key = monthKey(completedAt);
    const monthBucket = trendAccumulator.get(key) ?? {
      All: { sum: 0, count: 0 },
      English: { sum: 0, count: 0 },
      Filipino: { sum: 0, count: 0 },
      Math: { sum: 0, count: 0 },
    };

    monthBucket.All.sum += score;
    monthBucket.All.count += 1;
    monthBucket[subject].sum += score;
    monthBucket[subject].count += 1;
    trendAccumulator.set(key, monthBucket);
  }

  const gradeLabels = Array.from(
    new Set(Array.from(heatmapAccumulator.keys()).map((entry) => entry.split("|")[0])).values(),
  ).sort((a, b) => Number((a.match(/(\d+)/)?.[1] ?? 0)) - Number((b.match(/(\d+)/)?.[1] ?? 0)));

  const remedialAverageHeatmap: AnalyticsPayload["remedialAverageHeatmap"] = [];
  for (const grade of gradeLabels) {
    for (const subject of SUBJECT_NAMES) {
      const key = `${grade}|${subject}`;
      const entry = heatmapAccumulator.get(key);
      const averageScore = entry && entry.count > 0 ? Math.round(clamp(entry.sum / entry.count, 0, 100)) : 0;
      remedialAverageHeatmap.push({ grade, subject, averageScore });
    }
  }

  const monthKeys = buildRecentMonthKeys(12);
  const performanceTrend: AnalyticsPayload["performanceTrend"] = monthKeys.map(({ key, label }) => {
    const bucket = trendAccumulator.get(key);
    const average = (scope: SubjectName | "All") => {
      if (!bucket) return 0;
      const item = bucket[scope];
      if (!item || item.count <= 0) return 0;
      return Math.round(clamp(item.sum / item.count, 0, 100));
    };

    return {
      period: label,
      allSubjects: average("All"),
      english: average("English"),
      filipino: average("Filipino"),
      math: average("Math"),
    };
  });

  let averageStudentsPerSubject = SUBJECT_NAMES.map((subject) => ({ subject, students: 0, percentage: 0 }));

  if (sessionExists && sessionColumns.has("student_id") && sessionColumns.has("subject_id")) {
    const where: string[] = [];
    applyArchiveFilter(where, sessionColumns, "srs");

    const subjectJoin = subjectExists && subjectColumns.has("subject_id")
      ? `LEFT JOIN subject sbj ON sbj.subject_id = srs.subject_id`
      : "";
    const subjectNameExpr = subjectExists && subjectColumns.has("subject_name")
      ? "sbj.subject_name"
      : "CAST(srs.subject_id AS CHAR)";

    const [sessionRows] = await query<RowDataPacket[]>(
      `SELECT srs.student_id AS student_value, ${subjectNameExpr} AS subject_value
       FROM student_remedial_session srs
       ${subjectJoin}
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}`,
    );

    const studentsBySubject = new Map<SubjectName, Set<string>>();
    for (const subject of SUBJECT_NAMES) {
      studentsBySubject.set(subject, new Set<string>());
    }

    for (const row of sessionRows) {
      const subject = normalizeSubject(row.subject_value);
      if (!subject) continue;
      const studentId = String(row.student_value ?? "").trim();
      if (!studentId) continue;
      studentsBySubject.get(subject)?.add(studentId);
    }

    const counts = SUBJECT_NAMES.map((subject) => ({ subject, students: studentsBySubject.get(subject)?.size ?? 0 }));
    const total = counts.reduce((sum, entry) => sum + entry.students, 0);
    averageStudentsPerSubject = counts.map((entry) => ({
      ...entry,
      percentage: total > 0 ? Math.round((entry.students / total) * 100) : 0,
    }));
  }

  return {
    remedialAverageHeatmap,
    performanceTrend,
    averageStudentsPerSubject,
  };
}

export async function GET() {
  try {
    const [studentTable, teacherTable, masterTeacherTable, reportStats, analytics] = await Promise.all([
      resolveTable(STUDENT_TABLE_CANDIDATES),
      resolveTable(TEACHER_TABLE_CANDIDATES),
      resolveTable(MASTER_TEACHER_TABLE_CANDIDATES),
      fetchReportStats(),
      fetchPerformanceAnalytics(),
    ]);

    const [studentCount, teacherCount, masterTeacherCount] = await Promise.all([
      countRows(studentTable),
      countRows(teacherTable),
      countRows(masterTeacherTable),
    ]);

    return NextResponse.json({
      totals: {
        students: studentCount,
        teachers: teacherCount + masterTeacherCount,
        breakdown: {
          teachers: teacherCount,
          masterTeachers: masterTeacherCount,
        },
      },
      reports: {
        monthStats: reportStats.monthStats,
        currentMonth: reportStats.currentMonth,
      },
      analytics,
    });
  } catch (error) {
    console.error("Failed to load principal dashboard data", error);
    return NextResponse.json({ error: "Failed to load principal dashboard data." }, { status: 500 });
  }
}

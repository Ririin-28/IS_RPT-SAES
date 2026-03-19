"use client";

import { useEffect, useMemo, useState } from "react";
import EnglishReportTab from "@/modules/Teacher/report/EnglishTab/EnglishTab";
import FilipinoReportTab from "@/modules/Teacher/report/FilipinoTab/FilipinoTab";
import MathReportTab from "@/modules/Teacher/report/MathTab/MathTab";
import type {
  RemedialMonthColumn,
  RemedialQuarterGroup,
  RemedialReportRow,
} from "@/modules/Teacher/report/types";
import ReportsEmptyState from "./ReportsEmptyState";

export type PrincipalReportSubject = "english" | "filipino" | "math";

type ReportsTabContentProps = {
  searchTerm: string;
  gradeLevel?: string;
  subject: PrincipalReportSubject;
};

type PrincipalStudent = {
  studentId: string | null;
  name: string | null;
  section: string | null;
  grade?: string | number | null;
  gradeLabel?: string | null;
  gradeNumber?: number | null;
  english?: string | null;
  filipino?: string | null;
  math?: string | null;
  englishPhonemic?: string | null;
  filipinoPhonemic?: string | null;
  mathProficiency?: string | null;
};

type PrincipalStudentsResponse = {
  students?: PrincipalStudent[];
  error?: string;
};

type MonthlyAssessmentResponse = {
  success?: boolean;
  error?: string;
  levelsByStudent?: Record<string, Record<string, string>>;
};

type RemedialQuarterSchedule = {
  quarters?: Record<string, { startMonth?: number | null; endMonth?: number | null }>;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DEFAULT_QUARTERS: Array<{ label: string; months: number[] }> = [
  { label: "1st Quarter", months: [8, 9, 10] },
  { label: "2nd Quarter", months: [1, 2, 3] },
];

const SUBJECT_DISPLAY_LABELS: Record<PrincipalReportSubject, string> = {
  english: "English",
  filipino: "Filipino",
  math: "Math",
};

const SUBJECT_FETCH_LABELS: Record<PrincipalReportSubject, string> = {
  english: "English",
  filipino: "Filipino",
  math: "Math",
};

const SUBJECT_COMPONENTS = {
  english: EnglishReportTab,
  filipino: FilipinoReportTab,
  math: MathReportTab,
} as const;

const makeMonthKey = (month: number) => `m${month}`;

const buildQuarterHeaders = (schedule?: RemedialQuarterSchedule | null) => {
  const quarterGroups: RemedialQuarterGroup[] = [];
  const monthColumns: RemedialMonthColumn[] = [];

  const resolveMonths = (label: string, fallback: number[]) => {
    const raw = schedule?.quarters?.[label];
    const start = raw?.startMonth ?? null;
    const end = raw?.endMonth ?? null;
    if (
      typeof start === "number" &&
      typeof end === "number" &&
      start >= 1 &&
      start <= 12 &&
      end >= 1 &&
      end <= 12 &&
      start <= end
    ) {
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
    return fallback;
  };

  for (const quarter of DEFAULT_QUARTERS) {
    const months = resolveMonths(quarter.label, quarter.months);
    quarterGroups.push({ label: quarter.label, span: months.length });
    months.forEach((month) => {
      monthColumns.push({
        key: makeMonthKey(month),
        label: MONTH_NAMES[month - 1] ?? `Month ${month}`,
        quarterLabel: quarter.label,
      });
    });
  }

  return { quarterGroups, monthColumns };
};

const defaultHeaders = buildQuarterHeaders(null);

const normalizeGradeNumber = (value: unknown): string => {
  const match = String(value ?? "").match(/(\d+)/);
  return match?.[1] ?? "";
};

const matchesGrade = (student: PrincipalStudent, gradeLevel?: string) => {
  if (!gradeLevel) return true;

  const activeGrade = normalizeGradeNumber(gradeLevel);
  if (!activeGrade) return true;

  const studentGrade = normalizeGradeNumber(student.gradeLabel ?? student.grade ?? student.gradeNumber ?? "");
  return studentGrade === activeGrade;
};

const hasSubjectRemedialLevel = (
  student: PrincipalStudent,
  subject: PrincipalReportSubject,
) => {
  const values =
    subject === "english"
      ? [student.englishPhonemic, student.english]
      : subject === "filipino"
        ? [student.filipinoPhonemic, student.filipino]
        : [student.mathProficiency, student.math];

  return values.some((value) => String(value ?? "").trim().length > 0);
};

const buildRows = (
  students: PrincipalStudent[],
  levelsByStudent: Record<string, Record<string, string>>,
  gradeLevel?: string,
): RemedialReportRow[] =>
  students.map((student, index) => {
    const resolvedStudentId = student.studentId?.trim() || `student-${index + 1}`;
    return {
      id: resolvedStudentId,
      studentId: student.studentId?.trim() || null,
      learner: student.name?.trim() || "Unnamed Student",
      section: student.section?.trim() || "",
      gradeLevel: gradeLevel || student.gradeLabel || String(student.grade ?? ""),
      monthValues: levelsByStudent[resolvedStudentId] ?? {},
    };
  });

export default function ReportsTabContent({
  searchTerm,
  gradeLevel,
  subject,
}: ReportsTabContentProps) {
  const ReportComponent = SUBJECT_COMPONENTS[subject];
  const [students, setStudents] = useState<PrincipalStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [levelsLoading, setLevelsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [levelsError, setLevelsError] = useState<string | null>(null);
  const [levelsByStudent, setLevelsByStudent] = useState<Record<string, Record<string, string>>>({});
  const [monthColumns, setMonthColumns] = useState<RemedialMonthColumn[]>(defaultHeaders.monthColumns);
  const [quarterGroups, setQuarterGroups] = useState<RemedialQuarterGroup[]>(defaultHeaders.quarterGroups);

  useEffect(() => {
    const controller = new AbortController();

    const loadSchedule = async () => {
      try {
        const response = await fetch("/api/master_teacher/coordinator/calendar/remedial-schedule", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; schedule?: RemedialQuarterSchedule | null }
          | null;
        if (!response.ok || !payload?.success) {
          return;
        }

        const nextHeaders = buildQuarterHeaders(payload.schedule ?? null);
        setMonthColumns(nextHeaders.monthColumns);
        setQuarterGroups(nextHeaders.quarterGroups);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        console.warn("Failed to load remedial schedule headers", fetchError);
      }
    };

    void loadSchedule();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadStudents = async () => {
      setStudentsLoading(true);
      setStudentsError(null);
      try {
        const response = await fetch("/api/principal/students", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as PrincipalStudentsResponse | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? `Failed to load students (${response.status})`);
        }

        setStudents(Array.isArray(payload?.students) ? payload.students : []);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to load principal students for reports", fetchError);
        setStudents([]);
        setStudentsError(fetchError instanceof Error ? fetchError.message : "Unable to load students.");
      } finally {
        if (!controller.signal.aborted) {
          setStudentsLoading(false);
        }
      }
    };

    void loadStudents();

    return () => controller.abort();
  }, []);

  const gradeStudents = useMemo(() => {
    return students
      .filter((student) => matchesGrade(student, gradeLevel))
      .filter((student) => hasSubjectRemedialLevel(student, subject))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [gradeLevel, students, subject]);

  useEffect(() => {
    const controller = new AbortController();
    const months = monthColumns
      .map((column) => Number.parseInt(column.key.replace("m", ""), 10))
      .filter((value) => Number.isFinite(value));
    const studentIds = gradeStudents
      .map((student) => student.studentId?.trim() ?? "")
      .filter(Boolean);

    const loadMonthlyLevels = async () => {
      if (!studentIds.length || !months.length) {
        setLevelsError(null);
        setLevelsByStudent({});
        setLevelsLoading(false);
        return;
      }

      setLevelsLoading(true);
      setLevelsError(null);
      try {
        const response = await fetch("/api/remedial/assessment/monthly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            subject: SUBJECT_FETCH_LABELS[subject],
            studentIds,
            months,
          }),
        });
        const payload = (await response.json().catch(() => null)) as MonthlyAssessmentResponse | null;

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? `Failed to load monthly report (${response.status})`);
        }

        setLevelsError(null);
        setLevelsByStudent(payload.levelsByStudent ?? {});
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to load monthly progress report", fetchError);
        setLevelsByStudent({});
        setLevelsError(fetchError instanceof Error ? fetchError.message : "Unable to load monthly report.");
      } finally {
        if (!controller.signal.aborted) {
          setLevelsLoading(false);
        }
      }
    };

    void loadMonthlyLevels();

    return () => controller.abort();
  }, [gradeStudents, monthColumns, subject]);

  const reportRows = useMemo(() => {
    const rows = buildRows(gradeStudents, levelsByStudent, gradeLevel);
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((row) => {
      const learner = row.learner.toLowerCase();
      const section = row.section.toLowerCase();
      return learner.includes(query) || section.includes(query);
    });
  }, [gradeLevel, gradeStudents, levelsByStudent, searchTerm]);

  const isLoading = studentsLoading || levelsLoading;
  const error = studentsError ?? levelsError;
  const hasStudentsInGrade = gradeStudents.length > 0;
  const reportTitle = `Progress Report for ${gradeLevel || "Selected Grade"} - ${SUBJECT_DISPLAY_LABELS[subject]}`;

  return (
    <div className="flex h-full flex-col">
      <div className="report-header-grid mb-2">
        <div className="report-title-card rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2"></div>
          <h2 className="report-title mt-0 text-xl font-semibold text-slate-900 sm:text-2xl">{reportTitle}</h2>
          <p className="report-description mt-1 text-sm text-slate-500">
            Monthly progress report of learners for the selected subject and grade level.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[420px] flex-1 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-8 py-12 text-center">
          <p className="text-sm font-medium text-gray-400">Loading monthly progress report...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : !hasStudentsInGrade || reportRows.length === 0 ? (
        <ReportsEmptyState hasSearchTerm={searchTerm.trim().length > 0} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="report-table-shell rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="report-table-printable min-h-0 flex-1 overflow-auto pr-1">
              <ReportComponent
                rows={reportRows}
                editable={false}
                onCellChange={() => {}}
                monthColumns={monthColumns}
                quarterGroups={quarterGroups}
                showRowNumbers
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

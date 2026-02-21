"use client";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  SUBJECT_CONFIG,
  normalizeSubject,
} from "@/app/api/auth/master_teacher/report/subject-config";
import type {
  RemedialReportField,
  RemedialMonthColumn,
  RemedialQuarterGroup,
  RemedialReportRow,
  RemedialStudentRecord,
  RemedialStudentResponse,
  SubjectKey,
} from "./types";
import { getStoredUserProfile, formatFullNameWithMiddleInitial } from "@/lib/utils/user-profile";

const createEmptyRows = (): Record<SubjectKey, RemedialReportRow[]> => ({
  english: [],
  filipino: [],
  math: [],
});

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

const makeMonthKey = (month: number) => `m${month}`;

const buildQuarterHeaders = (schedule?: RemedialQuarterSchedule | null) => {
  const quarterGroups: RemedialQuarterGroup[] = [];
  const monthColumns: RemedialMonthColumn[] = [];

  const resolveMonths = (label: string, fallback: number[]) => {
    const raw = schedule?.quarters?.[label];
    const start = raw?.startMonth ?? null;
    const end = raw?.endMonth ?? null;
    if (typeof start === "number" && typeof end === "number" && start >= 1 && start <= 12 && end >= 1 && end <= 12 && start <= end) {
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
    return fallback;
  };

  for (const quarter of DEFAULT_QUARTERS) {
    const months = resolveMonths(quarter.label, quarter.months);
    quarterGroups.push({ label: quarter.label, span: months.length });
    months.forEach((month) => {
      const label = MONTH_NAMES[month - 1] ?? `Month ${month}`;
      monthColumns.push({ key: makeMonthKey(month), label, quarterLabel: quarter.label });
    });
  }

  return { quarterGroups, monthColumns };
};

const sanitize = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : "";
};

const composeStudentName = (student: RemedialStudentRecord): string => {
  const last = sanitize(student.lastName);
  const first = sanitize(student.firstName);
  const middle = sanitize(student.middleName);
  const middleInitial = middle ? `${middle.charAt(0).toUpperCase()}.` : "";
  if (last || first) {
    const rightSide = [first, middleInitial].filter(Boolean).join(" ").trim();
    return [last, rightSide].filter(Boolean).join(", ");
  }
  const explicit = sanitize(student.fullName);
  return explicit || "Unnamed Student";
};

const toReportRow = (
  student: RemedialStudentRecord,
  index: number,
  fallbackGrade: string,
  overrides: Partial<RemedialReportRow> = {},
): RemedialReportRow => {
  const identifier = sanitize(student.studentIdentifier);
  const rowId = identifier || `student-${student.studentId ?? student.userId ?? index + 1}`;
  const gradeLevel = sanitize(student.grade) || fallbackGrade;
  const baseRow: RemedialReportRow = {
    id: rowId,
    studentId: sanitize(student.studentId),
    learner: composeStudentName(student),
    section: sanitize(student.section),
    gradeLevel,
    monthValues: {},
  };
  return { ...baseRow, ...overrides };
};

const buildRowsForStudents = (
  students: RemedialStudentRecord[],
  fallbackGrade: string,
  mapper?: (student: RemedialStudentRecord, index: number) => Partial<RemedialReportRow>,
): RemedialReportRow[] =>
  students.map((student, index) => toReportRow(student, index, fallbackGrade, mapper?.(student, index)));

const SUBJECT_LABELS: Record<SubjectKey, string> = {
  english: "English",
  filipino: "Filipino",
  math: "Math",
};

type MasterTeacherReportProps = {
  subjectSlug?: string;
};

type SendStatus = {
  type: "success" | "error";
  message: string;
};

export default function MasterTeacherReport({ subjectSlug }: MasterTeacherReportProps) {
  const subject = normalizeSubject(subjectSlug);
  const { subjectLabel, Component } = SUBJECT_CONFIG[subject];
  const reportRef = useRef<HTMLDivElement>(null);

  const normalizeGradeValue = (value: unknown): string => {
    const match = String(value ?? "").match(/(\d+)/);
    const digit = match?.[1] ?? "";
    return ["1", "2", "3", "4", "5", "6"].includes(digit) ? digit : "";
  };

  const formatGradeLabel = (value: string | null | undefined): string => {
    const numeric = normalizeGradeValue(value);
    return numeric ? `Grade ${numeric}` : "Grade 3";
  };

  const userProfile = useMemo(() => getStoredUserProfile(), []);
  const userId = useMemo(() => {
    if (!userProfile) {
      return null;
    }
    const raw = userProfile.userId;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === "string") {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }, [userProfile]);

  const teacherName = useMemo(() => {
    const formatted = formatFullNameWithMiddleInitial(userProfile);
    return formatted || "Remedial Teacher";
  }, [userProfile]);

  const fallbackGrade = useMemo(() => {
    const grade = sanitize(userProfile?.gradeLevel ?? "");
    return normalizeGradeValue(grade) || "3";
  }, [userProfile]);

  const [rowsBySubject, setRowsBySubject] = useState<Record<SubjectKey, RemedialReportRow[]>>(createEmptyRows);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);
  const defaultHeaders = useMemo(() => buildQuarterHeaders(null), []);
  const [monthColumns, setMonthColumns] = useState<RemedialMonthColumn[]>(defaultHeaders.monthColumns);
  const [quarterGroups, setQuarterGroups] = useState<RemedialQuarterGroup[]>(defaultHeaders.quarterGroups);
  const monthlyLoadedRef = useRef<Record<SubjectKey, string>>({
    english: "",
    filipino: "",
    math: "",
  });

  const activeRows = rowsBySubject[subject] ?? [];
  const displayGradeLevel = useMemo(() => {
    if (activeRows.length > 0) {
      const gradeCandidate = sanitize(activeRows[0].gradeLevel);
      const normalized = normalizeGradeValue(gradeCandidate);
      if (normalized) {
        return normalized;
      }
    }
    return fallbackGrade;
  }, [activeRows, fallbackGrade]);

  const reportTitle = useMemo(
    () => `Progress Report for ${formatGradeLabel(displayGradeLevel)} - ${subjectLabel}`,
    [displayGradeLevel, subjectLabel],
  );

  useEffect(() => {
    const controller = new AbortController();
    const loadSchedule = async () => {
      try {
        const response = await fetch("/api/master_teacher/coordinator/calendar/remedial-schedule", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as { success?: boolean; schedule?: RemedialQuarterSchedule | null } | null;
        if (!response.ok || !payload?.success) {
          return;
        }
        const nextHeaders = buildQuarterHeaders(payload.schedule ?? null);
        setMonthColumns(nextHeaders.monthColumns);
        setQuarterGroups(nextHeaders.quarterGroups);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    };

    loadSchedule();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (userId === null) {
      setRowsBySubject(createEmptyRows());
      setIsLoading(false);
      setLoadError("Unable to identify the current user. Please sign in again.");
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(
          `/api/master_teacher/remedialteacher/students?userId=${encodeURIComponent(String(userId))}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as RemedialStudentResponse;
        if (!response.ok || !payload.success || !Array.isArray(payload.students)) {
          throw new Error(payload.error ?? "Failed to load students.");
        }

        const englishRows = buildRowsForStudents(payload.students, fallbackGrade);
        const filipinoRows = buildRowsForStudents(payload.students, fallbackGrade);
        const mathRows = buildRowsForStudents(payload.students, fallbackGrade);
        setRowsBySubject({
          english: englishRows,
          filipino: filipinoRows,
          math: mathRows,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to load remedial report students", error);
        setRowsBySubject(createEmptyRows());
        setLoadError(error instanceof Error ? error.message : "Failed to load students.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      controller.abort();
    };
  }, [fallbackGrade, userId]);

  useEffect(() => {
    if (!monthColumns.length) return;
    const months = monthColumns
      .map((column) => Number.parseInt(column.key.replace("m", ""), 10))
      .filter((value) => Number.isFinite(value));
    if (!months.length) return;

    const monthKey = monthColumns.map((column) => column.key).join("|");
    const loadForSubject = async (subjectKey: SubjectKey) => {
      if (monthlyLoadedRef.current[subjectKey] === monthKey) return;
      const rows = rowsBySubject[subjectKey] ?? [];
      if (!rows.length) return;
      const studentIds = rows
        .map((row) => row.studentId)
        .filter((value): value is string => Boolean(value));
      if (!studentIds.length) return;

      try {
        const response = await fetch("/api/remedial/assessment/monthly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: SUBJECT_LABELS[subjectKey],
            studentIds,
            months,
          }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; levelsByStudent?: Record<string, Record<string, string>> }
          | null;
        if (!response.ok || !payload?.success) {
          return;
        }
        const levelsByStudent = payload.levelsByStudent ?? {};
        setRowsBySubject((prev) => {
          const current = prev[subjectKey] ?? [];
          const updated = current.map((row) => {
            const studentId = row.studentId ?? "";
            const monthValues = levelsByStudent[studentId];
            if (!monthValues) return row;
            return {
              ...row,
              monthValues: {
                ...row.monthValues,
                ...monthValues,
              },
            };
          });
          return { ...prev, [subjectKey]: updated };
        });
        monthlyLoadedRef.current[subjectKey] = monthKey;
      } catch (error) {
        console.warn("Failed to load monthly assessment levels", error);
      }
    };

    void loadForSubject("english");
    void loadForSubject("filipino");
    void loadForSubject("math");
  }, [monthColumns, rowsBySubject]);

  const handleCellChange = useCallback(
    (subjectKey: SubjectKey, index: number, field: RemedialReportField, value: string) => {
      setRowsBySubject((prev) => {
        const currentRows = prev[subjectKey] ?? [];
        if (!currentRows[index]) {
          return prev;
        }
        const updatedRows = [...currentRows];
        const currentValues = updatedRows[index].monthValues ?? {};
        updatedRows[index] = {
          ...updatedRows[index],
          monthValues: {
            ...currentValues,
            [field]: value,
          },
        };
        return {
          ...prev,
          [subjectKey]: updatedRows,
        };
      });
    },
    [],
  );

  const handleEditToggle = useCallback(() => {
    setSendStatus(null);
    setIsEditing((prev) => !prev);
  }, []);

  const handlePrint = useCallback(() => {
    if (!reportRef.current) {
      return;
    }
    const printContent = reportRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportTitle}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { margin: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body class="p-6">
          <div class="text-center mb-6 border-b-2 border-black pb-4">
            <h1 class="text-2xl font-bold">${reportTitle}</h1>
          </div>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 100);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [reportTitle]);

  const handleSend = useCallback(async () => {
    if (!reportRef.current) {
      return;
    }
    if (userId === null) {
      setSendStatus({ type: "error", message: "Unable to identify the current user. Please sign in again." });
      return;
    }
    if (activeRows.length === 0) {
      setSendStatus({ type: "error", message: "There are no students to include in the report." });
      return;
    }

    setIsSending(true);
    setSendStatus(null);

    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "pt", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imageData, "PNG", 0, 0, pdfWidth, pdfHeight);
      const pdfDataUri = pdf.output("datauristring");
      const base64Pdf = pdfDataUri.includes(",") ? pdfDataUri.split(",")[1] : pdfDataUri;
      const fileName = `${reportTitle.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
      const gradeLevel = displayGradeLevel;

      const response = await fetch("/api/master_teacher/remedial/report/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          subject,
          gradeLevel,
          teacherName,
          fileName,
          pdfData: base64Pdf,
          reportData: activeRows,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Failed to send report.");
      }
      setSendStatus({ type: "success", message: "Report sent to the principal successfully." });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to send remedial report", error);
      setSendStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to send report.",
      });
    } finally {
      setIsSending(false);
    }
  }, [activeRows, displayGradeLevel, reportTitle, subject, teacherName, userId]);

  const handleSubjectCellChange = useCallback(
    (index: number, field: RemedialReportField, value: string) => {
      handleCellChange(subject, index, field, value);
    },
    [handleCellChange, subject],
  );

  const disableActions = isLoading || Boolean(loadError) || activeRows.length === 0;

  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      <Sidebar />
      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Report" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="relative z-10 h-full min-h-100 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-5 md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 no-print">
                <h1 className="text-xl font-bold text-gray-800">{reportTitle}</h1>
                <div className="flex flex-wrap gap-2 md:ml-auto items-center">
                  <Link
                    href={`/MasterTeacher/RemedialTeacher/report/${subject}/students`}
                    className="inline-flex items-center gap-2 rounded-md border border-green-700 px-3 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-50"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span>View Individual Progress</span>
                  </Link>
                  <KebabMenu
                    small
                    renderItems={(close) => (
                      <div className="py-1">
                        <button
                          onClick={() => {
                            handleEditToggle();
                            close();
                          }}
                          disabled={disableActions}
                          className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                          {isEditing ? "Save" : "Edit"}
                        </button>
                        <button
                          onClick={() => {
                            handleSend();
                            close();
                          }}
                          disabled={disableActions || isSending}
                          className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m22 2-7 20-4-9-9-4Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M22 2 11 13" />
                          </svg>
                          {isSending ? "Sending..." : "Send Report"}
                        </button>
                        <button
                          onClick={() => {
                            handlePrint();
                            close();
                          }}
                          disabled={disableActions}
                          className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
                            <rect x="6" y="14" width="12" height="8" rx="1" />
                          </svg>
                          Print
                        </button>
                      </div>
                    )}
                  />
                </div>
              </div>

              {sendStatus && (
                <p
                  className={`mb-4 text-sm ${
                    sendStatus.type === "success" ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {sendStatus.message}
                </p>
              )}

              <div ref={reportRef}>
                {isLoading ? (
                  <div className="py-12 text-center text-sm text-gray-500">Loading students...</div>
                ) : loadError ? (
                  <div className="py-12 text-center text-sm text-red-600">{loadError}</div>
                ) : (
                  <Component
                    rows={activeRows}
                    editable={isEditing}
                    onCellChange={handleSubjectCellChange}
                    monthColumns={monthColumns}
                    quarterGroups={quarterGroups}
                  />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
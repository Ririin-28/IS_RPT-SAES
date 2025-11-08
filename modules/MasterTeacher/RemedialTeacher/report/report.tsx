"use client";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
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

const sanitize = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : "";
};

const composeStudentName = (student: RemedialStudentRecord): string => {
  const explicit = sanitize(student.fullName);
  if (explicit.length) {
    return explicit;
  }
  const parts = [student.firstName, student.middleName, student.lastName]
    .map((part) => sanitize(part))
    .filter((part) => part.length > 0);
  if (parts.length) {
    return parts.join(" ");
  }
  return "Unnamed Student";
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
    learner: composeStudentName(student),
    section: sanitize(student.section),
    gradeLevel,
    preAssessment: "",
    october: "",
    december: "",
    midYear: "",
    postAssessment: "",
    endingProfile: "",
  };
  return { ...baseRow, ...overrides };
};

const buildRowsForStudents = (
  students: RemedialStudentRecord[],
  fallbackGrade: string,
  mapper?: (student: RemedialStudentRecord, index: number) => Partial<RemedialReportRow>,
): RemedialReportRow[] =>
  students.map((student, index) => toReportRow(student, index, fallbackGrade, mapper?.(student, index)));

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
    return grade || "Grade 3";
  }, [userProfile]);

  const [rowsBySubject, setRowsBySubject] = useState<Record<SubjectKey, RemedialReportRow[]>>(createEmptyRows);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);

  const activeRows = rowsBySubject[subject] ?? [];
  const displayGradeLevel = useMemo(() => {
    if (activeRows.length > 0) {
      const gradeCandidate = sanitize(activeRows[0].gradeLevel);
      if (gradeCandidate) {
        return gradeCandidate;
      }
    }
    return fallbackGrade;
  }, [activeRows, fallbackGrade]);

  const reportTitle = useMemo(
    () => `Progress Report for ${displayGradeLevel} - ${subjectLabel}`,
    [displayGradeLevel, subjectLabel],
  );

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
          `/api/master_teacher/remedial/students?userId=${encodeURIComponent(String(userId))}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as RemedialStudentResponse;
        if (!response.ok || !payload.success || !Array.isArray(payload.students)) {
          throw new Error(payload.error ?? "Failed to load students.");
        }

        const englishRows = buildRowsForStudents(payload.students, fallbackGrade, (student) => ({
          preAssessment: sanitize(student.englishStartingLevel),
          october: sanitize(student.englishOctLevel),
          december: sanitize(student.englishDecLevel),
          midYear: sanitize(student.englishFebLevel),
        }));
        const filipinoRows = buildRowsForStudents(payload.students, fallbackGrade, (student) => ({
          preAssessment: sanitize(student.filipinoStartingLevel),
          october: sanitize(student.filipinoOctLevel),
          december: sanitize(student.filipinoDecLevel),
          midYear: sanitize(student.filipinoFebLevel),
        }));
        const mathRows = buildRowsForStudents(payload.students, fallbackGrade, (student) => ({
          preAssessment: sanitize(student.mathStartingLevel),
          october: sanitize(student.mathOctLevel),
          december: sanitize(student.mathDecLevel),
          midYear: sanitize(student.mathFebLevel),
        }));
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

  const handleCellChange = useCallback(
    (subjectKey: SubjectKey, index: number, field: RemedialReportField, value: string) => {
      setRowsBySubject((prev) => {
        const currentRows = prev[subjectKey] ?? [];
        if (!currentRows[index]) {
          return prev;
        }
        const updatedRows = [...currentRows];
        updatedRows[index] = { ...updatedRows[index], [field]: value };
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
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Report" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
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
                  <SecondaryButton small onClick={handleEditToggle} disabled={disableActions}>
                    {isEditing ? "Save" : "Edit"}
                  </SecondaryButton>
                  <PrimaryButton small onClick={handleSend} disabled={disableActions || isSending}>
                    {isSending ? "Sending..." : "Send Report"}
                  </PrimaryButton>
                  <UtilityButton small onClick={handlePrint} disabled={disableActions}>
                    <div className="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
                        <rect x="6" y="14" width="12" height="8" rx="1" />
                      </svg>
                      <span>Print</span>
                    </div>
                  </UtilityButton>
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
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { SUBJECT_CONFIG, type SubjectKey } from "@/app/api/auth/master_teacher/report/subject-config";
import type { RemedialStudentRecord, RemedialStudentResponse } from "./types";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

type StudentCardsGridProps = {
  subject: SubjectKey;
};

type StudentCardData = {
  id: string;
  name: string;
  section: string;
  gradeLevel: string;
  startingLevel: string;
  currentLevel: string;
  currentPeriodLabel: string;
  aiRecommendation: string;
};

type ProgressPeriodKey = "sept" | "oct" | "dec" | "feb";

type ProgressFieldMap = {
  startingField: keyof RemedialStudentRecord;
  latestField: keyof RemedialStudentRecord;
  periodFields: Record<ProgressPeriodKey, keyof RemedialStudentRecord>;
};

const PROGRESS_PERIODS: Array<{ key: ProgressPeriodKey; label: string; monthIndex: number }> = [
  { key: "feb", label: "February", monthIndex: 14 },
  { key: "dec", label: "December", monthIndex: 12 },
  { key: "oct", label: "October", monthIndex: 10 },
  { key: "sept", label: "September", monthIndex: 9 },
];

const SUBJECT_PROGRESS_FIELDS: Record<SubjectKey, ProgressFieldMap> = {
  english: {
    startingField: "englishStartingLevel",
    latestField: "latestEnglishLevel",
    periodFields: {
      sept: "englishSeptLevel",
      oct: "englishOctLevel",
      dec: "englishDecLevel",
      feb: "englishFebLevel",
    },
  },
  filipino: {
    startingField: "filipinoStartingLevel",
    latestField: "latestFilipinoLevel",
    periodFields: {
      sept: "filipinoSeptLevel",
      oct: "filipinoOctLevel",
      dec: "filipinoDecLevel",
      feb: "filipinoFebLevel",
    },
  },
  math: {
    startingField: "mathStartingLevel",
    latestField: "latestMathLevel",
    periodFields: {
      sept: "mathSeptLevel",
      oct: "mathOctLevel",
      dec: "mathDecLevel",
      feb: "mathFebLevel",
    },
  },
};

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

const buildStudentIdentifier = (student: RemedialStudentRecord, index: number): string => {
  const identifier = sanitize(student.studentIdentifier);
  if (identifier) {
    return identifier;
  }
  const studentId = student.studentId ?? student.userId ?? index + 1;
  return `student-${studentId}`;
};

const resolvePeriodCandidates = (today: Date): Array<{ key: ProgressPeriodKey; label: string; monthIndex: number }> => {
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const rawLastMonth = lastMonthDate.getMonth() + 1; // 1-12
  const normalized = rawLastMonth >= 9 ? rawLastMonth : rawLastMonth + 12;
  const candidates = PROGRESS_PERIODS.filter((period) => normalized >= period.monthIndex);
  return candidates.length > 0 ? candidates : [...PROGRESS_PERIODS];
};

const resolveProgressLevel = (
  student: RemedialStudentRecord,
  subject: SubjectKey,
  today: Date,
): { value: string; label: string } => {
  const config = SUBJECT_PROGRESS_FIELDS[subject];
  const periods = resolvePeriodCandidates(today);

  for (const period of periods) {
    const field = config.periodFields[period.key];
    const raw = sanitize(student[field]);
    if (raw) {
      return { value: raw, label: period.label };
    }
  }

  const latest = sanitize(student[config.latestField]);
  if (latest) {
    return { value: latest, label: "Most Recent" };
  }

  const starting = sanitize(student[config.startingField]);
  if (starting) {
    return { value: starting, label: "Starting Level" };
  }

  return { value: "", label: "Most Recent" };
};

const StudentCard = ({ student }: { student: StudentCardData }) => (
  <article className="flex flex-col gap-4 rounded-2xl border border-green-200 bg-white p-6 shadow-md transition print:shadow-none print:border print:rounded-xl">
    <header className="border-b border-green-200 pb-3">
      <h2 className="text-lg font-semibold text-[#013300] leading-tight">{student.name}</h2>
      <p className="text-sm text-gray-600 mt-1">
        {student.gradeLevel} • {student.section}
      </p>
    </header>
    <dl className="space-y-3 text-sm text-gray-700">
      <div className="rounded-lg bg-green-50/70 px-3 py-2">
        <dt className="text-xs font-semibold uppercase tracking-wide text-green-900">Starting Level</dt>
        <dd className="text-base font-medium text-[#013300]">{student.startingLevel || "—"}</dd>
      </div>
      <div className="rounded-lg bg-green-50/70 px-3 py-2">
        <dt className="text-xs font-semibold uppercase tracking-wide text-green-900">
          Current Level ({student.currentPeriodLabel})
        </dt>
        <dd className="text-base font-medium text-[#013300]">{student.currentLevel || "—"}</dd>
      </div>
      <div className="rounded-lg border border-green-100 px-3 py-3">
        <dt className="text-xs font-semibold uppercase tracking-wide text-green-900">AI Recommendation</dt>
        <dd className="mt-1 text-sm leading-relaxed text-gray-700">{student.aiRecommendation}</dd>
      </div>
    </dl>
  </article>
);

export default function StudentCardsGrid({ subject }: StudentCardsGridProps) {
  const { subjectLabel } = SUBJECT_CONFIG[subject];
  const containerRef = useRef<HTMLDivElement>(null);
  const [rawStudents, setRawStudents] = useState<RemedialStudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const fallbackGrade = useMemo(() => {
    const grade = sanitize(userProfile?.gradeLevel ?? "");
    return grade || "Grade 3";
  }, [userProfile]);

  useEffect(() => {
    if (userId === null) {
      setRawStudents([]);
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
        setRawStudents(payload.students);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to load remedial student cards", error);
        setRawStudents([]);
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
  }, [userId]);

  const today = useMemo(() => new Date(), []);

  const cards = useMemo(() => {
    return rawStudents.map((student, index) => {
      const id = buildStudentIdentifier(student, index);
      const name = composeStudentName(student);
      const section = sanitize(student.section) || "—";
      const gradeLevel = sanitize(student.grade) || fallbackGrade;
      const config = SUBJECT_PROGRESS_FIELDS[subject];
      const startingLevel = sanitize(student[config.startingField]) || "—";
      const { value: currentLevel, label } = resolveProgressLevel(student, subject, today);

      return {
        id,
        name,
        section,
        gradeLevel,
        startingLevel,
        currentLevel,
        currentPeriodLabel: label,
        aiRecommendation: "No AI recommendation available yet.",
      } as StudentCardData;
    });
  }, [fallbackGrade, rawStudents, subject, today]);

  const displayGradeLevel = useMemo(() => {
    if (cards.length > 0) {
      const gradeCandidate = sanitize(cards[0].gradeLevel);
      if (gradeCandidate) {
        return gradeCandidate;
      }
    }
    return fallbackGrade;
  }, [cards, fallbackGrade]);

  const reportTitle = useMemo(
    () => `Progress Report for ${displayGradeLevel} - ${subjectLabel}`,
    [displayGradeLevel, subjectLabel],
  );

  const handlePrint = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    const printContent = containerRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportTitle} - Individual Progress</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              .no-print { display: none !important; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body class="p-6">
          <div class="mb-6 border-b-2 border-black pb-4 text-center">
            <h1 class="text-2xl font-bold">${reportTitle}</h1>
            <p class="text-sm">Individual Student Progress Overview</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            ${printContent}
          </div>
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

  const disableActions = isLoading || Boolean(loadError) || cards.length === 0;

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Report" />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 min-h-[400px] overflow-hidden">
              <div className="no-print flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 sm:py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-800">{reportTitle}</h1>
                  <p className="text-sm text-gray-600">Individual Student Progress Overview</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/MasterTeacher/RemedialTeacher/report/${subject}`}
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
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                    <span>Back to Progress Table</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-2 rounded-md bg-[#013300] px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-900"
                    disabled={disableActions}
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
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
                      <rect x="6" y="14" width="12" height="8" rx="1" />
                    </svg>
                    <span>Print Cards</span>
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto bg-gray-50 p-4 sm:p-6" ref={containerRef}>
                {isLoading ? (
                  <div className="flex h-32 items-center justify-center text-sm text-gray-500">Loading students...</div>
                ) : loadError ? (
                  <div className="flex h-32 items-center justify-center text-sm text-red-600">{loadError}</div>
                ) : cards.length === 0 ? (
                  <div className="flex h-32 items-center justify-center text-sm text-gray-500">
                    No students found for this subject.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {cards.map((student) => (
                      <StudentCard key={student.id} student={student} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

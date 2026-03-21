"use client";

import { useMemo, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { SUBJECT_CONFIG, normalizeSubject, type SubjectKey } from "@/app/api/auth/master_teacher/report/subject-config";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import TableList from "@/components/Common/Tables/TableList";
import type { RemedialStudentRecord } from "./types";

interface StudentTabProps {
  subject: SubjectKey;
}

const sanitize = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text.length ? text : "";
};

type StudentRow = {
  id: string;
  no: number;
  studentId: string;
  lrn: string;
  fullName: string;
  phonemic: string;
};

const formatStudentName = (student: RemedialStudentRecord): string => {
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

const toDisplayRow = (student: RemedialStudentRecord, index: number, subject: SubjectKey): StudentRow => {
  const studentId = sanitize(student.studentIdentifier) || sanitize(student.studentId) || `student-${index + 1}`;
  const lrn = sanitize(student.lrn);
  const fullName = formatStudentName(student);

  const phonemic = sanitize(
    subject === "english"
      ? student.latestEnglishLevel ?? student.english
      : subject === "filipino"
        ? student.latestFilipinoLevel ?? student.filipino
        : student.latestMathLevel ?? student.math,
  ) || "—";

  return {
    id: studentId,
    no: index + 1,
    studentId,
    lrn,
    fullName,
    phonemic,
  };
};

export default function StudentTab({ subject }: StudentTabProps) {
  const { subjectLabel } = SUBJECT_CONFIG[subject];
  const userProfile = useMemo(() => getStoredUserProfile(), []);

  const userId = useMemo(() => {
    const raw = userProfile?.userId;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }, [userProfile]);

  const [rows, setRows] = useState<StudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const normalizeGradeValue = (value: unknown): string => {
    const match = String(value ?? "").match(/(\d+)/);
    const digit = match?.[1] ?? "";
    return ["1", "2", "3", "4", "5", "6"].includes(digit) ? digit : "";
  };

  const formatGradeLabel = (value: string | null | undefined): string => {
    const numeric = normalizeGradeValue(value);
    return numeric ? `Grade ${numeric}` : "Grade 3";
  };

  const fallbackGrade = useMemo(() => {
    const grade = sanitize(userProfile?.gradeLevel ?? "");
    return normalizeGradeValue(grade) || "3";
  }, [userProfile]);

  const reportTitle = useMemo(
    () => `Progress Report for ${formatGradeLabel(fallbackGrade)} - ${subjectLabel}`,
    [fallbackGrade, subjectLabel],
  );

  useEffect(() => {
    if (userId === null) {
      setRows([]);
      setLoadError("Unable to identify the current user. Please sign in again.");
      return;
    }

    const controller = new AbortController();
    const loadStudents = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({ userId: String(userId), subject });
        const response = await fetch(`/api/master_teacher/remedialteacher/students?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          students?: RemedialStudentRecord[];
          error?: string;
        } | null;

        if (!response.ok || !payload?.success || !Array.isArray(payload.students)) {
          throw new Error(payload?.error ?? `Unable to load students (${response.status}).`);
        }

        setRows(payload.students.map((student, index) => toDisplayRow(student, index, subject)));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to load students", error);
        setRows([]);
        setLoadError(error instanceof Error ? error.message : "Unable to load students.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadStudents();
    return () => controller.abort();
  }, [subject, userId]);

  const columns = useMemo(
    () => [
      { key: "no", title: "No#", render: (row: StudentRow) => row.no },
      { key: "studentId", title: "Student ID", render: (row: StudentRow) => row.studentId || "—" },
      { key: "lrn", title: "LRN", render: (row: StudentRow) => row.lrn || "—" },
      { key: "fullName", title: "Full Name", render: (row: StudentRow) => row.fullName },
      { key: "phonemic", title: "Phonemic", render: (row: StudentRow) => row.phonemic || "—" },
    ],
    [],
  );

  const actions = useCallback(
    (row: StudentRow) => (
      <Link
        href={`/MasterTeacher/RemedialTeacher/report/${normalizeSubject(subject)}/students/${encodeURIComponent(row.studentId)}`}
        className="inline-flex h-10 items-center rounded-lg border border-emerald-700 bg-white px-4 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        aria-label={`View ${row.fullName}`}
      >
        View
      </Link>
    ),
    [subject],
  );

  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Report" />
        <main className="flex-1 overflow-y-auto">
          <div
            className="
            p-4 h-full
            sm:p-5
            md:p-6
          "
          >
            <div className="relative z-10 h-full min-h-100 overflow-hidden rounded-2xl border border-white/70 bg-white/45 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl flex flex-col">
              <div className="no-print flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 sm:py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-800">{reportTitle}</h1>
                  <p className="text-sm text-gray-600">Individual Student Progress Overview</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="flex bg-gray-100 rounded-md p-1">
                    <Link
                      href={`/MasterTeacher/RemedialTeacher/report/${normalizeSubject(subject)}`}
                      aria-label="Grade report view"
                      className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs text-gray-600 transition hover:text-gray-800 sm:text-sm"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 3h16" />
                        <path d="M4 8h16" />
                        <path d="M4 13h16" />
                        <path d="M4 18h16" />
                      </svg>
                    </Link>
                    <span
                      aria-current="page"
                      className="inline-flex items-center justify-center rounded-md bg-white px-3 py-1.5 text-xs text-gray-800 shadow-sm sm:text-sm"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
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
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex-1 min-h-0">
                {loadError && <p className="text-sm text-red-600 mb-3">{loadError}</p>}
                <TableList
                  columns={columns}
                  data={rows}
                  actions={actions}
                  actionHeaderLabel="Action"
                  hidePagination={rows.length <= 0}
                />
                {isLoading && <p className="mt-3 text-sm text-gray-500">Loading students…</p>}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

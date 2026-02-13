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

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

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
        className="inline-flex items-center gap-2 rounded-md bg-[#013300] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-900"
        aria-label={`View ${row.fullName}`}
      >
        View
      </Link>
    ),
    [subject],
  );

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div
        className="
        flex-1 pt-16 flex flex-col overflow-hidden
      "
      >
        <Header title="Report" />
        <main className="flex-1 overflow-y-auto">
          <div
            className="
            p-4 h-full
            sm:p-5
            md:p-6
          "
          >
            <div
              className="
              bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-100
              overflow-hidden flex flex-col
            "
            >
              <div className="no-print flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 sm:py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-800">{reportTitle}</h1>
                  <p className="text-sm text-gray-600">Individual Student Progress Overview</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/MasterTeacher/RemedialTeacher/report/${normalizeSubject(subject)}`}
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
                    <span>Print Table</span>
                  </button>
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

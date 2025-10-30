"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { SUBJECT_CONFIG, type SubjectKey } from "@/app/api/auth/master_teacher/report/subject-config";
import { STUDENT_DATA, type StudentProgress } from "@/app/api/auth/master_teacher/report/students-data";

type StudentCardsGridProps = {
  subject: SubjectKey;
};

const StudentCard = ({ student }: { student: StudentProgress }) => (
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
        <dd className="text-base font-medium text-[#013300]">{student.startingLevel}</dd>
      </div>
      <div className="rounded-lg bg-green-50/70 px-3 py-2">
        <dt className="text-xs font-semibold uppercase tracking-wide text-green-900">Current Level</dt>
        <dd className="text-base font-medium text-[#013300]">{student.currentLevel}</dd>
      </div>
      <div className="rounded-lg border border-green-100 px-3 py-3">
        <dt className="text-xs font-semibold uppercase tracking-wide text-green-900">AI Recommendation</dt>
        <dd className="mt-1 text-sm leading-relaxed text-gray-700">{student.aiRecommendation}</dd>
      </div>
    </dl>
  </article>
);

export default function StudentCardsGrid({ subject }: StudentCardsGridProps) {
  const { title } = SUBJECT_CONFIG[subject];
  const containerRef = useRef<HTMLDivElement>(null);
  const students = useMemo(() => STUDENT_DATA[subject] ?? [], [subject]);

  const handlePrint = () => {
    if (!containerRef.current) return;
    const printContent = containerRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - Individual Progress</title>
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
            <h1 class="text-2xl font-bold">${title}</h1>
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
  };

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
                  <h1 className="text-xl font-bold text-gray-800">{title}</h1>
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
                <div className="grid gap-4 sm:grid-cols-2">
                  {students.map((student) => (
                    <StudentCard key={student.id} student={student} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

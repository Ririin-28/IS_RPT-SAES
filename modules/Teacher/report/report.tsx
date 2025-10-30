"use client";
import TeacherSidebar from "@/components/Teacher/Sidebar";
import TeacherHeader from "@/components/Teacher/Header";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import Link from "next/link";
import { useRef } from "react";
import { SUBJECT_CONFIG, normalizeSubject } from "@/app/api/auth/teacher/report/subject-config";

type TeacherReportProps = {
  subjectSlug?: string;
};

export default function TeacherReport({ subjectSlug }: TeacherReportProps) {
  const subject = normalizeSubject(subjectSlug);
  const { title, Component } = SUBJECT_CONFIG[subject];
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!reportRef.current) return;
    const printContent = reportRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
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
            <h1 class="text-2xl font-bold">${title}</h1>
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
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <TeacherSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <TeacherHeader title="Report" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 no-print">
                <h1 className="text-xl font-bold text-gray-800">{title}</h1>
                <div className="flex flex-wrap gap-2 md:ml-auto">
                  <Link
                    href={`/Teacher/report/${subject}/students`}
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
                  <UtilityButton small onClick={handlePrint}>
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

              <div ref={reportRef}>
                <Component />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
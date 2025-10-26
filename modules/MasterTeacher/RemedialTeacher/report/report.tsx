"use client";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import EnglishReportTab from "./EnglishTab/EnglishTab";
import FilipinoReportTab from "./FilipinoTab/FilipinoTab";
import MathReportTab from "./MathTab/MathTab";
import { useRef, type ComponentType } from "react";

type SubjectKey = "english" | "filipino" | "math";

type MasterTeacherReportProps = {
  subjectSlug?: string;
};

type SubjectConfig = {
  title: string;
  Component: ComponentType<Record<string, never>>;
};

const SUBJECT_CONFIG: Record<SubjectKey, SubjectConfig> = {
  english: {
    title: "Progress Report for Grade Three - English",
    Component: EnglishReportTab,
  },
  filipino: {
    title: "Progress Report for Grade Three - Filipino",
    Component: FilipinoReportTab,
  },
  math: {
    title: "Progress Report for Grade Three - Mathematics",
    Component: MathReportTab,
  },
};

const normalizeSubject = (slug?: string): SubjectKey => {
  const value = (slug ?? "english").toLowerCase();
  if (value === "filipino") return "filipino";
  if (value === "math" || value === "mathematics") return "math";
  return "english";
};

export default function MasterTeacherReport({ subjectSlug }: MasterTeacherReportProps) {
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
      <Sidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Report" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="flex justify-between items-center mb-4 no-print">
                <h1 className="text-xl font-bold text-gray-800">{title}</h1>
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
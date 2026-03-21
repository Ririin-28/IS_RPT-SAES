"use client";
import Sidebar from "@/components/Principal/Sidebar";
import PrincipalHeader from "@/components/Principal/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { Printer } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { FaTimes } from "react-icons/fa";
// English Tabs (single unified component)
import EnglishTab from "./EnglishTabs/EnglishTab";
import FilipinoTab from "./FilipinoTabs/FilipinoTab";
import MathTab from "./MathTabs/MathTab";

type SubjectKey = "english" | "filipino" | "math";

interface PrincipalReportsProps {
  subjectSlug?: string;
}

const SUBJECT_LABELS: Record<SubjectKey, string> = {
  english: "English",
  filipino: "Filipino",
  math: "Math",
};

type GradeTabProps = {
  searchTerm: string;
  gradeLevel?: string;
};

const GRADE_OPTIONS = ["All Grades", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];

const toGradeLabel = (value: string | undefined): string => {
  if (!value) return "";
  if (value.startsWith("Grade")) return value;
  const digits = value.match(/(\d+)/)?.[1] ?? "";
  return digits ? `Grade ${digits}` : value;
};

const SUBJECT_GRADE_COMPONENTS: Record<SubjectKey, Record<string, ComponentType<GradeTabProps>>> = {
  english: {
    "Grade 1": EnglishTab,
    "Grade 2": EnglishTab,
    "Grade 3": EnglishTab,
    "Grade 4": EnglishTab,
    "Grade 5": EnglishTab,
    "Grade 6": EnglishTab,
  },
  filipino: {
    "Grade 1": FilipinoTab,
    "Grade 2": FilipinoTab,
    "Grade 3": FilipinoTab,
    "Grade 4": FilipinoTab,
    "Grade 5": FilipinoTab,
    "Grade 6": FilipinoTab,
  },
  math: {
    "Grade 1": MathTab,
    "Grade 2": MathTab,
    "Grade 3": MathTab,
    "Grade 4": MathTab,
    "Grade 5": MathTab,
    "Grade 6": MathTab,
  },
};

const normalizeSubject = (slug?: string): SubjectKey => {
  const value = (slug ?? "english").toLowerCase();
  if (value === "filipino") return "filipino";
  if (value === "math" || value === "mathematics") return "math";
  return "english";
};

export default function PrincipalReports({ subjectSlug }: PrincipalReportsProps) {
  const subject = normalizeSubject(subjectSlug);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeGrade, setActiveGrade] = useState(() => {
    const initialComponents = SUBJECT_GRADE_COMPONENTS[subject] ?? SUBJECT_GRADE_COMPONENTS.english;
    return Object.keys(initialComponents)[0] ?? GRADE_OPTIONS[0];
  });
  const subjectLabel = useMemo(() => SUBJECT_LABELS[subject] ?? "" , [subject]);
  const subjectGradeComponents = SUBJECT_GRADE_COMPONENTS[subject] ?? SUBJECT_GRADE_COMPONENTS.english;
  const gradeOptions = useMemo(() => Object.keys(subjectGradeComponents), [subjectGradeComponents]);
  const fallbackGrade = gradeOptions[0] ?? "";
  const ActiveGradeComponent =
    subjectGradeComponents[activeGrade] ??
    (fallbackGrade ? subjectGradeComponents[fallbackGrade] : undefined) ??
    EnglishTab;

  useEffect(() => {
    if (!activeGrade || !(activeGrade in subjectGradeComponents)) {
      if (fallbackGrade) {
        setActiveGrade(fallbackGrade);
      }
    }
  }, [subject, activeGrade, subjectGradeComponents, fallbackGrade]);

  const handlePrint = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
  }, []);

  return (
    <div className="principal-reports-page relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      {/*---------------------------------Sidebar---------------------------------*/}
      <div className="print-hidden">
        <Sidebar />
      </div>

      {/*---------------------------------Main Content---------------------------------*/}
      <div className="principal-reports-main relative z-10 flex flex-1 flex-col overflow-hidden pt-16">
        <div className="print-hidden">
          <PrincipalHeader title="Progress Reports" />
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="principal-reports-scroll relative h-full p-4 sm:p-5 md:p-6">
            {/*---------------------------------Main Container---------------------------------*/}
            <div className="principal-reports-surface relative flex h-full min-h-100 flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/45 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl">
              <div className="print-hidden p-4 sm:p-5 border-b border-gray-100 shrink-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-0 w-full sm:w-auto">
                    <SecondaryHeader title={`Reports for ${subjectLabel}`} />
                    <HeaderDropdown
                      options={gradeOptions.length ? gradeOptions : GRADE_OPTIONS}
                      value={activeGrade}
                      onChange={(value) => setActiveGrade(value)}
                      className="pl-2"
                    />
                  </div>

                  {/* Search bar aligned to the right */}
                  <div className="mt-4 flex w-full items-center gap-3 sm:mt-0 sm:w-auto">
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-100"
                      aria-label="Print report"
                      title="Print"
                    >
                      <Printer className="h-5 w-5" />
                    </button>
                    <div className="relative w-full sm:w-72">
                      <input
                        type="text"
                        placeholder="Search learners..."
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 text-black"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      {searchTerm && (
                        <button
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          onClick={() => setSearchTerm("")}
                        >
                          <FaTimes />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/*---------------------------------Tab Content---------------------------------*/}
              <div className="principal-reports-content flex-1 min-h-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-4 overflow-y-auto">
                <ActiveGradeComponent
                  searchTerm={searchTerm}
                  gradeLevel={toGradeLabel(activeGrade)}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 12mm;
          }

          html,
          body {
            background: #ffffff !important;
          }

          .print-hidden {
            display: none !important;
          }

          .principal-reports-page,
          .principal-reports-main,
          .principal-reports-scroll,
          .principal-reports-surface,
          .principal-reports-content {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: "Times New Roman", Times, serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .report-table-printable,
          .report-table-printable * {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .principal-reports-main {
            padding-top: 0 !important;
          }

          .principal-reports-main main {
            overflow: visible !important;
          }

          .principal-reports-scroll {
            padding: 0 !important;
          }

          .principal-reports-content {
            padding: 0 !important;
          }

          .principal-reports-surface {
            border: 0 !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
          }

          .principal-reports-page .pointer-events-none {
            display: none !important;
          }

          .report-header-grid {
            display: block !important;
            margin: 0 0 12px !important;
          }

          .report-title-card,
          .report-table-shell {
            border: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          .report-title-card {
            margin: 0 0 8px !important;
            text-align: center !important;
          }

          .report-title-card::after {
            content: "";
            display: block;
            margin-top: 10px;
            border-top: 2px solid #000000;
          }

          .report-title {
            margin: 0 !important;
            color: #000000 !important;
            font-size: 16pt !important;
            font-weight: 700 !important;
            line-height: 1.2 !important;
          }

          .report-description {
            display: none !important;
          }

          .report-table-printable > div {
            gap: 0 !important;
          }

          .report-table-printable > div > div {
            overflow: visible !important;
            border: 0 !important;
          }

          .report-table-printable table {
            width: 100% !important;
            table-layout: fixed;
            border-collapse: collapse !important;
            font-size: 10.5pt !important;
          }

          .report-table-printable th,
          .report-table-printable td {
            border: 1px solid #666666 !important;
            padding: 8px 6px !important;
            color: #000000 !important;
            font-size: 10.5pt !important;
            line-height: 1.25 !important;
            background: #ffffff !important;
          }

          .report-table-printable .report-row-number-cell {
            width: 6%;
          }

          .report-table-printable .report-learner-cell {
            width: 24%;
          }

          .report-table-printable .report-section-cell {
            width: 10%;
          }

          .report-table-printable thead {
            display: table-header-group !important;
          }

          .report-table-printable tfoot {
            display: table-footer-group !important;
          }

          .report-table-printable tr {
            page-break-inside: avoid;
            break-inside: avoid;
            background: #ffffff !important;
          }
        }
      `}</style>
    </div>
  );
}

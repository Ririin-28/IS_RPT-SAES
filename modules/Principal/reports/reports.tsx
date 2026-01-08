"use client";
import Sidebar from "@/components/Principal/Sidebar";
import PrincipalHeader from "@/components/Principal/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { useEffect, useMemo, useState, type ComponentType } from "react";
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
  onSearchTermChange: (value: string) => void;
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

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/*---------------------------------Sidebar---------------------------------*/}
      <Sidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div
        className="
        /* Mobile */
        flex-1 pt-16 flex flex-col overflow-hidden
        
      "
      >
        <PrincipalHeader title="Progress Reports" />
        <main className="flex-1">
          <div
            className="
            /* Mobile */
            p-4 h-full
            
            /* Tablet */
            sm:p-5
            
            /* Desktop */
            md:p-6
          "
          >
            {/*---------------------------------Main Container---------------------------------*/}
            <div
              className="
              /* Mobile */
              bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] 
              overflow-y-auto p-4
              
              /* Tablet */
              sm:p-5
              
              /* Desktop */
              md:p-6
            "
            >
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
                <div className="flex gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                  <div className="relative w-full sm:w-72">
                    <input
                      type="text"
                      placeholder="Search teachers..."
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

              {/*---------------------------------Tab Content---------------------------------*/}
              <div className="space-y-4">
                <ActiveGradeComponent
                  searchTerm={searchTerm}
                  onSearchTermChange={(value) => setSearchTerm(value)}
                  gradeLevel={toGradeLabel(activeGrade)}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
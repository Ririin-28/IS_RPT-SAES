"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import EnglishAssessmentTab, { ENGLISH_ASSESSMENT_LEVELS, type EnglishAssessmentLevel } from "./EnglishTabs/EnglishAssessmentTab";
import FilipinoAssessmentTab, { FILIPINO_ASSESSMENT_LEVELS, type FilipinoAssessmentLevel } from "./FilipinoTabs/FilipinoAssessmentTab";
import MathAssessmentTab, { MATH_ASSESSMENT_LEVELS, type MathAssessmentLevel } from "./MathTabs/MathAssessmentTab";

type AssessmentSubject = "English" | "Filipino" | "Math";

interface MasterTeacherAssessmentProps {
  language?: string;
}

const ENGLISH_SUBJECTS = new Set(["english", "en", "eng"]);
const FILIPINO_SUBJECTS = new Set(["filipino", "fil", "tagalog"]);
const MATH_SUBJECTS = new Set(["math", "mathematics"]);

function normalizeSubjectFromLanguage(value?: string): AssessmentSubject | null {
  if (!value) {
    return null;
  }
  const lowercase = value.toLowerCase();
  if (ENGLISH_SUBJECTS.has(lowercase)) return "English";
  if (FILIPINO_SUBJECTS.has(lowercase)) return "Filipino";
  if (MATH_SUBJECTS.has(lowercase)) return "Math";
  return null;
}

function normalizeSubjectFromPath(pathname?: string | null): AssessmentSubject | null {
  if (!pathname) {
    return null;
  }
  if (pathname.includes("/assessment/english")) return "English";
  if (pathname.includes("/assessment/filipino")) return "Filipino";
  if (pathname.includes("/assessment/math")) return "Math";
  return null;
}

export default function MasterTeacherAssessment({ language }: MasterTeacherAssessmentProps) {
  const pathname = usePathname();

  const determineInitialSubject = () =>
    normalizeSubjectFromLanguage(language) ??
    normalizeSubjectFromPath(pathname) ??
    "English";

  const initialSubject = useMemo(determineInitialSubject, [language, pathname]);
  const [subject, setSubject] = useState<AssessmentSubject>(initialSubject);
  const [activeTab, setActiveTab] = useState<EnglishAssessmentLevel | FilipinoAssessmentLevel | MathAssessmentLevel>(
    subject === "English"
      ? ENGLISH_ASSESSMENT_LEVELS[0]
      : subject === "Filipino"
      ? FILIPINO_ASSESSMENT_LEVELS[0]
      : MATH_ASSESSMENT_LEVELS[0]
  );

  useEffect(() => {
    const nextSubject = normalizeSubjectFromLanguage(language) ?? normalizeSubjectFromPath(pathname) ?? "English";
    setSubject((current) => (current === nextSubject ? current : nextSubject));
  }, [language, pathname]);

  useEffect(() => {
    if (subject === "English") {
      setActiveTab(ENGLISH_ASSESSMENT_LEVELS[0]);
    } else if (subject === "Filipino") {
      setActiveTab(FILIPINO_ASSESSMENT_LEVELS[0]);
    } else {
      setActiveTab(MATH_ASSESSMENT_LEVELS[0]);
    }
  }, [subject]);

  const currentTabOptions = useMemo(() => {
    if (subject === "English") return ENGLISH_ASSESSMENT_LEVELS;
    if (subject === "Filipino") return FILIPINO_ASSESSMENT_LEVELS;
    return MATH_ASSESSMENT_LEVELS;
  }, [subject]);

  const subjectHeader = `${subject} Assessment`;

  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      {/*---------------------------------Sidebar---------------------------------*/}
      <Sidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Assessment" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            {/*---------------------------------Main Container---------------------------------*/}
            <div className="relative z-10 h-full min-h-100 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-5 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="flex items-center gap-0">
                  <SecondaryHeader title={subjectHeader} />
                  <HeaderDropdown
                    options={[...currentTabOptions]}
                    value={activeTab}
                    onChange={(value) => {
                      if (subject === "English") {
                        setActiveTab(value as EnglishAssessmentLevel);
                      } else if (subject === "Filipino") {
                        setActiveTab(value as FilipinoAssessmentLevel);
                      } else {
                        setActiveTab(value as MathAssessmentLevel);
                      }
                    }}
                    className="pl-2"
                  />
                </div>
              </div>

              {/*---------------------------------Tab Content---------------------------------*/}
              <div className="mt-1 sm:mt-2">
                {/* English Assessment */}
                {subject === "English" && (
                  <EnglishAssessmentTab level={activeTab as EnglishAssessmentLevel} />
                )}
                {/* Filipino Assessment */}
                {subject === "Filipino" && <FilipinoAssessmentTab level={activeTab as FilipinoAssessmentLevel} />}
                {/* Math Assessment */}
                {subject === "Math" && <MathAssessmentTab level={activeTab as MathAssessmentLevel} />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
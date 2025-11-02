"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import TeacherSidebar from "@/components/Teacher/Sidebar";
import TeacherHeader from "@/components/Teacher/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import EnglishAssessmentTab, { ENGLISH_ASSESSMENT_LEVELS, type EnglishAssessmentLevel } from "./EnglishTabs/EnglishAssessmentTab";
import FilipinoAssessmentTab, { FILIPINO_ASSESSMENT_LEVELS, type FilipinoAssessmentLevel } from "./FilipinoTabs/FilipinoAssessmentTab";
import MathAssessmentTab, { MATH_ASSESSMENT_LEVELS, type MathAssessmentLevel } from "./MathTabs/MathAssessmentTab";

type AssessmentSubject = "English" | "Filipino" | "Math";

interface TeacherAssessmentProps {
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

export default function TeacherAssessment({ language }: TeacherAssessmentProps) {
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
    <div className="flex h-screen bg-white overflow-hidden">
      {/*---------------------------------Sidebar---------------------------------*/}
      <TeacherSidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <TeacherHeader title="Assessment" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            {/*---------------------------------Main Container---------------------------------*/}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
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
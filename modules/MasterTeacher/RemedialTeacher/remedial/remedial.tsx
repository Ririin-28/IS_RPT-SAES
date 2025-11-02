"use client";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
// Tabs
// English Tabs
import EnglishTab, { ENGLISH_LEVELS, type EnglishLevel } from "./EnglishTabs/EnglishTab";
// Filipino Tabs
import FilipinoTab, { FILIPINO_LEVELS, type FilipinoLevel } from "./FilipinoTabs/FilipinoTab";
// Math Tabs
import MathTab, { MATH_LEVELS, type MathLevel } from "./MathTabs/MathTab";

type AssessmentLevel = EnglishLevel;
const ASSESSMENT_LEVELS = ENGLISH_LEVELS;

export default function MasterTeacherRemedial() {
  const pathname = usePathname();

  // Determine subject from URL path
  const getSubjectFromPath = () => {
    if (pathname?.includes("/assessment")) return "Assessment";
    if (pathname?.includes("/english")) return "English";
    if (pathname?.includes("/filipino")) return "Filipino";
    if (pathname?.includes("/math")) return "Math";
    return "English"; // default
  };

  const initialSubject = getSubjectFromPath();
  const initialTab = initialSubject === "English" ? ENGLISH_LEVELS[0] : initialSubject === "Filipino" ? FILIPINO_LEVELS[0] : initialSubject === "Math" ? MATH_LEVELS[0] : ASSESSMENT_LEVELS[0];

  const [subject, setSubject] = useState(initialSubject);
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Update subject when path changes
  useEffect(() => {
    const newSubject = getSubjectFromPath();
    setSubject(newSubject);
  }, [pathname]);

  const currentTabOptions = subject === "English" ? ENGLISH_LEVELS : subject === "Filipino" ? FILIPINO_LEVELS : subject === "Math" ? MATH_LEVELS : ASSESSMENT_LEVELS;

  const assessmentLanguage = useMemo(() => {
    if (pathname?.includes("/assessment/filipino")) return "Filipino";
    if (pathname?.includes("/assessment/math")) return "Math";
    return "English";
  }, [pathname]);
  
  // Reset active tab when subject changes
  useEffect(() => {
    if (subject === "English") {
      setActiveTab(ENGLISH_LEVELS[0]);
    } else if (subject === "Filipino") {
      setActiveTab(FILIPINO_LEVELS[0]);
    } else if (subject === "Math") {
      setActiveTab(MATH_LEVELS[0]);
    } else if (subject === "Assessment") {
      setActiveTab(ASSESSMENT_LEVELS[0]);
    }
  }, [subject]);

  const subjectHeader = subject === "Assessment" ? "Assessment Center" : `${subject} Remedial`;

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
        <Header title="Remedial" />
        <main className="flex-1 overflow-y-auto">
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex items-center gap-0">
                  <SecondaryHeader title={subjectHeader} />
                  <HeaderDropdown
                    options={[...currentTabOptions]}
                    value={activeTab}
                    onChange={(value) => setActiveTab(value as typeof activeTab)}
                    className="pl-2"
                  />
                </div>
              </div>

              {/*---------------------------------Tab Content---------------------------------*/}
              <div
                className="
                /* Mobile */
                mt-1
                /* Tablet */
                sm:mt-2
              "
              >
                {/* English */}
                {subject === "English" && (
                  <>
                    <EnglishTab level={activeTab as EnglishLevel} />
                  </>
                )}
                {/* Filipino */}
                {subject === "Filipino" && <FilipinoTab level={activeTab as FilipinoLevel} />}
                {/* Math */}
                {subject === "Math" && <MathTab level={activeTab as MathLevel} />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}



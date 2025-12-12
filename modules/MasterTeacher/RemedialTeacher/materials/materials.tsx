"use client";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useEffect, useMemo, useState } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";
import { usePathname } from "next/navigation";
// English Tabs
import EnglishTab, { ENGLISH_LEVELS, type EnglishLevel } from "./EnglishTabs/EnglishTab";
// Filipino Tabs
import FilipinoTab, { FILIPINO_LEVELS, type FilipinoLevel } from "./FilipinoTabs/FilipinoTab";
// Math Tabs
import MathTab, { MATH_LEVELS, type MathLevel } from "./MathTabs/MathTab";

const SUBJECT_OPTIONS = ["English", "Filipino", "Math"] as const;

export default function MasterTeacherMaterials() {
  const pathname = usePathname();
  const subject = useMemo<(typeof SUBJECT_OPTIONS)[number]>(() => {
    if (!pathname) return "English";
    const lowerPath = pathname.toLowerCase();
    if (lowerPath.includes("/materials/filipino")) return "Filipino";
    if (lowerPath.includes("/materials/math")) return "Math";
    return "English";
  }, [pathname]);
  const [activeTab, setActiveTab] = useState("Non Reader");
  const [searchTerm, setSearchTerm] = useState("");

  const englishTabs = ENGLISH_LEVELS;
  const filipinoTabs = FILIPINO_LEVELS;
  const mathTabs = MATH_LEVELS;

  const currentTabOptions = subject === "English" ? englishTabs : subject === "Filipino" ? filipinoTabs : mathTabs;

  const ensureEnglishLevel = (value: string): EnglishLevel =>
    englishTabs.find((level) => level === value) ?? englishTabs[0];

  const ensureFilipinoLevel = (value: string): FilipinoLevel =>
    filipinoTabs.find((level) => level === value) ?? filipinoTabs[0];

  const ensureMathLevel = (value: string): MathLevel =>
    mathTabs.find((level) => level === value) ?? mathTabs[0];

  useEffect(() => {
    const defaultTab = subject === "English" ? englishTabs[0] : subject === "Filipino" ? filipinoTabs[0] : mathTabs[0];
    setActiveTab(defaultTab);
  }, [subject]);

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
        <Header title="Materials" />
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="flex flex-col gap-0 sm:flex-row sm:items-center sm:gap-0">
                  <div className="flex items-center gap-2">
                    <SecondaryHeader title={`${subject} Materials`} />
                  </div>
                  <HeaderDropdown
                    options={[...currentTabOptions]}
                    value={activeTab}
                    onChange={setActiveTab}
                    className="pl-2"
                  />
                </div>
                <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="relative flex-1 sm:flex-initial">
                    <input
                      type="text"
                      placeholder="Search materials..."
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 text-black"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setSearchTerm("")}
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/*---------------------------------Tab Content---------------------------------*/}
              <div
                className="
                /* Mobile */
                mt-2

                /* Tablet */
                sm:mt-2
              "
              >
                {subject === "English" && <EnglishTab level={ensureEnglishLevel(activeTab)} searchTerm={searchTerm} />}
                {subject === "Filipino" && <FilipinoTab level={ensureFilipinoLevel(activeTab)} searchTerm={searchTerm} />}
                {subject === "Math" && <MathTab level={ensureMathLevel(activeTab)} searchTerm={searchTerm} />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}



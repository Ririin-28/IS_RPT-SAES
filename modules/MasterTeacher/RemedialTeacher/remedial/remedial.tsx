"use client";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
// Tabs
// English Tabs
import NonReaderTab from "./EnglishTabs/NonReaderTab";
import SyllableTab from "./EnglishTabs/SyllableTab";
import WordTab from "./EnglishTabs/WordTab";
import SentenceTab from "./EnglishTabs/SentenceTab";
import ParagraphTab from "./EnglishTabs/ParagraphTab";
import PhraseTab from "./EnglishTabs/PhraseTab";
// Filipino Tabs
import FilipinoNonReaderTab from "./FilipinoTabs/NonReaderTab";
import FilipinoSyllableTab from "./FilipinoTabs/SyllableTab";
import FilipinoWordTab from "./FilipinoTabs/WordTab";
import FilipinoPhraseTab from "./FilipinoTabs/PhraseTab";
import FilipinoSentenceTab from "./FilipinoTabs/SentenceTab";
import FilipinoParagraphTab from "./FilipinoTabs/ParagraphTab";
// Math Tabs
import NotProficientTab from "./MathTabs/NotProficientTab";
import LowProficientTab from "./MathTabs/LowProficientTab";
import NearlyProficientTab from "./MathTabs/NearlyProficientTab";
import ProficientTab from "./MathTabs/ProficientTab";
import HighlyProficientTab from "./MathTabs/HighlyProficientTab";

export default function MasterTeacherRemedial() {
  const pathname = usePathname();
  
  // Determine subject from URL path
  const getSubjectFromPath = () => {
    if (pathname?.includes('/english')) return 'English';
    if (pathname?.includes('/filipino')) return 'Filipino';
    if (pathname?.includes('/math')) return 'Math';
    return 'English'; // default
  };
  
  const [subject, setSubject] = useState(getSubjectFromPath());
  const [activeTab, setActiveTab] = useState("Non Reader");
  
  // Update subject when path changes
  useEffect(() => {
    const newSubject = getSubjectFromPath();
    setSubject(newSubject);
  }, [pathname]);

  const englishTabs = ["Non Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"] as const;
  const filipinoTabs = ["Non Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"] as const;
  const mathTabs = [
    "Not Proficient",
    "Low Proficient",
    "Nearly Proficient",
    "Proficient",
    "Highly Proficient",
  ] as const;

  const currentTabOptions = subject === "English" ? englishTabs : subject === "Filipino" ? filipinoTabs : mathTabs;
  
  // Reset active tab when subject changes
  useEffect(() => {
    setActiveTab(currentTabOptions[0]);
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
                <div className="flex items-center gap-10">
                  <SecondaryHeader title={`${subject} Remedial`} />
                  <HeaderDropdown
                    options={[...currentTabOptions]}
                    value={activeTab}
                    onChange={setActiveTab}
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
                    {activeTab === "Non Reader" && <NonReaderTab />}
                    {activeTab === "Syllable" && <SyllableTab />}
                    {activeTab === "Word" && <WordTab />}
                    {activeTab === "Phrase" && <PhraseTab />}
                    {activeTab === "Sentence" && <SentenceTab />}
                    {activeTab === "Paragraph" && <ParagraphTab />}
                  </>
                )}
                {/* Filipino */}
                {subject === "Filipino" && (
                  <>
                    {activeTab === "Non Reader" && <FilipinoNonReaderTab />}
                    {activeTab === "Syllable" && <FilipinoSyllableTab />}
                    {activeTab === "Word" && <FilipinoWordTab />}
                    {activeTab === "Phrase" && <FilipinoPhraseTab />}
                    {activeTab === "Sentence" && <FilipinoSentenceTab />}
                    {activeTab === "Paragraph" && <FilipinoParagraphTab />}
                  </>
                )}
                {/* Math */}
                {subject === "Math" && (
                  <>
                    {activeTab === "Not Proficient" && <NotProficientTab />}
                    {activeTab === "Low Proficient" && <LowProficientTab />}
                    {activeTab === "Nearly Proficient" && <NearlyProficientTab />}
                    {activeTab === "Proficient" && <ProficientTab />}
                    {activeTab === "Highly Proficient" && <HighlyProficientTab />}
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}



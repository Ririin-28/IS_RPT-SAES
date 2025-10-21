"use client";
import Sidebar from "@/components/MasterTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
// Tabs
// English Tabs
import EnglishNonReaderArchive from "./EnglishTabs/NonReaderArchive";
import EnglishSyllableArchive from "./EnglishTabs/SyllableArchive";
import EnglishWordArchive from "./EnglishTabs/WordArchive";
import EnglishSentenceArchive from "./EnglishTabs/SentenceArchive";
import EnglishParagraphArchive from "./EnglishTabs/ParagraphArchive";
import EnglishPhraseArchive from "./EnglishTabs/PhraseArchive";
// Filipino Tabs
import FilipinoNonReaderArchive from "./FilipinoTabs/NonReaderArchive";
import FilipinoSyllableArchive from "./FilipinoTabs/SyllableArchive";
import FilipinoWordArchive from "./FilipinoTabs/WordArchive";
import FilipinoPhraseArchive from "./FilipinoTabs/PhraseArchive";
import FilipinoSentenceArchive from "./FilipinoTabs/SentenceArchive";
import FilipinoParagraphArchive from "./FilipinoTabs/ParagraphArchive";
// Math Tabs
import MathNotProficientArchive from "./MathTabs/NotProficientArchive";
import MathLowProficientArchive from "./MathTabs/LowProficientArchive";
import MathNearlyProficientArchive from "./MathTabs/NearlyProficientArchive";
import MathProficientArchive from "./MathTabs/ProficientArchive";
import MathHighlyProficientArchive from "./MathTabs/HighlyProficientArchive";

const SUBJECT_OPTIONS = ["English", "Filipino", "Math"] as const;

export default function MasterTeacherArchive() {
  const pathname = usePathname();
  const router = useRouter();
  
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

  const handleSubjectChange = useCallback((nextSubject: string) => {
    const matchedSubject = SUBJECT_OPTIONS.find((option) => option === nextSubject) ?? SUBJECT_OPTIONS[0];
    setSubject(matchedSubject);
    const targetPath = `/MasterTeacher/archive/${matchedSubject.toLowerCase()}`;
    if (pathname !== targetPath) {
      router.push(targetPath);
    }
  }, [pathname, router]);

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
        <Header title="Archive" />
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
                  <div className="flex items-center gap-2">
                    <HeaderDropdown
                      options={[...SUBJECT_OPTIONS]}
                      value={subject}
                      onChange={handleSubjectChange}
                    />
                    <SecondaryHeader title="Archive" />
                  </div>
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
                {/* English Archive */}
                {subject === "English" && (
                  <>
                    {activeTab === "Non Reader" && <EnglishNonReaderArchive />}
                    {activeTab === "Syllable" && <EnglishSyllableArchive />}
                    {activeTab === "Word" && <EnglishWordArchive />}
                    {activeTab === "Phrase" && <EnglishPhraseArchive />}
                    {activeTab === "Sentence" && <EnglishSentenceArchive />}
                    {activeTab === "Paragraph" && <EnglishParagraphArchive />}
                  </>
                )}
                {/* Filipino Archive */}
                {subject === "Filipino" && (
                  <>
                    {activeTab === "Non Reader" && <FilipinoNonReaderArchive />}
                    {activeTab === "Syllable" && <FilipinoSyllableArchive />}
                    {activeTab === "Word" && <FilipinoWordArchive />}
                    {activeTab === "Phrase" && <FilipinoPhraseArchive />}
                    {activeTab === "Sentence" && <FilipinoSentenceArchive />}
                    {activeTab === "Paragraph" && <FilipinoParagraphArchive />}
                  </>
                )}
                {/* Math Archive */}
                {subject === "Math" && (
                  <>
                    {activeTab === "Not Proficient" && <MathNotProficientArchive />}
                    {activeTab === "Low Proficient" && <MathLowProficientArchive />}
                    {activeTab === "Nearly Proficient" && <MathNearlyProficientArchive />}
                    {activeTab === "Proficient" && <MathProficientArchive />}
                    {activeTab === "Highly Proficient" && <MathHighlyProficientArchive />}
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
"use client";
import Sidebar from "@/components/MasterTeacher/Coordinator/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useCallback, useEffect, useState } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";
// English Tabs
import EnglishNonReaderTab from "./Tabs/NonReaderTab";
import EnglishSyllableTab from "./Tabs/SyllableTab";
import EnglishWordTab from "./Tabs/WordTab";
import EnglishPhraseTab from "./Tabs/PhraseTab";
import EnglishSentenceTab from "./Tabs/SentenceTab";
import EnglishParagraphTab from "./Tabs/ParagraphTab";
// Filipino Tabs
import FilipinoNonReaderTab from "./FilipinoTabs/NonReaderTab";
import FilipinoSyllableTab from "./FilipinoTabs/SyllableTab";
import FilipinoWordTab from "./FilipinoTabs/WordTab";
import FilipinoPhraseTab from "./FilipinoTabs/PhraseTab";
import FilipinoSentenceTab from "./FilipinoTabs/SentenceTab";
import FilipinoParagraphTab from "./FilipinoTabs/ParagraphTab";
// Math Tabs
import MathNotProficientTab from "./MathTabs/NotProficientTab";
import MathLowProficientTab from "./MathTabs/LowProficientTab";
import MathNearlyProficientTab from "./MathTabs/NearlyProficientTab";
import MathProficientTab from "./MathTabs/ProficientTab";
import MathHighlyProficientTab from "./MathTabs/HighlyProficientTab";

const SUBJECT_OPTIONS = ["English", "Filipino", "Math"] as const;

export default function MasterTeacherMaterials() {
  const [subject, setSubject] = useState<(typeof SUBJECT_OPTIONS)[number]>("English");
  const [activeTab, setActiveTab] = useState("Non Reader");
  const [searchTerm, setSearchTerm] = useState("");

  const englishTabs = ["Non Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"] as const;
  const filipinoTabs = ["Non Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"] as const;
  const mathTabs = ["Not Proficient", "Low Proficient", "Nearly Proficient", "Proficient", "Highly Proficient"] as const;

  const currentTabOptions = subject === "English" ? englishTabs : subject === "Filipino" ? filipinoTabs : mathTabs;

  useEffect(() => {
    const defaultTab = subject === "English" ? englishTabs[0] : subject === "Filipino" ? filipinoTabs[0] : mathTabs[0];
    setActiveTab(defaultTab);
  }, [subject]);

  const handleSubjectChange = useCallback((nextSubject: string) => {
    const matchedSubject = SUBJECT_OPTIONS.find((option) => option === nextSubject) ?? SUBJECT_OPTIONS[0];
    setSubject(matchedSubject);
  }, []);

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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex flex-col gap-0 sm:flex-row sm:items-center sm:gap-0">
                  <div className="flex items-center gap-2">
                    <HeaderDropdown
                      options={[...SUBJECT_OPTIONS]}
                      value={subject}
                      onChange={handleSubjectChange}
                    />
                    <SecondaryHeader title="Materials" />
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
                {subject === "English" && (
                  <>
                    {activeTab === "Non Reader" && <EnglishNonReaderTab />}
                    {activeTab === "Syllable" && <EnglishSyllableTab />}
                    {activeTab === "Word" && <EnglishWordTab />}
                    {activeTab === "Phrase" && <EnglishPhraseTab />}
                    {activeTab === "Sentence" && <EnglishSentenceTab />}
                    {activeTab === "Paragraph" && <EnglishParagraphTab />}
                  </>
                )}
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
                {subject === "Math" && (
                  <>
                    {activeTab === "Not Proficient" && <MathNotProficientTab />}
                    {activeTab === "Low Proficient" && <MathLowProficientTab />}
                    {activeTab === "Nearly Proficient" && <MathNearlyProficientTab />}
                    {activeTab === "Proficient" && <MathProficientTab />}
                    {activeTab === "Highly Proficient" && <MathHighlyProficientTab />}
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



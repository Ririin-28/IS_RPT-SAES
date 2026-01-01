"use client";
import PrincipalSidebar from "@/components/Principal/Sidebar";
import PrincipalHeader from "@/components/Principal/Header";
import { useMemo, useState, useEffect } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";

// English Tabs
import EnglishNonReaderTab from "./EnglishTabs/NonReaderTab";
import EnglishSyllableTab from "./EnglishTabs/SyllableTab";
import EnglishWordTab from "./EnglishTabs/WordTab";
import EnglishPhraseTab from "./EnglishTabs/PhraseTab";
import EnglishSentenceTab from "./EnglishTabs/SentenceTab";
import EnglishParagraphTab from "./EnglishTabs/ParagraphTab";

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

const GRADE_OPTIONS = ["1", "2", "3", "4", "5", "6"];
const ENGLISH_TABS = ["Non Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"] as const;
const FILIPINO_TABS = ["Non Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"] as const;
const MATH_TABS = [
  "Not Proficient",
  "Low Proficient",
  "Nearly Proficient",
  "Proficient",
  "Highly Proficient",
] as const;

const SUBJECT_TAB_MAP = {
  English: ENGLISH_TABS,
  Filipino: FILIPINO_TABS,
  Mathematics: MATH_TABS,
} as const;

type SubjectTitle = keyof typeof SUBJECT_TAB_MAP;

type PrincipalMaterialsProps = {
  subjectSlug?: string;
};

export default function PrincipalMaterials({ subjectSlug }: PrincipalMaterialsProps) {
  const normalizedSubject = useMemo<SubjectTitle>(() => {
    const slug = (subjectSlug ?? "english").toLowerCase();
    if (slug === "filipino") return "Filipino";
    if (slug === "mathematics" || slug === "math") return "Mathematics";
    return "English";
  }, [subjectSlug]);

  const tabOptions = SUBJECT_TAB_MAP[normalizedSubject];
  const [activeTab, setActiveTab] = useState<string>(tabOptions[0]);
  const [selectedGrade, setSelectedGrade] = useState(GRADE_OPTIONS[0]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setActiveTab(SUBJECT_TAB_MAP[normalizedSubject][0]);
  }, [normalizedSubject]);

  const subjectTitle = normalizedSubject;

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <PrincipalSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <PrincipalHeader title="Materials" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-0 w-full sm:w-auto">
                  <SecondaryHeader title={`${subjectTitle} Materials for`} />
                  <HeaderDropdown
                    options={GRADE_OPTIONS}
                    value={selectedGrade}
                    onChange={setSelectedGrade}
                    className="pl-2"
                  />
                  <HeaderDropdown
                    options={[...tabOptions]}
                    value={activeTab}
                    onChange={setActiveTab}
                    className="pl-0"
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
              <div className="mt-2 sm:mt-2">
                {normalizedSubject === "English" && (
                  <>
                    {activeTab === "Non Reader" && <EnglishNonReaderTab />}
                    {activeTab === "Syllable" && <EnglishSyllableTab />}
                    {activeTab === "Word" && <EnglishWordTab />}
                    {activeTab === "Phrase" && <EnglishPhraseTab />}
                    {activeTab === "Sentence" && <EnglishSentenceTab />}
                    {activeTab === "Paragraph" && <EnglishParagraphTab />}
                  </>
                )}
                {normalizedSubject === "Filipino" && (
                  <>
                    {activeTab === "Non Reader" && <FilipinoNonReaderTab />}
                    {activeTab === "Syllable" && <FilipinoSyllableTab />}
                    {activeTab === "Word" && <FilipinoWordTab />}
                    {activeTab === "Phrase" && <FilipinoPhraseTab />}
                    {activeTab === "Sentence" && <FilipinoSentenceTab />}
                    {activeTab === "Paragraph" && <FilipinoParagraphTab />}
                  </>
                )}
                {normalizedSubject === "Mathematics" && (
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

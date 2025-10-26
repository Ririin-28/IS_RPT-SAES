"use client";
import TeacherSidebar from "@/components/Teacher/Sidebar";
import TeacherHeader from "@/components/Teacher/Header";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";
//Tabs
import EnglishNonReaderTab from "./EnglishTabs/NonReaderTab";
import EnglishSyllableTab from "./EnglishTabs/SyllableTab";
import EnglishWordTab from "./EnglishTabs/WordTab";
import EnglishPhraseTab from "./EnglishTabs/PhraseTab";
import EnglishSentenceTab from "./EnglishTabs/SentenceTab";
import EnglishParagraphTab from "./EnglishTabs/ParagraphTab";
import FilipinoNonReaderTab from "./FilipinoTabs/NonReaderTab";
import FilipinoSyllableTab from "./FilipinoTabs/SyllableTab";
import FilipinoWordTab from "./FilipinoTabs/WordTab";
import FilipinoPhraseTab from "./FilipinoTabs/PhraseTab";
import FilipinoSentenceTab from "./FilipinoTabs/SentenceTab";
import FilipinoParagraphTab from "./FilipinoTabs/ParagraphTab";
import MathNotProficientTab from "./MathTabs/NotProficientTab";
import MathLowProficientTab from "./MathTabs/LowProficientTab";
import MathNearlyProficientTab from "./MathTabs/NearlyProficientTab";
import MathProficientTab from "./MathTabs/ProficientTab";
import MathHighlyProficientTab from "./MathTabs/HighlyProficientTab";

type SubjectKey = "English" | "Filipino" | "Math";

type TeacherMaterialsProps = {
  subjectSlug?: string;
};

const SUBJECT_TABS: Record<SubjectKey, readonly string[]> = {
  English: ["Non Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],
  Filipino: ["Non Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],
  Math: ["Not Proficient", "Low Proficient", "Nearly Proficient", "Proficient", "Highly Proficient"],
};

type TabComponent = ComponentType<Record<string, never>>;

const SUBJECT_COMPONENTS: Record<SubjectKey, Record<string, TabComponent>> = {
  English: {
    "Non Reader": EnglishNonReaderTab,
    Syllable: EnglishSyllableTab,
    Word: EnglishWordTab,
    Phrase: EnglishPhraseTab,
    Sentence: EnglishSentenceTab,
    Paragraph: EnglishParagraphTab,
  },
  Filipino: {
    "Non Reader": FilipinoNonReaderTab,
    Syllable: FilipinoSyllableTab,
    Word: FilipinoWordTab,
    Phrase: FilipinoPhraseTab,
    Sentence: FilipinoSentenceTab,
    Paragraph: FilipinoParagraphTab,
  },
  Math: {
    "Not Proficient": MathNotProficientTab,
    "Low Proficient": MathLowProficientTab,
    "Nearly Proficient": MathNearlyProficientTab,
    Proficient: MathProficientTab,
    "Highly Proficient": MathHighlyProficientTab,
  },
};

const normalizeSubject = (slug?: string): SubjectKey => {
  const normalized = (slug ?? "english").toLowerCase();
  if (normalized === "filipino") return "Filipino";
  if (normalized === "math" || normalized === "mathematics") return "Math";
  return "English";
};

export default function TeacherMaterials({ subjectSlug }: TeacherMaterialsProps) {
  const subject = useMemo(() => normalizeSubject(subjectSlug), [subjectSlug]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState(() => SUBJECT_TABS[subject][0]);

  useEffect(() => {
    setActiveTab(SUBJECT_TABS[subject][0]);
  }, [subject]);

  const tabOptions = SUBJECT_TABS[subject];
  const subjectComponents = SUBJECT_COMPONENTS[subject];
  const ActiveTabComponent = subjectComponents[activeTab] ?? subjectComponents[tabOptions[0]];

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/*---------------------------------Sidebar---------------------------------*/}
      <TeacherSidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div
        className="
        /* Mobile */
        flex-1 pt-16 flex flex-col overflow-hidden
        
      "
      >
        <TeacherHeader title="Materials" />
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
                  <SecondaryHeader title={`${subject} Materials`} />
                  <HeaderDropdown
                    options={[...tabOptions]}
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
                {ActiveTabComponent ? <ActiveTabComponent /> : null}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}



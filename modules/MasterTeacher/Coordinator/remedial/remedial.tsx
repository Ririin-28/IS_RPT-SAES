"use client";
import Sidebar from "@/components/MasterTeacher/Coordinator/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import RemedialTabContent, {
  type RemedialEntry,
  type RemedialLevelConfig,
  type RemedialSubjectConfig,
} from "./RemedialTabContent";
import type { FlashcardContent } from "./Modals/EditContentModal";

const SUBJECT_OPTIONS = ["English", "Filipino", "Math"] as const;
type SubjectOption = (typeof SUBJECT_OPTIONS)[number];

const ENGLISH_LEVELS = [
  "Non Reader",
  "Syllable",
  "Word",
  "Phrase",
  "Sentence",
  "Paragraph",
] as const;

const FILIPINO_LEVELS = [
  "Non Reader",
  "Syllable",
  "Word",
  "Phrase",
  "Sentence",
  "Paragraph",
] as const;

const MATH_LEVELS = [
  "Not Proficient",
  "Low Proficient",
  "Nearly Proficient",
  "Proficient",
  "Highly Proficient",
] as const;

const ENGLISH_INITIAL_FLASHCARDS: FlashcardContent[] = [
  { sentence: "The cat sat on the mat.", highlights: ["cat", "sat", "mat"] },
  { sentence: "A big dog ran in the park.", highlights: ["big", "dog", "ran"] },
  { sentence: "She has a red ball and blue car.", highlights: ["red", "ball", "blue"] },
  { sentence: "We go to the store for milk.", highlights: ["go", "store", "milk"] },
  { sentence: "He can see the sun in the sky.", highlights: ["see", "sun", "sky"] },
  { sentence: "I like to play with my friends.", highlights: ["like", "play", "friends"] },
  { sentence: "The book is on the small table.", highlights: ["book", "small", "table"] },
  { sentence: "They eat lunch at twelve o'clock.", highlights: ["eat", "lunch", "twelve"] },
  { sentence: "My mother reads me a story.", highlights: ["mother", "reads", "story"] },
  { sentence: "We live in a green house.", highlights: ["live", "green", "house"] },
];

const FILIPINO_INITIAL_FLASHCARDS: FlashcardContent[] = [
  { sentence: "Ang bata ay naglalaro sa parke.", highlights: ["bata", "parke"] },
  { sentence: "Kumakain ng masarap na pagkain ang pamilya.", highlights: ["masarap", "pamilya"] },
  { sentence: "Maganda ang bulaklak sa hardin.", highlights: ["bulaklak", "hardin"] },
  { sentence: "Mabilis tumakbo ang maliit na aso.", highlights: ["mabilis", "aso"] },
  { sentence: "Malakas ang ulan kanina.", highlights: ["malakas", "ulan"] },
  { sentence: "Nagluluto ang nanay ng hapunan.", highlights: ["nanay", "hapunan"] },
  { sentence: "Mabait ang guro sa eskwelahan.", highlights: ["guro", "eskwelahan"] },
  { sentence: "Maliwanag ang buwan ngayong gabi.", highlights: ["buwan", "gabi"] },
  { sentence: "Matulungin ang batang lalaki.", highlights: ["matulungin", "batang"] },
  { sentence: "Masaya ang mga bata sa party.", highlights: ["masaya", "party"] },
];

const MATH_INITIAL_FLASHCARDS: FlashcardContent[] = [
  { sentence: "5 + 3", highlights: [], answer: "8" },
  { sentence: "9 - 4", highlights: [], answer: "5" },
  { sentence: "6 × 7", highlights: [], answer: "42" },
  { sentence: "20 ÷ 4", highlights: [], answer: "5" },
  { sentence: "12 + 15", highlights: [], answer: "27" },
];

const buildLevels = (config: {
  labels: readonly string[];
  initialEntries: Record<string, RemedialEntry[]>;
  flashcardEditLevels?: Set<string>;
  playLevels?: Set<string>;
  inlineEditLevels?: Set<string>;
  seeAllLevels?: Set<string>;
}): RemedialLevelConfig[] =>
  config.labels.map((label) => ({
    label,
    initialEntries: config.initialEntries[label] ?? [],
    allowFlashcardEdit: config.flashcardEditLevels?.has(label),
    showPlay: config.playLevels?.has(label),
    inlineEditable: config.inlineEditLevels?.has(label) ?? false,
    allowSeeAll: config.seeAllLevels?.has(label),
  }));

const ENGLISH_INITIAL_ENTRIES: Record<string, RemedialEntry[]> = {
  "Non Reader": [
    { id: 1, title: "Lesson 1 - Consonant", phonemic: "Non-Reader", dateToUse: "2024-06-01" },
    { id: 2, title: "Lesson 2 - Vowel", phonemic: "Non-Reader", dateToUse: "2024-06-02" },
  ],
  Syllable: [],
  Word: [],
  Phrase: [],
  Sentence: [],
  Paragraph: [],
};

const FILIPINO_INITIAL_ENTRIES: Record<string, RemedialEntry[]> = {
  "Non Reader": [
    { id: 1, title: "Aralin 1 - Katinig", phonemic: "Non-Reader", dateToUse: "2024-06-01" },
    { id: 2, title: "Aralin 2 - Patinig", phonemic: "Non-Reader", dateToUse: "2024-06-02" },
  ],
  Syllable: [],
  Word: [],
  Phrase: [],
  Sentence: [],
  Paragraph: [],
};

const MATH_INITIAL_ENTRIES: Record<string, RemedialEntry[]> = {
  "Not Proficient": [
    { id: 1, title: "Basic Addition & Subtraction", phonemic: "Not Proficient", dateToUse: "2024-06-01" },
    { id: 2, title: "Simple Multiplication", phonemic: "Not Proficient", dateToUse: "2024-06-02" },
    { id: 3, title: "Basic Division", phonemic: "Not Proficient", dateToUse: "2024-06-03" },
  ],
  "Low Proficient": [
    { id: 4, title: "Intro Fractions", phonemic: "Low Proficient", dateToUse: "2024-06-04" },
  ],
  "Nearly Proficient": [
    { id: 5, title: "Decimal Operations", phonemic: "Nearly Proficient", dateToUse: "2024-06-05" },
  ],
  Proficient: [
    { id: 6, title: "Intro Algebra", phonemic: "Proficient", dateToUse: "2024-06-06" },
  ],
  "Highly Proficient": [
    { id: 7, title: "Geometry Applications", phonemic: "Highly Proficient", dateToUse: "2024-06-07" },
  ],
};

const REMEDIAL_CONFIG: Record<SubjectOption, RemedialSubjectConfig> = {
  English: {
    storageKey: "MASTER_TEACHER_REMEDIAL_ENGLISH",
    validationMessage: "Please complete all fields before saving.",
    playPath: "/MasterTeacher/RemedialTeacher/remedial/EnglishFlashcards",
    flashcardsStorageKey: "MASTER_TEACHER_ENGLISH_FLASHCARDS",
    flashcardsInitial: ENGLISH_INITIAL_FLASHCARDS,
    levels: buildLevels({
      labels: ENGLISH_LEVELS,
      initialEntries: ENGLISH_INITIAL_ENTRIES,
      flashcardEditLevels: new Set(["Non Reader"]),
      playLevels: new Set(["Non Reader"]),
      inlineEditLevels: new Set(["Syllable", "Word", "Phrase", "Sentence", "Paragraph"]),
      seeAllLevels: new Set(["Syllable", "Word", "Phrase", "Sentence", "Paragraph"]),
    }),
  },
  Filipino: {
    storageKey: "MASTER_TEACHER_REMEDIAL_FILIPINO",
    validationMessage: "Please complete all details before saving.",
    playPath: "/MasterTeacher/RemedialTeacher/remedial/FilipinoFlashcards",
    flashcardsStorageKey: "MASTER_TEACHER_FILIPINO_FLASHCARDS",
    flashcardsInitial: FILIPINO_INITIAL_FLASHCARDS,
    levels: buildLevels({
      labels: FILIPINO_LEVELS,
      initialEntries: FILIPINO_INITIAL_ENTRIES,
      flashcardEditLevels: new Set(["Non Reader"]),
      playLevels: new Set(FILIPINO_LEVELS),
      inlineEditLevels: new Set(["Syllable", "Word", "Phrase", "Sentence", "Paragraph"]),
    }),
  },
  Math: {
    storageKey: "MASTER_TEACHER_REMEDIAL_MATH",
    validationMessage: "Please complete all fields before saving.",
    playPath: "/MasterTeacher/RemedialTeacher/remedial/MathFlashcards",
    flashcardsStorageKey: "MASTER_TEACHER_MATH_FLASHCARDS",
    flashcardsInitial: MATH_INITIAL_FLASHCARDS,
    levels: buildLevels({
      labels: MATH_LEVELS,
      initialEntries: MATH_INITIAL_ENTRIES,
      flashcardEditLevels: new Set(["Not Proficient"]),
      playLevels: new Set(MATH_LEVELS),
      inlineEditLevels: new Set(["Low Proficient", "Nearly Proficient", "Proficient", "Highly Proficient"]),
    }),
  },
};

export default function MasterTeacherRemedial() {
  const pathname = usePathname();

  // Determine subject from URL path
  const getSubjectFromPath = () => {
    if (pathname?.includes("/english")) return "English" as SubjectOption;
    if (pathname?.includes("/filipino")) return "Filipino" as SubjectOption;
    if (pathname?.includes("/math")) return "Math" as SubjectOption;
    return "English" as SubjectOption;
  };

  const initialSubject = getSubjectFromPath();
  const initialTab = REMEDIAL_CONFIG[initialSubject].levels[0]?.label ?? "";

  const [subject, setSubject] = useState(initialSubject);
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Update subject when path changes
  useEffect(() => {
    const newSubject = getSubjectFromPath();
    setSubject(newSubject);
  }, [pathname]);

  const currentSubjectConfig = useMemo(() => REMEDIAL_CONFIG[subject], [subject]);
  const currentTabOptions = currentSubjectConfig.levels;
  
  // Reset active tab when subject changes
  useEffect(() => {
    setActiveTab(currentSubjectConfig.levels[0]?.label ?? "");
  }, [subject, currentSubjectConfig]);

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
                  <SecondaryHeader title={`${subject} Remedial`} />
                  <HeaderDropdown
                    options={currentTabOptions.map((tab) => tab.label)}
                    value={activeTab}
                    onChange={(value) => setActiveTab(value as string)}
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
                {activeTab && (
                  <RemedialTabContent level={activeTab} config={currentSubjectConfig} />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}



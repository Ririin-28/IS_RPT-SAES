"use client";
import Sidebar from "@/components/MasterTeacher/Coordinator/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useEffect, useMemo, useState } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";
import MaterialTabContent from "./MaterialsTab";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { MATERIAL_SUBJECTS, normalizeMaterialSubject, type MaterialSubject } from "@/lib/materials/shared";

const SUBJECT_OPTIONS = MATERIAL_SUBJECTS;

type TabDefinition = {
  label: string;
  columns?: { key: string; title: string }[];
};

const DEFAULT_COLUMNS: { key: string; title: string }[] = [
  { key: "no", title: "No#" },
  { key: "title", title: "Title" },
  { key: "dateAttached", title: "Date Attached" },
];

const MATH_COLUMNS: { key: string; title: string }[] = [
  { key: "no", title: "No#" },
  { key: "title", title: "Title" },
  { key: "dateAttached", title: "Date Attached" },
];

const TAB_CONFIG: Record<(typeof SUBJECT_OPTIONS)[number], readonly TabDefinition[]> = {
  English: [
    { label: "Non Reader", columns: DEFAULT_COLUMNS },
    { label: "Syllable", columns: DEFAULT_COLUMNS },
    { label: "Word", columns: DEFAULT_COLUMNS },
    { label: "Phrase", columns: DEFAULT_COLUMNS },
    { label: "Sentence", columns: DEFAULT_COLUMNS },
    { label: "Paragraph", columns: DEFAULT_COLUMNS },
  ],
  Filipino: [
    { label: "Non Reader", columns: DEFAULT_COLUMNS },
    { label: "Syllable", columns: DEFAULT_COLUMNS },
    { label: "Word", columns: DEFAULT_COLUMNS },
    { label: "Phrase", columns: DEFAULT_COLUMNS },
    { label: "Sentence", columns: DEFAULT_COLUMNS },
    { label: "Paragraph", columns: DEFAULT_COLUMNS },
  ],
  Math: [
    { label: "Not Proficient", columns: MATH_COLUMNS },
    { label: "Low Proficient", columns: MATH_COLUMNS },
    { label: "Nearly Proficient", columns: MATH_COLUMNS },
    { label: "Proficient", columns: MATH_COLUMNS },
    { label: "Highly Proficient", columns: MATH_COLUMNS },
  ],
};

type CoordinatorSubjectResponse = {
  success: boolean;
  coordinator?: {
    coordinatorSubject?: string | null;
    subjectsHandled?: string | null;
  } | null;
  error?: string;
};

const SUBJECT_FALLBACK: MaterialSubject = SUBJECT_OPTIONS[0];

export default function MasterTeacherMaterials() {
  const [subject, setSubject] = useState<MaterialSubject | null>(null);
  const [activeTab, setActiveTab] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingSubject, setLoadingSubject] = useState<boolean>(true);
  const [subjectError, setSubjectError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSubjectFromProfile() {
      setLoadingSubject(true);
      setSubjectError(null);

      try {
        const profile = getStoredUserProfile();
        const userId = profile?.userId;

        if (!userId) {
          throw new Error("Missing coordinator profile. Please log in again.");
        }

        const response = await fetch(
          `/api/master_teacher/coordinator/profile?userId=${encodeURIComponent(String(userId))}`,
          { cache: "no-store" },
        );

        const payload: CoordinatorSubjectResponse | null = await response.json().catch(() => null);

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload?.success) {
          const message = payload?.error ?? "Failed to determine assigned subject.";
          throw new Error(message);
        }

        const subjectCandidate = payload.coordinator?.coordinatorSubject ?? payload.coordinator?.subjectsHandled ?? null;
        const normalized = normalizeMaterialSubject(subjectCandidate);

        if (normalized) {
          setSubject(normalized);
        } else {
          const fallbackMessage = subjectCandidate
            ? `Subject "${subjectCandidate}" is not supported. Defaulting to ${SUBJECT_FALLBACK}.`
            : `Coordinator subject not assigned. Defaulting to ${SUBJECT_FALLBACK}.`;
          setSubjectError(fallbackMessage);
          setSubject(SUBJECT_FALLBACK);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load coordinator subject.";
          setSubjectError(message);
          setSubject(SUBJECT_FALLBACK);
        }
      } finally {
        if (!cancelled) {
          setLoadingSubject(false);
        }
      }
    }

    loadSubjectFromProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedSubject = subject ?? SUBJECT_FALLBACK;
  const currentTabOptions = useMemo(() => TAB_CONFIG[resolvedSubject], [resolvedSubject]);

  useEffect(() => {
    const defaultTab = currentTabOptions[0]?.label ?? "";
    setActiveTab(defaultTab);
  }, [currentTabOptions]);

  const currentTab = useMemo(
    () => currentTabOptions.find((tab) => tab.label === activeTab) ?? currentTabOptions[0],
    [activeTab, currentTabOptions],
  );

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
                    <SecondaryHeader title={`${resolvedSubject} Materials`} />
                    <HeaderDropdown
                      options={currentTabOptions.map((tab) => tab.label)}
                      value={activeTab}
                      onChange={setActiveTab}
                      className="pl-0"
                    />
                  </div>
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
                {currentTab && (
                  <MaterialTabContent
                    subject={resolvedSubject}
                    category={currentTab.label}
                    columns={currentTab.columns}
                  />
                )}
              </div>
              {subjectError && (
                <p className="mt-3 text-sm text-red-600">
                  {subjectError}
                </p>
              )}
              {loadingSubject && !subjectError && (
                <p className="mt-3 text-sm text-gray-500">Loading assigned subject...</p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}



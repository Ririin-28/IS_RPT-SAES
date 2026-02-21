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
import ScheduledActivitiesList, { type CalendarActivity } from "./ScheduledActivitiesList";
import BaseModal from "@/components/Common/Modals/BaseModal";

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

  // Calendar State
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleActivities, setScheduleActivities] = useState<CalendarActivity[]>([]);
  const [submissionFlags, setSubmissionFlags] = useState<Record<string, boolean>>({});

  // Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<CalendarActivity | null>(null);

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

  // Fetch Schedule
  useEffect(() => {
    let cancelled = false;
    const loadSchedule = async () => {
      setScheduleLoading(true);
      setScheduleError(null);
      try {
        const response = await fetch("/api/teacher/calendar", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          activities?: Array<{
            id?: string | number | null;
            title?: string | null;
            activityDate?: string | null;
            date?: string | null;
            day?: string | null;
            subject?: string | null;
            startTime?: string | null;
            endTime?: string | null;
          }>;
          error?: string | null;
        } | null;

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? `Unable to load schedule (${response.status})`);
        }

        const parsed = Array.isArray(payload.activities) ? payload.activities : [];
        const mapped = parsed
          .map<CalendarActivity | null>((item, index) => {
            const rawDate = item.activityDate ?? item.date ?? null;
            const dateValue = rawDate ? new Date(rawDate) : null;
            if (!dateValue || Number.isNaN(dateValue.getTime())) return null;
            return {
              id: String(item.id ?? index + 1),
              title: item.title ?? "Scheduled Activity",
              subject: item.subject ?? null,
              date: dateValue,
              day: item.day ?? null,
              startTime: item.startTime ?? null,
              endTime: item.endTime ?? null,
            } satisfies CalendarActivity;
          })
          .filter((item): item is CalendarActivity => item !== null);

        if (!cancelled) {
          setScheduleActivities(mapped);
        }
      } catch (error) {
        if (!cancelled) {
          setScheduleError("Unable to load schedule. Please try again later.");
          setScheduleActivities([]);
        }
      } finally {
        if (!cancelled) {
          setScheduleLoading(false);
        }
      }
    };

    void loadSchedule();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load submission badges for each scheduled activity (remedial requests)
  useEffect(() => {
    let cancelled = false;

    async function preloadSubmissionFlags() {
      if (!scheduleActivities.length) {
        setSubmissionFlags({});
        return;
      }
      try {
        const results = await Promise.all(
          scheduleActivities.map(async (activity) => {
            const id = String(activity.id);
            try {
              const response = await fetch(`/api/remedial-materials?requestId=${encodeURIComponent(id)}`, {
                cache: "no-store",
              });
              if (!response.ok) return [id, false] as const;
              const payload = await response.json().catch(() => null);
              // Show badge if there are any materials with status 'pending'
              const hasPending = Array.isArray(payload?.materials)
                ? payload.materials.some((mat: any) => (mat.status ?? '').toLowerCase() === 'pending')
                : false;
              return [id, hasPending] as const;
            } catch (error) {
              return [id, false] as const;
            }
          })
        );
        if (!cancelled) {
          setSubmissionFlags(Object.fromEntries(results));
        }
      } catch (error) {
        if (!cancelled) {
          setSubmissionFlags({});
        }
      }
    }

    preloadSubmissionFlags();
    return () => {
      cancelled = true;
    };
  }, [scheduleActivities]);

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

  const handleReviewClick = (activity: CalendarActivity) => {
    setSelectedActivity(activity);
    setShowReviewModal(true);
  };

  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      {/*---------------------------------Sidebar---------------------------------*/}
      <Sidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Materials" />
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 sm:p-5 md:p-6">
            
            {/*---------------------------------Unified Main Container---------------------------------*/}
            <div className="relative z-10 w-full h-full rounded-2xl border border-white/70 bg-white/45 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl flex flex-col overflow-hidden">
                
                {/* Fixed Header Section (Controls) */}
                <div className="p-4 sm:p-5 border-b border-gray-100 shrink-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
                            <SecondaryHeader title={`${resolvedSubject} Materials`} />
                            {subjectError ? (
                                <span className="text-red-500 text-sm ml-2">({subjectError})</span>
                            ) : (
                                <HeaderDropdown
                                    options={currentTabOptions.map((tab) => tab.label)}
                                    value={activeTab}
                                    onChange={setActiveTab}
                                    className="pl-2"
                                />
                            )}
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                            <div className="relative flex-1 sm:flex-initial">
                                <input
                                    type="text"
                                    placeholder="Search materials..."
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 text-black shadow-sm focus:ring-2 focus:ring-[#013300]/20 focus:border-[#013300] outline-none transition-all"
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
                </div>

                {/* Scrollable Content Section */}
                <div className="flex-1 overflow-hidden flex flex-col relative custom-scrollbar overflow-y-auto">
                     {/* Schedule Section */}
                     <div className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
                        <h2 className="text-lg font-bold text-gray-800">Scheduled Activities ({resolvedSubject})</h2>
                     </div>

                     <div className="flex-1 min-h-0 px-4 sm:px-6 pb-4 sm:pb-6">
                        <ScheduledActivitiesList 
                            activities={scheduleActivities} 
                            subject={resolvedSubject} 
                            loading={scheduleLoading} 
                            error={scheduleError}
                          submissionFlags={submissionFlags}
                            onReview={handleReviewClick}
                        />
                     </div>
                </div>
            </div>
        </main>
      </div>

       {/* Review Modal */}
       <BaseModal
          maxWidth="4xl"
          show={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          title={`Review Materials: ${selectedActivity?.title || activeTab}`}
       >
         <div className="p-4 min-h-100">
             {currentTab && (
              <MaterialTabContent
                subject={resolvedSubject}
                category={currentTab.label}
                requestId={selectedActivity?.id ?? null}
                columns={currentTab.columns}
              />
            )}
         </div>
       </BaseModal>
    </div>
  );
}

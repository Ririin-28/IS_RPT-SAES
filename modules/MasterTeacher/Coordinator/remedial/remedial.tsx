"use client";

import Sidebar from "@/components/MasterTeacher/Coordinator/Sidebar";

import Header from "@/components/MasterTeacher/Header";

import { useEffect, useMemo, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";

import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";

import { normalizeMaterialSubject } from "@/lib/materials/shared";

import { getStoredUserProfile } from "@/lib/utils/user-profile";

import ScheduledActivitiesList, { type CalendarActivity } from "./ScheduledActivitiesList";

import BaseModal from "@/components/Common/Modals/BaseModal";

import EditContentModal, { type FlashcardContent } from "./Modals/EditContentModal";

import NoContentModal from "./Modals/NoContentModal";

import NoFlashcardsModal from "./Modals/NoFlashcardsModal";


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



const REMEDIAL_LEVELS: Record<SubjectOption, string[]> = {

  English: [...ENGLISH_LEVELS],

  Filipino: [...FILIPINO_LEVELS],

  Math: [...MATH_LEVELS],

};



// Initial flashcards for each subject

const INITIAL_FLASHCARDS: Record<SubjectOption, FlashcardContent[]> = {

  English: [

    { sentence: "The cat sat on the mat.", highlights: ["cat", "sat", "mat"] },

    { sentence: "A big dog ran in the park.", highlights: ["big", "dog", "ran"] },

    { sentence: "She has a red ball and blue car.", highlights: ["red", "ball", "blue"] },

  ],

  Filipino: [

    { sentence: "Ang bata ay naglalaro sa parke.", highlights: ["bata", "parke"] },

    { sentence: "Kumakain ng masarap na pagkain ang pamilya.", highlights: ["masarap", "pamilya"] },

    { sentence: "Maganda ang bulaklak sa hardin.", highlights: ["bulaklak", "hardin"] },

  ],

  Math: [

    { sentence: "5 + 3", highlights: [], answer: "8" },

    { sentence: "9 - 4", highlights: [], answer: "5" },

    { sentence: "6 × 7", highlights: [], answer: "42" },

  ],

};



type CoordinatorSubjectResponse = {

  success: boolean;

  coordinator?: {

    coordinatorSubject?: string | null;

    subjectsHandled?: string | null;

    gradeLevel?: string | null;

  } | null;

  error?: string;

};



const SUBJECT_FALLBACK: SubjectOption = "English";



export default function MasterTeacherRemedial() {

  const pathname = usePathname();

  const router = useRouter();



  const [subject, setSubject] = useState<SubjectOption | null>(null);

  const [activeTab, setActiveTab] = useState("");

  const [loadingSubject, setLoadingSubject] = useState<boolean>(true);

  const [subjectError, setSubjectError] = useState<string | null>(null);



  // Calendar State

  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [scheduleActivities, setScheduleActivities] = useState<CalendarActivity[]>([]);



  const [phonemicLevels, setPhonemicLevels] = useState<Array<{ phonemic_id: number; level_name: string }>>([]);



  // Modal State

  const [showReviewModal, setShowReviewModal] = useState(false);

  const [selectedActivity, setSelectedActivity] = useState<CalendarActivity | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);

  const [flashcards, setFlashcards] = useState<FlashcardContent[]>([]);

  const [validatingActivityId, setValidatingActivityId] = useState<string | null>(null);
  const [showNoContentModal, setShowNoContentModal] = useState(false);
  const [showNoFlashcardsModal, setShowNoFlashcardsModal] = useState(false);



  // Determine assigned subject from profile

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



        if (cancelled) return;



        if (!response.ok || !payload?.success) {

          throw new Error(payload?.error ?? "Failed to determine assigned subject.");

        }



        const subjectCandidate = payload.coordinator?.coordinatorSubject ?? payload.coordinator?.subjectsHandled ?? null;

        const normalized = normalizeMaterialSubject(subjectCandidate) as SubjectOption | null;



        if (normalized && SUBJECT_OPTIONS.includes(normalized)) {

          setSubject(normalized);

        } else {

          setSubject(SUBJECT_FALLBACK);

          if (subjectCandidate) {

            setSubjectError(`Subject "${subjectCandidate}" is not supported. Defaulting to ${SUBJECT_FALLBACK}.`);

          }

        }



        if (payload.coordinator?.gradeLevel) {

          // Grade level is no longer needed but keeping the fetch for potential future use

        }

      } catch (error) {

        if (!cancelled) {

          setSubjectError(error instanceof Error ? error.message : "Unable to load coordinator subject.");

          setSubject(SUBJECT_FALLBACK);

        }

      } finally {

        if (!cancelled) {

          setLoadingSubject(false);

        }

      }

    }



    loadSubjectFromProfile();

    return () => { cancelled = true; };

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







  const resolvedSubject = subject ?? SUBJECT_FALLBACK;

  const currentTabOptions = REMEDIAL_LEVELS[resolvedSubject];



  useEffect(() => {

    setActiveTab(currentTabOptions[0] ?? "");

  }, [resolvedSubject, currentTabOptions]);



  useEffect(() => {

    let cancelled = false;



    async function loadPhonemicLevels() {

      try {

        const response = await fetch(`/api/subject-levels?subject=${encodeURIComponent(resolvedSubject)}`, { cache: "no-store" });

        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.success) {

          throw new Error(payload?.error ?? "Unable to load phonemic levels");

        }

        const levels = Array.isArray(payload.levels) ? payload.levels : [];

        if (!cancelled) {

          setPhonemicLevels(

            levels

              .map((level: any) => ({

                phonemic_id: Number.parseInt(String(level.phonemic_id), 10),

                level_name: String(level.level_name ?? "").trim(),

              }))

              .filter((level: any) => Number.isFinite(level.phonemic_id) && level.level_name),

          );

        }

      } catch {

        if (!cancelled) {

          setPhonemicLevels([]);

        }

      }

    }



    loadPhonemicLevels();

    return () => {

      cancelled = true;

    };

  }, [resolvedSubject]);



  const resolveActivePhonemicId = useMemo(() => {

    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

    const activeKey = normalize(activeTab);

    const match = phonemicLevels.find((level) => normalize(level.level_name) === activeKey);

    return match?.phonemic_id ?? null;

  }, [phonemicLevels, activeTab]);



  const handleEditClick = async (activity: CalendarActivity) => {

    setSelectedActivity(activity);

    const phonemicId = resolveActivePhonemicId;

    if (!phonemicId) {

      setFlashcards([]);

      setShowEditModal(true);

      return;

    }



    try {

      const response = await fetch(

        `/api/remedial-material-content?requestId=${encodeURIComponent(String(activity.id))}&phonemicId=${encodeURIComponent(String(phonemicId))}`,

        { cache: "no-store" },

      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success || !payload?.found) {

        setFlashcards([]);

        setShowEditModal(true);

        return;

      }

      const raw = payload.content?.flashcardsOverride ?? payload.content?.flashcards;

      const list = Array.isArray(raw) ? raw : [];

      const normalized: FlashcardContent[] = list

        .map((entry: any) => ({

          sentence: typeof entry?.sentence === "string" ? entry.sentence : "",

          highlights: Array.isArray(entry?.highlights) ? entry.highlights.filter((v: any) => typeof v === "string") : [],

          answer: typeof entry?.answer === "string" ? entry.answer : entry?.answer === undefined ? undefined : "",

        }))

        .filter((entry: FlashcardContent) => entry.sentence.trim().length > 0);

      setFlashcards(normalized);

      setShowEditModal(true);

    } catch {

      setFlashcards([]);

      setShowEditModal(true);

    }

  };



  const handlePlayClick = async (activity: CalendarActivity) => {

    const phonemicId = resolveActivePhonemicId;
    // Find the phonemic level name for the current tab
    const phonemicLevelName = activeTab;

    if (!phonemicId) return;

    setValidatingActivityId(String(activity.id));

    try {
      const response = await fetch(
        `/api/remedial-material-content?requestId=${encodeURIComponent(String(activity.id))}&phonemicId=${encodeURIComponent(String(phonemicId))}`,
        { cache: "no-store" }
      );

      const payload = await response.json().catch(() => null);

      if (response.ok && payload?.success && payload?.found) {
        const raw = payload.content?.flashcardsOverride ?? payload.content?.flashcards;
        const list = Array.isArray(raw) ? raw : [];
        const normalized: FlashcardContent[] = list
          .map((entry: any) => ({
            sentence: typeof entry?.sentence === "string" ? entry.sentence : "",
            highlights: Array.isArray(entry?.highlights) ? entry.highlights.filter((v: any) => typeof v === "string") : [],
            answer: typeof entry?.answer === "string" ? entry.answer : entry?.answer === undefined ? undefined : "",
          }))
          .filter((entry: FlashcardContent) => entry.sentence.trim().length > 0);

        if (normalized.length === 0) {
          setShowNoFlashcardsModal(true);
        } else {
          const phonemicParam = phonemicId ? `&phonemicId=${encodeURIComponent(String(phonemicId))}` : "";
          const phonemicNameParam = phonemicLevelName ? `&phonemicName=${encodeURIComponent(phonemicLevelName)}` : "";
          const playPath = `/MasterTeacher/Coordinator/remedial/Flashcards?subject=${encodeURIComponent(resolvedSubject)}&activity=${encodeURIComponent(activity.id)}${phonemicParam}${phonemicNameParam}`;
          router.push(playPath);
        }
      } else {
        setShowNoContentModal(true);
      }
    } catch (error) {
      console.error("Validation failed", error);
      setShowNoContentModal(true);
    } finally {
      setValidatingActivityId(null);
    }

  };



  const handleSaveFlashcards = async (updatedFlashcards: FlashcardContent[]) => {

    setFlashcards(updatedFlashcards);

    const activity = selectedActivity;

    const phonemicId = resolveActivePhonemicId;

    if (!activity || !phonemicId) return;

    try {

      await fetch("/api/remedial-material-content", {

        method: "PUT",

        headers: {

          "Content-Type": "application/json",

        },

        body: JSON.stringify({

          requestId: activity.id,

          phonemicId,

          flashcardsOverride: updatedFlashcards,

        }),

      });

    } catch {

      return;

    }

  };



  return (

    <div className="flex h-screen bg-white overflow-hidden">

      {/*---------------------------------Sidebar---------------------------------*/}

      <Sidebar />



      {/*---------------------------------Main Content---------------------------------*/}

      <div className="flex-1 pt-16 flex flex-col overflow-hidden">

        <Header title="Remedial" />

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 sm:p-5 md:p-6">

            

            {/*---------------------------------Main Container---------------------------------*/}

            <div className="w-full h-full bg-white rounded-lg shadow-md border border-gray-200 flex flex-col overflow-hidden">

                

                {/* Fixed Header Section (Controls) */}

                <div className="p-4 sm:p-5 border-b border-gray-100 shrink-0">

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">

                      <SecondaryHeader title={`${resolvedSubject} Remedial`} />

                      <HeaderDropdown

                        options={currentTabOptions}

                        value={activeTab}

                        onChange={(value) => setActiveTab(value as string)}

                        className="pl-2"

                      />

                      {subjectError ? (

                        <span className="text-red-500 text-sm ml-2">({subjectError})</span>

                      ) : null}

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

                            onEdit={handleEditClick}

                            onPlay={handlePlayClick}

                            validatingActivityId={validatingActivityId}

                        />

                     </div>

                </div>

            </div>

        </main>

      </div>



       {/* Edit Content Modal */}

       <EditContentModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          flashcards={flashcards}
          onSave={handleSaveFlashcards}
          subject={resolvedSubject}
       />



       {/* Review Modal */}

       <BaseModal

          maxWidth="4xl"

          show={showReviewModal}

          onClose={() => setShowReviewModal(false)}

          title={`Review Remedial: ${selectedActivity?.title || activeTab || 'Activity'}`}

       >

         <div className="p-4 min-h-100">

           <p className="text-gray-500 text-center">No remedial content to display.</p>

         </div>

       </BaseModal>

       <NoContentModal
          isOpen={showNoContentModal}
          onClose={() => setShowNoContentModal(false)}
       />
       <NoFlashcardsModal
          isOpen={showNoFlashcardsModal}
          onClose={() => setShowNoFlashcardsModal(false)}
       />

    </div>

  );

}






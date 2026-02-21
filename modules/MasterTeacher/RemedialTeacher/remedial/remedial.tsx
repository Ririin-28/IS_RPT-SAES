"use client";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import ScheduledActivitiesList, { type CalendarActivity } from "./ScheduledActivitiesList";
import NoContentModal from "./NoContentModal";
import { buildFlashcardContentKey } from "@/lib/utils/flashcards-storage";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

// Tabs
// English Tabs
import { ENGLISH_LEVELS } from "./EnglishTabs/EnglishTab";
// Filipino Tabs
import { FILIPINO_LEVELS } from "./FilipinoTabs/FilipinoTab";
// Math Tabs
import { MATH_LEVELS } from "./MathTabs/MathTab";

type AssessmentLevel = typeof ENGLISH_LEVELS[number];
const ASSESSMENT_LEVELS = ENGLISH_LEVELS;

export default function MasterTeacherRemedial() {
  const pathname = usePathname();
  const router = useRouter();
  const userProfile = useMemo(() => getStoredUserProfile(), []);
  const userId = useMemo(() => {
    const raw = userProfile?.userId;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }, [userProfile]);

  // Determine subject from URL path
  const getSubjectFromPath = () => {
    if (pathname?.includes("/assessment")) return "Assessment";
    if (pathname?.includes("/english")) return "English";
    if (pathname?.includes("/filipino")) return "Filipino";
    if (pathname?.includes("/math")) return "Math";
    return "English"; // default
  };

  const initialSubject = getSubjectFromPath();
  const initialTab = initialSubject === "English" ? ENGLISH_LEVELS[0] : initialSubject === "Filipino" ? FILIPINO_LEVELS[0] : initialSubject === "Math" ? MATH_LEVELS[0] : ASSESSMENT_LEVELS[0];

  const [subject, setSubject] = useState(initialSubject);
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Calendar State
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleActivities, setScheduleActivities] = useState<CalendarActivity[]>([]);
  
  const [phonemicLevels, setPhonemicLevels] = useState<Array<{ phonemic_id: number; level_name: string }>>([]);
  const [validatingActivityId, setValidatingActivityId] = useState<string | null>(null);
  const [showNoContentModal, setShowNoContentModal] = useState(false);

  // Update subject when path changes
  useEffect(() => {
    const newSubject = getSubjectFromPath();
    setSubject(newSubject);
  }, [pathname]);

  const currentTabOptions = subject === "English" ? ENGLISH_LEVELS : subject === "Filipino" ? FILIPINO_LEVELS : subject === "Math" ? MATH_LEVELS : ASSESSMENT_LEVELS;
  
  const assessmentLanguage = useMemo(() => {
    if (pathname?.includes("/assessment/filipino")) return "Filipino";
    if (pathname?.includes("/assessment/math")) return "Math";
    return "English";
  }, [pathname]);
  
  // Reset active tab when subject changes
  useEffect(() => {
    if (subject === "English") {
      setActiveTab(ENGLISH_LEVELS[0]);
    } else if (subject === "Filipino") {
      setActiveTab(FILIPINO_LEVELS[0]);
    } else if (subject === "Math") {
      setActiveTab(MATH_LEVELS[0]);
    } else if (subject === "Assessment") {
      setActiveTab(ASSESSMENT_LEVELS[0]);
    }
  }, [subject]);

  // Load Phonemic Levels
  useEffect(() => {
    let cancelled = false;
    async function loadPhonemicLevels() {
      try {
        const response = await fetch(`/api/subject-levels?subject=${encodeURIComponent(subject)}`, { cache: "no-store" });
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
        if (!cancelled) setPhonemicLevels([]);
      }
    }
    if (subject !== "Assessment") {
        loadPhonemicLevels();
    }
    return () => { cancelled = true; };
  }, [subject]);

  // Fetch Schedule
  useEffect(() => {
    let cancelled = false;
    const loadSchedule = async () => {
      setScheduleLoading(true);
      setScheduleError(null);
      try {
        const response = await fetch("/api/teacher/calendar", { cache: "no-store" });
        const payload = (await response.json().catch(() => null));

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? `Unable to load schedule (${response.status})`);
        }

        const parsed = Array.isArray(payload.activities) ? (payload.activities as unknown[]) : [];
        const mapped = parsed
          .map((item: any, index: number): CalendarActivity | null => {
            const rawDate = item.activityDate ?? item.date ?? null;
            const dateValue = rawDate ? new Date(rawDate) : null;
            if (!dateValue || Number.isNaN(dateValue.getTime())) return null;
            return {
              id: String(item.id ?? index + 1),
              title: item.title ?? "Scheduled Activity",
              subject: item.subject ?? null,
              subjectId: Number.isFinite(Number(item.subjectId)) ? Number(item.subjectId) : null,
              gradeId: Number.isFinite(Number(item.gradeId)) ? Number(item.gradeId) : null,
              date: dateValue,
              day: item.day ?? null,
              startTime: item.startTime ?? null,
              endTime: item.endTime ?? null,
            } satisfies CalendarActivity;
          })
          .filter((item: CalendarActivity | null): item is CalendarActivity => item !== null);

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
    return () => { cancelled = true; };
  }, []);

  const resolveActivePhonemicId = useMemo(() => {
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const activeKey = normalize(activeTab);
    const match = phonemicLevels.find((level) => normalize(level.level_name) === activeKey);
    return match?.phonemic_id ?? null;
  }, [phonemicLevels, activeTab]);

  const handlePlayClick = async (activity: CalendarActivity) => {
    const phonemicId = resolveActivePhonemicId;
    const phonemicLevelName = activeTab;

    if (!phonemicId) {
        setShowNoContentModal(true);
        return;
    }

    setValidatingActivityId(String(activity.id));

    try {
      const response = await fetch(
        `/api/remedial-material-content?requestId=${encodeURIComponent(String(activity.id))}&phonemicId=${encodeURIComponent(String(phonemicId))}`,
        { cache: "no-store" }
      );

      const payload = await response.json().catch(() => null);

      if (response.ok && payload?.success && payload?.found) {
          const materialId = payload?.content?.materialId ?? null;
          const subjectIdParam = activity.subjectId ? `&subjectId=${encodeURIComponent(String(activity.subjectId))}` : "";
          const gradeIdParam = activity.gradeId ? `&gradeId=${encodeURIComponent(String(activity.gradeId))}` : "";
          const materialIdParam = materialId ? `&materialId=${encodeURIComponent(String(materialId))}` : "";
          const phonemicParam = phonemicId ? `&phonemicId=${encodeURIComponent(String(phonemicId))}` : "";
          const phonemicNameParam = phonemicLevelName ? `&phonemicName=${encodeURIComponent(phonemicLevelName)}` : "";

          const cards = payload?.content?.flashcardsOverride ?? payload?.content?.flashcards;
          const baseKey = subject === "English"
            ? "MASTER_TEACHER_ENGLISH_FLASHCARDS"
            : subject === "Filipino"
              ? "MASTER_TEACHER_FILIPINO_FLASHCARDS"
              : subject === "Math"
                ? "MASTER_TEACHER_MATH_FLASHCARDS"
                : null;
          if (baseKey && Array.isArray(cards) && cards.length > 0) {
            let contentToStore = cards;
            if (subject === "Math") {
              contentToStore = cards.map((card: any) => ({
                question: card.sentence ?? "",
                correctAnswer: card.answer ?? "",
              }));
            }
            const storageKey = buildFlashcardContentKey(baseKey, {
              activityId: activity.id,
              phonemicId,
              userId,
            });
            window.localStorage.setItem(storageKey, JSON.stringify(contentToStore));
          }
          
          // Determine Flashcards path based on subject
          let flashcardsPath = "Flashcards"; // Fallback
          if (subject === "English") flashcardsPath = "EnglishFlashcards";
          else if (subject === "Filipino") flashcardsPath = "FilipinoFlashcards";
          else if (subject === "Math") flashcardsPath = "MathFlashcards";

          const playPath = `/MasterTeacher/RemedialTeacher/remedial/${flashcardsPath}?subject=${encodeURIComponent(subject)}&activity=${encodeURIComponent(activity.id)}${subjectIdParam}${gradeIdParam}${materialIdParam}${phonemicParam}${phonemicNameParam}`;
          router.push(playPath);
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

  const subjectHeader = subject === "Assessment" ? "Assessment Center" : `${subject} Remedial`;

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
            <div className="relative z-10 h-full min-h-100 overflow-hidden rounded-2xl border border-white/70 bg-white/45 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl flex flex-col">
              <div className="p-4 sm:p-5 border-b border-gray-100 shrink-0">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div className="flex items-center gap-0">
                      <SecondaryHeader title={subjectHeader} />
                      <HeaderDropdown
                        options={[...currentTabOptions]}
                        value={activeTab}
                        onChange={(value) => setActiveTab(value as typeof activeTab)}
                        className="pl-2"
                      />
                    </div>
                  </div>
              </div>

              {/*---------------------------------List Content---------------------------------*/}
              <div className="flex-1 min-h-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-4 overflow-y-auto">
                 <ScheduledActivitiesList 
                    activities={scheduleActivities} 
                    subject={subject} 
                    loading={scheduleLoading} 
                    error={scheduleError}
                    onPlay={handlePlayClick}
                    validatingActivityId={validatingActivityId}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
      
      <NoContentModal
        isOpen={showNoContentModal}
        onClose={() => setShowNoContentModal(false)}
      />
    </div>
  );
}

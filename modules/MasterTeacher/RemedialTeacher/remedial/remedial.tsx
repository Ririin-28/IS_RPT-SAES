"use client";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import ScheduledActivitiesList, { type CalendarActivity } from "./ScheduledActivitiesList";

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

        const parsed = Array.isArray(payload.activities) ? payload.activities : [];
        const mapped = parsed
          .map<CalendarActivity | null>((item: any, index: number) => {
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
        alert("Please select a valid level to play.");
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
          const phonemicParam = phonemicId ? `&phonemicId=${encodeURIComponent(String(phonemicId))}` : "";
          const phonemicNameParam = phonemicLevelName ? `&phonemicName=${encodeURIComponent(phonemicLevelName)}` : "";
          
          // Determine Flashcards path based on subject
          let flashcardsPath = "Flashcards"; // Fallback
          if (subject === "English") flashcardsPath = "EnglishFlashcards";
          else if (subject === "Filipino") flashcardsPath = "FilipinoFlashcards";
          else if (subject === "Math") flashcardsPath = "MathFlashcards";

          const playPath = `/MasterTeacher/RemedialTeacher/remedial/${flashcardsPath}?subject=${encodeURIComponent(subject)}&activity=${encodeURIComponent(activity.id)}${phonemicParam}${phonemicNameParam}`;
          router.push(playPath);
      } else {
        alert("No content found for this activity and level.");
      }
    } catch (error) {
      console.error("Validation failed", error);
      alert("An error occurred while validating content.");
    } finally {
      setValidatingActivityId(null);
    }
  };

  const subjectHeader = subject === "Assessment" ? "Assessment Center" : `${subject} Remedial`;

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
              overflow-hidden flex flex-col
            "
            >
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
    </div>
  );
}

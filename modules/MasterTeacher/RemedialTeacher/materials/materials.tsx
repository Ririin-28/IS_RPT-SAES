"use client";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useEffect, useMemo, useState, useRef, type ChangeEvent } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";
import { usePathname } from "next/navigation";
import { ENGLISH_LEVELS } from "./EnglishTabs/EnglishTab";
import { FILIPINO_LEVELS } from "./FilipinoTabs/FilipinoTab";
import { MATH_LEVELS } from "./MathTabs/MathTab";
import ScheduledActivitiesList, { type CalendarActivity } from "./ScheduledActivitiesList";
import { useRemedialMaterials } from "./useRemedialMaterials";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import MaterialGridModal from "./MaterialGridModal";

const SUBJECT_OPTIONS = ["English", "Filipino", "Math"] as const;

export default function MasterTeacherMaterials() {
  const pathname = usePathname();
  const subject = useMemo<(typeof SUBJECT_OPTIONS)[number]>(() => {
    if (!pathname) return "English";
    const lowerPath = pathname.toLowerCase();
    if (lowerPath.includes("/materials/filipino")) return "Filipino";
    if (lowerPath.includes("/materials/math")) return "Math";
    return "English";
  }, [pathname]);

  const englishTabs = ENGLISH_LEVELS;
  const filipinoTabs = FILIPINO_LEVELS;
  const mathTabs = MATH_LEVELS;

  const currentTabOptions = subject === "English" ? englishTabs : subject === "Filipino" ? filipinoTabs : mathTabs;

  const [activeTab, setActiveTab] = useState<string>(currentTabOptions[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleActivities, setScheduleActivities] = useState<CalendarActivity[]>([]);

  // Helpers for file upload
  // Helpers for Material Grid
  const [showGridModal, setShowGridModal] = useState(false);
  const [targetActivity, setTargetActivity] = useState<CalendarActivity | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Integrate useRemedialMaterials for upload functionality
  // Note: We use the activeTab as the "level" context for uploads
  const { uploadFiles, uploading } = useRemedialMaterials({
    subject,
    level: activeTab,
  });

  useEffect(() => {
    const defaultTab = subject === "English" ? englishTabs[0] : subject === "Filipino" ? filipinoTabs[0] : mathTabs[0];
    setActiveTab(defaultTab);
  }, [subject, englishTabs, filipinoTabs, mathTabs]);

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

  const handleAttachClick = (activity: CalendarActivity) => {
    setTargetActivity(activity);
    setShowGridModal(true);
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
                            <SecondaryHeader title={`${subject} Materials`} />
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
                <div className="flex-1 overflow-hidden flex flex-col relative">
                     {/* Inner Header for Schedule (Optional, but keeps context) */}
                     <div className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2 shrink-0">
                        <h2 className="text-lg font-bold text-gray-800">Scheduled Activities ({subject})</h2>
                     </div>

                     {/* The Scrollable List */}
                     <div className="flex-1 min-h-0 px-4 sm:px-6 pb-4 sm:pb-6">
                        <ScheduledActivitiesList 
                            activities={scheduleActivities} 
                            subject={subject} 
                            loading={scheduleLoading} 
                            error={scheduleError}
                            onAttach={handleAttachClick}
                        />
                     </div>
                </div>
            </div>
        </main>
      </div>
      
      {/* Material Grid Modal */}
      {targetActivity && (
        <MaterialGridModal
          isOpen={showGridModal}
          onClose={() => setShowGridModal(false)}
          activity={targetActivity}
          subject={subject}
        />
      )}
    </div>
  );
}

"use client";
import PrincipalSidebar from "@/components/Principal/Sidebar";
import PrincipalHeader from "@/components/Principal/Header";
import { useMemo, useState, useEffect } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";
import ScheduledActivitiesList, { type CalendarActivity } from "./ScheduledActivitiesList";
import BaseModal from "@/components/Common/Modals/BaseModal";
import MaterialTabContent from "@/modules/MasterTeacher/Coordinator/materials/MaterialsTab";

const GRADE_OPTIONS = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];

type SubjectTitle = "English" | "Filipino" | "Mathematics";

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

  const [selectedGrade, setSelectedGrade] = useState(GRADE_OPTIONS[0]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Calendar State
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleActivities, setScheduleActivities] = useState<CalendarActivity[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<CalendarActivity | null>(null);

  // Fetch Schedule
  useEffect(() => {
    let cancelled = false;
    const loadSchedule = async () => {
      setScheduleLoading(true);
      setScheduleError(null);
      try {
        const params = new URLSearchParams();
        if (selectedGrade) {
          params.set("grade", selectedGrade);
        }
        const query = params.toString();
        const response = await fetch(`/api/teacher/calendar${query ? `?${query}` : ""}`, { cache: "no-store" });
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
  }, [selectedGrade]);

  const subjectTitle = normalizedSubject;
  const reviewCategory = "All Levels";

  const handleReviewClick = (activity: CalendarActivity) => {
    setSelectedActivity(activity);
    setShowReviewModal(true);
  };

  // Filter activities by search term
  const filteredActivities = useMemo(() => {
    if (!searchTerm.trim()) return scheduleActivities;
    const term = searchTerm.toLowerCase();
    return scheduleActivities.filter(activity => 
      activity.title.toLowerCase().includes(term) ||
      (activity.subject?.toLowerCase().includes(term))
    );
  }, [scheduleActivities, searchTerm]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <PrincipalSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <PrincipalHeader title="Materials" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-hidden flex flex-col">
              <div className="p-4 sm:p-5 border-b border-gray-100 shrink-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-0 w-full sm:w-auto">
                    <SecondaryHeader title={`${subjectTitle} Materials for`} />
                    <HeaderDropdown
                      options={GRADE_OPTIONS}
                      value={selectedGrade}
                      onChange={setSelectedGrade}
                      className="pl-2"
                    />
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                    <div className="relative flex-1 sm:flex-initial">
                      <input
                        type="text"
                        placeholder="Search activities..."
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
              </div>
              <div className="flex-1 min-h-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-4 overflow-y-auto">
                <ScheduledActivitiesList
                  activities={filteredActivities}
                  subject={normalizedSubject}
                  loading={scheduleLoading}
                  error={scheduleError}
                  onReview={handleReviewClick}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
      <BaseModal
        maxWidth="4xl"
        show={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title={`Review Materials: ${selectedActivity?.title || subjectTitle}`}
      >
        <div className="p-4 min-h-[400px]">
          <MaterialTabContent
            subject={subjectTitle}
            category={reviewCategory}
            requestId={selectedActivity?.id ?? null}
          />
        </div>
      </BaseModal>
    </div>
  );
}

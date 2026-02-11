"use client";
import Sidebar from "@/components/MasterTeacher/Coordinator/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useEffect, useMemo, useState } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import ArchiveTab from "./ArchiveTab";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { MATERIAL_SUBJECTS, normalizeMaterialSubject, type MaterialSubject } from "@/lib/materials/shared";
import ScheduledActivitiesList, { type CalendarActivity } from "../materials/ScheduledActivitiesList";
import BaseModal from "@/components/Common/Modals/BaseModal";

const SUBJECT_OPTIONS = MATERIAL_SUBJECTS;

type TabDefinition = {
  label: string;
};

const TAB_CONFIG: Record<(typeof SUBJECT_OPTIONS)[number], readonly TabDefinition[]> = {
  English: [
    { label: "Non Reader" },
    { label: "Syllable" },
    { label: "Word" },
    { label: "Phrase" },
    { label: "Sentence" },
    { label: "Paragraph" },
  ],
  Filipino: [
    { label: "Non Reader" },
    { label: "Syllable" },
    { label: "Word" },
    { label: "Phrase" },
    { label: "Sentence" },
    { label: "Paragraph" },
  ],
  Math: [
    { label: "Not Proficient" },
    { label: "Low Proficient" },
    { label: "Nearly Proficient" },
    { label: "Proficient" },
    { label: "Highly Proficient" },
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

export default function MasterTeacherArchive() {
  const [subject, setSubject] = useState<MaterialSubject | null>(null);
  const [activeTab, setActiveTab] = useState("");
  const [loadingSubject, setLoadingSubject] = useState<boolean>(true);
  const [subjectError, setSubjectError] = useState<string | null>(null);

  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleActivities, setScheduleActivities] = useState<CalendarActivity[]>([]);

  const [showArchiveModal, setShowArchiveModal] = useState(false);
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
  const currentTabOptions = useMemo(() => TAB_CONFIG[resolvedSubject], [resolvedSubject]);

  useEffect(() => {
    const defaultTab = currentTabOptions[0]?.label ?? "";
    setActiveTab(defaultTab);
  }, [currentTabOptions]);

  const handleReviewClick = (activity: CalendarActivity) => {
    setSelectedActivity(activity);
    setShowArchiveModal(true);
  };

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
        <Header title="Archive" />
        <main className="flex-1 overflow-hidden">
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
              overflow-hidden p-4 flex flex-col
              
              /* Tablet */
              sm:p-5
              
              /* Desktop */
              md:p-6
            "
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                  <div className="flex items-center gap-0">
                    <SecondaryHeader title={`${resolvedSubject} Materials Archive`} />
                  </div>
                  {subjectError ? (
                    <span className="text-red-500 text-sm">({subjectError})</span>
                  ) : (
                    <HeaderDropdown
                      options={currentTabOptions.map((tab) => tab.label)}
                      value={activeTab}
                      onChange={setActiveTab}
                    />
                  )}
                </div>
              </div>

              {/*---------------------------------Tab Content---------------------------------*/}
              <div
                className="
                /* Mobile */
                mt-1 flex-1 min-h-0 flex flex-col
                /* Tablet */
                sm:mt-2
              "
              >
                <div className="px-1 pt-2 pb-4">
                  <h2 className="text-lg font-bold text-gray-800">Scheduled Activities ({resolvedSubject})</h2>
                </div>
                <div className="min-h-[240px] flex-1 overflow-y-auto pr-2">
                  <ScheduledActivitiesList
                    activities={scheduleActivities}
                    subject={resolvedSubject}
                    loading={scheduleLoading}
                    error={scheduleError}
                    onReview={handleReviewClick}
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <BaseModal
        maxWidth="4xl"
        show={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        title={`Archived Materials: ${selectedActivity?.title || activeTab}`}
      >
        <div className="p-4 min-h-[400px]">
          {activeTab && (
            <ArchiveTab
              subject={resolvedSubject}
              category={activeTab}
              requestId={selectedActivity?.id ?? null}
              activityTitle={selectedActivity?.title ?? null}
              activityDate={selectedActivity?.date ?? null}
              loadingSubject={loadingSubject}
            />
          )}
        </div>
      </BaseModal>
    </div>
  );
}
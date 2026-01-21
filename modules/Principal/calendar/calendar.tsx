"use client";
import Sidebar from "@/components/Principal/Sidebar";
import Header from "@/components/Principal/Header";
import { useCallback, useEffect, useMemo, useState } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import BaseModal, { ModalInfoItem } from "@/components/Common/Modals/BaseModal";
import RemedialPeriodModal, {
  type QuarterOption,
  type QuarterRange,
  type RemedialPeriodFormValues,
} from "./Modals/RemedialPeriodModal";
import SubjectScheduleModal, {
  SUBJECT_WEEKDAYS,
  type SubjectScheduleFormValues,
} from "./Modals/SubjectScheduleModal";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

interface Activity {
  id: number;
  title: string;
  submittedBy?: string | null;
  date: Date;
  end: Date;
  type: string;
}

interface RemedialPeriod {
  schoolYear: string;
  quarters: QuarterRange;
}

interface ScheduleResponsePayload {
  schoolYear: string;
  quarters: QuarterRange;
}

interface ScheduleResponse {
  success: boolean;
  schedule: ScheduleResponsePayload | null;
}

const API_ENDPOINT = "/api/master_teacher/coordinator/calendar/remedial-schedule";
const SUBJECT_SCHEDULE_ENDPOINT = "/api/principal/weekly-subject-schedule";
const ACTIVITIES_ENDPOINT = "/api/principal/calendar";
const ACTIVITIES_DELETE_ENDPOINT = "/api/principal/calendar-activities";
const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const formatMonthRange = (range: { startMonth: number | null; endMonth: number | null }) => {
  if (!range.startMonth || !range.endMonth) return "--";
  const startLabel = MONTH_LABELS[range.startMonth - 1] ?? "";
  const endLabel = MONTH_LABELS[range.endMonth - 1] ?? "";
  if (!startLabel || !endLabel) return "--";
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
};

const getActivityColor = (type: string) => {
  switch (type) {
    case "class":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "meeting":
      return "bg-green-100 text-green-800 border-green-200";
    case "appointment":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "event":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const DEFAULT_SUBJECT_OPTIONS = ["Assessment", "English", "Filipino", "Math"] as const;

const buildEmptySubjectSchedule = (): SubjectScheduleFormValues =>
  SUBJECT_WEEKDAYS.reduce<SubjectScheduleFormValues>((acc, day) => {
    acc[day] = "";
    return acc;
  }, { startTime: "", endTime: "" } as SubjectScheduleFormValues);

const normalizeSubjectSchedule = (
  input: Partial<SubjectScheduleFormValues> | null | undefined,
): SubjectScheduleFormValues => {
  const baseline = buildEmptySubjectSchedule();
  if (!input) {
    return baseline;
  }
  for (const day of SUBJECT_WEEKDAYS) {
    const raw = input[day];
    baseline[day] = typeof raw === "string" ? raw.trim() : "";
  }
  baseline.startTime = typeof input.startTime === "string" ? input.startTime.trim() : "";
  baseline.endTime = typeof input.endTime === "string" ? input.endTime.trim() : "";
  return baseline;
};

const dedupeSubjects = (subjects: readonly string[]): string[] => {
  const unique = new Set<string>();
  for (const subject of subjects) {
    const trimmed = subject?.trim();
    if (trimmed) {
      unique.add(trimmed);
    }
  }
  return Array.from(unique);
};

const subjectScheduleHasAssignments = (schedule: SubjectScheduleFormValues): boolean =>
  SUBJECT_WEEKDAYS.some((day) => Boolean(schedule[day]?.trim().length)) &&
  Boolean(schedule.startTime?.trim()) &&
  Boolean(schedule.endTime?.trim());

const getPrincipalUserId = (): number | null => {
  const profile = getStoredUserProfile();
  const rawUserId = profile?.userId;
  const userId = typeof rawUserId === "string" ? Number(rawUserId) : rawUserId;
  if (!userId || !Number.isFinite(userId)) {
    return null;
  }
  return userId;
};


const resolveDefaultSchoolYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return month >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const parseSchoolYear = (value: string | null | undefined): { startYear: number; endYear: number } | null => {
  if (!value) return null;
  const [start, end] = value.split("-").map((part) => Number(part));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { startYear: start, endYear: end };
};

const resolveSchoolYearFromDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth();
  return month >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const monthInRange = (month: number, start: number, end: number): boolean => {
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
};

const formatTime12Hour = (value: string | null | undefined): string => {
  if (!value) return "--";
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "--";
  const period = hours >= 12 ? "PM" : "AM";
  const normalizedHours = ((hours + 11) % 12) + 1;
  return `${normalizedHours}:${String(minutes).padStart(2, "0")} ${period}`;
};

export default function PrincipalCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<(typeof GRADE_OPTIONS)[number]>(1);
  const [remedialPeriod, setRemedialPeriod] = useState<RemedialPeriod | null>(null);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>(resolveDefaultSchoolYear());
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [subjectSchedule, setSubjectSchedule] = useState<SubjectScheduleFormValues>(() => buildEmptySubjectSchedule());
  const [subjectScheduleLoading, setSubjectScheduleLoading] = useState(true);
  const [subjectScheduleError, setSubjectScheduleError] = useState<string | null>(null);
  const [subjectScheduleEmpty, setSubjectScheduleEmpty] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState<string[]>(() => dedupeSubjects(DEFAULT_SUBJECT_OPTIONS));
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectMutating, setSubjectMutating] = useState(false);
  const [subjectMutationError, setSubjectMutationError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityRemoving, setActivityRemoving] = useState(false);
  const [activityRemoveError, setActivityRemoveError] = useState<string | null>(null);

  const loadSubjectSchedule = useCallback(async () => {
    setSubjectScheduleLoading(true);
    setSubjectScheduleError(null);
    setSubjectScheduleEmpty(false);
    try {
      const response = await fetch(`${SUBJECT_SCHEDULE_ENDPOINT}?grade_id=${selectedGrade}`, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 404) {
          setSubjectScheduleEmpty(true);
          setSubjectSchedule(buildEmptySubjectSchedule());
          return;
        }
        throw new Error(`Request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as {
        success: boolean;
        schedule: Partial<SubjectScheduleFormValues> | null;
        options?: { subjects?: string[] } | null;
        error?: string | null;
      };
      if (!payload.success) {
        throw new Error(payload.error ?? "Subject schedule request failed.");
      }
      if (!payload.schedule) {
        setSubjectScheduleEmpty(true);
        setSubjectSchedule(buildEmptySubjectSchedule());
      } else {
        const schedule = normalizeSubjectSchedule(payload.schedule ?? null);
        setSubjectSchedule(schedule);
      }
      const optionSeeds = Array.isArray(payload.options?.subjects) ? payload.options?.subjects : [];
      setSubjectOptions(dedupeSubjects([...DEFAULT_SUBJECT_OPTIONS, ...optionSeeds]));
    } catch (error) {
      console.error("Failed to load subject schedule", error);
      setSubjectScheduleError("Unable to load the weekly subject schedule. Please refresh or try again later.");
    } finally {
      setSubjectScheduleLoading(false);
    }
  }, [selectedGrade]);

  const loadRemedialSchedule = useCallback(async () => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const response = await fetch(`${API_ENDPOINT}?school_year=${encodeURIComponent(selectedSchoolYear)}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = (await response.json()) as ScheduleResponse;
      if (!data.success) {
        throw new Error("Server responded with an error");
      }
      const schedule = data.schedule;
      if (schedule?.quarters) {
        setRemedialPeriod({
          schoolYear: schedule.schoolYear,
          quarters: schedule.quarters,
        });
      } else {
        setRemedialPeriod(null);
      }
    } catch (error) {
      console.error("Failed to load remedial schedule", error);
      setScheduleError("Unable to load the remedial schedule. Showing the last saved version.");
    } finally {
      setScheduleLoading(false);
    }
  }, [selectedSchoolYear]);

  useEffect(() => {
    loadRemedialSchedule();
  }, [loadRemedialSchedule]);

  useEffect(() => {
    loadSubjectSchedule();
  }, [loadSubjectSchedule]);

  const loadApprovedActivities = useCallback(async () => {
    try {
      const gradeLabel = `Grade ${selectedGrade}`;
      const response = await fetch(`${ACTIVITIES_ENDPOINT}?grade=${encodeURIComponent(gradeLabel)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        activities?: Array<{
          id: string;
          title: string | null;
          submittedBy?: string | null;
          date: string | null;
          end?: string | null;
          type?: string | null;
        }>;
        error?: string | null;
      } | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? `Unable to load activities (status ${response.status})`);
      }

      const parsed = Array.isArray(payload.activities) ? payload.activities : [];
      const mapped = parsed
        .map<Activity | null>((item) => {
          const date = item.date ? new Date(item.date) : null;
          if (!date || Number.isNaN(date.getTime())) return null;
          const end = item.end ? new Date(item.end) : new Date(date.getTime() + 60 * 60 * 1000);
          const activity: Activity = {
            id: Number(item.id),
            title: item.title ?? "Remedial Activity",
            submittedBy: item.submittedBy ?? null,
            date,
            end,
            type: item.type ?? "remedial",
          };
          return activity;
        })
        .filter((item): item is Activity => item !== null);

      setActivities(mapped);
    } catch (error) {
      console.warn("Failed to load approved activities", error);
      setActivities([]);
    }
  }, [selectedGrade]);

  useEffect(() => {
    loadApprovedActivities();
  }, [loadApprovedActivities]);

  const subjectScheduleConfigured = useMemo(
    () => subjectScheduleHasAssignments(subjectSchedule),
    [subjectSchedule],
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthMatrix = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const weeks: Array<Array<Date | null>> = [];
    let day = 1;

    for (let week = 0; week < 6; week++) {
      if (day > daysInMonth) break;
      const days: Array<Date | null> = [];

      for (let weekday = 0; weekday < 7; weekday++) {
        if ((week === 0 && weekday < firstDay) || day > daysInMonth) {
          days.push(null);
        } else {
          days.push(new Date(year, month, day));
          day += 1;
        }
      }

      weeks.push(days);
    }

    return weeks;
  }, [month, year]);

  const prevMonth = () => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() - 1);
    setCurrentDate(next);
  };

  const nextMonth = () => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isWithinPeriod = (date: Date) => {
    if (!remedialPeriod?.quarters) return false;
    const schoolYear = remedialPeriod.schoolYear ?? selectedSchoolYear;
    const parsed = parseSchoolYear(schoolYear);
    const dateSchoolYear = resolveSchoolYearFromDate(date);
    if (!parsed || dateSchoolYear !== schoolYear) return false;
    const month = date.getMonth() + 1;
    const ranges = Object.values(remedialPeriod.quarters);
    return ranges.some((range) => {
      if (!range?.startMonth || !range?.endMonth) return false;
      return monthInRange(month, range.startMonth, range.endMonth);
    });
  };

  const renderDayCell = (cellDate: Date | null) => {
    if (!cellDate) {
      return <div className="h-24 p-1 border border-gray-100 bg-gray-50"></div>;
    }

    const cellActivities = activities.filter(
      (activity) =>
        activity.date.getDate() === cellDate.getDate() &&
        activity.date.getMonth() === cellDate.getMonth() &&
        activity.date.getFullYear() === cellDate.getFullYear()
    );

    const isToday = (() => {
      const today = new Date();
      return (
        cellDate.getDate() === today.getDate() &&
        cellDate.getMonth() === today.getMonth() &&
        cellDate.getFullYear() === today.getFullYear()
      );
    })();

    const withinPeriod = isWithinPeriod(cellDate);

    return (
      <div
        className={`h-24 p-1 border overflow-hidden relative hover:bg-gray-50 transition-colors cursor-pointer ${
          withinPeriod ? "border-green-200 bg-green-50" : "border-gray-100"
        }`}
      >
        <div className="text-right text-sm font-medium text-gray-800 mb-1">
          {withinPeriod && (
            <span className="absolute left-1 top-1 text-[0.65rem] font-semibold uppercase tracking-wide text-[#013300]/70">
              Remedial
            </span>
          )}
          {isToday ? (
            <span className="inline-block w-6 h-6 bg-[#013300] text-white rounded-full text-center leading-6">
              {cellDate.getDate()}
            </span>
          ) : (
            <span>{cellDate.getDate()}</span>
          )}
        </div>
        <div className="overflow-y-auto max-h-12 space-y-1">
          {cellActivities.slice(0, 2).map((activity) => (
            <div
              key={activity.id}
              className={`text-xs p-1 rounded truncate cursor-pointer border ${getActivityColor(activity.type)}`}
              onClick={() => {
                setActivityRemoveError(null);
                setSelectedActivity(activity);
                setShowActivityModal(true);
              }}
            >
              <div className="flex justify-between items-center gap-2">
                <span className="truncate font-semibold text-[#013300]">
                  {activity.title}
                </span>
              </div>
            </div>
          ))}
          {cellActivities.length > 2 && (
            <div className="text-xs text-gray-500 text-center bg-gray-100 rounded p-1">
              +{cellActivities.length - 2} more
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleOpenSubjectModal = () => {
    setSubjectMutationError(null);
    setShowSubjectModal(true);
  };

  const handleCloseSubjectModal = () => {
    if (subjectMutating) {
      return;
    }
    setShowSubjectModal(false);
    setSubjectMutationError(null);
  };

  const handleSaveSubjectSchedule = async (values: SubjectScheduleFormValues) => {
    if (subjectMutating) return;

    const existing = normalizeSubjectSchedule(subjectSchedule);
    const draft = normalizeSubjectSchedule(values);
    const hasExistingTime = Boolean(existing.startTime || existing.endTime);

    let resolvedStartTime = draft.startTime || existing.startTime;
    let resolvedEndTime = draft.endTime || existing.endTime;

    if (!hasExistingTime) {
      if (!draft.startTime || !draft.endTime) {
        setSubjectMutationError("Start and end time are required for new schedules.");
        return;
      }
      resolvedStartTime = draft.startTime;
      resolvedEndTime = draft.endTime;
    }

    if (!resolvedStartTime || !resolvedEndTime) {
      setSubjectMutationError("Start and end time are required.");
      return;
    }

    // Validate time order
    const parseTimeToMinutes = (timeStr: string): number | null => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
      return hours * 60 + minutes;
    };

    const startMinutes = parseTimeToMinutes(resolvedStartTime);
    const endMinutes = parseTimeToMinutes(resolvedEndTime);
    
    if (startMinutes === null || endMinutes === null) {
      setSubjectMutationError("Invalid time format.");
      return;
    }
    
    if (endMinutes <= startMinutes) {
      setSubjectMutationError("End time must be later than start time.");
      return;
    }

    setSubjectMutationError(null);
    setSubjectMutating(true);

    const createdByUserId = getPrincipalUserId();

    if (!createdByUserId) {
      setSubjectMutationError("Your session has expired. Please sign in again.");
      setSubjectMutating(false);
      return;
    }

    try {
      const response = await fetch(SUBJECT_SCHEDULE_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule: {
            ...draft,
            startTime: resolvedStartTime,
            endTime: resolvedEndTime,
          },
          grade_id: selectedGrade,
          created_by_user_id: createdByUserId,
        }),
      });
      
      const payload = (await response.json().catch(() => null)) as {
        success: boolean;
        schedule: Partial<SubjectScheduleFormValues> | null;
        options?: { subjects?: string[] } | null;
        error?: string | null;
      } | null;
      
      if (!response.ok) {
        const message = payload && typeof payload.error === "string"
          ? payload.error
          : `Request failed with status ${response.status}`;
        throw new Error(message);
      }
      
      if (!payload || !payload.success) {
        throw new Error(payload?.error ?? "Failed to update subject schedule.");
      }
      
      const schedule = normalizeSubjectSchedule(payload.schedule ?? {
        ...draft,
        startTime: resolvedStartTime,
        endTime: resolvedEndTime,
      });
      setSubjectSchedule(schedule);
      const optionSeeds = Array.isArray(payload.options?.subjects) ? payload.options?.subjects : [];
      setSubjectOptions(dedupeSubjects([...DEFAULT_SUBJECT_OPTIONS, ...optionSeeds]));
      setSubjectMutationError(null);
      setShowSubjectModal(false);
    } catch (error) {
      console.error("Failed to update subject schedule", error);
      setSubjectMutationError("Unable to update the subject schedule. Please try again.");
    } finally {
      setSubjectMutating(false);
    }
  };

  const handleResetSubjectSchedule = async () => {
    if (subjectMutating) return;
    setSubjectMutationError(null);
    setSubjectMutating(true);
    try {
      const response = await fetch(`${SUBJECT_SCHEDULE_ENDPOINT}?grade_id=${selectedGrade}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as {
        success: boolean;
        schedule: Partial<SubjectScheduleFormValues> | null;
        options?: { subjects?: string[] } | null;
        error?: string | null;
      } | null;
      if (!response.ok) {
        const message = payload && typeof payload.error === "string"
          ? payload.error
          : `Request failed with status ${response.status}`;
        throw new Error(message);
      }
      if (!payload || !payload.success) {
        throw new Error(payload?.error ?? "Failed to reset subject schedule.");
      }
      const schedule = normalizeSubjectSchedule(payload.schedule ?? buildEmptySubjectSchedule());
      setSubjectSchedule(schedule);
      const optionSeeds = Array.isArray(payload.options?.subjects) ? payload.options?.subjects : [];
      setSubjectOptions(dedupeSubjects([...DEFAULT_SUBJECT_OPTIONS, ...optionSeeds]));
      setSubjectMutationError(null);
    } catch (error) {
      console.error("Failed to reset subject schedule", error);
      setSubjectMutationError("Unable to reset the subject schedule. Please try again.");
    } finally {
      setSubjectMutating(false);
    }
  };

  const handleSavePeriod = async (values: RemedialPeriodFormValues) => {
    if (isMutating) return;
    setIsMutating(true);
    setScheduleError(null);
    const createdByUserId = getPrincipalUserId();
    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          created_by_user_id: createdByUserId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ScheduleResponse | null;
      if (!response.ok) {
        const message = payload && typeof (payload as any)?.error === "string"
          ? (payload as any).error
          : `Request failed with status ${response.status}`;
        throw new Error(message);
      }
      const data = payload ?? { success: false, schedule: null };
      if (!data.success) {
        throw new Error("Server responded with an error");
      }
      const schedule = data.schedule;
      if (!schedule?.quarters) {
        throw new Error("Incomplete schedule returned by the server");
      }
      setRemedialPeriod({
        schoolYear: schedule.schoolYear,
        quarters: schedule.quarters,
      });
      setSelectedSchoolYear(schedule.schoolYear);
      setShowPeriodModal(false);
    } catch (error) {
      console.error("Failed to save remedial schedule", error);
      setScheduleError(error instanceof Error ? error.message : "Unable to save the remedial schedule. Please try again.");
    } finally {
      setIsMutating(false);
    }
  };

  const openCancelModal = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (isMutating) return;
    setIsMutating(true);
    setScheduleError(null);
    try {
      const response = await fetch(`${API_ENDPOINT}?school_year=${encodeURIComponent(selectedSchoolYear)}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as ScheduleResponse | null;
      if (!response.ok) {
        const message = payload && typeof (payload as any)?.error === "string"
          ? (payload as any).error
          : `Request failed with status ${response.status}`;
        throw new Error(message);
      }
      const data = payload ?? { success: false, schedule: null };
      if (!data.success) {
        throw new Error("Server responded with an error");
      }
      const schedule = data.schedule;
      if (schedule?.quarters) {
        setRemedialPeriod({
          schoolYear: schedule.schoolYear,
          quarters: schedule.quarters,
        });
      } else {
        setRemedialPeriod(null);
      }
      setShowCancelModal(false);
    } catch (error) {
      console.error("Failed to cancel remedial schedule", error);
      setScheduleError(error instanceof Error ? error.message : "Unable to cancel the remedial schedule. Please try again.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
  };

  const handleConfirmActivityDelete = async () => {
    if (!selectedActivity || activityRemoving) return;
    setActivityRemoving(true);
    setActivityRemoveError(null);
    try {
      const response = await fetch(ACTIVITIES_DELETE_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: selectedActivity.id,
          sourceTable: "approved_remedial_schedule",
        }),
      });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: string | null } | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
      }
      setShowActivityModal(false);
      setSelectedActivity(null);
      loadApprovedActivities();
    } catch (error) {
      console.error("Failed to remove activity", error);
      setActivityRemoveError("Unable to remove the activity. Please try again.");
    } finally {
      setActivityRemoving(false);
    }
  };

  const handleCloseActivityModal = () => {
    if (activityRemoving) return;
    setShowActivityModal(false);
    setSelectedActivity(null);
    setActivityRemoveError(null);
  };

  const modalInitialData = useMemo<RemedialPeriodFormValues>(() => ({
    schoolYear: remedialPeriod?.schoolYear ?? selectedSchoolYear,
    quarters: remedialPeriod?.quarters ?? {
      "1st Quarter": { startMonth: null, endMonth: null },
      "2nd Quarter": { startMonth: null, endMonth: null },
    },
  }), [remedialPeriod, selectedSchoolYear]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Calendar" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              {/* Calendar Controls */}
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="flex items-center space-x-1">
                      <button onClick={prevMonth} className="p-2 rounded-md hover:bg-gray-100 text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button onClick={nextMonth} className="p-2 rounded-md hover:bg-gray-100 text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">
                      {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </h2>
                    <button onClick={goToToday} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700">
                      Today
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <PrimaryButton
                      type="button"
                      small
                      className="px-4"
                      onClick={() => setShowPeriodModal(true)}
                      disabled={isMutating}
                    >
                      {remedialPeriod ? "Update Schedule" : "Set Schedule"}
                    </PrimaryButton>
                    <DangerButton
                      type="button"
                      small
                      className={`px-4 ${!remedialPeriod ? "opacity-60" : ""}`}
                      onClick={openCancelModal}
                      disabled={isMutating || !remedialPeriod}
                    >
                      Cancel Schedule
                    </DangerButton>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">Grade Calendar</span>
                    <div className="flex flex-wrap gap-2">
                      {GRADE_OPTIONS.map((grade) => (
                        <button
                          key={grade}
                          type="button"
                          onClick={() => setSelectedGrade(grade)}
                          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                            selectedGrade === grade
                              ? "bg-[#013300] text-white border-[#013300]"
                              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          Grade {grade}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Subject Schedule Card */}
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <p className="text-xl font-semibold text-gray-800">Weekly Subject Schedule</p>
                      {subjectScheduleLoading && (
                        <p className="text-sm text-gray-500 mt-1">Loading latest assignments…</p>
                      )}
                      {subjectScheduleError && (
                        <p className="text-sm text-amber-600 mt-1">{subjectScheduleError}</p>
                      )}
                      {subjectScheduleEmpty && !subjectScheduleError && (
                        <p className="text-sm text-gray-500 mt-1">No weekly schedule yet. Create one to get started.</p>
                      )}
                      {!subjectScheduleLoading && !subjectScheduleConfigured && !subjectScheduleError && (
                        <p className="text-sm text-gray-600 mt-1">
                          Configure the weekday subjects so teachers know the focus for each day.
                        </p>
                      )}
                      {!subjectScheduleLoading && subjectScheduleConfigured && (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
                          <span className="uppercase tracking-wide text-[0.65rem] text-emerald-700">Time</span>
                          <span>
                            {formatTime12Hour(subjectSchedule.startTime)} – {formatTime12Hour(subjectSchedule.endTime)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <PrimaryButton
                        type="button"
                        small
                        className="px-4"
                        onClick={handleOpenSubjectModal}
                        disabled={subjectMutating}
                      >
                        {subjectScheduleConfigured ? "Edit Subjects" : "Set Subjects"}
                      </PrimaryButton>
                      <DangerButton
                        type="button"
                        small
                        className={`px-4 ${!subjectScheduleConfigured ? "opacity-60" : ""}`}
                        onClick={handleResetSubjectSchedule}
                        disabled={subjectMutating || !subjectScheduleConfigured}
                      >
                        Reset
                      </DangerButton>
                    </div>
                  </div>

                  {!subjectScheduleLoading && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {SUBJECT_WEEKDAYS.map((day) => (
                        <div
                          key={day}
                          className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 shadow-sm"
                        >
                          <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">{day}</div>
                          <div className="mt-1 text-lg font-semibold text-black">
                            {subjectSchedule[day] ? subjectSchedule[day] : "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Remedial Period Card */}
                <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <p className="text-xl font-semibold text-gray-800">Remedial Period Schedule</p>
                      {scheduleLoading && (
                        <p className="text-sm text-gray-500 mt-1">Loading latest schedule…</p>
                      )}
                      {scheduleError && (
                        <p className="text-sm text-amber-600 mt-1">{scheduleError}</p>
                      )}
                      {remedialPeriod ? (
                        <div className="mt-1 space-y-1">
                          <p className="text-sm text-gray-600">
                            School Year: {remedialPeriod.schoolYear}
                          </p>
                          <p className="text-sm text-gray-600">
                            1st Quarter · {formatMonthRange(remedialPeriod.quarters["1st Quarter"])}
                          </p>
                          <p className="text-sm text-gray-600">
                            2nd Quarter · {formatMonthRange(remedialPeriod.quarters["2nd Quarter"])}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 mt-1">
                          Click Set Schedule to configure the remedial timeframe.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Calendar View */}
              <div className="border rounded-lg overflow-hidden bg-white">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-base font-semibold text-gray-800">Grade {selectedGrade} Calendar</h3>
                </div>
                <div className="grid grid-cols-7 bg-gray-50 text-sm font-medium text-gray-700">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                    <div key={`${day}-${index}`} className="p-2 text-center">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="divide-y">
                  {monthMatrix.map((week, index) => (
                    <div key={`week-${index}`} className="grid grid-cols-7">
                      {week.map((date, dayIndex) => (
                        <div key={`day-${index}-${dayIndex}`}>
                          {renderDayCell(date)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <SubjectScheduleModal
        show={showSubjectModal}
        onClose={handleCloseSubjectModal}
        onSave={handleSaveSubjectSchedule}
        initialValues={subjectSchedule}
        subjectOptions={subjectOptions}
        isSaving={subjectMutating}
        errorMessage={subjectMutationError}
      />
      <RemedialPeriodModal
        show={showPeriodModal}
        onClose={() => setShowPeriodModal(false)}
        onSave={handleSavePeriod}
        initialData={modalInitialData}
      />
      <DeleteConfirmationModal
        isOpen={showCancelModal}
        onClose={handleCloseCancelModal}
        onConfirm={handleConfirmCancel}
        title="Cancel Remedial Schedule"
        message="Are you sure you want to cancel the current remedial schedule? This will remove the configured period for all principals."
      />
      <BaseModal
        show={showActivityModal}
        onClose={handleCloseActivityModal}
        title="Activity Details"
        maxWidth="md"
        footer={(
          <>
            <SecondaryButton type="button" onClick={handleCloseActivityModal} disabled={activityRemoving}>
              Close
            </SecondaryButton>
            <DangerButton type="button" onClick={handleConfirmActivityDelete} disabled={activityRemoving || !selectedActivity}>
              {activityRemoving ? "Deleting..." : "Delete"}
            </DangerButton>
          </>
        )}
      >
        {activityRemoveError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {activityRemoveError}
          </div>
        )}
        <div className="space-y-4">
          <ModalInfoItem label="Title" value={selectedActivity?.title ?? "-"} />
          <ModalInfoItem
            label="Date"
            value={selectedActivity ? selectedActivity.date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }) : "-"}
          />
          <ModalInfoItem label="Submitted by" value={selectedActivity?.submittedBy ?? "-"} />
        </div>
      </BaseModal>
    </div>
  );
}
"use client";
import Sidebar from "@/components/Principal/Sidebar";
import Header from "@/components/Principal/Header";
import { useCallback, useEffect, useMemo, useState } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import BaseModal, { ModalInfoItem } from "@/components/Common/Modals/BaseModal";
import {
  QUARTER_OPTIONS,
  type QuarterOption,
  type QuarterRange,
  type RemedialPeriodFormValues,
  SUBJECT_WEEKDAYS,
  type SubjectScheduleFormValues,
} from "./schedule-settings";
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

const MONTH_OPTIONS = [
  { label: "January", value: 1 },
  { label: "February", value: 2 },
  { label: "March", value: 3 },
  { label: "April", value: 4 },
  { label: "May", value: 5 },
  { label: "June", value: 6 },
  { label: "July", value: 7 },
  { label: "August", value: 8 },
  { label: "September", value: 9 },
  { label: "October", value: 10 },
  { label: "November", value: 11 },
  { label: "December", value: 12 },
] as const;

const formatMonthRange = (range: { startMonth: number | null; endMonth: number | null }) => {
  if (!range.startMonth || !range.endMonth) return "--";
  const startLabel = MONTH_LABELS[range.startMonth - 1] ?? "";
  const endLabel = MONTH_LABELS[range.endMonth - 1] ?? "";
  if (!startLabel || !endLabel) return "--";
  return startLabel === endLabel ? startLabel : `${startLabel} â€“ ${endLabel}`;
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

const getSubjectColor = (subject: string | null | undefined) => {
  const value = subject?.toLowerCase() ?? "";
  if (value.includes("english")) return "border-emerald-200 bg-emerald-50";
  if (value.includes("filipino")) return "border-blue-200 bg-blue-100";
  if (value.includes("math")) return "border-rose-200 bg-rose-100";
  if (value.includes("assessment")) return "border-amber-200 bg-amber-100";
  return "border-gray-100";
};

const getSubjectChipTone = (subject: string | null | undefined) => {
  const value = subject?.toLowerCase() ?? "";
  if (value.includes("english")) return "bg-emerald-700 text-white border-emerald-700";
  if (value.includes("filipino")) return "bg-blue-700 text-white border-blue-700";
  if (value.includes("math")) return "bg-rose-700 text-white border-rose-700";
  if (value.includes("assessment")) return "bg-amber-700 text-white border-amber-700";
  return "bg-gray-700 text-white border-gray-700";
};

const resolveActivitySubject = (title: string | null | undefined, fallback: string | null | undefined) => {
  const text = `${title ?? ""}`.toLowerCase();
  if (text.includes("english")) return "english";
  if (text.includes("filipino")) return "filipino";
  if (text.includes("math")) return "math";
  if (text.includes("assessment")) return "assessment";
  return fallback ?? null;
};

const MONTH_LABELS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const formatMonthRangeShort = (range: { startMonth: number | null; endMonth: number | null }) => {
  if (!range.startMonth || !range.endMonth) return "--";
  const startLabel = MONTH_LABELS_SHORT[range.startMonth - 1] ?? "";
  const endLabel = MONTH_LABELS_SHORT[range.endMonth - 1] ?? "";
  if (!startLabel || !endLabel) return "--";
  return startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`;
};

const DEFAULT_SUBJECT_OPTIONS = ["Assessment", "English", "Filipino", "Math"] as const;

const buildEmptySubjectSchedule = (): SubjectScheduleFormValues =>
  SUBJECT_WEEKDAYS.reduce<SubjectScheduleFormValues>((acc, day) => {
    acc[day] = "";
    return acc;
  }, { startTime: "", endTime: "" } as SubjectScheduleFormValues);

const buildEmptyQuarterRanges = (): QuarterRange => ({
  "1st Quarter": { startMonth: null, endMonth: null },
  "2nd Quarter": { startMonth: null, endMonth: null },
});

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

const SUBJECT_DAY_LABELS: Record<(typeof SUBJECT_WEEKDAYS)[number], string> = {
  Monday: "M",
  Tuesday: "T",
  Wednesday: "W",
  Thursday: "Th",
  Friday: "F",
};

export default function PrincipalCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<(typeof GRADE_OPTIONS)[number]>(1);
  const [remedialPeriod, setRemedialPeriod] = useState<RemedialPeriod | null>(null);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>(resolveDefaultSchoolYear());
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [gradeMenuOpen, setGradeMenuOpen] = useState(false);
  const [subjectSchedule, setSubjectSchedule] = useState<SubjectScheduleFormValues>(() => buildEmptySubjectSchedule());
  const [subjectScheduleLoading, setSubjectScheduleLoading] = useState(true);
  const [subjectScheduleError, setSubjectScheduleError] = useState<string | null>(null);
  const [subjectScheduleEmpty, setSubjectScheduleEmpty] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState<string[]>(() => dedupeSubjects(DEFAULT_SUBJECT_OPTIONS));
  const [activeSettingsTab, setActiveSettingsTab] = useState<"weekly" | "remedial">("weekly");
  const [subjectDraft, setSubjectDraft] = useState<SubjectScheduleFormValues>(() => buildEmptySubjectSchedule());
  const [remedialDraft, setRemedialDraft] = useState<RemedialPeriodFormValues>(() => ({
    schoolYear: resolveDefaultSchoolYear(),
    quarters: buildEmptyQuarterRanges(),
  }));
  const [remedialDraftError, setRemedialDraftError] = useState<string | null>(null);
  const [subjectMutating, setSubjectMutating] = useState(false);
  const [subjectMutationError, setSubjectMutationError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }
    setSubjectDraft(normalizeSubjectSchedule(subjectSchedule));
    setSubjectMutationError(null);
  }, [settingsOpen, subjectSchedule, selectedGrade]);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }
    setRemedialDraft({
      schoolYear: remedialPeriod?.schoolYear ?? selectedSchoolYear,
      quarters: remedialPeriod?.quarters ?? buildEmptyQuarterRanges(),
    });
    setRemedialDraftError(null);
  }, [settingsOpen, remedialPeriod, selectedSchoolYear]);

  useEffect(() => {
    if (!settingsOpen) {
      document.body.style.overflow = "";
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [settingsOpen]);

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
  const weeklyTimeLabel = `${formatTime12Hour(subjectSchedule.startTime)} \u2013 ${formatTime12Hour(subjectSchedule.endTime)}`;
  const quarterOneLabel = remedialPeriod ? formatMonthRangeShort(remedialPeriod.quarters["1st Quarter"]) : "--";
  const quarterTwoLabel = remedialPeriod ? formatMonthRangeShort(remedialPeriod.quarters["2nd Quarter"]) : "--";
  const activeRemedialQuarter = useMemo(() => {
    if (!remedialPeriod?.quarters) return null;
    const month = new Date().getMonth() + 1;
    const entries = Object.entries(remedialPeriod.quarters) as Array<
      [keyof RemedialPeriod["quarters"], { startMonth: number | null; endMonth: number | null }]
    >;
    for (const [label, range] of entries) {
      if (!range?.startMonth || !range?.endMonth) continue;
      if (monthInRange(month, range.startMonth, range.endMonth)) {
        return label;
      }
    }
    return null;
  }, [remedialPeriod]);
  const activeRemedialQuarterLabel = useMemo(() => {
    if (!activeRemedialQuarter || !remedialPeriod?.quarters) {
      return "--";
    }
    const range = remedialPeriod.quarters[activeRemedialQuarter];
    if (!range) {
      return activeRemedialQuarter;
    }
    const monthRange = formatMonthRangeShort(range);
    return monthRange && monthRange !== "--"
      ? `${activeRemedialQuarter} | ${monthRange}`
      : activeRemedialQuarter;
  }, [activeRemedialQuarter, remedialPeriod]);

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

  const prevPeriod = () => {
    const next = new Date(currentDate);
    if (view === "month") {
      next.setMonth(next.getMonth() - 1);
    } else {
      next.setDate(next.getDate() - 7);
    }
    setCurrentDate(next);
  };

  const nextPeriod = () => {
    const next = new Date(currentDate);
    if (view === "month") {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setDate(next.getDate() + 7);
    }
    setCurrentDate(next);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getWeekNumber = (date: Date): number => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  const getActivitiesByWeek = () => {
    const grouped: Record<string, Activity[]> = {};

    activities.forEach((activity) => {
      const weekNumber = getWeekNumber(activity.date);
      const weekKey = `Week ${weekNumber}`;

      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(activity);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => parseInt(a.replace("Week ", ""), 10) - parseInt(b.replace("Week ", ""), 10))
      .map(([week, weekActivities]) => ({
        week,
        activities: weekActivities.sort((a, b) => a.date.getTime() - b.date.getTime()),
      }));
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

    const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
    const withinPeriod = isWithinPeriod(cellDate) && !isWeekend;
    const weekdayIndex = cellDate.getDay();
    const weekdayLabel = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekdayIndex] ?? "";
    const subjectForDay = SUBJECT_WEEKDAYS.includes(weekdayLabel as (typeof SUBJECT_WEEKDAYS)[number])
      ? subjectSchedule[weekdayLabel as (typeof SUBJECT_WEEKDAYS)[number]]
      : "";
    const subjectColor = withinPeriod ? getSubjectColor(subjectForDay) : "border-gray-100";

    return (
      <div
        className={`h-24 p-1 border overflow-hidden relative hover:bg-gray-50 transition-colors cursor-pointer ${subjectColor}`}
      >
        <div className="text-right text-sm font-medium text-gray-800 mb-1">
          {isToday ? (
            <span className="inline-block w-6 h-6 bg-[#013300] text-white rounded-full text-center leading-6">
              {cellDate.getDate()}
            </span>
          ) : (
            <span>{cellDate.getDate()}</span>
          )}
        </div>
        <div className="overflow-y-auto max-h-12 space-y-1">
          {cellActivities.slice(0, 2).map((activity) => {
            const activitySubject = resolveActivitySubject(activity.title, subjectForDay);
            return (
              <div
                key={activity.id}
                className={`rounded-lg border px-2 py-1 text-[0.7rem] font-semibold shadow-sm ${getSubjectChipTone(activitySubject)}`}
                onClick={() => {
                  setActivityRemoveError(null);
                  setSelectedActivity(activity);
                  setShowActivityModal(true);
                }}
                title={activity.title}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[0.6rem] font-semibold text-white">
                    {activitySubject ? activitySubject.charAt(0).toUpperCase() : "A"}
                  </span>
                  <span className="text-[0.7rem] font-semibold leading-snug text-white line-clamp-2">
                    {activity.title}
                  </span>
                </div>
              </div>
            );
          })}
          {cellActivities.length > 2 && (
            <div className="text-xs text-gray-500 text-center bg-gray-100 rounded p-1">
              +{cellActivities.length - 2} more
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMonthView = () => (
    <>
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
    </>
  );

  const renderWeekView = () => {
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const formatSubjectLabel = (subject: string | null) => {
      if (!subject) return "Remedial";
      const normalized = subject.toLowerCase();
      if (normalized.includes("english")) return "English";
      if (normalized.includes("filipino")) return "Filipino";
      if (normalized.includes("math")) return "Math";
      if (normalized.includes("assessment")) return "Assessment";
      return subject
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    };
    const formatTimeRange = (start: Date, end: Date) => {
      const startLabel = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const endLabel = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `${startLabel} - ${endLabel}`.toLowerCase();
    };
    const formatStackedDate = (date: Date) => ({
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
      day: date.toLocaleDateString("en-US", { day: "2-digit" }),
      month: date.toLocaleDateString("en-US", { month: "short" }),
    });

    const days = Array.from({ length: 7 }, (_, index) => {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + index);

      const dayActivities = activities
        .filter(
          (activity) =>
            activity.date.getDate() === dayDate.getDate() &&
            activity.date.getMonth() === dayDate.getMonth() &&
            activity.date.getFullYear() === dayDate.getFullYear(),
        )
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      return (
        <div key={`weekday-${index}`} className="border-b border-gray-200">
          <div className="p-2 bg-gray-50">
            <div>
              <div className="font-medium text-gray-800 text-sm">{dayNames[index]}</div>
              <div className="text-xs text-gray-600">
                {dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {dayDate.getDate() === new Date().getDate() &&
                  dayDate.getMonth() === new Date().getMonth() &&
                  dayDate.getFullYear() === new Date().getFullYear() && (
                    <span className="ml-2 text-xs bg-[#013300] text-white px-1.5 py-0.5 rounded-full">Today</span>
                  )}
              </div>
            </div>
          </div>
          <div className="p-2 space-y-2">
            {dayActivities.length > 0 ? (
              dayActivities.map((activity) => {
                const weekdayLabel = dayDate.toLocaleDateString("en-US", { weekday: "long" });
                const scheduleSubject = SUBJECT_WEEKDAYS.includes(weekdayLabel as (typeof SUBJECT_WEEKDAYS)[number])
                  ? subjectSchedule[weekdayLabel as (typeof SUBJECT_WEEKDAYS)[number]]
                  : null;
                const activitySubject = resolveActivitySubject(activity.title, scheduleSubject);
                const subjectTone = getSubjectColor(activitySubject);
                const subjectLabel = formatSubjectLabel(activitySubject);
                const dateParts = formatStackedDate(activity.date);
                const timeLabel = subjectScheduleConfigured
                  ? `${formatTime12Hour(subjectSchedule.startTime)} - ${formatTime12Hour(subjectSchedule.endTime)}`.toLowerCase()
                  : formatTimeRange(activity.date, activity.end);
                return (
                  <div
                    key={activity.id}
                    className={`rounded-2xl border border-transparent p-4 shadow-sm ring-1 ring-black/5 ${subjectTone}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                      <div className="min-w-[72px] text-center">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {dateParts.weekday}
                        </div>
                        <div className="text-3xl font-semibold text-gray-900 leading-none">{dateParts.day}</div>
                        <div className="text-sm font-semibold text-gray-600">{dateParts.month}</div>
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                          {subjectLabel}
                        </div>
                        <div className="text-base font-semibold text-gray-900">{activity.title}</div>
                        <div className="text-sm text-gray-600">{timeLabel}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-gray-400 py-4 text-sm">No activities scheduled</div>
            )}
          </div>
        </div>
      );
    });

    return <div className="divide-y">{days}</div>;
  };

  const renderCalendar = () => {
    if (view === "week") {
      return renderWeekView();
    }

    return renderMonthView();
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
      setSubjectDraft(schedule);
      const optionSeeds = Array.isArray(payload.options?.subjects) ? payload.options?.subjects : [];
      setSubjectOptions(dedupeSubjects([...DEFAULT_SUBJECT_OPTIONS, ...optionSeeds]));
      setSubjectMutationError(null);
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
      setSubjectDraft(schedule);
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

  const handleSubjectDraftChange = (day: (typeof SUBJECT_WEEKDAYS)[number], value: string) => {
    setSubjectDraft((prev) => ({ ...prev, [day]: value }));
  };

  const handleSubjectTimeChange = (field: "startTime" | "endTime", value: string) => {
    setSubjectDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleRemedialDraftChange = (
    quarter: QuarterOption,
    field: "startMonth" | "endMonth",
    value: number | null,
  ) => {
    setRemedialDraft((prev) => ({
      ...prev,
      quarters: {
        ...prev.quarters,
        [quarter]: {
          ...prev.quarters[quarter],
          [field]: value,
        },
      },
    }));
  };

  const handleSettingsCancel = () => {
    if (activeSettingsTab === "weekly") {
      setSubjectDraft(normalizeSubjectSchedule(subjectSchedule));
      setSubjectMutationError(null);
      return;
    }
    setRemedialDraft({
      schoolYear: remedialPeriod?.schoolYear ?? selectedSchoolYear,
      quarters: remedialPeriod?.quarters ?? buildEmptyQuarterRanges(),
    });
    setRemedialDraftError(null);
  };

  const handleSettingsSave = () => {
    if (activeSettingsTab === "weekly") {
      void handleSaveSubjectSchedule(subjectDraft);
      return;
    }
    void handleSavePeriod(remedialDraft);
  };

  const handleSavePeriod = async (values: RemedialPeriodFormValues) => {
    if (isMutating) return;
    setRemedialDraftError(null);

    for (const quarter of QUARTER_OPTIONS) {
      const range = values.quarters[quarter];
      if (!range?.startMonth || !range?.endMonth) {
        setRemedialDraftError(`Select start and end months for the ${quarter}.`);
        return;
      }
      if (range.startMonth > range.endMonth) {
        setRemedialDraftError(`The ${quarter} start month must be before the end month.`);
        return;
      }
    }

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
      setRemedialDraft({
        schoolYear: schedule.schoolYear,
        quarters: schedule.quarters,
      });
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

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#f2f7f4]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-[-10%] h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] h-96 w-96 rounded-full bg-emerald-100/50 blur-3xl" />
        <div className="absolute top-16 left-1/2 h-40 w-96 -translate-x-1/2 rounded-full bg-white/70 blur-2xl" />
      </div>
      <Sidebar />
      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Calendar" />
        <main className="flex-1 overflow-y-auto">
          <div className="relative p-4 h-full sm:p-5 md:p-6">
            <div className="relative z-10 h-full min-h-100 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-5 md:p-6">
              {/* Calendar Toolbar */}
              <div className="flex flex-col gap-3 mb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="flex items-center space-x-1">
                      <button onClick={prevPeriod} className="p-2 rounded-md hover:bg-gray-100 text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button onClick={nextPeriod} className="p-2 rounded-md hover:bg-gray-100 text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">
                      {view === "month"
                        ? currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                        : view === "week"
                        ? `Week of ${currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                        : "Activities by Week"}
                    </h2>
                    <button onClick={goToToday} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700">
                      Today
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-gray-100 rounded-md p-1">
                      <button
                        onClick={() => setView("month")}
                        className={`px-3 py-1.5 text-xs rounded-md sm:text-sm ${
                          view === "month" ? "bg-white text-gray-800 shadow-sm" : "text-gray-600 hover:text-gray-800"
                        }`}
                      >
                        Month
                      </button>
                      <button
                        onClick={() => setView("week")}
                        className={`px-3 py-1.5 text-xs rounded-md sm:text-sm ${
                          view === "week" ? "bg-white text-gray-800 shadow-sm" : "text-gray-600 hover:text-gray-800"
                        }`}
                      >
                        Week
                      </button>
                    </div>
                    <div className="relative">
                      {gradeMenuOpen && (
                        <button
                          type="button"
                          className="fixed inset-0 z-10 cursor-default"
                          onClick={() => setGradeMenuOpen(false)}
                          aria-label="Close grade filter"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setGradeMenuOpen((prev) => !prev)}
                        className="relative z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100"
                        aria-label={`Filter grade (Grade ${selectedGrade})`}
                        title={`Grade ${selectedGrade}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="3 4 21 4 14 12 14 19 10 21 10 12 3 4" />
                        </svg>
                      </button>
                      {gradeMenuOpen && (
                        <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                            Grade
                          </div>
                          <div className="mt-1 space-y-1">
                            {GRADE_OPTIONS.map((grade) => (
                              <button
                                key={grade}
                                type="button"
                                onClick={() => {
                                  setSelectedGrade(grade);
                                  setGradeMenuOpen(false);
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
                                  grade === selectedGrade
                                    ? "bg-emerald-50 text-emerald-800"
                                    : "text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                <span>Grade {grade}</span>
                                {grade === selectedGrade && (
                                  <span className="text-xs text-emerald-700">Active</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white p-2 text-gray-700 transition hover:bg-gray-100"
                      aria-label="Open schedule settings"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09c0 .65.39 1.24 1 1.51.61.26 1.32.14 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.47.47-.59 1.2-.33 1.82.26.61.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.65 0-1.24.39-1.51 1Z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Grade Filter + Schedule Overview */}
              <div className="mb-4 rounded-2xl border border-white/80 bg-white/80 px-4 py-2 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-gray-900">Schedule Overview</h3>
                    {(subjectScheduleLoading || scheduleLoading) && (
                      <span className="text-xs text-gray-400">Loading...</span>
                    )}
                  </div>
                  <div />
                </div>

                <div className="mt-1 grid gap-3 text-xs font-semibold text-emerald-900 lg:grid-cols-3">
                  <div className="text-center">Remedial Time</div>
                  <div className="text-center">Remedial Subjects</div>
                  <div className="text-center">Remedial Period</div>
                </div>

                <div className="mt-1 flex flex-col gap-3 rounded-lg bg-white px-1 py-1 text-sm text-gray-700 lg:flex-row lg:items-center">
                  <div className="flex flex-1 justify-center">
                    <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600">
                      <span className="inline-flex items-center justify-center rounded-full text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v6l4 2" />
                        </svg>
                      </span>
                      <span className="font-base">{weeklyTimeLabel}</span>
                    </div>
                  </div>

                  <span className="hidden h-6 w-px bg-gray-300 lg:block" />

                  <div className="flex flex-1 justify-center">
                    <div className="flex items-center gap-2 overflow-x-auto text-center scrollbar-hide">
                      {SUBJECT_WEEKDAYS.map((day) => (
                        <div key={day} className="flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-600">
                          <span className="font-semibold text-[#013300]">{SUBJECT_DAY_LABELS[day]}</span>
                          <span className="text-gray-500">|</span>
                          <span className="text-gray-600">{subjectSchedule[day] || "--"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <span className="hidden h-6 w-px bg-gray-300 lg:block" />

                  <div className="flex flex-1 justify-center">
                    <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600">
                      <span className="inline-flex items-center justify-center rounded-full text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                      </span>
                      <span className="text-gray-600">{activeRemedialQuarterLabel}</span>
                    </div>
                  </div>
                </div>

                {subjectScheduleError && (
                  <p className="mt-2 text-xs text-amber-600">{subjectScheduleError}</p>
                )}
                {scheduleError && (
                  <p className="mt-1 text-xs text-amber-600">{scheduleError}</p>
                )}
                {subjectScheduleEmpty && !subjectScheduleLoading && !subjectScheduleError && (
                  <p className="mt-2 text-xs text-gray-500">Weekly schedule is not set yet.</p>
                )}
              </div>

              <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
                <div className="min-w-0 flex-1">
                  {/* Calendar View */}
                  <div className="rounded-2xl border border-gray-100 bg-white/90 shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-100 bg-white">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Grade {selectedGrade} Calendar</h3>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-gray-600">
                          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-500">Legend</span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            English
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            Filipino
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                            Math
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            Assessment
                          </span>
                        </div>
                      </div>
                    </div>
                    {renderCalendar()}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </main>
      </div>

      <aside
        className={`fixed inset-0 z-[2000] transition-opacity duration-300 ${
          settingsOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!settingsOpen}
      >
        <div className="absolute inset-0 bg-black/30" onClick={() => setSettingsOpen(false)} />
        <div
          role="dialog"
          aria-modal="true"
          className={`absolute right-0 top-0 flex h-full w-full max-w-[420px] transform flex-col border-l border-gray-200 bg-white transition-transform duration-300 ${
            settingsOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-start justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Schedule Settings</h3>
              <p className="text-xs text-gray-500">Grade {selectedGrade} Configuration</p>
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              className="rounded-full p-1 text-gray-400 transition hover:bg-white hover:text-gray-700"
              aria-label="Close schedule settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setActiveSettingsTab("weekly")}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeSettingsTab === "weekly"
                    ? "bg-white text-[#013300] shadow-sm"
                    : "bg-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v16H4z" />
                  <path d="M8 4v16" />
                </svg>
                Weekly Subjects
              </button>
              <button
                type="button"
                onClick={() => setActiveSettingsTab("remedial")}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeSettingsTab === "remedial"
                    ? "bg-white text-[#013300] shadow-sm"
                    : "bg-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 4h18" />
                  <path d="M8 2v4" />
                  <path d="M16 2v4" />
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                </svg>
                Remedial Period
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-24 pt-6">
            {activeSettingsTab === "weekly" ? (
              <div className="space-y-6">
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v6l4 2" />
                      </svg>
                    </span>
                    Session Time
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Start</label>
                      <input
                        type="time"
                        value={subjectDraft.startTime}
                        onChange={(event) => handleSubjectTimeChange("startTime", event.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#013300]"
                        disabled={subjectMutating || subjectScheduleLoading}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">End</label>
                      <input
                        type="time"
                        value={subjectDraft.endTime}
                        onChange={(event) => handleSubjectTimeChange("endTime", event.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#013300]"
                        disabled={subjectMutating || subjectScheduleLoading}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16v16H4z" />
                          <path d="M8 4v16" />
                        </svg>
                      </span>
                      Subject Per Day
                    </div>
                    <DangerButton
                      type="button"
                      small
                      className="px-3"
                      onClick={handleResetSubjectSchedule}
                      disabled={subjectMutating || !subjectScheduleConfigured}
                    >
                      Reset
                    </DangerButton>
                  </div>
                  <div className="space-y-2">
                    {SUBJECT_WEEKDAYS.map((day) => (
                      <div key={day} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <span className="text-sm font-semibold text-gray-700">{day}</span>
                        <select
                          value={subjectDraft[day] ?? ""}
                          onChange={(event) => handleSubjectDraftChange(day, event.target.value)}
                          className="min-w-[160px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#013300]"
                          disabled={subjectMutating || subjectScheduleLoading}
                        >
                          <option value="">Select subject</option>
                          {subjectOptions.map((subject) => (
                            <option key={subject} value={subject}>
                              {subject}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {subjectMutationError && <p className="text-sm text-red-600">{subjectMutationError}</p>}
                {subjectScheduleError && <p className="text-sm text-amber-600">{subjectScheduleError}</p>}
                {subjectScheduleEmpty && !subjectScheduleLoading && !subjectScheduleError && (
                  <p className="text-sm text-gray-500">Weekly schedule is not set yet.</p>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-sm font-semibold text-gray-900">School Year</div>
                  <input
                    value={remedialDraft.schoolYear}
                    onChange={(event) => {
                      setRemedialDraft((prev) => ({ ...prev, schoolYear: event.target.value }));
                      setRemedialDraftError(null);
                    }}
                    placeholder="2025-2026"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#013300]"
                    disabled={isMutating}
                  />
                  <p className="text-xs text-gray-500">Format: YYYY-YYYY (ex. 2025-2026).</p>
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-900">Quarter Month Ranges</div>
                    <DangerButton
                      type="button"
                      small
                      className={`px-3 ${!remedialPeriod ? "opacity-60" : ""}`}
                      onClick={openCancelModal}
                      disabled={isMutating || !remedialPeriod}
                    >
                      Reset
                    </DangerButton>
                  </div>
                  <div className="space-y-3">
                    {QUARTER_OPTIONS.map((quarter) => (
                      <div key={quarter} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                        <div className="text-sm font-semibold text-gray-900">{quarter}</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Start Month</label>
                            <select
                              value={remedialDraft.quarters[quarter]?.startMonth ?? ""}
                              onChange={(event) =>
                                handleRemedialDraftChange(
                                  quarter,
                                  "startMonth",
                                  event.target.value ? Number(event.target.value) : null,
                                )
                              }
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#013300]"
                              disabled={isMutating}
                            >
                              <option value="">Select start month</option>
                              {MONTH_OPTIONS.map(({ label, value }) => (
                                <option key={`${quarter}-start-${label}`} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">End Month</label>
                            <select
                              value={remedialDraft.quarters[quarter]?.endMonth ?? ""}
                              onChange={(event) =>
                                handleRemedialDraftChange(
                                  quarter,
                                  "endMonth",
                                  event.target.value ? Number(event.target.value) : null,
                                )
                              }
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#013300]"
                              disabled={isMutating}
                            >
                              <option value="">Select end month</option>
                              {MONTH_OPTIONS.map(({ label, value }) => (
                                <option key={`${quarter}-end-${label}`} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {remedialDraftError && <p className="text-sm text-red-600">{remedialDraftError}</p>}
                {scheduleError && <p className="text-sm text-amber-600">{scheduleError}</p>}
              </div>
            )}
          </div>

          <div className="mt-auto border-t border-gray-200 px-6 py-4">
            <div className="flex gap-3">
              <SecondaryButton type="button" onClick={handleSettingsCancel} className="flex-1">
                Cancel
              </SecondaryButton>
              <PrimaryButton
                type="button"
                onClick={handleSettingsSave}
                className="flex-1"
                disabled={activeSettingsTab === "weekly" ? subjectMutating : isMutating}
              >
                {(activeSettingsTab === "weekly" ? subjectMutating : isMutating) ? "Saving..." : "Save Changes"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </aside>

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


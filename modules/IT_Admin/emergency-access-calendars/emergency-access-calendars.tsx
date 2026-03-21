"use client";
import Link from "next/link";
import Sidebar from "@/components/IT_Admin/Sidebar";
import Header from "@/components/IT_Admin/Header";
import { useCallback, useEffect, useMemo, useState } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import BaseModal, { ModalInfoItem, ModalSection } from "@/components/Common/Modals/BaseModal";
import ToastActivity from "@/components/ToastActivity";
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
  subject?: string | null;
  gradeLevel?: string | null;
  day?: string | null;
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

const API_ENDPOINT = "/api/it_admin/emergency-access/remedial-schedule";
const SUBJECT_SCHEDULE_ENDPOINT = "/api/it_admin/emergency-access/weekly-subject-schedule";
const ACTIVITIES_ENDPOINT = "/api/it_admin/emergency-access/calendar";
const ACTIVITIES_DELETE_ENDPOINT = "/api/it_admin/emergency-access/calendar-activities";
const NEW_ACADEMIC_YEAR_ENDPOINT = "/api/it_admin/emergency-access/calendar/new-academic-year";
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
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
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

const getPrintSubjectTone = (subject: string | null | undefined) => {
  const value = subject?.toLowerCase() ?? "";
  if (value.includes("english")) return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (value.includes("filipino")) return "border-blue-300 bg-blue-50 text-blue-900";
  if (value.includes("math")) return "border-rose-300 bg-rose-50 text-rose-900";
  if (value.includes("assessment")) return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-gray-300 bg-gray-50 text-gray-900";
};

const resolveActivitySubject = (title: string | null | undefined, fallback: string | null | undefined) => {
  const text = `${title ?? ""}`.toLowerCase();
  if (text.includes("english")) return "english";
  if (text.includes("filipino")) return "filipino";
  if (text.includes("math")) return "math";
  if (text.includes("assessment")) return "assessment";
  return fallback ?? null;
};

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
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

const buildMonthMatrix = (year: number, month: number): Array<Array<Date | null>> => {
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
  const [scheduleOverviewCollapsed, setScheduleOverviewCollapsed] = useState(false);
  const [remedialPeriod, setRemedialPeriod] = useState<RemedialPeriod | null>(null);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>(resolveDefaultSchoolYear());
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
  const [showNewAcademicYearModal, setShowNewAcademicYearModal] = useState(false);
  const [newAcademicYearConfirmText, setNewAcademicYearConfirmText] = useState("");
  const [newAcademicYearError, setNewAcademicYearError] = useState<string | null>(null);
  const [newAcademicYearSubmitting, setNewAcademicYearSubmitting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{
    title: string;
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [emergencyLocked, setEmergencyLocked] = useState(true);
  const [emergencyReason, setEmergencyReason] = useState<string | null>(null);
  const [emergencyActivatedAt, setEmergencyActivatedAt] = useState<string | null>(null);
  const [emergencyExpiresAt, setEmergencyExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadEmergencyState = async () => {
      try {
        const response = await fetch("/api/it_admin/emergency-access/current", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as {
          emergency_access?: {
            active?: boolean;
            reason?: string | null;
            activated_at?: string | null;
            expires_at?: string | null;
          };
        } | null;

        if (!active) return;
        const emergency = payload?.emergency_access;
        setEmergencyLocked(!Boolean(emergency?.active));
        setEmergencyReason(emergency?.reason ?? null);
        setEmergencyActivatedAt(emergency?.activated_at ?? null);
        setEmergencyExpiresAt(emergency?.expires_at ?? null);
      } catch {
        if (!active) return;
        setEmergencyLocked(true);
      }
    };
    void loadEmergencyState();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!feedbackToast) return;
    const timerId = window.setTimeout(() => {
      setFeedbackToast(null);
    }, 3500);
    return () => window.clearTimeout(timerId);
  }, [feedbackToast]);

  const loadSubjectSchedule = useCallback(async () => {
    if (emergencyLocked) {
      setSubjectSchedule(buildEmptySubjectSchedule());
      setSubjectScheduleLoading(false);
      setSubjectScheduleEmpty(true);
      return;
    }

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
      const message = "Unable to load the weekly subject schedule. Please refresh or try again later.";
      setSubjectScheduleError(message);
      setFeedbackToast({
        title: "Load Failed",
        message,
        tone: "error",
      });
    } finally {
      setSubjectScheduleLoading(false);
    }
  }, [emergencyLocked, selectedGrade]);

  const loadRemedialSchedule = useCallback(async () => {
    if (emergencyLocked) {
      setRemedialPeriod(null);
      setScheduleLoading(false);
      return;
    }

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
      const message = "Unable to load the remedial schedule. Showing the last saved version.";
      setScheduleError(message);
      setFeedbackToast({
        title: "Load Failed",
        message,
        tone: "error",
      });
    } finally {
      setScheduleLoading(false);
    }
  }, [emergencyLocked, selectedSchoolYear]);

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
    if (emergencyLocked) {
      setActivities([]);
      return;
    }

    try {
      const gradeLabel = `Grade ${selectedGrade}`;
      const response = await fetch(`${ACTIVITIES_ENDPOINT}?grade=${encodeURIComponent(gradeLabel)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        activities?: Array<{
          id: string;
          title: string | null;
          submittedBy?: string | null;
          subject?: string | null;
          gradeLevel?: string | null;
          day?: string | null;
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
            subject: item.subject ?? null,
            gradeLevel: item.gradeLevel ?? null,
            day: item.day ?? null,
          };
          return activity;
        })
        .filter((item): item is Activity => item !== null);

      setActivities(mapped);
    } catch (error) {
      console.warn("Failed to load approved activities", error);
      setActivities([]);
    }
  }, [emergencyLocked, selectedGrade]);

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
    return buildMonthMatrix(year, month);
  }, [month, year]);

  const activitiesByDate = useMemo(() => {
    const grouped = new Map<string, Activity[]>();
    for (const activity of activities) {
      const key = toDateKey(activity.date);
      const existing = grouped.get(key);
      if (existing) {
        existing.push(activity);
      } else {
        grouped.set(key, [activity]);
      }
    }
    for (const [, items] of grouped) {
      items.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    return grouped;
  }, [activities]);

  const printableMonths = useMemo(() => {
    const schedule = remedialPeriod;
    if (!schedule?.quarters) {
      return [
        {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          key: `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`,
        },
      ];
    }

    const schoolYear = schedule.schoolYear || selectedSchoolYear;
    const parsedYear = parseSchoolYear(schoolYear);
    if (!parsedYear) {
      return [
        {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          key: `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`,
        },
      ];
    }

    const allMonths: Array<{ month: number; year: number; key: string }> = [];
    const quarterRanges = Object.values(schedule.quarters);

    quarterRanges.forEach((range) => {
      if (!range?.startMonth || !range?.endMonth) return;
      for (let monthValue = range.startMonth; monthValue <= range.endMonth; monthValue += 1) {
        const resolvedYear = monthValue >= 6 ? parsedYear.startYear : parsedYear.endYear;
        allMonths.push({
          month: monthValue,
          year: resolvedYear,
          key: `${resolvedYear}-${monthValue}`,
        });
      }
    });

    const deduped = Array.from(new Map(allMonths.map((item) => [item.key, item])).values());
    deduped.sort((a, b) => new Date(a.year, a.month - 1, 1).getTime() - new Date(b.year, b.month - 1, 1).getTime());
    return deduped;
  }, [currentDate, remedialPeriod, selectedSchoolYear]);

  const remedialPeriodSummaryLabel = useMemo(() => {
    if (!remedialPeriod?.quarters) {
      return "--";
    }

    return QUARTER_OPTIONS.map((quarter) => {
      const range = remedialPeriod.quarters[quarter];
      return `${quarter}: ${formatMonthRangeShort(range)}`;
    }).join(" | ");
  }, [remedialPeriod]);

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

    const cellActivities = activitiesByDate.get(toDateKey(cellDate)) ?? [];

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
                      <div className="min-w-18 text-center">
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

  const currentPeriodLabel =
    view === "month"
      ? currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : view === "week"
      ? `Week of ${currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : "Activities by Week";

  const handlePrint = () => {
    setGradeMenuOpen(false);
    setSettingsOpen(false);
    setScheduleOverviewCollapsed(false);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
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
      setFeedbackToast({
        title: "Schedule Saved",
        message: "Weekly subject schedule was updated successfully.",
        tone: "success",
      });
    } catch (error) {
      console.error("Failed to update subject schedule", error);
      const message = "Unable to update the subject schedule. Please try again.";
      setSubjectMutationError(message);
      setFeedbackToast({
        title: "Save Failed",
        message,
        tone: "error",
      });
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
      setFeedbackToast({
        title: "Schedule Reset",
        message: "Weekly subject schedule was reset successfully.",
        tone: "success",
      });
    } catch (error) {
      console.error("Failed to reset subject schedule", error);
      const message = "Unable to reset the subject schedule. Please try again.";
      setSubjectMutationError(message);
      setFeedbackToast({
        title: "Reset Failed",
        message,
        tone: "error",
      });
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
      setFeedbackToast({
        title: "Period Saved",
        message: "Remedial period settings were saved successfully.",
        tone: "success",
      });
    } catch (error) {
      console.error("Failed to save remedial schedule", error);
      const message = error instanceof Error ? error.message : "Unable to save the remedial schedule. Please try again.";
      setScheduleError(message);
      setFeedbackToast({
        title: "Save Failed",
        message,
        tone: "error",
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleOpenNewAcademicYearModal = () => {
    setNewAcademicYearConfirmText("");
    setNewAcademicYearError(null);
    setShowNewAcademicYearModal(true);
  };

  const handleCloseNewAcademicYearModal = () => {
    if (newAcademicYearSubmitting) return;
    setShowNewAcademicYearModal(false);
    setNewAcademicYearConfirmText("");
    setNewAcademicYearError(null);
  };

  const handleStartNewAcademicYear = async () => {
    if (newAcademicYearSubmitting) return;
    if (newAcademicYearConfirmText.trim() !== "CONFIRM") {
      setNewAcademicYearError('Type "CONFIRM" to proceed.');
      return;
    }

    setNewAcademicYearSubmitting(true);
    setNewAcademicYearError(null);
    try {
      const response = await fetch(NEW_ACADEMIC_YEAR_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmText: newAcademicYearConfirmText.trim(),
          schoolYear: selectedSchoolYear,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string | null;
      } | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
      }

      setShowNewAcademicYearModal(false);
      setNewAcademicYearConfirmText("");
      setRemedialPeriod(null);
      setActivities([]);
      setSubjectSchedule(buildEmptySubjectSchedule());
      setSubjectScheduleEmpty(true);
      setScheduleError(null);
      setSubjectScheduleError(null);

      await Promise.all([loadRemedialSchedule(), loadSubjectSchedule(), loadApprovedActivities()]);
      setFeedbackToast({
        title: "Academic Year Started",
        message: "The current remedial setup was archived and a new academic year has started.",
        tone: "success",
      });
    } catch (error) {
      console.error("Failed to start new academic year", error);
      const message = error instanceof Error ? error.message : "Unable to archive the current remedial setup.";
      setNewAcademicYearError(message);
      setFeedbackToast({
        title: "Action Failed",
        message,
        tone: "error",
      });
    } finally {
      setNewAcademicYearSubmitting(false);
    }
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
      setFeedbackToast({
        title: "Activity Deleted",
        message: "The activity was removed successfully.",
        tone: "success",
      });
    } catch (error) {
      console.error("Failed to remove activity", error);
      const message = "Unable to remove the activity. Please try again.";
      setActivityRemoveError(message);
      setFeedbackToast({
        title: "Delete Failed",
        message,
        tone: "error",
      });
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
    <div className="principal-calendar-page relative flex h-screen overflow-hidden bg-[#f2f7f4]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-[-10%] h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] h-96 w-96 rounded-full bg-emerald-100/50 blur-3xl" />
        <div className="absolute top-16 left-1/2 h-40 w-96 -translate-x-1/2 rounded-full bg-white/70 blur-2xl" />
      </div>
      <div className="print-hidden">
        <Sidebar />
      </div>
      <div className="principal-calendar-content relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <div className="print-hidden">
          <Header title="Emergency Calendar Access" />
        </div>
        <main className="principal-calendar-main flex-1 overflow-y-auto">
          <div className="principal-calendar-scroll relative p-4 h-full sm:p-5 md:p-6">
            {!emergencyLocked ? (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 print-hidden">
                <p className="text-sm font-semibold text-amber-900">Emergency Access Active</p>
                <p className="mt-1 text-sm text-amber-900">Reason: {emergencyReason ?? "--"}</p>
                <p className="mt-1 text-sm text-amber-900">Activated: {emergencyActivatedAt ?? "--"}</p>
                <p className="mt-1 text-sm text-amber-900">Expires: {emergencyExpiresAt ?? "--"}</p>
              </div>
            ) : null}
            <div className="relative h-full min-h-100">
              {emergencyLocked && (
                <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/18 p-4 backdrop-blur-[2px] print-hidden">
                  <div className="w-full max-w-md rounded-[28px] border border-[#013300]/12 bg-white/95 p-6 text-center shadow-[0_28px_60px_-28px_rgba(1,51,0,0.26)]">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#013300]/8 text-[#013300]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 2 5 5v6c0 5 3.4 9.4 7 11 3.6-1.6 7-6 7-11V5l-7-3Z" />
                        <path d="M9.5 12.5 11 14l3.5-3.5" />
                      </svg>
                    </div>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#013300]/70">
                      Access Required
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-[#013300]">Emergency Access is inactive</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Activate Emergency Access first to enable Calendar actions.
                    </p>
                    <Link
                      href="/IT_Admin/emergency-access"
                      className="mt-5 inline-flex rounded-xl bg-[#013300] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#024d00]"
                    >
                      Activate Emergency Access
                    </Link>
                  </div>
                </div>
              )}
              <div className="principal-calendar-surface relative z-10 h-full overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-5 md:p-6">

              {/* Calendar Toolbar */}
              <div className="principal-calendar-toolbar print-hidden flex flex-col gap-3 mb-3">
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
                    <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">{currentPeriodLabel}</h2>
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
                        aria-label="Grade Levels"
                        title="Grade Levels"
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
                      onClick={handlePrint}
                      className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white p-2 text-gray-700 transition hover:bg-gray-100"
                      aria-label="Print calendar"
                      title="Print"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9V2h12v7" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" rx="1" />
                        <circle cx="18" cy="12" r="1" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white p-2 text-gray-700 transition hover:bg-gray-100"
                      aria-label="Remedial Schedule Settings"
                      title="Remedial Schedule Settings"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09c0 .65.39 1.24 1 1.51.61.26 1.32.14 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.47.47-.59 1.2-.33 1.82.26.61.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.65 0-1.24.39-1.51 1Z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <section className="printable-calendar-section">
                <div className="print-only mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Grade {selectedGrade} Calendar</h2>
                  <p className="text-sm text-gray-700">{currentPeriodLabel}</p>
                </div>

              {/* Grade Filter + Schedule Overview */}
              <div className="mb-4 rounded-2xl border border-white/80 bg-white/80 px-4 py-2 shadow-sm print-avoid-break">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-gray-900">Schedule Overview</h3>
                    {(subjectScheduleLoading || scheduleLoading) && (
                      <span className="text-xs text-gray-400">Loading...</span>
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setScheduleOverviewCollapsed((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      aria-expanded={!scheduleOverviewCollapsed}
                      aria-controls="principal-schedule-overview"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={scheduleOverviewCollapsed ? "" : "rotate-180 transition"}
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                </div>

                {!scheduleOverviewCollapsed && (
                  <div id="principal-schedule-overview">
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
                )}
              </div>

              <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
                <div className="min-w-0 flex-1">
                  {/* Calendar View */}
                  <div className="printable-calendar-grid rounded-2xl border border-gray-100 bg-white/90 shadow-sm print-avoid-break">
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
              </section>
            </div>
          </div>
          </div>
        </main>
      </div>

      <div className="print-calendar-document print-only">
        {printableMonths.map((item, monthIndex) => {
          const monthDate = new Date(item.year, item.month - 1, 1);
          const matrix = buildMonthMatrix(item.year, item.month - 1);

          return (
            <section className="print-month-page" key={item.key}>
              <header className="print-month-header">
                <h1 className="text-xl font-bold text-gray-900">Grade {selectedGrade} Calendar</h1>
                <p className="text-sm text-gray-700">
                  {monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              </header>

              <div className="print-month-overview rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs">
                <div className="grid grid-cols-3 gap-2 font-semibold text-emerald-900">
                  <div>Remedial Time</div>
                  <div>Remedial Subjects</div>
                  <div>Remedial Period</div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-gray-700">
                  <div>{weeklyTimeLabel}</div>
                  <div>
                    {SUBJECT_WEEKDAYS.map((day) => `${SUBJECT_DAY_LABELS[day]}:${subjectSchedule[day] || "--"}`).join(" | ")}
                  </div>
                  <div>{remedialPeriodSummaryLabel}</div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-700">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">Legend</span>
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

              <div className="mt-3 rounded-lg border border-gray-300 bg-white">
                <div className="grid grid-cols-7 bg-gray-100 text-xs font-semibold text-gray-700">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                    <div key={`print-${item.key}-${day}-${index}`} className="border-r border-gray-200 px-2 py-1 text-center last:border-r-0">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-gray-200">
                  {matrix.map((week, weekIndex) => (
                    <div key={`print-week-${item.key}-${weekIndex}`} className="grid grid-cols-7">
                      {week.map((cellDate, dayIndex) => {
                        if (!cellDate) {
                          return (
                            <div
                              key={`print-day-${item.key}-${weekIndex}-${dayIndex}`}
                              className="h-20 border-r border-gray-200 bg-gray-50 last:border-r-0"
                            />
                          );
                        }

                        const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
                        const withinPeriod = isWithinPeriod(cellDate) && !isWeekend;
                        const weekdayLabel = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][cellDate.getDay()] ?? "";
                        const subjectForDay = SUBJECT_WEEKDAYS.includes(weekdayLabel as (typeof SUBJECT_WEEKDAYS)[number])
                          ? subjectSchedule[weekdayLabel as (typeof SUBJECT_WEEKDAYS)[number]]
                          : "";
                        const subjectColor = withinPeriod ? getSubjectColor(subjectForDay) : "border-gray-100";
                        const cellActivities = activitiesByDate.get(toDateKey(cellDate)) ?? [];

                        return (
                          <div
                            key={`print-day-${item.key}-${weekIndex}-${dayIndex}`}
                            className={`h-23 border-r border-gray-200 px-1.5 py-1 align-top last:border-r-0 ${subjectColor}`}
                          >
                            <div className="text-right text-[11px] font-semibold leading-none text-gray-800">{cellDate.getDate()}</div>
                            <div className="mt-1 space-y-0.5 overflow-visible">
                              {cellActivities.map((activity) => {
                                const activitySubject = resolveActivitySubject(activity.title, activity.subject ?? subjectForDay);
                                return (
                                  <div
                                    key={`print-activity-${item.key}-${activity.id}`}
                                    className={`rounded border px-1 py-px text-[9px] font-semibold leading-[1.2] wrap-break-word whitespace-normal ${getPrintSubjectTone(activitySubject)}`}
                                    title={activity.title}
                                  >
                                    {activity.title}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-2 text-right text-[11px] text-gray-500">
                {monthIndex + 1} / {printableMonths.length}
              </div>
            </section>
          );
        })}
      </div>

      <aside
        className={`print-hidden fixed inset-0 z-2000 transition-opacity duration-300 ${
          settingsOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!settingsOpen}
      >
        <div className="absolute inset-0 bg-black/30" onClick={() => setSettingsOpen(false)} />
        <div
          role="dialog"
          aria-modal="true"
          className={`absolute right-0 top-0 flex h-full w-full max-w-105 transform flex-col border-l border-gray-200 bg-white transition-transform duration-300 ${
            settingsOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-start justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Remedial Schedule Settings</h3>
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
                          className="min-w-40 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#013300]"
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
                  <div className="text-sm font-semibold text-gray-900">Quarter Month Ranges</div>
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

                <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="text-sm font-semibold text-red-800">Danger Zone</div>
                  <div className="space-y-2 text-xs text-red-700 text-justify">
                    <p>
                      This action archives the current remedial calendar setup including:
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>schedules</li>
                      <li>activities</li>
                      <li>approved records</li>
                      <li>materials</li>
                    </ul>
                    <p>
                      Archived records remain stored for history but will no longer appear in the active calendar.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <DangerButton
                      type="button"
                      small
                      className="px-3"
                      onClick={handleOpenNewAcademicYearModal}
                      disabled={newAcademicYearSubmitting || isMutating}
                    >
                      Start New Academic Year
                    </DangerButton>
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

      <div className="print-hidden">
        <BaseModal
          show={showNewAcademicYearModal}
          onClose={handleCloseNewAcademicYearModal}
          title="Start New Academic Year?"
          maxWidth="lg"
          footer={(
            <>
              <SecondaryButton type="button" onClick={handleCloseNewAcademicYearModal} disabled={newAcademicYearSubmitting}>
                Cancel
              </SecondaryButton>
              <DangerButton
                type="button"
                onClick={handleStartNewAcademicYear}
                disabled={newAcademicYearSubmitting || newAcademicYearConfirmText.trim() !== "CONFIRM"}
              >
                {newAcademicYearSubmitting ? "Archiving..." : "Start New Academic Year"}
              </DangerButton>
            </>
          )}
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              This will archive the current remedial calendar setup including schedules, activities, and materials. Archived data will remain stored but will not appear in the active calendar.
            </p>
            <div className="space-y-1">
              <label htmlFor="confirm-new-year" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Type CONFIRM to continue
              </label>
              <input
                id="confirm-new-year"
                value={newAcademicYearConfirmText}
                onChange={(event) => setNewAcademicYearConfirmText(event.target.value)}
                placeholder="CONFIRM"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#013300]"
                disabled={newAcademicYearSubmitting}
              />
            </div>
            {newAcademicYearError && (
              <p className="text-sm text-red-600">{newAcademicYearError}</p>
            )}
          </div>
        </BaseModal>
      </div>
      <div className="print-hidden">
        <BaseModal
          show={showActivityModal}
          onClose={handleCloseActivityModal}
          title="Activity Details"
          maxWidth="lg"
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
          <ModalSection title="Grade and Subject">
            <div className="grid gap-4 sm:grid-cols-2">
              <ModalInfoItem label="Subject" value={selectedActivity?.subject ?? selectedActivity?.title ?? "-"} />
              <ModalInfoItem label="Grade Level" value={selectedActivity?.gradeLevel ?? `Grade ${selectedGrade}`} />
            </div>
          </ModalSection>

          <ModalSection title="Date and Time">
            <div className="grid gap-4 sm:grid-cols-2">
              <ModalInfoItem
                label="Date"
                value={
                  selectedActivity
                    ? selectedActivity.date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "-"
                }
              />
              <ModalInfoItem
                label="Day"
                value={selectedActivity?.day ?? selectedActivity?.date.toLocaleDateString("en-US", { weekday: "long" }) ?? "-"}
              />
              <ModalInfoItem
                label="Time"
                value={
                  selectedActivity
                    ? subjectScheduleConfigured
                      ? weeklyTimeLabel
                      : `${selectedActivity.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${selectedActivity.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : "-"
                }
              />
            </div>
          </ModalSection>
        </BaseModal>
      </div>

      <style jsx global>{`
        .print-only {
          display: none;
        }

        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }

          body {
            background: #ffffff !important;
            opacity: 1 !important;
            visibility: visible !important;
            transform: none !important;
            filter: none !important;
            backdrop-filter: none !important;
          }

          html,
          #__next {
            background: #ffffff !important;
            opacity: 1 !important;
            visibility: visible !important;
            transform: none !important;
            filter: none !important;
            backdrop-filter: none !important;
          }

          .print-hidden {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .principal-calendar-content {
            display: none !important;
          }

          .print-calendar-document {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            opacity: 1 !important;
            visibility: visible !important;
            transform: none !important;
          }

          .principal-calendar-page > :not(.print-calendar-document) {
            display: none !important;
          }

          .print-month-page {
            break-inside: avoid;
            page-break-inside: avoid;
            page-break-after: always;
            width: 100%;
            min-height: 0;
            padding: 0;
          }

          .print-month-page:last-child {
            page-break-after: auto;
          }

          .print-month-header {
            margin-bottom: 8px;
          }

          .print-month-overview {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .principal-calendar-page,
          .principal-calendar-content,
          .principal-calendar-main,
          .principal-calendar-scroll,
          .principal-calendar-surface,
          .printable-calendar-section,
          .printable-calendar-grid {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            opacity: 1 !important;
            visibility: visible !important;
            transform: none !important;
            filter: none !important;
            backdrop-filter: none !important;
          }

          .principal-calendar-surface {
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          .print-calendar-document,
          .print-calendar-document * {
            position: static !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            transform: none !important;
            opacity: 1 !important;
            visibility: visible !important;
            overflow: visible !important;
          }

          .print-calendar-document .sticky,
          .print-calendar-document [style*="position: sticky"],
          .print-calendar-document [style*="position:fixed"],
          .print-calendar-document [style*="position: fixed"] {
            position: static !important;
          }

          .print-calendar-document,
          .print-calendar-document * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .printable-calendar-grid * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {feedbackToast && (
        <ToastActivity
          title={feedbackToast.title}
          message={feedbackToast.message}
          tone={feedbackToast.tone}
          onClose={() => setFeedbackToast(null)}
        />
      )}
    </div>
  );
}


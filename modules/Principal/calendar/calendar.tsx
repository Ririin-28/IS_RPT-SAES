"use client";
import Sidebar from "@/components/Principal/Sidebar";
import Header from "@/components/Principal/Header";
import { useCallback, useEffect, useMemo, useState } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import RemedialPeriodModal, {
  type QuarterMonths,
  type QuarterOption,
  type RemedialPeriodFormValues,
} from "./Modals/RemedialPeriodModal";
import SubjectScheduleModal, {
  SUBJECT_WEEKDAYS,
  type SubjectScheduleFormValues,
} from "./Modals/SubjectScheduleModal";

interface Activity {
  id: number;
  title: string;
  description?: string;
  date: Date;
  end: Date;
  type: string;
}

interface RemedialPeriod {
  quarter: "1st Quarter" | "2nd Quarter";
  startDate: string;
  endDate: string;
}

interface ScheduleResponsePayload {
  quarter: string | null;
  startDate: string | null;
  endDate: string | null;
  months?: QuarterMonths | null;
}

interface ScheduleResponse {
  success: boolean;
  schedule: ScheduleResponsePayload | null;
}

const STORAGE_KEY = "principalRemedialPeriod";
const API_ENDPOINT = "/api/master_teacher/coordinator/remedial-schedule";
const MONTHS_STORAGE_KEY = "principalRemedialQuarterMonths";
const SUBJECT_SCHEDULE_ENDPOINT = "/api/principal/subject-schedule";

const resolveQuarterValue = (value: string | null | undefined): RemedialPeriod["quarter"] =>
  value === "2nd Quarter" ? "2nd Quarter" : "1st Quarter";

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

const uniqueSortedMonths = (values: number[]) =>
  Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 11)
    )
  ).sort((a, b) => a - b);

const normalizeQuarterMonths = (input: Partial<QuarterMonths> | null | undefined): QuarterMonths => ({
  "1st Quarter": uniqueSortedMonths(input?.["1st Quarter"] ?? []),
  "2nd Quarter": uniqueSortedMonths(input?.["2nd Quarter"] ?? []),
});

const deriveMonthsFromRange = (start: string, end: string) => {
  const startDate = parseDateString(start);
  const endDate = parseDateString(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }

  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  cursor.setHours(0, 0, 0, 0);
  const months: number[] = [];

  while (cursor <= endDate) {
    months.push(cursor.getMonth());
    cursor.setMonth(cursor.getMonth() + 1);
    cursor.setDate(1);
  }

  return uniqueSortedMonths(months);
};

const formatMonthList = (months: number[]) => {
  if (!months.length) return "No months selected";
  const formatted = months
    .map((month) => MONTH_LABELS[month] ?? "")
    .filter((label) => label.length > 0)
    .join(", ");
  return formatted || "No months selected";
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

const DEFAULT_SUBJECT_OPTIONS = [
  "English",
  "Filipino",
  "Math",
  "Science",
  "Araling Panlipunan",
  "MAPEH",
  "Values Education",
  "Assessment",
] as const;

const buildEmptySubjectSchedule = (): SubjectScheduleFormValues =>
  SUBJECT_WEEKDAYS.reduce<SubjectScheduleFormValues>((acc, day) => {
    acc[day] = "";
    return acc;
  }, {} as SubjectScheduleFormValues);

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
  SUBJECT_WEEKDAYS.some((day) => Boolean(schedule[day]?.trim().length));

const parseDateString = (value: string) => {
  if (!value) return new Date(NaN);
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(NaN);
};

const formatRangeLabel = (start: string, end: string) => {
  const startDate = parseDateString(start);
  const endDate = parseDateString(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "--";
  }

  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const startLabel = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const endLabel = endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
};

const formatFullDate = (value: string) => {
  const date = parseDateString(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const getPeriodStatus = (period: RemedialPeriod | null) => {
  if (!period) return null;
  const today = new Date();
  const start = parseDateString(period.startDate);
  const end = parseDateString(period.endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (today < start) {
    return { 
      label: "Upcoming", 
      tone: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-400"
    } as const;
  }
  if (today > end) {
    return { 
      label: "Completed", 
      tone: "bg-gray-100 text-gray-600 border-gray-300",
      dot: "bg-gray-400"
    } as const;
  }
  return { 
    label: "Active", 
    tone: "bg-green-50 text-[#013300] border-green-200",
    dot: "bg-green-500"
  } as const;
};

export default function PrincipalCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities] = useState<Activity[]>([]);
  const [remedialPeriod, setRemedialPeriod] = useState<RemedialPeriod | null>(null);
  const [quarterMonths, setQuarterMonths] = useState<QuarterMonths>(() => normalizeQuarterMonths(null));
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [subjectSchedule, setSubjectSchedule] = useState<SubjectScheduleFormValues>(() => buildEmptySubjectSchedule());
  const [subjectScheduleLoading, setSubjectScheduleLoading] = useState(true);
  const [subjectScheduleError, setSubjectScheduleError] = useState<string | null>(null);
  const [subjectOptions, setSubjectOptions] = useState<string[]>(() => dedupeSubjects(DEFAULT_SUBJECT_OPTIONS));
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectMutating, setSubjectMutating] = useState(false);
  const [subjectMutationError, setSubjectMutationError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let initialMonths = normalizeQuarterMonths(null);

    const storedMonths = window.localStorage.getItem(MONTHS_STORAGE_KEY);
    if (storedMonths) {
      try {
        initialMonths = normalizeQuarterMonths(JSON.parse(storedMonths) as Partial<QuarterMonths>);
      } catch (error) {
        console.error("Failed to parse remedial month selections from storage", error);
      }
    }

    const storedPeriod = window.localStorage.getItem(STORAGE_KEY);
    if (storedPeriod) {
      try {
        const parsed = JSON.parse(storedPeriod) as (RemedialPeriod & { months?: Partial<QuarterMonths> }) | null;
        if (parsed?.quarter && parsed?.startDate && parsed?.endDate) {
          const resolvedQuarter = resolveQuarterValue(parsed.quarter);
          setRemedialPeriod({
            quarter: resolvedQuarter,
            startDate: parsed.startDate,
            endDate: parsed.endDate,
          });

          const parsedMonths = parsed.months ? normalizeQuarterMonths(parsed.months) : initialMonths;
          const derivedActiveMonths =
            parsedMonths[resolvedQuarter].length > 0
              ? parsedMonths[resolvedQuarter]
              : deriveMonthsFromRange(parsed.startDate, parsed.endDate);

          initialMonths = normalizeQuarterMonths({
            ...parsedMonths,
            [resolvedQuarter]: derivedActiveMonths,
          });
        }
      } catch (error) {
        console.error("Failed to parse remedial period from storage", error);
      }
    }

    setQuarterMonths(initialMonths);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!remedialPeriod) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...remedialPeriod, months: quarterMonths })
    );
  }, [remedialPeriod, quarterMonths]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isEmpty =
      (quarterMonths["1st Quarter"]?.length ?? 0) === 0 &&
      (quarterMonths["2nd Quarter"]?.length ?? 0) === 0;
    if (isEmpty) {
      window.localStorage.removeItem(MONTHS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(MONTHS_STORAGE_KEY, JSON.stringify(quarterMonths));
    }
  }, [quarterMonths]);

  const loadSubjectSchedule = useCallback(async () => {
    setSubjectScheduleLoading(true);
    setSubjectScheduleError(null);
    try {
      const response = await fetch(SUBJECT_SCHEDULE_ENDPOINT, { cache: "no-store" });
      if (!response.ok) {
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
      const schedule = normalizeSubjectSchedule(payload.schedule ?? null);
      setSubjectSchedule(schedule);
      const optionSeeds = Array.isArray(payload.options?.subjects) ? payload.options?.subjects : [];
      setSubjectOptions(dedupeSubjects([...DEFAULT_SUBJECT_OPTIONS, ...optionSeeds]));
    } catch (error) {
      console.error("Failed to load subject schedule", error);
      setSubjectScheduleError("Unable to load the subject schedule. Showing the last saved version.");
    } finally {
      setSubjectScheduleLoading(false);
    }
  }, []);

  const loadRemedialSchedule = useCallback(async () => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const response = await fetch(API_ENDPOINT, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = (await response.json()) as ScheduleResponse;
      if (!data.success) {
        throw new Error("Server responded with an error");
      }
      const schedule = data.schedule;
      if (schedule?.startDate && schedule?.endDate) {
        const resolvedQuarter = resolveQuarterValue(schedule.quarter);
        const startDate = schedule.startDate;
        const endDate = schedule.endDate;
        const nextMonths = schedule.months
          ? normalizeQuarterMonths(schedule.months)
          : normalizeQuarterMonths({
              [resolvedQuarter]: deriveMonthsFromRange(startDate, endDate),
            });
        setRemedialPeriod({
          quarter: resolvedQuarter,
          startDate,
          endDate,
        });
        setQuarterMonths(nextMonths);
      } else {
        setRemedialPeriod(null);
        setQuarterMonths(schedule?.months ? normalizeQuarterMonths(schedule.months) : normalizeQuarterMonths(null));
      }
    } catch (error) {
      console.error("Failed to load remedial schedule", error);
      setScheduleError("Unable to load the remedial schedule. Showing the last saved version.");
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRemedialSchedule();
  }, [loadRemedialSchedule]);

  useEffect(() => {
    loadSubjectSchedule();
  }, [loadSubjectSchedule]);

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
    if (!remedialPeriod) return false;
    const start = parseDateString(remedialPeriod.startDate);
    const end = parseDateString(remedialPeriod.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
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
    if (subjectMutating) {
      return;
    }
    const normalized = normalizeSubjectSchedule(values);
    setSubjectMutationError(null);
    setSubjectMutating(true);
    try {
      const response = await fetch(SUBJECT_SCHEDULE_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: normalized }),
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
      const schedule = normalizeSubjectSchedule(payload.schedule ?? normalized);
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

  const handleSavePeriod = async (values: RemedialPeriodFormValues) => {
    if (isMutating) return;
    setIsMutating(true);
    setScheduleError(null);
    const sanitizedMonths = normalizeQuarterMonths(values.months);
    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quarter: values.quarter,
          startDate: values.startDate,
          endDate: values.endDate,
          months: sanitizedMonths,
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
      if (!schedule?.startDate || !schedule?.endDate) {
        throw new Error("Incomplete schedule returned by the server");
      }
      const resolvedQuarter = resolveQuarterValue(schedule.quarter ?? values.quarter);
      setRemedialPeriod({
        quarter: resolvedQuarter,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
      });
      const nextMonths = schedule.months
        ? normalizeQuarterMonths(schedule.months)
        : normalizeQuarterMonths({
            ...sanitizedMonths,
            [resolvedQuarter]: deriveMonthsFromRange(schedule.startDate, schedule.endDate),
          });
      setQuarterMonths(nextMonths);
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
      const response = await fetch(API_ENDPOINT, { method: "DELETE" });
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
      if (schedule?.startDate && schedule?.endDate) {
        const resolvedQuarter = resolveQuarterValue(schedule.quarter);
        setRemedialPeriod({
          quarter: resolvedQuarter,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
        });
        setQuarterMonths(
          normalizeQuarterMonths(schedule.months ?? {
            [resolvedQuarter]: deriveMonthsFromRange(schedule.startDate, schedule.endDate),
          }),
        );
      } else {
        setRemedialPeriod(null);
        setQuarterMonths(normalizeQuarterMonths(null));
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(MONTHS_STORAGE_KEY);
        }
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

  const statusBadge = getPeriodStatus(remedialPeriod);

  const availableQuarterOptions = useMemo<QuarterOption[]>(() => {
    if (!remedialPeriod || remedialPeriod.quarter !== "1st Quarter") {
      return ["1st Quarter", "2nd Quarter"];
    }

    const endDate = parseDateString(remedialPeriod.endDate);
    if (Number.isNaN(endDate.getTime())) {
      return ["1st Quarter", "2nd Quarter"];
    }

    endDate.setHours(23, 59, 59, 999);
    if (endDate >= new Date()) {
      return ["1st Quarter"];
    }

    return ["1st Quarter", "2nd Quarter"];
  }, [remedialPeriod]);

  const modalInitialData = useMemo<RemedialPeriodFormValues>(() => ({
    quarter: remedialPeriod?.quarter ?? "",
    startDate: remedialPeriod?.startDate ?? "",
    endDate: remedialPeriod?.endDate ?? "",
    months: quarterMonths,
  }), [remedialPeriod, quarterMonths]);

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
                    {remedialPeriod && (
                      <DangerButton
                        type="button"
                        small
                        className="px-4"
                        onClick={openCancelModal}
                        disabled={isMutating}
                      >
                        Cancel Schedule
                      </DangerButton>
                    )}
                    <PrimaryButton
                      type="button"
                      small
                      className="px-4"
                      onClick={() => setShowPeriodModal(true)}
                      disabled={isMutating}
                    >
                      {remedialPeriod ? "Update Schedule" : "Set Schedule"}
                    </PrimaryButton>
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
                      {!subjectScheduleLoading && !subjectScheduleConfigured && !subjectScheduleError && (
                        <p className="text-sm text-gray-600 mt-1">
                          Configure the weekday subjects so teachers know the focus for each day.
                        </p>
                      )}
                    </div>
                    <PrimaryButton
                      type="button"
                      small
                      className="px-4"
                      onClick={handleOpenSubjectModal}
                      disabled={subjectMutating}
                    >
                      {subjectScheduleConfigured ? "Edit Subjects" : "Set Subjects"}
                    </PrimaryButton>
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
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                          <p className="text-sm text-gray-600">
                            {remedialPeriod.quarter} · {formatRangeLabel(remedialPeriod.startDate, remedialPeriod.endDate)}
                          </p>
                          {statusBadge && (
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge.tone}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dot}`} />
                              {statusBadge.label}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 mt-1">
                          Click Set Schedule to configure the remedial timeframe.
                        </p>
                      )}
                    </div>
                  </div>

                  {remedialPeriod && (
                    <div className="mt-3 text-sm text-gray-700 leading-relaxed">
                      <span className="font-semibold text-gray-900">Months Covered:</span> {formatMonthList(quarterMonths[remedialPeriod.quarter] ?? [])}
                    </div>
                  )}
                </div>
              </div>

              {/* Calendar View */}
              <div className="border rounded-lg overflow-hidden bg-white">
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
        availableQuarters={availableQuarterOptions}
      />
      <DeleteConfirmationModal
        isOpen={showCancelModal}
        onClose={handleCloseCancelModal}
        onConfirm={handleConfirmCancel}
        title="Cancel Remedial Schedule"
        message="Are you sure you want to cancel the current remedial schedule? This will remove the configured period for all principals."
      />
    </div>
  );
}
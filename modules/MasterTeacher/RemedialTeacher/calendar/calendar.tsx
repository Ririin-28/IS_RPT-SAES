"use client";
import Sidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import ActivityDetailModal from "./Modals/ActivityDetailModal";


interface Activity {
  id: number;
  title: string;
  day: string;
  roomNo: string;
  date: Date;
  end: Date;
  type: string;
  subject?: string | null;
  grade?: string | null;
}

type WeeklySubjectSchedule = {
  Monday?: string;
  Tuesday?: string;
  Wednesday?: string;
  Thursday?: string;
  Friday?: string;
  startTime?: string;
  endTime?: string;
};

type QuarterRange = {
  startMonth: number | null;
  endMonth: number | null;
};

type RemedialQuarterSchedule = {
  schoolYear: string;
  quarters: Record<string, QuarterRange>;
};

const SCHEDULE_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

const getSubjectIndicator = (subject: string | null | undefined): string | null => {
  if (!subject) {
    return null;
  }
  const normalized = subject.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("eng")) {
    return "E";
  }
  if (normalized.startsWith("fil")) {
    return "F";
  }
  if (normalized.startsWith("math") || normalized.includes("mathematics")) {
    return "M";
  }
  return null;
};

const formatGradeLabel = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().startsWith("grade") ? trimmed : `Grade ${trimmed}`;
};

const resolveGradeTitle = (items: Activity[], fallbackGrade?: string | null): string => {
  const normalizedFallback = formatGradeLabel(fallbackGrade ?? null);
  if (normalizedFallback) {
    return `${normalizedFallback} Calendar`;
  }
  const gradeMatches = new Set<string>();
  for (const activity of items) {
    const explicitGrade = formatGradeLabel(activity.grade ?? null);
    if (explicitGrade) {
      gradeMatches.add(explicitGrade);
      continue;
    }
    const source = `${activity.title ?? ""} ${activity.roomNo ?? ""}`;
    const match = /grade\s*([0-9]+)/i.exec(source);
    if (match?.[1]) {
      gradeMatches.add(`Grade ${match[1]}`);
    }
  }
  if (gradeMatches.size === 1) {
    return `${Array.from(gradeMatches)[0]} Calendar`;
  }
  return "Remedial Calendar";
};

const resolveDefaultSchoolYear = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return month >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const parseSchoolYear = (schoolYear: string | null | undefined): { startYear: number; endYear: number } | null => {
  if (!schoolYear) return null;
  const parts = schoolYear.split("-").map((value) => Number(value));
  if (parts.length !== 2) return null;
  const [startYear, endYear] = parts;
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null;
  return { startYear, endYear };
};

const yearForMonth = (schoolYear: string, month: number): number | null => {
  const parsed = parseSchoolYear(schoolYear);
  if (!parsed) return null;
  return month >= 6 ? parsed.startYear : parsed.endYear;
};

const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const buildMonthMatrix = (year: number, month: number): Array<Array<Date | null>> => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weeks: Array<Array<Date | null>> = [];
  let day = 1;

  for (let week = 0; week < 6; week += 1) {
    const row: Array<Date | null> = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      if ((week === 0 && dayIndex < firstDay) || day > daysInMonth) {
        row.push(null);
      } else {
        row.push(new Date(year, month, day));
        day += 1;
      }
    }
    weeks.push(row);
    if (day > daysInMonth) break;
  }

  return weeks;
};

const getPrintSubjectTone = (subject: string | null | undefined) => {
  const value = subject?.toLowerCase() ?? "";
  if (value.includes("english")) return "border-emerald-300 bg-emerald-100 text-emerald-900";
  if (value.includes("filipino")) return "border-blue-300 bg-blue-100 text-blue-900";
  if (value.includes("math")) return "border-rose-300 bg-rose-100 text-rose-900";
  if (value.includes("assessment")) return "border-amber-300 bg-amber-100 text-amber-900";
  return "border-gray-300 bg-gray-100 text-gray-800";
};

export default function MasterTeacherCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month");


  // Activities data in state - Start with empty array
  const [activities, setActivities] = useState<Activity[]>([]);
  const [weeklySubjectSchedule, setWeeklySubjectSchedule] = useState<WeeklySubjectSchedule | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [remedialSchedule, setRemedialSchedule] = useState<RemedialQuarterSchedule | null>(null);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [weeklyScheduleLoading, setWeeklyScheduleLoading] = useState(true);
  const [remedialScheduleLoading, setRemedialScheduleLoading] = useState(true);

  const loadApprovedActivities = useCallback(async () => {
    setActivitiesLoading(true);
    try {
      const response = await fetch("/api/master_teacher/calendar", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        activities?: Array<{
          id?: string | number | null;
          title?: string | null;
          activityDate?: string | null;
          date?: string | null;
          day?: string | null;
          subject?: string | null;
          grade?: string | null;
        }>;
        error?: string | null;
      } | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? `Unable to load activities (status ${response.status})`);
      }

      const parsed = Array.isArray(payload.activities) ? payload.activities : [];
      const mapped = parsed
        .map<Activity | null>((item, index) => {
          const rawDate = item.activityDate ?? item.date ?? null;
          const dateValue = rawDate ? new Date(rawDate) : null;
          if (!dateValue || Number.isNaN(dateValue.getTime())) return null;
          return {
            id: Number(item.id ?? index + 1),
            title: item.title ?? "Remedial Activity",
            day: item.day ?? dateValue.toLocaleDateString("en-US", { weekday: "long" }),
            roomNo: "",
            date: dateValue,
            end: new Date(dateValue.getTime() + 60 * 60 * 1000),
            type: "class",
            subject: item.subject ?? null,
            grade: item.grade ?? null,
          } satisfies Activity;
        })
        .filter((item): item is Activity => item !== null);

      setActivities(mapped);
    } catch (error) {
      console.warn("Failed to load approved activities", error);
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovedActivities();
  }, [loadApprovedActivities]);

  const loadWeeklySubjectSchedule = useCallback(async () => {
    setWeeklyScheduleLoading(true);
    try {
      const response = await fetch("/api/principal/weekly-subject-schedule", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        schedule?: Record<string, unknown> | null;
        error?: string;
      } | null;
      if (!payload?.success) {
        throw new Error(payload?.error ?? "Unable to load the weekly subject schedule.");
      }
      setWeeklySubjectSchedule(normalizeWeeklySubjectSchedule(payload.schedule ?? null));
    } catch (error) {
      console.warn("Failed to load weekly subject schedule", error);
      setWeeklySubjectSchedule(null);
    } finally {
      setWeeklyScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeeklySubjectSchedule();
  }, [loadWeeklySubjectSchedule]);

  useEffect(() => {
    const loadRemedialSchedule = async () => {
      setRemedialScheduleLoading(true);
      try {
        const response = await fetch("/api/master_teacher/coordinator/calendar/remedial-schedule", { cache: "no-store" });
        if (!response.ok) {
          setRemedialSchedule(null);
          return;
        }
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          schedule?: { schoolYear?: string | null; quarters?: Record<string, QuarterRange> | null } | null;
        } | null;

        if (!payload?.success || !payload?.schedule?.quarters) {
          setRemedialSchedule(null);
          return;
        }

        setRemedialSchedule({
          schoolYear: payload.schedule.schoolYear ?? resolveDefaultSchoolYear(),
          quarters: payload.schedule.quarters,
        });
      } catch {
        setRemedialSchedule(null);
      } finally {
        setRemedialScheduleLoading(false);
      }
    };

    loadRemedialSchedule();
  }, []);

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
    if (!remedialSchedule?.quarters) {
      return [
        {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          key: `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`,
        },
      ];
    }

    const allMonths: Array<{ month: number; year: number; key: string }> = [];
    const schoolYear = remedialSchedule.schoolYear || resolveDefaultSchoolYear();
    for (const range of Object.values(remedialSchedule.quarters)) {
      if (!range?.startMonth || !range?.endMonth) continue;
      for (let monthValue = range.startMonth; monthValue <= range.endMonth; monthValue += 1) {
        const resolvedYear = yearForMonth(schoolYear, monthValue);
        if (!resolvedYear) continue;
        allMonths.push({
          month: monthValue,
          year: resolvedYear,
          key: `${resolvedYear}-${monthValue}`,
        });
      }
    }

    const deduped = Array.from(new Map(allMonths.map((item) => [item.key, item])).values());
    deduped.sort((a, b) => new Date(a.year, a.month - 1, 1).getTime() - new Date(b.year, b.month - 1, 1).getTime());
    return deduped.length
      ? deduped
      : [
          {
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
            key: `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`,
          },
        ];
  }, [currentDate, remedialSchedule]);

  const handlePrint = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
  }, []);

  // Get week number for a date
  const getWeekNumber = (date: Date): number => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  // Group activities by week
  const getActivitiesByWeek = () => {
    const grouped: { [key: string]: Activity[] } = {};
    
    activities.forEach(activity => {
      const weekNumber = getWeekNumber(activity.date);
      const weekKey = `Week ${weekNumber}`;
      
      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(activity);
    });

    // Sort weeks and activities within each week
    return Object.entries(grouped)
      .sort(([a], [b]) => parseInt(a.replace('Week ', '')) - parseInt(b.replace('Week ', '')))
      .map(([week, weekActivities]) => ({
        week,
        activities: weekActivities.sort((a, b) => a.date.getTime() - b.date.getTime())
      }));
  };

  // Navigation functions
  const prevPeriod = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const nextPeriod = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };



  // Activity type colors
  const getActivityColor = (type: string) => {
    switch(type) {
      case "class": return "bg-blue-100 text-blue-800 border-blue-200";
      case "meeting": return "bg-green-100 text-green-800 border-green-200";
      case "appointment": return "bg-purple-100 text-purple-800 border-purple-200";
      case "event": return "bg-amber-100 text-amber-800 border-amber-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
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

  const normalizeScheduleTime = (value: unknown): string => {
    if (typeof value !== "string") {
      return "";
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(trimmed);
    return match ? `${match[1]}:${match[2]}` : "";
  };

  const normalizeWeeklySubjectSchedule = (value: unknown): WeeklySubjectSchedule => {
    const record = value as Record<string, unknown> | null;
    return {
      Monday: typeof record?.Monday === "string" ? record.Monday.trim() : "",
      Tuesday: typeof record?.Tuesday === "string" ? record.Tuesday.trim() : "",
      Wednesday: typeof record?.Wednesday === "string" ? record.Wednesday.trim() : "",
      Thursday: typeof record?.Thursday === "string" ? record.Thursday.trim() : "",
      Friday: typeof record?.Friday === "string" ? record.Friday.trim() : "",
      startTime: normalizeScheduleTime(record?.startTime),
      endTime: normalizeScheduleTime(record?.endTime),
    };
  };

  const getScheduledSubjectForDate = (
    schedule: WeeklySubjectSchedule | null,
    date: Date,
  ): string | null => {
    if (!schedule) {
      return null;
    }
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    if (!SCHEDULE_WEEKDAYS.includes(weekday as (typeof SCHEDULE_WEEKDAYS)[number])) {
      return null;
    }

    const scheduleWeekday = weekday as (typeof SCHEDULE_WEEKDAYS)[number];
    const subject = schedule[scheduleWeekday];
    return typeof subject === "string" && subject.trim() ? subject.trim() : null;
  };

  const formatTimeLabel = (time: string | null | undefined): string => {
    if (!time) {
      return "--";
    }
    const [hour, minute] = time.split(":").map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return "--";
    }
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const getSubjectChipTone = (subject: string | null | undefined) => {
    const value = subject?.toLowerCase() ?? "";
    if (value.includes("english")) return "bg-emerald-700 text-white border-emerald-700";
    if (value.includes("filipino")) return "bg-blue-700 text-white border-blue-700";
    if (value.includes("math")) return "bg-rose-700 text-white border-rose-700";
    if (value.includes("assessment")) return "bg-amber-700 text-white border-amber-700";
    return "bg-gray-700 text-white border-gray-700";
  };

  // Render the calendar based on view
  const renderCalendar = () => {
    if (view === "week") {
      return renderWeekView();
    }
    return renderMonthView();
  };

  const renderMonthView = () => {
    const storedProfile = getStoredUserProfile();
    const profileGrade =
      storedProfile?.gradeLevel ??
      (storedProfile as { gradeLabel?: string | null })?.gradeLabel ??
      (storedProfile as { grade?: string | null })?.grade ??
      (storedProfile as { gradeRaw?: string | null })?.gradeRaw ??
      (storedProfile as { gradeNumber?: string | number | null })?.gradeNumber ??
      null;
    const gradeTitle = resolveGradeTitle(activities, typeof profileGrade === "number" ? String(profileGrade) : profileGrade);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const weeks = [];
    let day = 1;

    for (let i = 0; i < 6; i++) {
      if (day > daysInMonth) break;

      const days = [];
      for (let j = 0; j < 7; j++) {
        if ((i === 0 && j < firstDay) || day > daysInMonth) {
          days.push(<div key={`empty-${i}-${j}`} className="h-20 p-1 border border-gray-100"></div>);
        } else {
          const currentDay = new Date(year, month, day);
          const dayActivities = activities.filter(
            (a) => a.date.getDate() === day && a.date.getMonth() === month && a.date.getFullYear() === year
          );
          const scheduledSubject = getScheduledSubjectForDate(weeklySubjectSchedule, currentDay);
          const subjectColor = dayActivities.length
            ? getSubjectColor(dayActivities[0].subject)
            : scheduledSubject?.toLowerCase().includes("assessment")
              ? getSubjectColor(scheduledSubject)
              : "border-gray-100";

          days.push(
            <div
              key={`day-${day}`}
              className={`h-24 p-1 border overflow-hidden relative hover:bg-gray-50 transition-colors cursor-pointer ${subjectColor}`}
            >
              <div className="text-right text-sm font-medium text-gray-800 mb-1">
                {day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear() ? (
                  <span className="inline-block w-6 h-6 bg-[#013300] text-white rounded-full text-center leading-6">
                    {day}
                  </span>
                ) : (
                  <span>{day}</span>
                )}
              </div>
              <div className="overflow-y-auto max-h-12 space-y-1">
                {dayActivities.slice(0, 2).map((activity) => {
                  const indicator = getSubjectIndicator(activity.subject);
                  return (
                    <div
                      key={activity.id}
                      className={`group rounded-lg border px-2 py-1 text-[0.7rem] font-semibold shadow-sm ${getSubjectChipTone(activity.subject)}`}
                      title={activity.title}
                      onClick={() => setSelectedActivity(activity)}
                    >
                      <div className="flex items-start gap-2">
                        {indicator && (
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[0.6rem] font-bold text-white">
                            {indicator}
                          </span>
                        )}
                        <span className="text-[0.7rem] font-semibold leading-snug text-white line-clamp-2">
                          {activity.title}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {dayActivities.length > 2 && (
                  <div className="text-xs text-gray-500 text-center bg-gray-100 rounded p-1">
                    +{dayActivities.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
          day++;
        }
      }
      weeks.push(
        <div key={`week-${i}`} className="grid grid-cols-7">
          {days}
        </div>
      );
    }

    return (
      <div>
        <div className="px-4 py-3 border-b border-gray-100 bg-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-gray-800">{gradeTitle}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-500">Legend</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                <span className="h-2 w-2 rounded-full  bg-emerald-500" />
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
        <div className="grid grid-cols-7 bg-gray-50 text-sm font-medium text-gray-700">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <div key={`${day}-${index}`} className="p-2 text-center">
              {day}
            </div>
          ))}
        </div>
        <div className="divide-y">{weeks}</div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const days = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const formatSubjectLabel = (subject: string | null | undefined) => {
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

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + i);

      const dayActivities = activities
        .filter(
          (a) =>
            a.date.getDate() === dayDate.getDate() &&
            a.date.getMonth() === dayDate.getMonth() &&
            a.date.getFullYear() === dayDate.getFullYear()
        )
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      days.push(
        <div 
          key={`weekday-${i}`} 
          className="border-b border-gray-200"
        >
          <div className="p-2 bg-gray-50">
            <div>
              <div className="font-medium text-gray-800 text-sm">{dayNames[i]}</div>
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
                const subjectTone = getSubjectColor(activity.subject);
                const subjectLabel = formatSubjectLabel(activity.subject ?? null);
                const dateParts = formatStackedDate(activity.date);
                const timeLabel =
                  weeklySubjectSchedule?.startTime && weeklySubjectSchedule?.endTime
                    ? `${formatTimeLabel(weeklySubjectSchedule.startTime)} - ${formatTimeLabel(
                        weeklySubjectSchedule.endTime,
                      )}`.toLowerCase()
                    : formatTimeRange(activity.date, activity.end);

                return (
                  <div
                    key={activity.id}
                    className={`rounded-2xl border border-transparent p-4 shadow-sm ring-1 ring-black/5 ${subjectTone}`}
                    onClick={() => setSelectedActivity(activity)}
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
    }

    return <div className="divide-y">{days}</div>;
  };

  const showInitialSkeleton = activitiesLoading || weeklyScheduleLoading || remedialScheduleLoading;

  if (showInitialSkeleton) {
    return <MasterTeacherPageSkeleton title="Calendar" variant="remedial" />;
  }

  return (
    <div className="remedial-calendar-page relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      <div className="print-hidden">
        <Sidebar />
      </div>
      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <div className="print-hidden">
          <Header title="Calendar" />
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="remedial-calendar-scroll p-4 h-full sm:p-5 md:p-6">
            <div className="remedial-calendar-surface relative z-10 h-full min-h-100 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-5 md:p-6">
              {/* Calendar Controls */}
              <div className="print-hidden flex flex-col space-y-3 mb-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
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
                      : `Week of ${currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  </h2>
                  <button onClick={goToToday} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700">
                    Today
                  </button>
                </div>
                <div className="flex items-center space-x-2">
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
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white p-2 text-gray-700 transition hover:bg-gray-100"
                    aria-label="Print calendar"
                    title="Print"
                  >
                    <Printer className="h-5 w-5" />
                  </button>
                </div>
              </div>



              {/* Calendar View */}
              <div className="border rounded-lg overflow-hidden bg-white">
                {renderCalendar()}
              </div>
              <ActivityDetailModal
                activity={selectedActivity}
                onClose={() => setSelectedActivity(null)}
                remedialTime={
                  weeklySubjectSchedule?.startTime && weeklySubjectSchedule?.endTime
                    ? `${formatTimeLabel(weeklySubjectSchedule.startTime)} - ${formatTimeLabel(weeklySubjectSchedule.endTime)}`
                    : null
                }
              />
            </div>
          </div>
        </main>
      </div>

      <div className="print-calendar-document print-only">
        {printableMonths.map((item, monthIndex) => {
          const monthDate = new Date(item.year, item.month - 1, 1);
          const matrix = buildMonthMatrix(item.year, item.month - 1);
          const storedProfile = getStoredUserProfile();
          const profileGrade =
            storedProfile?.gradeLevel ??
            (storedProfile as { gradeLabel?: string | null })?.gradeLabel ??
            (storedProfile as { grade?: string | null })?.grade ??
            (storedProfile as { gradeRaw?: string | null })?.gradeRaw ??
            (storedProfile as { gradeNumber?: string | number | null })?.gradeNumber ??
            null;
          const gradeTitle = resolveGradeTitle(activities, typeof profileGrade === "number" ? String(profileGrade) : profileGrade);

          return (
            <section className="print-month-page" key={item.key}>
              <header className="print-month-header">
                <h1 className="text-xl font-bold text-gray-900">{gradeTitle}</h1>
                <p className="text-sm text-gray-700">
                  {monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              </header>

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
                  {["S", "M", "T", "W", "T", "F", "S"].map((dayLabel, index) => (
                    <div key={`print-${item.key}-${dayLabel}-${index}`} className="border-r border-gray-200 px-2 py-1 text-center last:border-r-0">
                      {dayLabel}
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

                        const cellActivities = activitiesByDate.get(toDateKey(cellDate)) ?? [];
                        return (
                          <div
                            key={`print-day-${item.key}-${weekIndex}-${dayIndex}`}
                            className="h-[92px] border-r border-gray-200 px-1.5 py-1 align-top last:border-r-0"
                          >
                            <div className="text-right text-[11px] font-semibold leading-none text-gray-800">{cellDate.getDate()}</div>
                            <div className="mt-1 space-y-0.5 overflow-visible">
                              {cellActivities.map((activity) => (
                                <div
                                  key={`print-activity-${item.key}-${activity.id}`}
                                  className={`rounded border px-1 py-[1px] text-[9px] font-semibold leading-[1.2] break-words whitespace-normal ${getPrintSubjectTone(activity.subject)}`}
                                  title={activity.title}
                                >
                                  {activity.title}
                                </div>
                              ))}
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

      <style jsx global>{`
        .print-only {
          display: none;
        }

        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }

          .print-hidden {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .remedial-calendar-page > :not(.print-calendar-document) {
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

          .remedial-calendar-page,
          .remedial-calendar-scroll,
          .remedial-calendar-surface,
          .print-calendar-document {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .remedial-calendar-surface {
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          .print-calendar-document,
          .print-calendar-document * {
            position: static !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}

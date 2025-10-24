"use client";
import Sidebar from "@/components/Principal/Sidebar";
import Header from "@/components/Principal/Header";
import { useState, useEffect, useMemo, useCallback } from "react";
// Button Component
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
// Modal Component
import AddScheduleModal from "./Modals/AddScheduleModal";
import {
  GRADE_LEVELS,
  WEEKDAYS,
  createEmptySchedule,
  type RemedialPeriodPayload,
  type RemedialSchedule,
  type WeekdayKey,
} from "./types";

interface Activity {
  id: number;
  title: string;
  day: string;
  roomNo: string;
  description: string;
  date: Date;
  end: Date;
  type: string;
}

type RemedialPeriod = RemedialPeriodPayload;

const DAY_INDEX_TO_KEY: (WeekdayKey | null)[] = [null, "monday", "tuesday", "wednesday", "thursday", "friday", null];
const LOCAL_STORAGE_KEY = "remedialPeriods";

const formatTime = (time: string) => {
  if (!time) return "";
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  if (Number.isNaN(hour)) return time;
  const period = hour >= 12 ? "PM" : "AM";
  const normalizedHour = ((hour + 11) % 12) + 1;
  return `${normalizedHour}:${minuteStr ?? "00"} ${period}`;
};

const formatTimeRange = (start: string, end: string) => `${formatTime(start)} - ${formatTime(end)}`;

const formatDateRange = (start?: Date, end?: Date) => {
  if (!start || !end) {
    return "--";
  }

  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: start.getFullYear() === end.getFullYear() ? undefined : "numeric",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startLabel} – ${endLabel}`;
};

const normalizeSchedule = (rawSchedule: unknown): RemedialSchedule => {
  const base = createEmptySchedule();
  if (!rawSchedule || typeof rawSchedule !== "object") {
    return base;
  }

  const scheduleObj = rawSchedule as Record<string, any>;
  WEEKDAYS.forEach(({ key }) => {
    const dayInput = scheduleObj[key];
    if (dayInput && typeof dayInput === "object") {
      base[key].subject = typeof dayInput.subject === "string" ? dayInput.subject : "";

      const gradesInput = (dayInput as { grades?: Record<string, any> }).grades ?? {};
      GRADE_LEVELS.forEach((grade) => {
        const gradeData = gradesInput[grade as unknown as keyof typeof gradesInput];
        if (gradeData && typeof gradeData === "object") {
          base[key].grades[grade] = {
            startTime: typeof gradeData.startTime === "string" ? gradeData.startTime : "",
            endTime: typeof gradeData.endTime === "string" ? gradeData.endTime : "",
          };
        }
      });
    }
  });

  return base;
};

export default function PrincipalCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [remedialPeriods, setRemedialPeriods] = useState<RemedialPeriod[]>([]);
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);
  const [scheduleSlideIndex, setScheduleSlideIndex] = useState(0);
  const [periodPendingEnd, setPeriodPendingEnd] = useState<RemedialPeriod | null>(null);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);

  // Activities array for calendar
  const [activities, setActivities] = useState<Activity[]>([]);

  const syncPeriodStatuses = useCallback(() => {
    setRemedialPeriods((prev) => {
      const now = new Date();
      let didChange = false;

      const updated = prev.map((period) => {
        if (!period.startDate || !period.endDate) {
          return period;
        }

        const effectiveEnd = period.endedAt ?? period.endDate;
        const hasStarted = now >= period.startDate;
        const beforeEnd = period.endedAt ? now < effectiveEnd : now <= effectiveEnd;
        const shouldBeActive = hasStarted && beforeEnd;

        if (shouldBeActive !== period.isActive) {
          didChange = true;
          return { ...period, isActive: shouldBeActive };
        }
        return period;
      });

      return didChange ? updated : prev;
    });
  }, []);

  const activePeriod = useMemo(() => {
    const now = new Date();
    return (
      remedialPeriods.find((period) => {
        if (!period.startDate || !period.endDate) return false;
        return period.isActive && now >= period.startDate && now <= period.endDate;
      }) ?? null
    );
  }, [remedialPeriods]);

  const upcomingPeriods = useMemo(() => {
    const now = new Date();
    return remedialPeriods
      .filter((period) => period.startDate && period.startDate > now)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [remedialPeriods]);

  const nextUpcomingPeriod = upcomingPeriods[0] ?? null;

  const activeScheduleSummary = useMemo(() => {
    if (!activePeriod) return [] as Array<{ label: string; subject: string; grades: { grade: number; range: string }[] }>;

    return WEEKDAYS.map(({ key, label }) => {
      const dayPlan = activePeriod.schedule?.[key];
      if (!dayPlan) {
        return { label, subject: "", grades: [] };
      }

      const grades = GRADE_LEVELS.map((grade) => {
        const gradePlan = dayPlan.grades[grade];
        if (!gradePlan?.startTime || !gradePlan?.endTime) return null;
        return { grade, range: formatTimeRange(gradePlan.startTime, gradePlan.endTime) };
      }).filter(Boolean) as { grade: number; range: string }[];

      return {
        label,
        subject: dayPlan.subject?.trim?.() ?? "",
        grades,
      };
    }).filter((entry) => entry.subject || entry.grades.length > 0);
  }, [activePeriod]);

  useEffect(() => {
    if (activeScheduleSummary.length === 0) {
      setScheduleSlideIndex(0);
      return;
    }

    setScheduleSlideIndex((prev) => {
      if (prev >= activeScheduleSummary.length) {
        return activeScheduleSummary.length - 1;
      }
      return prev;
    });
  }, [activeScheduleSummary.length]);

  useEffect(() => {
    if (activeScheduleSummary.length > 0) {
      setScheduleSlideIndex(0);
    }
  }, [activePeriod?.id]);

  const visibleScheduleDay = activeScheduleSummary[scheduleSlideIndex] ?? null;

  // Initialize remedial periods
  useEffect(() => {
    const storedPeriods = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedPeriods) {
      try {
        const parsed: RemedialPeriod[] = JSON.parse(storedPeriods).map((item: RemedialPeriod) => ({
          ...item,
          startDate: item.startDate ? new Date(item.startDate) : null,
          endDate: item.endDate ? new Date(item.endDate) : null,
          endedAt: item.endedAt ? new Date(item.endedAt) : null,
          isActive: Boolean(item.isActive),
          schedule: normalizeSchedule(item.schedule),
        }));
        setRemedialPeriods(parsed);
        syncPeriodStatuses();
      } catch (error) {
        console.error("Error parsing stored remedial periods:", error);
        setRemedialPeriods([]);
        syncPeriodStatuses();
      }
    } else {
      setRemedialPeriods([]);
      syncPeriodStatuses();
    }
  }, [syncPeriodStatuses]);

  useEffect(() => {
    syncPeriodStatuses();
  }, [syncPeriodStatuses]);

  useEffect(() => {
    const intervalId = window.setInterval(syncPeriodStatuses, 60000);
    return () => window.clearInterval(intervalId);
  }, [syncPeriodStatuses]);

  // Save to localStorage whenever periods change
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remedialPeriods));
  }, [remedialPeriods]);

  // Add new schedule
  const handleAddSchedule = (schedule: RemedialPeriod) => {
    setRemedialPeriods((prev) => [...prev, { ...schedule, endedAt: null }]);
    syncPeriodStatuses();
  };

  const handleDiscardPeriod = useCallback(
    (periodId: number) => {
      setRemedialPeriods((prev) => prev.filter((period) => period.id !== periodId));

      if (periodPendingEnd?.id === periodId) {
        setPeriodPendingEnd(null);
        setShowEndConfirmation(false);
      }

      syncPeriodStatuses();
    },
    [periodPendingEnd, syncPeriodStatuses]
  );

  const handleRequestEndPeriod = useCallback((period: RemedialPeriod) => {
    setPeriodPendingEnd(period);
    setShowEndConfirmation(true);
  }, []);

  const handleCancelEndPeriod = useCallback(() => {
    setShowEndConfirmation(false);
    setPeriodPendingEnd(null);
  }, []);

  const handleConfirmEndPeriod = useCallback(() => {
    if (!periodPendingEnd) return;

    const endedAt = new Date();
    setRemedialPeriods((prev) =>
      prev.map((period) =>
        period.id === periodPendingEnd.id ? { ...period, endedAt, isActive: false } : period
      )
    );
    setShowEndConfirmation(false);
    setPeriodPendingEnd(null);
    syncPeriodStatuses();
  }, [periodPendingEnd, syncPeriodStatuses]);

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
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const nextPeriod = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
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

  // Check if a date is within any remedial period
  const getRemedialPlanForDate = (date: Date) => {
    const dayKey = DAY_INDEX_TO_KEY[date.getDay()];
    if (!dayKey) return null;

    for (const period of remedialPeriods) {
      if (!period.isActive) continue;
      if (!period.startDate || !period.endDate) continue;
      if (date >= period.startDate && date <= period.endDate) {
        return {
          period,
          dayKey,
          schedule: period.schedule?.[dayKey],
        };
      }
    }

    return null;
  };

  // Render the calendar - only month view now
  const renderCalendar = () => {
    return renderMonthView();
  };

  // List View
  const renderListView = () => {
    const activitiesByWeek = getActivitiesByWeek();

    return (
      <div className="space-y-6">
        {activitiesByWeek.length > 0 ? (
          activitiesByWeek.map(({ week, activities }) => (
            <div key={week} className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                {week} - {activities[0].date.getFullYear()}
              </h3>
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="p-3 border-l-4 border-[#013300] bg-white rounded-lg shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{activity.title}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {activity.date.toLocaleDateString("en-US", { 
                            month: "long", 
                            day: "numeric", 
                            year: "numeric" 
                          })}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{activity.roomNo}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-8">
            No activities scheduled.
          </div>
        )}
      </div>
    );
  };

  const renderMonthView = () => {
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

          const remedialPlan = getRemedialPlanForDate(currentDay);
          const daySchedule = remedialPlan?.schedule;
          const gradeSummaries = daySchedule
            ? GRADE_LEVELS.map((grade) => ({
                grade,
                startTime: daySchedule.grades[grade]?.startTime ?? "",
                endTime: daySchedule.grades[grade]?.endTime ?? "",
              })).filter((entry) => entry.startTime && entry.endTime)
            : [];
          const isRemedialDay = Boolean(remedialPlan);
          const subjectLabel = daySchedule?.subject?.trim?.() ?? "";
          const hasScheduleDetails = Boolean(subjectLabel || gradeSummaries.length > 0);

          days.push(
            <div
              key={`day-${day}`}
              className={`h-24 p-1 border overflow-hidden relative transition-colors ${
                isRemedialDay ? "bg-green-50 border-green-200" : "border-gray-100"
              }`}
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
              <div className="overflow-y-auto max-h-20 space-y-1">
                {hasScheduleDetails && daySchedule && (
                  <div className="bg-green-100 border border-green-200 rounded px-1 py-1 text-[10px] text-green-900">
                    <div className="font-semibold text-[11px] truncate">
                      {subjectLabel || "Remedial Session"}
                    </div>
                    {gradeSummaries.slice(0, 3).map((entry) => (
                      <div key={`grade-summary-${entry.grade}`} className="truncate">
                        G{entry.grade}: {formatTimeRange(entry.startTime, entry.endTime)}
                      </div>
                    ))}
                    {gradeSummaries.length > 3 && (
                      <div className="text-[9px] text-green-800 text-right">
                        +{gradeSummaries.length - 3} more grades
                      </div>
                    )}
                  </div>
                )}
                {dayActivities.slice(0, 2).map((activity) => (
                  <div
                    key={activity.id}
                    className={`text-xs p-1 rounded truncate border ${getActivityColor(activity.type)}`}
                  >
                    <span className="truncate">{activity.title}</span>
                  </div>
                ))}
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

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Calendar" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="flex flex-col gap-6">
              <section>
                <div className="rounded-2xl border border-[#013300]/15 bg-green-50 p-6 shadow-sm">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-[#013300]/80">Remedial Period</p>
                        <h3 className="text-2xl font-bold text-[#013300]">
                          {activePeriod ? activePeriod.title : "No active period"}
                        </h3>
                        {activePeriod && (
                          <p className="text-sm text-[#013300]/80">
                            {formatDateRange(activePeriod.startDate, activePeriod.endDate)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                            activePeriod
                              ? "border-[#013300]/30 bg-green-50 text-[#013300]"
                              : "border-gray-300 bg-gray-100 text-gray-600"
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {activePeriod ? "Active" : "Inactive"}
                        </span>
                        {activePeriod && (
                          <button
                            type="button"
                            onClick={() => handleRequestEndPeriod(activePeriod)}
                            className="rounded-lg border border-[#013300]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#013300] shadow-sm transition hover:bg-green-100"
                          >
                            Force End
                          </button>
                        )}
                        <UtilityButton small onClick={() => setShowAddScheduleModal(true)}>
                          Manage Periods
                        </UtilityButton>
                      </div>
                    </div>

                    {activeScheduleSummary.length > 0 && visibleScheduleDay && (
                      <div className="rounded-2xl border border-[#013300]/20 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-[#013300]/70">
                              Day {scheduleSlideIndex + 1} of {activeScheduleSummary.length}
                            </p>
                            <h4 className="mt-1 text-2xl font-bold text-[#013300]">{visibleScheduleDay.label}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setScheduleSlideIndex((prev) => Math.max(prev - 1, 0))}
                              disabled={scheduleSlideIndex === 0}
                              className={`flex h-9 w-9 items-center justify-center rounded-full border text-[#013300] transition ${
                                scheduleSlideIndex === 0
                                  ? "cursor-not-allowed border-[#013300]/10 bg-green-50 text-[#013300]/40"
                                  : "border-[#013300]/20 bg-white hover:border-[#013300]/40 hover:bg-green-50"
                              }`}
                              aria-label="Previous day schedule"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                <path
                                  fillRule="evenodd"
                                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setScheduleSlideIndex((prev) => Math.min(prev + 1, activeScheduleSummary.length - 1))
                              }
                              disabled={scheduleSlideIndex === activeScheduleSummary.length - 1}
                              className={`flex h-9 w-9 items-center justify-center rounded-full border text-[#013300] transition ${
                                scheduleSlideIndex === activeScheduleSummary.length - 1
                                  ? "cursor-not-allowed border-[#013300]/10 bg-green-50 text-[#013300]/40"
                                  : "border-[#013300]/20 bg-white hover:border-[#013300]/40 hover:bg-green-50"
                              }`}
                              aria-label="Next day schedule"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                <path
                                  fillRule="evenodd"
                                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="mt-6 space-y-4">
                          {visibleScheduleDay.subject && (
                            <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#013300]">
                              {visibleScheduleDay.subject}
                            </span>
                          )}
                          <div className="rounded-2xl border border-[#013300]/15 bg-green-50 p-5">
                            {visibleScheduleDay.grades.length > 0 ? (
                              <ul className="space-y-3">
                                {visibleScheduleDay.grades.map((grade) => (
                                  <li
                                    key={`${visibleScheduleDay.label}-${grade.grade}`}
                                    className="flex flex-col gap-1 text-[#013300] sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <span className="text-base font-semibold">Grade {grade.grade}</span>
                                    <span className="text-sm font-medium text-[#013300]/80 sm:text-base">{grade.range}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm font-medium text-[#013300]/80">
                                Set grade times in the modal to display the schedule overview.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {nextUpcomingPeriod && (
                      <div className="rounded-2xl border border-dashed border-[#013300]/30 bg-green-100/40 p-6 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-[#013300]/70">
                              Upcoming Period
                            </p>
                            <h4 className="mt-1 text-xl font-bold text-[#013300]">{nextUpcomingPeriod.title}</h4>
                            <p className="text-sm text-[#013300]/80">
                              {formatDateRange(nextUpcomingPeriod.startDate, nextUpcomingPeriod.endDate)}
                            </p>
                            <p className="mt-2 text-xs font-medium text-[#013300]/70">
                              Auto-activates at the start of the day on {nextUpcomingPeriod.startDate?.toLocaleDateString(
                                "en-US",
                                {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDiscardPeriod(nextUpcomingPeriod.id)}
                              className="rounded-lg border border-[#013300]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#013300] shadow-sm transition hover:bg-green-100"
                            >
                              Discard Plan
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2 text-gray-700">
                    <button onClick={prevPeriod} className="rounded-lg border border-gray-200 p-2 hover:bg-gray-100">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button onClick={nextPeriod} className="rounded-lg border border-gray-200 p-2 hover:bg-gray-100">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <h2 className="text-lg font-semibold sm:text-xl">
                      {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={goToToday} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
                      Today
                    </button>
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-xl border border-gray-100">
                  {renderCalendar()}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      {showEndConfirmation && periodPendingEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#013300]/70">
                  End Current Period
                </p>
                <h3 className="text-xl font-bold text-[#013300]">Force end {periodPendingEnd.title}?</h3>
                <p className="mt-2 text-sm text-[#013300]/80">
                  Ending the period immediately will archive the schedule and stop displaying its highlights on the
                  calendar. You can create a new plan at any time.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelEndPeriod}
                  className="rounded-lg border border-[#013300]/20 px-3 py-1.5 text-sm font-medium text-[#013300] transition hover:bg-green-50"
                >
                  Keep Period
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEndPeriod}
                  className="rounded-lg bg-[#013300] px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012400]"
                >
                  End Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Schedule Modal */}
      <AddScheduleModal
        show={showAddScheduleModal}
        onClose={() => setShowAddScheduleModal(false)}
        onSave={handleAddSchedule}
      />
    </div>
  );
}
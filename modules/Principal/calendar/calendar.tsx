"use client";
import Sidebar from "@/components/Principal/Sidebar";
import Header from "@/components/Principal/Header";
import { useState, useEffect, useMemo } from "react";
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
  // Recently added schedule activation prompt
  const [recentlyAddedId, setRecentlyAddedId] = useState<number | null>(null);
  const [showActivationPrompt, setShowActivationPrompt] = useState(false);

  // Activities array for calendar
  const [activities, setActivities] = useState<Activity[]>([]);

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

  // Initialize remedial periods
  useEffect(() => {
    // Try to load from localStorage if available
    const savedPeriods = localStorage.getItem('remedialPeriods');
    if (savedPeriods) {
      const parsedPeriods = JSON.parse(savedPeriods).map((period: any) => ({
        ...period,
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate),
        isActive: Boolean(period.isActive),
        schedule: normalizeSchedule(period.schedule),
      }));
      setRemedialPeriods(parsedPeriods);
    } else {
      // Default empty array if no saved periods
      setRemedialPeriods([]);
    }
  }, []);

  // Save to localStorage whenever periods change
  useEffect(() => {
    localStorage.setItem('remedialPeriods', JSON.stringify(remedialPeriods));
  }, [remedialPeriods]);

  // Add new schedule
  const handleAddSchedule = (schedule: RemedialPeriod) => {
    setRemedialPeriods(prev => [...prev, schedule]);
    setRecentlyAddedId(schedule.id);
    setShowActivationPrompt(true);
  };

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
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr),minmax(0,1fr)]">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-6 shadow-sm">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Remedial Period</p>
                        <h3 className="text-2xl font-bold text-emerald-900">
                          {activePeriod ? activePeriod.title : "No active period"}
                        </h3>
                        {activePeriod && (
                          <p className="text-sm text-emerald-800">
                            {formatDateRange(activePeriod.startDate, activePeriod.endDate)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                            activePeriod
                              ? "border-emerald-400 bg-emerald-100 text-emerald-700"
                              : "border-gray-300 bg-gray-100 text-gray-600"
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {activePeriod ? "Active" : "Inactive"}
                        </span>
                        <UtilityButton small onClick={() => setShowAddScheduleModal(true)}>
                          Manage Periods
                        </UtilityButton>
                      </div>
                    </div>

                    {showActivationPrompt && recentlyAddedId && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-900 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <span>New remedial plan created. Activate it to display highlights on the calendar.</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setRemedialPeriods((prev) => prev.map((p) => ({ ...p, isActive: p.id === recentlyAddedId })));
                                setShowActivationPrompt(false);
                              }}
                              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-700"
                            >
                              Activate Now
                            </button>
                            <button
                              onClick={() => setShowActivationPrompt(false)}
                              className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeScheduleSummary.length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {activeScheduleSummary.map((day) => (
                          <div
                            key={day.label}
                            className="rounded-xl border border-emerald-200 bg-white/80 p-4 shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-emerald-900">{day.label}</span>
                              {day.subject && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                                  {day.subject}
                                </span>
                              )}
                            </div>
                            <ul className="mt-3 space-y-1 text-xs text-emerald-900">
                              {day.grades.map((grade) => (
                                <li key={`${day.label}-${grade.grade}`} className="flex items-center justify-between gap-3">
                                  <span className="font-medium">Grade {grade.grade}</span>
                                  <span className="text-emerald-700">{grade.range}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h4 className="text-base font-semibold text-gray-900">Next Remedial Period</h4>
                  {nextUpcomingPeriod ? (
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{nextUpcomingPeriod.title}</p>
                        <p className="text-sm text-gray-500">
                          {formatDateRange(nextUpcomingPeriod.startDate, nextUpcomingPeriod.endDate)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                      No upcoming schedules yet. Plan ahead to keep everyone aligned.
                    </div>
                  )}
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

      {/* Add Schedule Modal */}
      <AddScheduleModal
        show={showAddScheduleModal}
        onClose={() => setShowAddScheduleModal(false)}
        onSave={handleAddSchedule}
      />
    </div>
  );
}
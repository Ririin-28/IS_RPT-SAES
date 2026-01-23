"use client";
import Sidebar from "@/components/Teacher/Sidebar";
import Header from "@/components/Teacher/Header";
import { useCallback, useEffect, useState } from "react";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import { getStoredUserProfile, storeUserProfile } from "@/lib/utils/user-profile";

interface Activity {
  id: string;
  title: string;
  day: string | null;
  date: Date;
  end: Date;
  type: string;
  grade: string | null;
  subject: string | null;
  status: string | null;
}

type TeacherProfileResponse = {
  success?: boolean;
  error?: string;
  profile?: {
    userId?: number | null;
    grade?: string | null;
    gradeLabel?: string | null;
    gradeRaw?: string | null;
    gradeNumber?: number | null;
    subjectHandled?: string | null;
  } | null;
  metadata?: {
    missingGrade?: boolean;
  } | null;
};

const GRADE_WORD_TO_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const ROMAN_NUMERAL_TO_NUMBER: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
};

const deriveGradeNumber = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  const text = value.trim().toLowerCase();
  if (!text) {
    return null;
  }
  const digitMatch = text.match(/(\d+)/);
  if (digitMatch) {
    const parsed = Number(digitMatch[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const romanMatch = text.match(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/);
  if (romanMatch) {
    const parsed = ROMAN_NUMERAL_TO_NUMBER[romanMatch[1]];
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const wordMatch = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (wordMatch) {
    const parsed = GRADE_WORD_TO_NUMBER[wordMatch[1]];
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeGradeLabel = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const derivedNumber = deriveGradeNumber(trimmed);
  if (Number.isFinite(derivedNumber) && derivedNumber !== null) {
    return `Grade ${derivedNumber}`;
  }

  const gradePattern = /^grade\s*(.*)$/i;
  const gradeMatch = gradePattern.exec(trimmed.replace(/\s+/g, " "));
  if (gradeMatch) {
    const remainder = gradeMatch[1]?.trim();
    if (!remainder) {
      return "Grade";
    }
    const remainderNumber = deriveGradeNumber(remainder);
    if (Number.isFinite(remainderNumber) && remainderNumber !== null) {
      return `Grade ${remainderNumber}`;
    }
    return `Grade ${remainder}`;
  }

  return trimmed;
};

const statusBadgeTone = (status: string | null | undefined) => {
  if (!status) {
    return "bg-gray-100 text-gray-600 border border-gray-200";
  }
  const normalized = status.toLowerCase();
  if (normalized.includes("approve")) {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  }
  if (normalized.includes("decline") || normalized.includes("reject")) {
    return "bg-red-100 text-red-700 border border-red-200";
  }
  return "bg-amber-100 text-amber-800 border border-amber-200";
};

const isViewOnlyStatus = (status: string | null | undefined): boolean =>
  Boolean(status && status.toLowerCase().includes("approve"));

export default function TeacherCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);

  const combineDateTime = useCallback((dateStr: string | null, timeStr: string | null): Date | null => {
    if (!dateStr) {
      return null;
    }

    const parts = dateStr.split("-");
    if (parts.length === 3 && parts.every((part) => part.trim().length > 0)) {
      const [yearRaw, monthRaw, dayRaw] = parts;
      const year = Number(yearRaw);
      const monthIndex = Number(monthRaw) - 1;
      const day = Number(dayRaw);
      if (Number.isFinite(year) && Number.isFinite(monthIndex) && Number.isFinite(day)) {
        const date = new Date(year, monthIndex, day, 8, 0, 0, 0);
        if (Number.isFinite(date.getTime())) {
          if (timeStr) {
            const [hoursRaw, minutesRaw, secondsRaw] = timeStr.split(":");
            const hours = Number(hoursRaw);
            const minutes = Number(minutesRaw);
            const seconds = Number(secondsRaw ?? 0);
            if (Number.isFinite(hours)) {
              date.setHours(hours);
            }
            if (Number.isFinite(minutes)) {
              date.setMinutes(minutes);
            }
            if (Number.isFinite(seconds)) {
              date.setSeconds(seconds);
            }
          }
          return date;
        }
      }
    }

    const fallback = new Date(dateStr);
    if (!Number.isFinite(fallback.getTime())) {
      return null;
    }

    if (timeStr) {
      const [hoursRaw, minutesRaw, secondsRaw] = timeStr.split(":");
      const hours = Number(hoursRaw);
      const minutes = Number(minutesRaw);
      const seconds = Number(secondsRaw ?? 0);
      if (Number.isFinite(hours)) {
        fallback.setHours(hours);
      }
      if (Number.isFinite(minutes)) {
        fallback.setMinutes(minutes);
      }
      if (Number.isFinite(seconds)) {
        fallback.setSeconds(seconds);
      }
    }

    return fallback;
  }, []);

  const fetchActivities = useCallback(async (gradeOverride: string | null) => {
    setLoading(true);
    setError(null);

    try {
      const targetGrade = normalizeGradeLabel(gradeOverride);
      const query = targetGrade ? `?grade=${encodeURIComponent(targetGrade)}` : "";
      const response = await fetch(`/api/teacher/calendar${query}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        activities?: Array<{
          id: string;
          title: string | null;
          subject: string | null;
          grade: string | null;
          status: string | null;
          activityDate: string | null;
          startTime: string | null;
          endTime: string | null;
          day: string | null;
        }> | null;
        error?: string;
      } | null;

      if (!response.ok || !payload?.success) {
        const message = payload?.error ?? `Failed to load activities (status ${response.status})`;
        throw new Error(message);
      }

      const hydrated = (payload.activities ?? [])
        .map<Activity | null>((item) => {
          const startDate = combineDateTime(item.activityDate ?? null, item.startTime ?? null);
          if (!startDate) {
            return null;
          }
          const endDateCandidate = combineDateTime(item.activityDate ?? null, item.endTime ?? null);
          const endDate = endDateCandidate && endDateCandidate.getTime() >= startDate.getTime()
            ? endDateCandidate
            : new Date(startDate.getTime() + 60 * 60 * 1000);

          const title = item.title ?? `${item.subject ?? "Activity"} Schedule`;

          return {
            id: item.id,
            title,
            day: item.day ?? null,
            date: startDate,
            end: endDate,
            type: (item.subject ?? "class").toLowerCase(),
            grade: item.grade ?? null,
            subject: item.subject ?? null,
            status: item.status ?? null,
          } satisfies Activity;
        })
        .filter((activity): activity is Activity => Boolean(activity));

      if (!targetGrade) {
        const detectedGrades = Array.from(
          new Set(
            hydrated
              .map((activity) => normalizeGradeLabel(activity.grade))
              .filter((grade): grade is string => Boolean(grade)),
          ),
        );

        if (detectedGrades.length === 1) {
          const detectedGrade = detectedGrades[0];
          if (detectedGrade && detectedGrade !== gradeFilter) {
            const storedProfile = getStoredUserProfile();
            setGradeFilter(detectedGrade);
            if (storedProfile) {
              storeUserProfile({
                ...storedProfile,
                gradeLevel: detectedGrade,
              });
            }
          }

          const filteredActivities = hydrated.filter((activity) => {
            const normalizedGrade = normalizeGradeLabel(activity.grade);
            return !normalizedGrade || normalizedGrade === detectedGrade;
          });

          setActivities(filteredActivities);
          return;
        }
      }

      setActivities(hydrated);
    } catch (err) {
      console.error("Failed to load teacher activities", err);
      setError((err as Error)?.message ?? "Unable to load activities. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [combineDateTime, gradeFilter]);

  const resolveTeacherGrade = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);

    try {
      const storedProfile = getStoredUserProfile();
      const storedGrade = normalizeGradeLabel(storedProfile?.gradeLevel ?? null);

      if (!storedProfile?.userId) {
        setGradeFilter(null);
        setProfileError("Teacher profile is unavailable. Please sign in again.");
        setProfileLoading(false);
        return;
      }

      if (storedGrade) {
        setGradeFilter(storedGrade);
        setProfileLoading(false);
        return;
      }

      const userId = String(storedProfile.userId);
      const response = await fetch(`/api/teacher/profile?userId=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as TeacherProfileResponse | null;

      if (!response.ok || !payload?.success) {
        const message = payload?.error ?? `Failed to load teacher profile (status ${response.status}).`;
        throw new Error(message);
      }

      const profileGrade = normalizeGradeLabel(payload.profile?.gradeLabel ?? payload.profile?.grade ?? null);
      if (!profileGrade) {
        setGradeFilter(null);
        if (storedProfile) {
          storeUserProfile({
            ...storedProfile,
            gradeLevel: null,
          });
        }
        setProfileLoading(false);
        return;
      }

      setGradeFilter(profileGrade);

      if (storedProfile) {
        storeUserProfile({
          ...storedProfile,
          gradeLevel: profileGrade,
        });
      }

      setProfileLoading(false);
    } catch (err) {
      setGradeFilter(null);
      setProfileError((err as Error)?.message ?? "Unable to load teacher profile.");
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    resolveTeacherGrade();
  }, [resolveTeacherGrade]);

  useEffect(() => {
    if (profileLoading) {
      return;
    }
    fetchActivities(gradeFilter ?? null);
  }, [fetchActivities, gradeFilter, profileLoading]);

  const handleRefresh = useCallback(() => {
    fetchActivities(gradeFilter ?? null);
    resolveTeacherGrade();
  }, [fetchActivities, gradeFilter, resolveTeacherGrade]);

  // Get week number for a date
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

  // Group activities by week
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
                {activities.map((activity) => {
                  const viewOnly = isViewOnlyStatus(activity.status);
                  const statusLabel = activity.status ?? null;
                  const tone = resolveActivityTone(activity.type);
                  const statusClass = statusLabel ? statusBadgeTone(viewOnly ? "Pending" : statusLabel) : null;

                  return (
                    <div
                      key={activity.id}
                      className={`p-3 border border-l-4 rounded-lg shadow-sm transition-shadow ${tone.backgroundClass} ${tone.borderClass}`}
                      style={{ borderLeftColor: tone.accentColor }}
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-semibold ${tone.titleClass}`}>{activity.title}</span>
                          {statusLabel && statusClass && (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}
                            >
                              {statusLabel}
                            </span>
                          )}
                          {viewOnly && (
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                              View Only
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          <span>
                            {activity.date.toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span>
                            {activity.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" – "}
                            {activity.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {[activity.subject, activity.grade].filter(Boolean).join(" • ") || "Scheduled activity"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-8">No activities scheduled.</div>
        )}
      </div>
    );
  };

  const resolveActivityTone = (type: string | null | undefined) => {
    const normalized = (type ?? "").toLowerCase();

    if (normalized.includes("english")) {
      return {
        backgroundClass: "bg-blue-50",
        borderClass: "border-blue-200",
        titleClass: "text-blue-900",
        accentColor: "#2563EB",
      } as const;
    }

    if (normalized.includes("filipino")) {
      return {
        backgroundClass: "bg-purple-50",
        borderClass: "border-purple-200",
        titleClass: "text-purple-900",
        accentColor: "#7C3AED",
      } as const;
    }

    if (normalized.includes("math")) {
      return {
        backgroundClass: "bg-amber-50",
        borderClass: "border-amber-200",
        titleClass: "text-amber-900",
        accentColor: "#D97706",
      } as const;
    }

    if (normalized.includes("meeting")) {
      return {
        backgroundClass: "bg-green-50",
        borderClass: "border-green-200",
        titleClass: "text-green-900",
        accentColor: "#047857",
      } as const;
    }

    if (normalized.includes("appointment")) {
      return {
        backgroundClass: "bg-rose-50",
        borderClass: "border-rose-200",
        titleClass: "text-rose-900",
        accentColor: "#DB2777",
      } as const;
    }

    if (normalized.includes("event")) {
      return {
        backgroundClass: "bg-sky-50",
        borderClass: "border-sky-200",
        titleClass: "text-sky-900",
        accentColor: "#0EA5E9",
      } as const;
    }

    return {
      backgroundClass: "bg-gray-50",
      borderClass: "border-gray-200",
      titleClass: "text-gray-900",
      accentColor: "#047857",
    } as const;
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

  // Render the calendar based on view
  const renderCalendar = () => {
    if (profileLoading) {
      return <div className="py-10 text-center text-gray-500">Loading teacher profile...</div>;
    }

    if (loading) {
      return <div className="py-10 text-center text-gray-500">Loading activities...</div>;
    }

    if (error) {
      return (
        <div className="py-10 text-center text-red-600">
          {error}
        </div>
      );
    }

    if (view === "list") {
      return renderListView();
    }

    if (view === "week") {
      return renderWeekView();
    }

    return renderMonthView();
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

          days.push(
            <div
              key={`day-${day}`}
              className="h-24 p-1 border overflow-hidden relative hover:bg-gray-50 transition-colors cursor-pointer border-gray-100"
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
                {dayActivities.slice(0, 2).map((activity) => (
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

  const renderWeekView = () => {
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const days = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
                const viewOnly = isViewOnlyStatus(activity.status);
                const statusLabel = activity.status ?? null;
                const tone = resolveActivityTone(activity.type);
                const statusClass = statusLabel ? statusBadgeTone(viewOnly ? "Pending" : statusLabel) : null;

                return (
                  <div
                    key={activity.id}
                    className={`p-3 border border-l-4 rounded-lg shadow-sm transition-shadow ${tone.backgroundClass} ${tone.borderClass}`}
                    style={{ borderLeftColor: tone.accentColor }}
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-semibold text-sm ${tone.titleClass}`}>{activity.title}</span>
                        {statusLabel && statusClass && (
                          <span
                            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold ${statusClass}`}
                          >
                            {statusLabel}
                          </span>
                        )}
                        {viewOnly && (
                          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-600">
                            View Only
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600">
                        {activity.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" – "}
                        {activity.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="text-xs text-gray-500">
                        {[activity.subject, activity.grade].filter(Boolean).join(" • ") || "Scheduled activity"}
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

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Calendar" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              {profileError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {profileError}
                </div>
              )}
              {/* Calendar Controls */}
              <div className="flex flex-col space-y-3 mb-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
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
                  {gradeFilter && (
                    <span className="px-3 py-1 text-xs font-medium text-[#013300] bg-[#e9f6ed] rounded-full border border-[#c7e2ce]">
                      {gradeFilter}
                    </span>
                  )}
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
                    <button
                      onClick={() => setView("list")}
                      className={`px-3 py-1.5 text-xs rounded-md sm:text-sm ${
                        view === "list" ? "bg-white text-gray-800 shadow-sm" : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      List
                    </button>
                  </div>
                  <button
                    onClick={handleRefresh}
                    className="px-3 py-1.5 text-xs sm:text-sm rounded-md border border-gray-200 text-gray-600 hover:text-gray-800 hover:border-gray-300"
                    disabled={loading || profileLoading}
                  >
                    {loading ? "Loading..." : profileError ? "Retry" : "Refresh"}
                  </button>
                </div>
              </div>

              {/* Calendar View */}
              <div className="border rounded-lg overflow-hidden bg-white">
                {renderCalendar()}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";

export type CalendarActivity = {
  id: string;
  title: string;
  subject: string | null;
  subjectId?: number | null;
  date: Date;
  day: string | null;
  startTime: string | null;
  endTime: string | null;
  gradeId?: number | null;
};

type Props = {
  activities: CalendarActivity[];
  subject: string;
  loading: boolean;
  error: string | null;
  onEdit?: (activity: CalendarActivity) => void;
  onPlay?: (activity: CalendarActivity) => void;
  playLinkBuilder?: (activity: CalendarActivity) => string;
  validatingActivityId?: string | null;
  renderTitle?: (
    activity: CalendarActivity,
    options: { isCurrentAnchor: boolean },
  ) => React.ReactNode;
  renderActions?: (activity: CalendarActivity) => React.ReactNode;
};

const normalizeCalendarSubject = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.startsWith("eng")) return "English";
  if (lower.startsWith("fil")) return "Filipino";
  if (lower.startsWith("math") || lower.includes("mathematics")) return "Math";
  return null;
};

const formatTimeLabel = (time: string | null | undefined): string | null => {
  if (!time) return null;
  const parts = time.split(":");
  const hour = Number.parseInt(parts[0] ?? "", 10);
  const minute = Number.parseInt(parts[1] ?? "0", 10);
  if (!Number.isFinite(hour)) return null;
  const date = new Date();
  date.setHours(hour, Number.isFinite(minute) ? minute : 0, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatTimeRange = (start: string | null | undefined, end: string | null | undefined): string | null => {
  const startLabel = formatTimeLabel(start);
  const endLabel = formatTimeLabel(end);
  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
  if (startLabel) return startLabel;
  if (endLabel) return endLabel;
  return null;
};

const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

const DAY_INDEX_LOOKUP: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const isSameDate = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

type ScheduleStatus = "upcoming" | "today" | "completed";

const getScheduleStatus = (activityDate: Date, today = new Date()): ScheduleStatus => {
  const normalizedActivityDate = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());
  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (isSameDate(normalizedActivityDate, normalizedToday)) {
    return "today";
  }

  return normalizedActivityDate.getTime() > normalizedToday.getTime() ? "upcoming" : "completed";
};

const getScheduleStatusLabel = (status: ScheduleStatus): string => {
  if (status === "today") return "Today";
  if (status === "upcoming") return "Upcoming";
  return "Completed";
};

const getScheduleStatusTone = (status: ScheduleStatus): string => {
  if (status === "today") {
    return "border border-[#013300]/15 bg-green-50 text-[#013300]";
  }
  if (status === "upcoming") {
    return "border border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border border-gray-200 bg-gray-100 text-gray-500";
};

const getActivityDayIndex = (activity: CalendarActivity): number => {
  const normalizedDay = String(activity.day ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (normalizedDay && Number.isFinite(DAY_INDEX_LOOKUP[normalizedDay])) {
    return DAY_INDEX_LOOKUP[normalizedDay];
  }
  return activity.date.getDay();
};

export default function ScheduledActivitiesList({ activities, subject, loading, error, onEdit, onPlay, validatingActivityId, renderTitle, renderActions }: Props) {
  const filteredSchedule = useMemo(() => {
    return activities
      .filter((activity) => {
        const normalized = normalizeCalendarSubject(activity.subject);
        if (!normalized) return true;
        return normalized === subject;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [activities, subject]);

  const groupedSchedule = useMemo(() => {
    const grouped: Record<string, { weekNumber: number; year: number; items: CalendarActivity[] }> = {};
    filteredSchedule.forEach((activity) => {
      const weekNumber = getWeekNumber(activity.date);
      const year = activity.date.getFullYear();
      const key = `${year}-W${weekNumber}`;
      if (!grouped[key]) {
        grouped[key] = { weekNumber, year, items: [] };
      }
      grouped[key].items.push(activity);
    });

    return Object.values(grouped)
      .sort((a, b) => (a.year === b.year ? a.weekNumber - b.weekNumber : a.year - b.year))
      .map((entry) => ({
        label: `Week ${entry.weekNumber}, ${entry.year}`,
        activities: entry.items.sort((a, b) => a.date.getTime() - b.date.getTime()),
      }));
  }, [filteredSchedule]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activityRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const initialScrollKeyRef = useRef<string | null>(null);
  const [showBackToCurrentButton, setShowBackToCurrentButton] = useState(false);
  const [anchorDirection, setAnchorDirection] = useState<"up" | "down">("up");

  const currentAnchor = useMemo(() => {
    if (filteredSchedule.length === 0) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todayMatch = filteredSchedule.find((activity) => isSameDate(activity.date, today));
    if (todayMatch) {
      return { id: String(todayMatch.id), mode: "today" as const };
    }

    const todayDayIndex = now.getDay();
    const sameDayCandidates = filteredSchedule.filter((activity) => getActivityDayIndex(activity) === todayDayIndex);
    if (sameDayCandidates.length > 0) {
      const upcomingSameDay = sameDayCandidates.find((activity) => activity.date.getTime() >= today.getTime());
      const sameDayAnchor = upcomingSameDay ?? sameDayCandidates[sameDayCandidates.length - 1];
      return { id: String(sameDayAnchor.id), mode: "day" as const };
    }

    const nextMatch = filteredSchedule.find((activity) => activity.date.getTime() >= today.getTime());
    if (nextMatch) {
      return { id: String(nextMatch.id), mode: "next" as const };
    }

    const fallback = filteredSchedule[filteredSchedule.length - 1];
    return fallback ? { id: String(fallback.id), mode: "latest" as const } : null;
  }, [filteredSchedule]);

  const currentAnchorId = currentAnchor?.id ?? null;

  const registerActivityRef = useCallback(
    (activityId: string) => (node: HTMLDivElement | null) => {
      if (node) {
        activityRefs.current[activityId] = node;
      } else {
        delete activityRefs.current[activityId];
      }
    },
    [],
  );

  const resolveAnchorScrollTop = useCallback((): number | null => {
    if (!currentAnchorId) return null;
    const container = scrollContainerRef.current;
    const anchor = activityRefs.current[currentAnchorId];
    if (!container || !anchor) return null;

    const stickyOffset = 56;
    const containerRect = container.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const rawTop = anchorRect.top - containerRect.top + container.scrollTop - stickyOffset;
    return Math.max(0, rawTop);
  }, [currentAnchorId]);

  const scrollToCurrentAnchor = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const container = scrollContainerRef.current;
      const nextTop = resolveAnchorScrollTop();
      if (!container || nextTop === null) return;
      container.scrollTo({ top: nextTop, behavior });
    },
    [resolveAnchorScrollTop],
  );

  useEffect(() => {
    if (loading || error || !currentAnchorId) return;
    const scrollKey = `${subject}-${currentAnchorId}-${filteredSchedule.length}`;
    if (initialScrollKeyRef.current === scrollKey) return;

    const frameId = window.requestAnimationFrame(() => {
      scrollToCurrentAnchor("auto");
      initialScrollKeyRef.current = scrollKey;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [loading, error, currentAnchorId, filteredSchedule.length, scrollToCurrentAnchor, subject]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateButtonVisibility = () => {
      const anchorTop = resolveAnchorScrollTop();
      if (anchorTop === null) {
        setShowBackToCurrentButton(false);
        return;
      }
      const distance = anchorTop - container.scrollTop;
      setShowBackToCurrentButton(Math.abs(distance) > 180);
      setAnchorDirection(distance >= 0 ? "down" : "up");
    };

    updateButtonVisibility();
    container.addEventListener("scroll", updateButtonVisibility, { passive: true });
    window.addEventListener("resize", updateButtonVisibility);

    return () => {
      container.removeEventListener("scroll", updateButtonVisibility);
      window.removeEventListener("resize", updateButtonVisibility);
    };
  }, [resolveAnchorScrollTop, groupedSchedule.length]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center border bordered-gray-100 rounded-xl bg-gray-50/50 animate-pulse">
        <p className="text-gray-400 font-medium">Loading schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 p-4 border border-red-100 bg-red-50 text-red-600 rounded-lg text-sm">
        {error}
      </div>
    );
  }

  if (groupedSchedule.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50">
        <p className="text-gray-500 font-medium">No scheduled activities for {subject}.</p>
        <p className="text-gray-400 text-sm mt-1">Check back later or view other subjects.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div ref={scrollContainerRef} className="h-full overflow-y-auto pr-2 pb-10 custom-scrollbar">
        <div className="space-y-8">
          {groupedSchedule.map((group) => (
            <div key={group.label} className="space-y-3">
              <h3 className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm py-2 text-xs font-bold text-gray-400 uppercase tracking-widest px-1 border-b border-gray-100">
                {group.label}
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {group.activities.map((activity) => {
                  const normalizedSubject = normalizeCalendarSubject(activity.subject);
                  const timeLabel = formatTimeRange(activity.startTime, activity.endTime);
                  const month = activity.date.toLocaleDateString("en-PH", { month: "short" });
                  const day = activity.date.toLocaleDateString("en-PH", { day: "numeric" });
                  const weekday = activity.date.toLocaleDateString("en-PH", { weekday: "short" });
                  const isCurrentAnchor = currentAnchorId === String(activity.id);
                  const scheduleStatus = getScheduleStatus(activity.date);

                  return (
                    <div
                      key={activity.id}
                      ref={registerActivityRef(String(activity.id))}
                      className={`group flex flex-row items-center justify-between w-full rounded-xl p-4 transition-all duration-300 ${
                        isCurrentAnchor
                          ? "current-schedule-card border border-[#013300] bg-[#013300] shadow-[0_16px_36px_-24px_rgba(1,51,0,0.45)]"
                          : "border border-gray-200 hover:border-[#013300]/30 hover:shadow-lg"
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Date Box */}
                        <div
                          className={`shrink-0 flex h-14 w-12 flex-col items-center justify-center rounded-lg border ${
                            isCurrentAnchor
                              ? "border-white/15 bg-white/10 text-white"
                              : "border-[#013300]/10 bg-[#013300]/5 text-[#013300]"
                          }`}
                        >
                          <span className="text-[0.65rem] font-bold uppercase tracking-wide leading-none">{month}</span>
                          <span className="text-xl font-extrabold leading-none mt-0.5">{day}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            {normalizedSubject && (
                              <span
                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider ${
                                  isCurrentAnchor ? "bg-white/12 text-white" : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {normalizedSubject}
                              </span>
                            )}
                            <span className={`text-[0.65rem] font-medium uppercase ${isCurrentAnchor ? "text-white/70" : "text-gray-400"}`}>
                              {weekday}
                            </span>
                            {isCurrentAnchor && (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] ${getScheduleStatusTone(
                                  scheduleStatus,
                                )}`}
                              >
                                {getScheduleStatusLabel(scheduleStatus)}
                              </span>
                            )}
                          </div>

                          <h4
                            className={`truncate text-sm font-bold leading-tight transition-colors ${
                              isCurrentAnchor ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {renderTitle ? renderTitle(activity, { isCurrentAnchor }) : activity.title}
                          </h4>

                          {timeLabel && (
                            <div className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${isCurrentAnchor ? "text-white/80" : "text-gray-500"}`}>
                              <svg className={`h-3.5 w-3.5 ${isCurrentAnchor ? "text-white/70" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {timeLabel}
                            </div>
                          )}
                        </div>
                      </div>

                      {(renderActions || onEdit || onPlay) && (
                        <div className="ml-4 shrink-0 flex gap-2">
                          {renderActions ? renderActions(activity) : null}
                          {!renderActions && onEdit && (
                            <div className="relative inline-block">
                              <UtilityButton small onClick={() => onEdit(activity)} className="py-2! px-4!">
                                Edit
                              </UtilityButton>
                            </div>
                          )}
                          {!renderActions && onPlay && (
                            <UtilityButton
                              small
                              onClick={() => onPlay(activity)}
                              className="py-2! px-4! min-w-17.5"
                              disabled={validatingActivityId === String(activity.id)}
                            >
                              {validatingActivityId === String(activity.id) ? (
                                <span className="inline-flex items-center gap-2">
                                  <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                </span>
                              ) : (
                                "Play"
                              )}
                            </UtilityButton>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showBackToCurrentButton && currentAnchorId && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 sm:bottom-5">
          <button
            type="button"
            onClick={() => scrollToCurrentAnchor("smooth")}
            className="pointer-events-auto flex min-w-43 flex-col items-center justify-center gap-2 rounded-2xl bg-transparent px-6 py-4 text-center text-[0.95rem] font-medium tracking-[-0.01em] text-slate-900 transition duration-200"
            aria-label={currentAnchor?.mode === "today" ? "Back to current date" : "Back to current day"}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-900"
              style={{ animation: "iconNudge 2.2s ease-in-out infinite" }}
            >
              <svg
                className={`h-4.5 w-4.5 transition-transform duration-300 ${anchorDirection === "down" ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path d="M5 12L10 7L15 12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 16L10 11L15 16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>{currentAnchor?.mode === "today" ? "Current Schedule" : "Current Schedule"}</span>
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes iconNudge {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        .current-schedule-card :global(button) {
          background: rgb(255 255 255 / 0.12) !important;
          border: 2px solid rgb(255 255 255 / 0.12) !important;
          color: #ffffff !important;
          box-shadow: none !important;
        }

        .current-schedule-card :global(button:hover) {
          background: rgb(255 255 255 / 0.12) !important;
          border: 2px solid rgb(255 255 255 / 0.12) !important;
        }

        @media (prefers-reduced-motion: reduce) {
          button span {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

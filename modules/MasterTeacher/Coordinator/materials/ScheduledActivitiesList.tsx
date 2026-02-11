import Link from "next/link";
import { useMemo } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";

export type CalendarActivity = {
  id: string;
  title: string;
  subject: string | null;
  date: Date;
  day: string | null;
  startTime: string | null;
  endTime: string | null;
};

type Props = {
  activities: CalendarActivity[];
  subject: string;
  loading: boolean;
  error: string | null;
  submissionFlags?: Record<string, boolean>;
  onReview?: (activity: CalendarActivity) => void;
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

export default function ScheduledActivitiesList({ activities, subject, loading, error, submissionFlags, onReview }: Props) {
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
    <div className="h-full overflow-y-auto pr-2 pb-10 custom-scrollbar">
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

                const hasSubmission = submissionFlags?.[String(activity.id)] ?? false;

                return (
                  <div
                    key={activity.id}
                    className="group flex flex-row items-center justify-between w-full bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-[#013300]/30 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Date Box */}
                      <div className="flex-shrink-0 flex flex-col items-center justify-center w-12 h-14 bg-[#013300]/5 text-[#013300] rounded-lg border border-[#013300]/10">
                        <span className="text-[0.65rem] font-bold uppercase tracking-wide leading-none">{month}</span>
                        <span className="text-xl font-extrabold leading-none mt-0.5">{day}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {normalizedSubject && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                              {normalizedSubject}
                            </span>
                          )}
                          <span className="text-[0.65rem] font-medium text-gray-400 uppercase">
                            {weekday}
                          </span>
                        </div>
                        
                        <h4 className="text-sm font-bold text-gray-900 truncate leading-tight transition-colors">
                          {activity.title}
                        </h4>
                        
                        {timeLabel && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {timeLabel}
                          </div>
                        )}
                      </div>
                    </div>

                    {onReview && (
                      <div className="ml-4 flex-shrink-0">
                        <div className="relative inline-block">
                          <PrimaryButton small onClick={() => onReview(activity)} className="!py-2 !px-6">
                            Review
                          </PrimaryButton>
                        </div>
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
  );
}

"use client";
import Sidebar from "@/components/Principal/Sidebar";
import Header from "@/components/Principal/Header";
import { useEffect, useMemo, useState } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import DeleteConfirmationModal from "@/components/Common/Modals/DeleteConfirmationModal";
import RemedialPeriodModal, {
  type RemedialPeriodFormValues,
} from "./Modals/RemedialPeriodModal";

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

const STORAGE_KEY = "principalRemedialPeriod";

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
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as RemedialPeriod;
      if (parsed?.quarter && parsed?.startDate && parsed?.endDate) {
        setRemedialPeriod(parsed);
      }
    } catch (error) {
      console.error("Failed to parse remedial period from storage", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!remedialPeriod) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remedialPeriod));
  }, [remedialPeriod]);

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

  const handleSavePeriod = (values: RemedialPeriodFormValues) => {
    setRemedialPeriod({
      quarter: values.quarter as RemedialPeriod["quarter"],
      startDate: values.startDate,
      endDate: values.endDate,
    });
    setShowPeriodModal(false);
  };

  const openCancelModal = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = () => {
    setRemedialPeriod(null);
    setShowCancelModal(false);
  };

  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
  };

  const statusBadge = getPeriodStatus(remedialPeriod);

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
                      >
                        Cancel Schedule
                      </DangerButton>
                    )}
                    <PrimaryButton
                      type="button"
                      small
                      className="px-4"
                      onClick={() => setShowPeriodModal(true)}
                    >
                      {remedialPeriod ? "Update Schedule" : "Set Schedule"}
                    </PrimaryButton>
                  </div>
                </div>

                {/* Remedial Period Card */}
                <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <p className="text-xl font-semibold text-gray-800">Remedial Period Schedule</p>
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
                          Click Set Remedial Period to configure the remedial timeframe
                        </p>
                      )}
                    </div>
                  </div>

                  {remedialPeriod && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                        <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">Quarter</div>
                        <div className="mt-1 text-lg font-semibold text-black">{remedialPeriod.quarter}</div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                        <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">Start Date</div>
                        <div className="mt-1 text-lg font-semibold text-black">
                          {formatFullDate(remedialPeriod.startDate)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                        <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">End Date</div>
                        <div className="mt-1 text-lg font-semibold text-black">
                          {formatFullDate(remedialPeriod.endDate)}
                        </div>
                      </div>
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

      <RemedialPeriodModal
        show={showPeriodModal}
        onClose={() => setShowPeriodModal(false)}
        onSave={handleSavePeriod}
        initialData={
          remedialPeriod
            ? {
                quarter: remedialPeriod.quarter,
                startDate: remedialPeriod.startDate,
                endDate: remedialPeriod.endDate,
              }
            : undefined
        }
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
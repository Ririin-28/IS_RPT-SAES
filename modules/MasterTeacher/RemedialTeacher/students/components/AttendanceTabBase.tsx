"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TableList from "@/components/Common/Tables/TableList";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import type { SubjectKey } from "@/modules/MasterTeacher/RemedialTeacher/report/types";

const SUPPORTED_MONTHS = new Set([2, 3, 9, 10, 12]);

type AttendanceStatus = "present" | "absent";

type DayInfo = {
  day: number;
  dayName: string;
  key: string;
  iso: string;
  month: number;
  isSupported: boolean;
};

type AttendanceTabBaseProps = {
  subjectKey: SubjectKey;
  subjectLabel: string;
  students: any[];
  searchTerm: string;
};

const buildKey = (studentId: number, iso: string) => `${studentId}|${iso}`;

const cycleStatus = (current: AttendanceStatus | undefined): AttendanceStatus | null => {
  if (!current) {
    return "present";
  }
  if (current === "present") {
    return "absent";
  }
  return null;
};

const getStatusClass = (status: AttendanceStatus | undefined) => {
  if (status === "present") {
    return "bg-[#013300] text-white";
  }
  if (status === "absent") {
    return "bg-red-600 text-white";
  }
  return "bg-gray-200 text-gray-500";
};

const renderStatusIcon = (status: AttendanceStatus | undefined) => {
  if (status === "present") {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === "absent") {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return <div className="w-2 h-2 rounded-full bg-current opacity-40" />;
};

const toIso = (year: number, month: number, day: number) => {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const buildMonthDays = (anchor: Date): DayInfo[] => {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const list: DayInfo[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    list.push({
      day,
      dayName,
      key: `${dayName} ${day}`,
      iso: toIso(year, month, day),
      month: month + 1,
      isSupported: SUPPORTED_MONTHS.has(month + 1),
    });
  }
  return list;
};

const buildWeekDays = (anchor: Date): DayInfo[] => {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const day = anchor.getDate();
  const startOfWeek = new Date(year, month, day - anchor.getDay());
  const days: DayInfo[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const current = new Date(startOfWeek);
    current.setDate(startOfWeek.getDate() + offset);
    const currentYear = current.getFullYear();
    const currentMonth = current.getMonth();
    const currentDay = current.getDate();
    const dayName = current.toLocaleDateString("en-US", { weekday: "short" });
    days.push({
      day: currentDay,
      dayName,
      key: `${dayName} ${currentDay}`,
      iso: toIso(currentYear, currentMonth, currentDay),
      month: currentMonth + 1,
      isSupported: SUPPORTED_MONTHS.has(currentMonth + 1),
    });
  }
  return days;
};

export default function AttendanceTabBase({ subjectKey, subjectLabel, students, searchTerm }: AttendanceTabBaseProps) {
  const [view, setView] = useState<"Week" | "Month">("Week");
  const [isEditing, setIsEditing] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [statusMap, setStatusMap] = useState<Map<string, AttendanceStatus>>(new Map());
  const [baselineMap, setBaselineMap] = useState<Map<string, AttendanceStatus>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const studentIds = useMemo(() => {
    const ids: number[] = [];
    for (const student of students) {
      const raw = student?.id ?? student?.studentId;
      const numeric = typeof raw === "number" ? raw : Number(raw);
      if (Number.isFinite(numeric) && numeric > 0) {
        ids.push(numeric);
      }
    }
    return ids;
  }, [students]);

  const studentsKey = useMemo(() => studentIds.join(","), [studentIds]);

  const monthDays = useMemo(() => buildMonthDays(currentDate), [currentDate]);
  const weekDays = useMemo(() => buildWeekDays(currentDate), [currentDate]);
  const daysToDisplay = view === "Month" ? monthDays : weekDays;
  const hasSupportedDays = useMemo(() => daysToDisplay.some((day) => day.isSupported), [daysToDisplay]);

  const filteredStudents = useMemo(() => {
    if (!searchTerm) {
      return students;
    }
    const term = searchTerm.toLowerCase();
    return students.filter((student) => {
      const nameMatch = student?.name?.toLowerCase().includes(term);
      const idMatch = student?.studentId?.toString().toLowerCase().includes(term);
      const gradeMatch = student?.grade?.toString().toLowerCase().includes(term);
      const sectionMatch = student?.section?.toLowerCase().includes(term);
      return Boolean(nameMatch || idMatch || gradeMatch || sectionMatch);
    });
  }, [students, searchTerm]);

  const startIso = daysToDisplay[0]?.iso ?? null;
  const endIso = daysToDisplay[daysToDisplay.length - 1]?.iso ?? null;

  useEffect(() => {
    if (isEditing) {
      return;
    }
    if (!studentIds.length || !startIso || !endIso) {
      setStatusMap(new Map());
      setBaselineMap(new Map());
      return;
    }

    const controller = new AbortController();
    let isCancelled = false;

    const loadAttendance = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({
          subject: subjectKey,
          start: startIso,
          end: endIso,
        });
        if (studentIds.length) {
          params.set("studentIds", studentIds.join(","));
        }

        const response = await fetch(`/api/master_teacher/remedial/attendance?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.success || !Array.isArray(payload.records)) {
          throw new Error(payload?.error ?? "Failed to load attendance records.");
        }

        if (isCancelled) {
          return;
        }

        const nextMap = new Map<string, AttendanceStatus>();
        for (const record of payload.records as Array<{ studentId: number; date: string; present: "Yes" | "No" }>) {
          const key = buildKey(Number(record.studentId), record.date);
          nextMap.set(key, record.present === "Yes" ? "present" : "absent");
        }

        setBaselineMap(new Map(nextMap));
        setStatusMap(new Map(nextMap));
      } catch (error) {
        if (isCancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        console.error("Failed to load attendance records", error);
        setBaselineMap(new Map());
        setStatusMap(new Map());
        setLoadError(error instanceof Error ? error.message : "Failed to load attendance records.");
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadAttendance();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [isEditing, subjectKey, studentsKey, startIso, endIso]);

  const toggleAttendance = useCallback(
    (studentId: number, iso: string, isSupported: boolean) => {
      if (!isEditing || !isSupported) {
        return;
      }
      const key = buildKey(studentId, iso);
      setStatusMap((prev) => {
        const next = new Map(prev);
        const current = next.get(key);
        const cycled = cycleStatus(current);
        if (cycled === null) {
          next.delete(key);
        } else {
          next.set(key, cycled);
        }
        return next;
      });
      setFeedback(null);
    },
    [isEditing]
  );

  const handleCancel = useCallback(() => {
    setStatusMap(new Map(baselineMap));
    setIsEditing(false);
    setFeedback(null);
  }, [baselineMap]);

  const handleSave = useCallback(async () => {
    if (!isEditing) {
      return;
    }

    const changes: Array<{ studentId: number; date: string; present: "Yes" | "No" | null }> = [];
    const allKeys = new Set<string>([...baselineMap.keys(), ...statusMap.keys()]);

    for (const key of allKeys) {
      const previous = baselineMap.get(key);
      const current = statusMap.get(key);
      if (previous === current) {
        continue;
      }
      const [studentIdPart, iso] = key.split("|");
      const studentId = Number(studentIdPart);
      if (!Number.isFinite(studentId)) {
        continue;
      }
      let present: "Yes" | "No" | null = null;
      if (current === "present") {
        present = "Yes";
      } else if (current === "absent") {
        present = "No";
      }
      changes.push({ studentId, date: iso, present });
    }

    if (!changes.length) {
      setIsEditing(false);
      setFeedback({ type: "success", message: "No changes to save." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/master_teacher/remedial/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subjectKey, entries: changes }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Failed to save attendance.");
      }
      setBaselineMap(new Map(statusMap));
      setIsEditing(false);
      const notified = changes.some((entry) => entry.present === "No");
      const message = notified
        ? `Attendance saved. Parents were notified about the absences in ${subjectLabel}.`
        : `Attendance for ${subjectLabel} saved successfully.`;
      setFeedback({ type: "success", message });
    } catch (error) {
      console.error("Failed to save attendance", error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save attendance.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [baselineMap, isEditing, statusMap, subjectKey, subjectLabel]);

  const goToPreviousMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToPreviousWeek = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() - 7);
      return next;
    });
  };

  const goToNextWeek = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7);
      return next;
    });
  };

  const currentMonthLabel = useMemo(() => {
    return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [currentDate]);

  const currentWeekLabel = useMemo(() => {
    if (!weekDays.length) {
      return "Week";
    }
    const first = weekDays[0];
    const last = weekDays[weekDays.length - 1];
    return `Week of ${first.dayName} ${first.day} - ${last.dayName} ${last.day}, ${currentDate.getFullYear()}`;
  }, [currentDate, weekDays]);

  const rows = useMemo(() => {
    return filteredStudents.map((student: any, index: number) => {
      const rawId = student?.id ?? student?.studentId ?? index + 1;
      const numericId = typeof rawId === "number" ? rawId : Number(rawId);
      const id = Number.isFinite(numericId) ? numericId : index + 1;
      const row: Record<string, any> = {
        id,
        no: index + 1,
        name: student.name,
      };
      for (const day of daysToDisplay) {
        const key = buildKey(id, day.iso);
        const status = statusMap.get(key);
        row[day.key] = status ?? "unmarked";
      }
      return row;
    });
  }, [filteredStudents, daysToDisplay, statusMap]);

  const renderAttendanceCell = useCallback(
    (row: any, day: DayInfo) => {
      const status = row[day.key] as AttendanceStatus | "unmarked";
      const displayStatus = status === "unmarked" ? undefined : (status as AttendanceStatus);
      const className = getStatusClass(displayStatus);

      if (!day.isSupported) {
        return (
          <div
            className={`w-8 h-8 rounded-md flex items-center justify-center bg-gray-100 text-gray-400 border border-dashed border-gray-300`}
            title="Attendance tracking for this month is not yet available."
          >
            --
          </div>
        );
      }

      if (!isEditing) {
        return (
          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${className}`}>
            {renderStatusIcon(displayStatus)}
          </div>
        );
      }

      return (
        <button
          type="button"
          onClick={() => toggleAttendance(row.id, day.iso, day.isSupported)}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-all hover:scale-110 hover:shadow-md ${className}`}
          title={
            !displayStatus
              ? "Click to mark as present"
              : displayStatus === "present"
              ? "Click to mark as absent"
              : "Click to clear"
          }
        >
          {renderStatusIcon(displayStatus)}
        </button>
      );
    },
    [isEditing, toggleAttendance]
  );

  const columns = useMemo(() => {
    return [
      { key: "no", title: "No#", render: (row: any) => row.no },
      { key: "name", title: "Name" },
      ...daysToDisplay.map((day) => ({
        key: day.key,
        title: `${day.dayName} ${day.day}`,
        render: (row: any) => renderAttendanceCell(row, day),
      })),
    ];
  }, [daysToDisplay, renderAttendanceCell]);

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={view === "Month" ? goToPreviousMonth : goToPreviousWeek}
            className="p-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
            type="button"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <SecondaryHeader title={view === "Month" ? currentMonthLabel : currentWeekLabel} />
          <button
            onClick={view === "Month" ? goToNextMonth : goToNextWeek}
            className="p-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
            type="button"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setView("Week")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                view === "Week" ? "bg-white text-[#013300] shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView("Month")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                view === "Month" ? "bg-white text-[#013300] shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Month
            </button>
          </div>

          {isEditing ? (
            <div className="flex gap-2">
              <UtilityButton small onClick={handleCancel} disabled={isSaving}>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </span>
              </UtilityButton>
              <PrimaryButton small onClick={handleSave} disabled={isSaving}>
                <span className="flex items-center gap-1">
                  {isSaving ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 1v4a8 8 0 100 16v-4l-3.5 3.5L12 23v-4a8 8 0 01-8-8z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Save
                </span>
              </PrimaryButton>
            </div>
          ) : (
            <UtilityButton small onClick={() => setIsEditing(true)} disabled={!hasSupportedDays || loading}>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="hidden sm:inline">Edit</span>
              </span>
            </UtilityButton>
          )}
        </div>
      </div>

      {!hasSupportedDays && (
        <p className="mb-3 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
          Attendance tracking is currently available for September, October, December, February, and March.
        </p>
      )}

      {loadError && (
        <p className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {feedback && (
        <p
          className={`mb-3 rounded-md px-3 py-2 text-sm ${
            feedback.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {feedback.message}
        </p>
      )}

      <div className="mb-2 flex items-center gap-6 text-sm text-gray-600">
        <span className="font-medium">Legend:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-gray-300" />
          <span>Unmarked</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#013300]" />
          <span>Present</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-600" />
          <span>Absent</span>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading attendance records...</div>
      ) : (
        <div className="[&_th]:py-2">
          <TableList columns={columns} data={rows} pageSize={10} />
        </div>
      )}
    </div>
  );
}

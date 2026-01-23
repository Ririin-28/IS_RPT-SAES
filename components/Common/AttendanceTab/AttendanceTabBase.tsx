"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TableList from "@/components/Common/Tables/TableList";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import { exportRowsToExcel } from "@/lib/utils/export-to-excel";
import type { SubjectKey } from "@/modules/MasterTeacher/RemedialTeacher/report/types";

const DEFAULT_SUPPORTED_MONTHS = new Set([2, 3, 9, 10, 12]);

type AttendanceStatus = "present" | "absent";

type DayInfo = {
  day: number;
  dayName: string;
  weekday: string;
  key: string;
  iso: string;
  month: number;
  isSupported: boolean;
  isFuture: boolean;
};

// Define types for name parts
type NameParts = {
  firstName: string;
  lastName: string;
  middleNames: string[];
};

type AttendanceTabBaseProps = {
  subjectKey: SubjectKey;
  subjectLabel: string;
  students: any[];
  searchTerm: string;
};

const buildKey = (studentId: number, iso: string) => `${studentId}|${iso}`;

const resolveStudentId = (student: any, fallback: number) => {
  const rawId = student?.id ?? student?.studentId ?? fallback;
  const numericId = typeof rawId === "number" ? rawId : Number(rawId);
  return Number.isFinite(numericId) ? numericId : fallback;
};

// Helper function to capitalize words
const capitalizeWord = (value: string) => {
  if (!value) {
    return "";
  }
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

// Extract name parts from student object
const extractNameParts = (student: any): NameParts => {
  const firstName = (student?.firstName ?? student?.firstname ?? "").trim();
  const lastName = (student?.lastName ?? student?.surname ?? student?.lastname ?? "").trim();
  const middleNameRaw = (student?.middleName ?? student?.middlename ?? student?.middleInitial ?? "").trim();

  // If we have separate name fields, use them
  if (firstName || lastName) {
    const middleNames = middleNameRaw ? middleNameRaw.split(/\s+/).filter(Boolean) : [];
    return { firstName, lastName, middleNames };
  }

  // Otherwise, parse the full name
  const raw = (student?.name ?? "").trim();
  if (!raw) {
    return { firstName: "", lastName: "", middleNames: [] };
  }
  
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: "", lastName: "", middleNames: [] };
  }
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "", middleNames: [] };
  }
  
  // Assume format: FirstName MiddleName LastName
  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
    middleNames: parts.slice(1, -1),
  };
};

// Format display name as "Surname, FirstName M.I."
const formatStudentDisplayName = (student: any) => {
  const { firstName, lastName, middleNames } = extractNameParts(student);
  
  if (!firstName && !lastName) {
    return student?.name ?? "";
  }
  
  const segments: string[] = [];
  
  // Add last name (surname) first
  if (lastName) {
    segments.push(capitalizeWord(lastName));
  }
  
  // Add first name
  if (firstName) {
    segments.push(capitalizeWord(firstName));
  }
  
  // Add middle initials
  const middleInitials = middleNames
    .map((name) => (name ? `${name.charAt(0).toUpperCase()}.` : ""))
    .filter(Boolean)
    .join(" ");
  
  if (middleInitials) {
    segments.push(middleInitials);
  }
  
  // Format as "Surname, FirstName M.I."
  if (segments.length === 1) {
    return segments[0];
  } else if (segments.length === 2) {
    return `${segments[0]}, ${segments[1]}`;
  } else {
    return `${segments[0]}, ${segments[1]} ${segments.slice(2).join(" ")}`;
  }
};

// Build sort key for A-Z sorting by Surname, FirstName, Middle Initials
const buildNameSortKey = (student: any) => {
  const { firstName, lastName, middleNames } = extractNameParts(student);
  
  // Create sort key: lastName|firstName|middleNames
  const normalized = [
    lastName.toLowerCase(),
    firstName.toLowerCase(),
    middleNames.join(" ").toLowerCase(),
  ].join("|");
  
  // If we have no name data, use the raw name field
  if (normalized.replace(/\|/g, "").trim()) {
    return normalized;
  }
  
  return (student?.name ?? "").toLowerCase();
};

const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const adjustToWeekday = (date: Date, direction: "forward" | "backward" = "forward") => {
  const next = new Date(date);
  if (!isWeekend(next)) {
    return next;
  }
  const step = direction === "forward" ? 1 : -1;
  do {
    next.setDate(next.getDate() + step);
  } while (isWeekend(next));
  return next;
};

const moveOneWeekday = (date: Date, direction: "forward" | "backward") => {
  const step = direction === "forward" ? 1 : -1;
  const next = new Date(date);
  do {
    next.setDate(next.getDate() + step);
  } while (isWeekend(next));
  return next;
};

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

const isFutureDate = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date > today;
};

const buildMonthDays = (anchor: Date, supportedMonths: Set<number>, allowedWeekdays: Set<string> | null): DayInfo[] => {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const list: DayInfo[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    if (isWeekend(date)) {
      continue;
    }
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    const isoDate = new Date(year, month, day);
    isoDate.setHours(0, 0, 0, 0);
    
    list.push({
      day,
      dayName,
      key: `${dayName} ${day}`,
      iso: toIso(year, month, day),
      month: month + 1,
      weekday,
      isSupported: supportedMonths.has(month + 1) && (allowedWeekdays === null || allowedWeekdays.has(weekday)),
      isFuture: isoDate > today,
    });
  }
  return list;
};

const buildWeekDays = (anchor: Date, supportedMonths: Set<number>, allowedWeekdays: Set<string> | null): DayInfo[] => {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const day = anchor.getDate();
  const startOfWeek = new Date(year, month, day - anchor.getDay());
  const days: DayInfo[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let offset = 0; offset < 7; offset += 1) {
    const current = new Date(startOfWeek);
    current.setDate(startOfWeek.getDate() + offset);
    if (isWeekend(current)) {
      continue;
    }
    const currentYear = current.getFullYear();
    const currentMonth = current.getMonth();
    const currentDay = current.getDate();
    const dayName = current.toLocaleDateString("en-US", { weekday: "short" });
    const weekday = current.toLocaleDateString("en-US", { weekday: "long" });
    const isoDate = new Date(currentYear, currentMonth, currentDay);
    isoDate.setHours(0, 0, 0, 0);
    
    days.push({
      day: currentDay,
      dayName,
      key: `${dayName} ${currentDay}`,
      iso: toIso(currentYear, currentMonth, currentDay),
      month: currentMonth + 1,
      weekday,
      isSupported: supportedMonths.has(currentMonth + 1) && (allowedWeekdays === null || allowedWeekdays.has(weekday)),
      isFuture: isoDate > today,
    });
  }
  return days;
};

const buildDayDays = (anchor: Date, supportedMonths: Set<number>, allowedWeekdays: Set<string> | null): DayInfo[] => {
  const normalized = adjustToWeekday(anchor);
  const year = normalized.getFullYear();
  const month = normalized.getMonth();
  const day = normalized.getDate();
  const dayName = normalized.toLocaleDateString("en-US", { weekday: "short" });
  const weekday = normalized.toLocaleDateString("en-US", { weekday: "long" });
  const isoDate = new Date(year, month, day);
  isoDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return [
    {
      day,
      dayName,
      key: `${dayName} ${day}`,
      iso: toIso(year, month, day),
      month: month + 1,
      weekday,
      isSupported: supportedMonths.has(month + 1) && (allowedWeekdays === null || allowedWeekdays.has(weekday)),
      isFuture: isoDate > today,
    },
  ];
};

const resolveDefaultSchoolYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return month >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

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
];

const formatMonthList = (months: Set<number>) => {
  const names = Array.from(months)
    .filter((month) => month >= 1 && month <= 12)
    .sort((a, b) => a - b)
    .map((month) => MONTH_LABELS[month - 1])
    .filter(Boolean);

  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
};

const formatMonthAbbrev = (month: number): string => {
  const months = [
    "Jan.", "Feb.", "Mar.", "Apr.", "May.", "Jun.",
    "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."
  ];
  return months[month - 1] || "Invalid";
};

export default function AttendanceTabBase({ subjectKey, subjectLabel, students, searchTerm }: AttendanceTabBaseProps) {
  const [view, setView] = useState<"Day" | "Week" | "Month">("Week");
  const [isEditing, setIsEditing] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [statusMap, setStatusMap] = useState<Map<string, AttendanceStatus>>(new Map());
  const [baselineMap, setBaselineMap] = useState<Map<string, AttendanceStatus>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [supportedMonths, setSupportedMonths] = useState<Set<number>>(DEFAULT_SUPPORTED_MONTHS);
  const [supportedMonthsLabel, setSupportedMonthsLabel] = useState<string>(() => formatMonthList(DEFAULT_SUPPORTED_MONTHS));
  const [allowedWeekdays, setAllowedWeekdays] = useState<Set<string> | null>(null);

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

  const monthDays = useMemo(
    () => buildMonthDays(currentDate, supportedMonths, allowedWeekdays),
    [allowedWeekdays, currentDate, supportedMonths],
  );
  const weekDays = useMemo(
    () => buildWeekDays(currentDate, supportedMonths, allowedWeekdays),
    [allowedWeekdays, currentDate, supportedMonths],
  );
  const dayDays = useMemo(
    () => buildDayDays(currentDate, supportedMonths, allowedWeekdays),
    [allowedWeekdays, currentDate, supportedMonths],
  );
  const daysToDisplay = useMemo(() => {
    if (view === "Month") {
      return monthDays;
    }
    if (view === "Week") {
      return weekDays;
    }
    return dayDays;
  }, [dayDays, monthDays, view, weekDays]);
  const hasSupportedDays = useMemo(() => daysToDisplay.some((day) => day.isSupported), [daysToDisplay]);
  
  const canEnterEditMode = useMemo(() => {
    if (!hasSupportedDays || loading) {
      return false;
    }
    return daysToDisplay.some((day) => day.isSupported && !day.isFuture);
  }, [hasSupportedDays, loading, daysToDisplay]);
  
  const todayIso = useMemo(() => {
    const now = new Date();
    return toIso(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  
  const todayDayInfo = useMemo(() => daysToDisplay.find((day) => day.iso === todayIso), [daysToDisplay, todayIso]);
  
  const canMarkAllPresentToday = Boolean(
    todayDayInfo?.isSupported && 
    !todayDayInfo?.isFuture && 
    isEditing
  );

  // Sort students A-Z by Surname, FirstName, Middle Initials
  const sortedStudents = useMemo(() => {
    const list = [...students];
    list.sort((a, b) => {
      const aKey = buildNameSortKey(a);
      const bKey = buildNameSortKey(b);
      return aKey.localeCompare(bKey, undefined, { sensitivity: "base" });
    });
    return list;
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!searchTerm) {
      return sortedStudents;
    }
    const term = searchTerm.toLowerCase();
    return sortedStudents.filter((student) => {
      // Search in formatted name for better matching
      const formattedName = formatStudentDisplayName(student).toLowerCase();
      const nameMatch = formattedName.includes(term);
      const idMatch = student?.studentId?.toString().toLowerCase().includes(term);
      const gradeMatch = student?.grade?.toString().toLowerCase().includes(term);
      const sectionMatch = student?.section?.toLowerCase().includes(term);
      return Boolean(nameMatch || idMatch || gradeMatch || sectionMatch);
    });
  }, [sortedStudents, searchTerm]);

  const startIso = daysToDisplay[0]?.iso ?? null;
  const endIso = daysToDisplay[daysToDisplay.length - 1]?.iso ?? null;

  useEffect(() => {
    const controller = new AbortController();
    let isCancelled = false;

    const loadRemedialSchedule = async () => {
      try {
        const schoolYear = resolveDefaultSchoolYear();
        const response = await fetch(
          `/api/master_teacher/coordinator/calendar/remedial-schedule?school_year=${encodeURIComponent(schoolYear)}`,
          { cache: "no-store", signal: controller.signal },
        );

        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          schedule?: {
            schoolYear?: string | null;
            quarters?: Record<string, { startMonth: number | null; endMonth: number | null }> | null;
          } | null;
          error?: string | null;
        } | null;

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? "Failed to load remedial schedule.");
        }

        const quarters = payload?.schedule?.quarters ?? null;
        if (!quarters) {
          return;
        }

        const next = new Set<number>();
        for (const range of Object.values(quarters)) {
          const start = range?.startMonth ?? null;
          const end = range?.endMonth ?? null;
          if (!start || !end) continue;
          if (start > end) continue;
          for (let month = start; month <= end; month += 1) {
            if (month >= 1 && month <= 12) {
              next.add(month);
            }
          }
        }

        const filtered = new Set(Array.from(next).filter((month) => DEFAULT_SUPPORTED_MONTHS.has(month)));
        if (filtered.size === 0) {
          return;
        }

        if (!isCancelled) {
          setSupportedMonths(filtered);
          setSupportedMonthsLabel(formatMonthList(filtered));
        }
      } catch (error) {
        if (isCancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
      }
    };

    loadRemedialSchedule();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isCancelled = false;

    const loadWeeklySchedule = async () => {
      try {
        const response = await fetch("/api/principal/weekly-subject-schedule", {
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          schedule?: Record<string, string> | null;
        } | null;

        if (!response.ok || !payload?.success || !payload.schedule) {
          throw new Error("Failed to load weekly schedule.");
        }

        const next = new Set<string>();
        const subjectMatch = subjectLabel.trim().toLowerCase();

        for (const [weekday, subject] of Object.entries(payload.schedule)) {
          if (weekday === "startTime" || weekday === "endTime") {
            continue;
          }
          if (subject && subject.trim().toLowerCase() === subjectMatch) {
            next.add(weekday);
          }
        }

        if (!isCancelled) {
          setAllowedWeekdays(next);
        }
      } catch (error) {
        if (isCancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setAllowedWeekdays(new Set());
      }
    };

    loadWeeklySchedule();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [subjectLabel]);

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
    (studentId: number, iso: string, isSupported: boolean, isFuture: boolean) => {
      if (!isEditing || !isSupported || isFuture) {
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

  const goToPreviousDay = () => {
    setCurrentDate((prev) => moveOneWeekday(prev, "backward"));
  };

  const goToNextDay = () => {
    setCurrentDate((prev) => moveOneWeekday(prev, "forward"));
  };

  const handlePreviousRange = () => {
    if (view === "Month") {
      goToPreviousMonth();
    } else if (view === "Week") {
      goToPreviousWeek();
    } else {
      goToPreviousDay();
    }
  };

  const handleNextRange = () => {
    if (view === "Month") {
      goToNextMonth();
    } else if (view === "Week") {
      goToNextWeek();
    } else {
      goToNextDay();
    }
  };

  const currentMonthLabel = useMemo(() => {
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    return `${formatMonthAbbrev(month)} ${year}`;
  }, [currentDate]);

  const currentWeekLabel = useMemo(() => {
    if (!weekDays.length) {
      return "Week";
    }
    const first = weekDays[0];
    const last = weekDays[weekDays.length - 1];
    const year = currentDate.getFullYear();
    const month = formatMonthAbbrev(first.month);
    return `${month} ${first.day}-${last.day}, ${year}`;
  }, [currentDate, weekDays]);

  const currentDayLabel = useMemo(() => {
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    const year = currentDate.getFullYear();
    return `${formatMonthAbbrev(month)} ${day}, ${year}`;
  }, [currentDate]);

  const rows = useMemo(() => {
    return filteredStudents.map((student: any, index: number) => {
      const id = resolveStudentId(student, index + 1);
      const row: Record<string, any> = {
        id,
        no: index + 1,
        name: formatStudentDisplayName(student), // Display as "Surname, FirstName M.I."
        originalName: student.name, // Keep original for reference if needed
      };
      for (const day of daysToDisplay) {
        const key = buildKey(id, day.iso);
        const status = statusMap.get(key);
        row[day.key] = status ?? "unmarked";
      }
      return row;
    });
  }, [filteredStudents, daysToDisplay, statusMap]);
  const hasRows = rows.length > 0;

  const handleViewChange = useCallback((nextView: "Day" | "Week" | "Month") => {
    if (nextView === "Day") {
      setCurrentDate((prev) => adjustToWeekday(prev));
    }
    setView(nextView);
  }, []);

  const handleEnterEditMode = useCallback(() => {
    if (!canEnterEditMode) {
      setFeedback({ 
        type: "error", 
        message: "Cannot enter edit mode. No editable dates available in this view." 
      });
      return;
    }
    setFeedback(null);
    setIsEditing(true);
  }, [canEnterEditMode, setFeedback]);

  const handleExport = useCallback(async () => {
    if (!rows.length) {
      setFeedback({ type: "error", message: "No attendance records available to export." });
      return;
    }

    setIsExporting(true);
    try {
      const columns = [
        { header: "No#", accessor: (row: any) => row.no },
        { header: "Name", accessor: (row: any) => row.name }, // Uses formatted name
        ...daysToDisplay.map((day) => ({
          header: day.key,
          accessor: (row: any) => {
            const value = row[day.key];
            if (value === "present") {
              return "Present";
            }
            if (value === "absent") {
              return "Absent";
            }
            return "";
          },
        })),
      ];

      const safeSubject = subjectLabel.trim().length ? subjectLabel.trim() : "Attendance";
      const filenameBase = safeSubject.replace(/\s+/g, "_");
      const dateStamp = new Date().toISOString().split("T")[0];

      await exportRowsToExcel({
        rows,
        columns,
        filename: `${filenameBase}_${view}_Attendance_${dateStamp}.xlsx`,
        sheetName: `${safeSubject} Attendance`,
      });

      setFeedback({ type: "success", message: `${safeSubject} attendance exported to Excel.` });
    } catch (error) {
      console.error("Failed to export attendance", error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to export attendance.",
      });
    } finally {
      setIsExporting(false);
    }
  }, [daysToDisplay, rows, setFeedback, subjectLabel, view]);

  const handleMarkAllPresentToday = useCallback(() => {
    if (!canMarkAllPresentToday || !todayDayInfo) {
      return;
    }

    setStatusMap((prev) => {
      const next = new Map(prev);
      students.forEach((student: any, index: number) => {
        const id = resolveStudentId(student, index + 1);
        const key = buildKey(id, todayDayInfo.iso);
        next.set(key, "present");
      });
      return next;
    });
    setFeedback({
      type: "success",
      message: `Marked all students present for ${todayDayInfo.dayName} ${todayDayInfo.day}.`,
    });
  }, [canMarkAllPresentToday, setFeedback, students, todayDayInfo]);

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

      if (day.isFuture) {
        return (
          <div
            className={`w-8 h-8 rounded-md flex items-center justify-center ${className} opacity-50 cursor-not-allowed`}
            title="Cannot modify future dates"
          >
            {renderStatusIcon(displayStatus)}
          </div>
        );
      }

      return (
        <button
          type="button"
          onClick={() => toggleAttendance(row.id, day.iso, day.isSupported, day.isFuture)}
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
      { key: "name", title: "Name" }, // Will show "Surname, FirstName M.I."
      ...daysToDisplay.map((day) => ({
        key: day.key,
        title: day.key,
        render: (row: any) => renderAttendanceCell(row, day),
      })),
    ];
  }, [daysToDisplay, renderAttendanceCell]);

  return (
    <div>
      {/* Desktop Layout */}
      <div className="hidden md:flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePreviousRange}
            className="p-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
            type="button"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <SecondaryHeader title={view === "Month" ? currentMonthLabel : view === "Week" ? currentWeekLabel : currentDayLabel} />
          <button
            onClick={handleNextRange}
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
              onClick={() => handleViewChange("Day")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                view === "Day" ? "bg-white text-[#013300] shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("Week")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                view === "Week" ? "bg-white text-[#013300] shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("Month")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                view === "Month" ? "bg-white text-[#013300] shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Month
            </button>
          </div>

          {isEditing ? (
            <div className="flex gap-2 flex-wrap justify-end">
              <UtilityButton
                small
                onClick={handleMarkAllPresentToday}
                disabled={!canMarkAllPresentToday}
                title={
                  todayDayInfo?.isFuture
                    ? "Cannot mark attendance for future dates"
                    : todayDayInfo
                    ? `Mark every student as present for ${todayDayInfo.dayName} ${todayDayInfo.day}.`
                    : "Current day is not visible in this view."
                }
              >
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h6" />
                  </svg>
                  All Present (Today)
                </span>
              </UtilityButton>
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
            <KebabMenu
              small
              buttonAriaLabel="Attendance actions"
              renderItems={(close) => (
                <div className="py-1" role="none">
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
                      canEnterEditMode ? "text-[#013300] hover:bg-gray-50" : "text-gray-400 cursor-not-allowed"
                    }`}
                    disabled={!canEnterEditMode}
                    onClick={() => {
                      handleEnterEditMode();
                      close();
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Mode
                  </button>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
                      isExporting || !hasRows
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-[#013300] hover:bg-gray-50"
                    }`}
                    disabled={isExporting || !hasRows}
                    onClick={() => {
                      close();
                      void handleExport();
                    }}
                  >
                    {isExporting ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 1v4a8 8 0 100 16v-4l-3.5 3.5L12 23v-4a8 8 0 01-8-8z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
                      </svg>
                    )}
                    Export to Excel
                  </button>
                  <div className="relative group">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-left text-[#013300] hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
                      </svg>
                      Legend
                    </button>
                    <div className="absolute right-full top-0 mr-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="text-sm font-semibold text-gray-700 mb-2">Attendance Legend</div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gray-300 border border-gray-400" />
                          <span className="text-gray-700">Unmarked</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#013300] border border-green-700" />
                          <span className="text-gray-700">Present</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-600 border border-red-700" />
                          <span className="text-gray-700">Absent</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-gray-500">
                        Click cells to change status in Edit Mode
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                        Note: Future dates cannot be modified
                      </div>
                    </div>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Date navigation and title */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <button
            onClick={handlePreviousRange}
            className="p-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
            type="button"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <SecondaryHeader 
              title={view === "Month" ? currentMonthLabel : view === "Week" ? currentWeekLabel : currentDayLabel} 
            />
          </div>
          <button
            onClick={handleNextRange}
            className="p-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
            type="button"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Toggle + actions row */}
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => handleViewChange("Day")}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all text-center ${
                  view === "Day" ? "bg-white text-[#013300] shadow-sm" : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => handleViewChange("Week")}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all text-center ${
                  view === "Week" ? "bg-white text-[#013300] shadow-sm" : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => handleViewChange("Month")}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all text-center ${
                  view === "Month" ? "bg-white text-[#013300] shadow-sm" : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Month
              </button>
            </div>

            {!isEditing && (
              <div className="flex-shrink-0">
                <KebabMenu
                  small
                  buttonAriaLabel="Attendance actions"
                  renderItems={(close) => (
                    <div className="py-1" role="none">
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
                          canEnterEditMode ? "text-[#013300] hover:bg-gray-50" : "text-gray-400 cursor-not-allowed"
                        }`}
                        disabled={!canEnterEditMode}
                        onClick={() => {
                          handleEnterEditMode();
                          close();
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Mode
                      </button>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
                          isExporting || !hasRows
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-[#013300] hover:bg-gray-50"
                        }`}
                        disabled={isExporting || !hasRows}
                        onClick={() => {
                          close();
                          void handleExport();
                        }}
                      >
                        {isExporting ? (
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3.5-3.5L12 1v4a8 8 0 100 16v-4l-3.5 3.5L12 23v-4a8 8 0 01-8-8z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
                          </svg>
                        )}
                        Export to Excel
                      </button>
                      <div className="relative group">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-left text-[#013300] hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
                          </svg>
                          Legend
                        </button>
                        <div className="absolute left-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                          <div className="text-sm font-semibold text-gray-700 mb-2">Attendance Legend</div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-gray-300 border border-gray-400" />
                              <span className="text-gray-700">Unmarked</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-[#013300] border border-green-700" />
                              <span className="text-gray-700">Present</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-red-600 border border-red-700" />
                              <span className="text-gray-700">Absent</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-gray-500">
                            Click cells to change status in Edit Mode
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                            Note: Future dates cannot be modified
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                />
              </div>
            )}
          </div>

          {isEditing && (
            <div className="flex flex-wrap gap-2 justify-end">
              <UtilityButton
                small
                onClick={handleMarkAllPresentToday}
                disabled={!canMarkAllPresentToday}
                title={
                  todayDayInfo?.isFuture
                    ? "Cannot mark attendance for future dates"
                    : todayDayInfo
                    ? `Mark every student as present for ${todayDayInfo.dayName} ${todayDayInfo.day}.`
                    : "Current day is not visible in this view."
                }
              >
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  All Today
                </span>
              </UtilityButton>
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
          )}
        </div>
      </div>

      {!hasSupportedDays && (
        <p className="mb-3 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
          Attendance tracking is currently available for {supportedMonthsLabel || "the configured remedial period"}.
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

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading attendance records...</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px] [&_th]:py-2">
            <TableList columns={columns} data={rows} pageSize={10} />
          </div>
        </div>
      )}
    </div>
  );
}
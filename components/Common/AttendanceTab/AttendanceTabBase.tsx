"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TableList from "@/components/Common/Tables/TableList";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import { exportRowsToExcel } from "@/lib/utils/export-to-excel";
import type { SubjectKey } from "@/modules/MasterTeacher/RemedialTeacher/report/types";
import { Printer } from "lucide-react";

const DEFAULT_SUPPORTED_MONTHS = new Set<number>();

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
  attendanceApiBase?: string;
  uiVariant?: "default" | "remedial";
};

const buildKey = (studentId: string | number, iso: string) => `${studentId}|${iso}`;

const resolveStudentId = (student: any, fallback: number) => {
  const rawId = student?.studentId ?? student?.id ?? fallback;
  return String(rawId ?? "").trim() || String(fallback);
};

// Helper function to capitalize words
const capitalizeWord = (value: string) => {
  if (!value) {
    return "";
  }

  const normalizePart = (part: string) => {
    if (!part) return "";
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  };

  return value
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((segment) =>
          segment
            .split("'")
            .map((piece) => normalizePart(piece))
            .join("'"),
        )
        .join("-"),
    )
    .join(" ");
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

export default function AttendanceTabBase({
  subjectKey,
  subjectLabel,
  students,
  searchTerm,
  attendanceApiBase = "/api/master_teacher/remedial/attendance",
  uiVariant = "default",
}: AttendanceTabBaseProps) {
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
  const [isPrinting, setIsPrinting] = useState(false);
  const [supportedMonths, setSupportedMonths] = useState<Set<number>>(DEFAULT_SUPPORTED_MONTHS);
  const [supportedMonthsLabel, setSupportedMonthsLabel] = useState<string>(() => formatMonthList(DEFAULT_SUPPORTED_MONTHS));
  const [allowedWeekdays, setAllowedWeekdays] = useState<Set<string> | null>(null);
  const isRemedialEnhanced = uiVariant === "remedial";

  useEffect(() => {
    if (!feedback || feedback.type !== "success") {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      setFeedback(null);
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const studentIds = useMemo(() => {
    const ids: string[] = [];
    for (const student of students) {
      const raw = student?.studentId ?? student?.id;
      if (raw === null || raw === undefined) continue;
      const text = String(raw).trim();
      if (text) ids.push(text);
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

  const fetchAttendance = useCallback(
    async (signal?: AbortSignal) => {
      if (!studentIds.length || !startIso || !endIso) {
        setStatusMap(new Map());
        setBaselineMap(new Map());
        return;
      }

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

        const response = await fetch(`${attendanceApiBase}?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal,
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.success || !Array.isArray(payload.records)) {
          throw new Error(payload?.error ?? "Failed to load attendance records.");
        }

        if (signal?.aborted) {
          return;
        }

        const nextMap = new Map<string, AttendanceStatus>();
        for (const record of payload.records as Array<{ studentId: string | number; date: string; present: "Yes" | "No" }>) {
          const key = buildKey(String(record.studentId), record.date);
          nextMap.set(key, record.present === "Yes" ? "present" : "absent");
        }

        setBaselineMap(new Map(nextMap));
        setStatusMap(new Map(nextMap));
      } catch (error) {
        if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        console.error("Failed to load attendance records", error);
        setBaselineMap(new Map());
        setStatusMap(new Map());
        setLoadError(error instanceof Error ? error.message : "Failed to load attendance records.");
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [attendanceApiBase, endIso, startIso, studentIds, subjectKey],
  );

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
          if (start <= end) {
            for (let month = start; month <= end; month += 1) {
              if (month >= 1 && month <= 12) {
                next.add(month);
              }
            }
          } else {
            for (let month = start; month <= 12; month += 1) {
              next.add(month);
            }
            for (let month = 1; month <= end; month += 1) {
              next.add(month);
            }
          }
        }

        if (next.size === 0) {
          return;
        }

        if (!isCancelled) {
          setSupportedMonths(next);
          setSupportedMonthsLabel(formatMonthList(next));
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

    const controller = new AbortController();
    void fetchAttendance(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchAttendance, isEditing, studentsKey]);

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

    const changes: Array<{ studentId: string; date: string; present: "Yes" | "No" | null }> = [];
    const allKeys = new Set<string>([...baselineMap.keys(), ...statusMap.keys()]);

    for (const key of allKeys) {
      const previous = baselineMap.get(key);
      const current = statusMap.get(key);
      if (previous === current) {
        continue;
      }
      const [studentIdPart, iso] = key.split("|");
      const studentId = String(studentIdPart ?? "").trim();
      if (!studentId) {
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
      console.log("Saving changes:", {
        subject: subjectKey,
        entries: changes.map((entry) => ({
          studentId: entry.studentId,
          date: entry.date,
          present: entry.present,
        })),
      });

      const response = await fetch(attendanceApiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subjectKey, entries: changes }),
      });

      const responseText = await response.text();
      console.log("Raw response:", responseText);

      let payload: any = null;
      try {
        payload = responseText ? JSON.parse(responseText) : null;
      } catch (parseError) {
        console.error("Failed to parse response:", parseError);
        throw new Error(
          `Invalid JSON response: ${responseText.substring(0, 100)}...`,
        );
      }

      if (!response.ok || !payload?.success) {
        const errorMessage = payload?.error
          ? `${payload.error}${payload.code ? ` (Code: ${payload.code})` : ""}`
          : `HTTP ${response.status}: ${response.statusText}`;

        console.error("Backend error details:", payload);
        throw new Error(errorMessage);
      }

      setBaselineMap(new Map(statusMap));
      setIsEditing(false);

      await fetchAttendance();

      const successMessage = `Attendance saved: ${payload.updated ?? changes.length} records updated.`;
      setFeedback({
        type: "success",
        message: payload.reason ? `${successMessage} ${payload.reason}` : successMessage,
      });
    } catch (error) {
      console.error("Failed to save attendance", error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save attendance.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [attendanceApiBase, baselineMap, isEditing, statusMap, subjectKey, fetchAttendance]);

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

  const activeRangeLabel = useMemo(() => {
    if (view === "Month") return currentMonthLabel;
    if (view === "Week") return currentWeekLabel;
    return currentDayLabel;
  }, [currentDayLabel, currentMonthLabel, currentWeekLabel, view]);

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

  const handlePrintAttendance = useCallback(() => {
    if (!rows.length) {
      setFeedback({ type: "error", message: "No attendance records available to print." });
      return;
    }

    setIsPrinting(true);
    try {
      const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1280,height=860");
      if (!printWindow) {
        throw new Error("Unable to open print preview. Please allow pop-ups and try again.");
      }

      const escapeHtml = (value: string) =>
        value
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");

      const printableStatus = (value: unknown): string => {
        if (value === "present") return "Present";
        if (value === "absent") return "Absent";
        return "--";
      };

      const headers = daysToDisplay
        .map((day) => `<th>${escapeHtml(day.key)}</th>`)
        .join("");

      const bodyRows = rows
        .map((row: any) => {
          const cells = daysToDisplay
            .map((day) => `<td>${escapeHtml(printableStatus(row[day.key]))}</td>`)
            .join("");
          return `<tr><td>${row.no}</td><td>${escapeHtml(String(row.name ?? ""))}</td>${cells}</tr>`;
        })
        .join("");

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(subjectLabel)} Attendance Print</title>
  <style>
    @page { size: landscape; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
    .print-wrap { padding: 8px 10px; }
    .header { margin-bottom: 10px; }
    .title { font-size: 20px; font-weight: 700; color: #013300; margin: 0 0 4px 0; }
    .meta { font-size: 12px; color: #374151; display: flex; gap: 14px; flex-wrap: wrap; }
    .legend { margin: 8px 0 10px; font-size: 12px; color: #374151; }
    .legend span { margin-right: 12px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #d1d5db; padding: 6px 4px; font-size: 11px; text-align: center; }
    th:nth-child(2), td:nth-child(2) { text-align: left; width: 220px; }
    th:first-child, td:first-child { width: 48px; }
    th { background: #f3f4f6; font-weight: 700; }
  </style>
</head>
<body>
  <div class="print-wrap">
    <div class="header">
      <h1 class="title">${escapeHtml(subjectLabel)} Attendance</h1>
      <div class="meta">
        <span><strong>View:</strong> ${escapeHtml(view)}</span>
        <span><strong>Range:</strong> ${escapeHtml(activeRangeLabel)}</span>
        <span><strong>Printed:</strong> ${escapeHtml(new Date().toLocaleString())}</span>
      </div>
      <div class="legend">
        <span><strong>Present:</strong> Present</span>
        <span><strong>Absent:</strong> Absent</span>
        <span><strong>Unmarked:</strong> --</span>
      </div>
    </div>
    <table>
      <thead>
        <tr><th>No#</th><th>Name</th>${headers}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  </div>
</body>
</html>`;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to prepare attendance print.",
      });
    } finally {
      setIsPrinting(false);
    }
  }, [activeRangeLabel, daysToDisplay, rows, setFeedback, subjectLabel, view]);

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
    <div className="w-full">
      <div className="mb-3 space-y-2.5 rounded-xl border border-gray-200 bg-white/80 p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SecondaryHeader title={activeRangeLabel} />
          <div className="ml-auto flex items-center justify-end gap-1.5 whitespace-nowrap overflow-x-auto">
            <span className="pr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">Legend</span>
            <span className="inline-flex h-7 items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 text-[11px] text-gray-700">
              <span className="inline-block h-2 w-2 rounded-full border border-gray-400 bg-gray-300" />
              Unmarked
            </span>
            <span className="inline-flex h-7 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[11px] text-emerald-800">
              <span className="inline-block h-2 w-2 rounded-full bg-[#013300]" />
              Present
            </span>
            <span className="inline-flex h-7 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 text-[11px] text-red-700">
              <span className="inline-block h-2 w-2 rounded-full bg-red-600" />
              Absent
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2.5 border-t border-gray-100 pt-2.5">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePreviousRange}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 shadow-xs transition-colors hover:bg-gray-50"
              type="button"
              aria-label="Previous range"
              title="Previous range"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNextRange}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 shadow-xs transition-colors hover:bg-gray-50"
              type="button"
              aria-label="Next range"
              title="Next range"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex h-9 items-center rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => handleViewChange("Day")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                view === "Day" ? "bg-white text-[#013300] shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("Week")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                view === "Week" ? "bg-white text-[#013300] shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("Month")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                view === "Month" ? "bg-white text-[#013300] shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Month
            </button>
          </div>

          <div className="ml-auto flex min-w-60 flex-col items-end gap-1.5">

            {!isEditing ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {isRemedialEnhanced ? (
                  <button
                    type="button"
                    onClick={handlePrintAttendance}
                    disabled={isPrinting || !hasRows}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 ${
                      isPrinting || !hasRows ? "cursor-not-allowed opacity-60" : ""
                    }`}
                    aria-label="Print attendance"
                    title={isPrinting ? "Preparing..." : "Print Attendance"}
                  >
                    <Printer className="h-4.5 w-4.5" />
                  </button>
                ) : (
                  <SecondaryButton
                    small
                    onClick={() => void handleExport()}
                    disabled={isExporting || !hasRows}
                    className="h-10 rounded-full border border-gray-200 bg-white px-4 font-semibold text-gray-700 shadow-sm hover:bg-gray-100"
                  >
                    <span className="flex items-center gap-1">
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
                      Export
                    </span>
                  </SecondaryButton>
                )}

                <button
                  type="button"
                  onClick={handleEnterEditMode}
                  disabled={!canEnterEditMode}
                  className={`inline-flex h-10 items-center gap-2 rounded-full border-2 border-[#013300] bg-[#013300] px-4 text-sm font-semibold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                    !canEnterEditMode ? "cursor-not-allowed opacity-60" : "hover:border-green-900 hover:bg-green-900"
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Attendance
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {isEditing ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
            <div className="inline-flex h-8 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-800">
              <span>Editing mode</span>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className={`inline-flex h-10 items-center gap-1 rounded-full border border-red-600 px-4 text-sm font-semibold shadow-sm transition ${
                  isSaving
                    ? "cursor-not-allowed bg-red-400 text-white/80 opacity-70"
                    : "bg-red-600 text-white hover:border-red-700 hover:bg-red-700"
                }`}
              >
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </span>
              </button>

              <button
                type="button"
                onClick={handleMarkAllPresentToday}
                disabled={!canMarkAllPresentToday}
                title={
                  todayDayInfo?.isFuture
                    ? "Cannot mark attendance for future dates"
                    : todayDayInfo
                    ? `Mark every student as present for ${todayDayInfo.dayName} ${todayDayInfo.day}.`
                    : "Current day is not visible in this view."
                }
                className={`inline-flex h-10 items-center gap-2 rounded-full border border-emerald-700 bg-white px-4 text-sm font-semibold text-emerald-800 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                  !canMarkAllPresentToday ? "cursor-not-allowed opacity-60" : "hover:bg-emerald-50"
                }`}
              >
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h6" />
                  </svg>
                  Mark All as &quot;Present&quot;
                </span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={`inline-flex h-10 items-center gap-2 rounded-full border-2 border-[#013300] bg-[#013300] px-4 text-sm font-semibold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                  isSaving ? "cursor-not-allowed opacity-60" : "hover:border-green-900 hover:bg-green-900"
                }`}
              >
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
              </button>
            </div>
          </div>
        ) : null}
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
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white/90">
          <div className="min-w-245 [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-green-50 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_td]:align-middle [&_tr:hover]:bg-emerald-50/40 [&_th:nth-child(2)]:sticky [&_th:nth-child(2)]:left-14 [&_th:nth-child(2)]:z-30 [&_th:nth-child(2)]:bg-green-50 [&_td:nth-child(2)]:sticky [&_td:nth-child(2)]:left-14 [&_td:nth-child(2)]:z-10 [&_td:nth-child(2)]:bg-white [&_td:nth-child(2)]:font-medium">
            <TableList columns={columns} data={rows} pageSize={10} hidePagination bodyCellPaddingYClass="py-3" />
          </div>
        </div>
      )}
    </div>
  );
}
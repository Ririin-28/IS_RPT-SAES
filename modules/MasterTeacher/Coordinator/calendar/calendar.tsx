"use client";
import Sidebar from "@/components/MasterTeacher/Coordinator/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useForm } from "react-hook-form";
// Button Components
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import Toast from "@/components/Toast";
import ToastActivity from "@/components/ToastActivity";
// Modal Components
import AddScheduleModal from "./Modals/AddScheduleModal";
import ActivityDetailModal from "./Modals/ActivityDetailModal";
import DeleteConfirmationModal from "./Modals/DeleteConfirmationModal";
import WeeklyScheduleModal, { WEEKDAY_ORDER, WeeklyScheduleFormData, Weekday } from "./Modals/WeeklyScheduleModal";
import SendActivitiesModal from "./Modals/SendActivitiesModal";
import { getStoredUserProfile, StoredUserProfile } from "@/lib/utils/user-profile";
import * as XLSX from "xlsx";

interface Activity {
  id: number;
  title: string;
  day: string;
  date: Date;
  end: Date;
  type: string;
  gradeLevel?: string;
  subject?: string;
  isWeeklyTemplate?: boolean;
  weekRef?: string | null;
  status?: string | null;
  planBatchId?: string | null;
  requestedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  sourceTable?: string | null;
  requester?: string | null;
}

type ActivityTone = {
  backgroundClass: string;
  borderClass: string;
  titleClass: string;
  accentColor: string;
};

type CalendarFormValues = {
  title: string;
  date: string;
  teachers: string[];
  subject: string;
};

const FALLBACK_GRADE_LEVEL = "3";

interface RemedialScheduleWindow {
  quarter: string | null;
  startDate: string;
  endDate: string;
  active: boolean;
}

type WeeklySubjectSchedule = Record<Weekday, string> & {
  startTime?: string;
  endTime?: string;
};

const SUBJECT_DAY_LABELS: Record<Weekday, string> = {
  Monday: "M",
  Tuesday: "T",
  Wednesday: "W",
  Thursday: "Th",
  Friday: "F",
};

const SUBJECT_SYNONYM_MAP: Record<string, string> = {
  english: "English",
  math: "Math",
  mathematics: "Math",
  filipino: "Filipino",
  science: "Science",
  "araling panlipunan": "Araling Panlipunan",
  ap: "Araling Panlipunan",
  mapeh: "MAPEH",
  values: "Values Education",
  "values education": "Values Education",
  ede: "Values Education",
};

const normalizeStatusLabel = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.toLowerCase();
  if (["1", "approved", "accept", "accepted", "granted", "true", "yes", "ok"].includes(normalized)) {
    return "Approved";
  }
  if (["0", "pending", "awaiting", "submitted", "for approval", "waiting"].includes(normalized)) {
    return "Pending";
  }
  if (["rejected", "declined", "denied", "cancelled", "canceled", "void"].includes(normalized)) {
    return "Declined";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const isActivityLocked = (activity: Activity | null | undefined): boolean => {
  if (!activity?.status) {
    return false;
  }
  const normalized = normalizeStatusLabel(activity.status);
  if (normalized) {
    return normalized === "Approved";
  }
  return String(activity.status).toLowerCase().includes("approve");
};

const STATUS_TONE_OVERRIDES: Record<string, ActivityTone> = {
  Approved: {
    backgroundClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
    titleClass: "text-emerald-900",
    accentColor: "#059669",
  },
  Pending: {
    backgroundClass: "bg-amber-50",
    borderClass: "border-amber-200",
    titleClass: "text-amber-900",
    accentColor: "#D97706",
  },
  Declined: {
    backgroundClass: "bg-red-50",
    borderClass: "border-red-200",
    titleClass: "text-red-900",
    accentColor: "#DC2626",
  },
};

const statusBadgeTone = (status: string | null | undefined) => {
  const normalized = normalizeStatusLabel(status);
  if (!normalized) {
    return "bg-gray-100 text-gray-600 border border-gray-300";
  }
  if (normalized === "Approved") {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  }
  if (normalized === "Declined") {
    return "bg-red-100 text-red-700 border border-red-200";
  }
  if (normalized === "Pending") {
    return "bg-amber-100 text-amber-800 border border-amber-200";
  }
  return "bg-blue-100 text-blue-800 border border-blue-200";
};

const getSubjectChipTone = (subject: string | null | undefined) => {
  const value = subject?.toLowerCase() ?? "";
  if (value.includes("english")) return "bg-emerald-700 text-white border-emerald-700";
  if (value.includes("filipino")) return "bg-blue-700 text-white border-blue-700";
  if (value.includes("math")) return "bg-rose-700 text-white border-rose-700";
  if (value.includes("assessment")) return "bg-amber-700 text-white border-amber-700";
  return "bg-gray-700 text-white border-gray-700";
};

const resolveActivitySubject = (title: string | null | undefined, subject: string | null | undefined) => {
  const text = `${title ?? ""}`.toLowerCase();
  if (text.includes("english")) return "english";
  if (text.includes("filipino")) return "filipino";
  if (text.includes("math")) return "math";
  if (text.includes("assessment")) return "assessment";
  return subject ?? null;
};

const resolveStatusToneOverride = (status: string | null | undefined): ActivityTone | null => {
  const normalized = normalizeStatusLabel(status);
  if (!normalized) {
    return null;
  }
  return STATUS_TONE_OVERRIDES[normalized] ?? null;
};

const normalizeSubjectValue = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed
    .replace(/\b(coordinator|subject|subjects|teacher|handled)\b/gi, "")
    .replace(/\bgrade\s*\d+\b/gi, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  const lower = cleaned.toLowerCase();
  const synonym = SUBJECT_SYNONYM_MAP[lower];
  if (synonym) {
    return synonym;
  }

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ")
    .trim();
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
  const schedule = {} as WeeklySubjectSchedule;
  const record = value as Record<string, unknown> | null;
  for (const day of WEEKDAY_ORDER) {
    const raw = record?.[day];
    schedule[day] = typeof raw === "string" ? raw.trim() : "";
  }
  schedule.startTime = normalizeScheduleTime(record?.startTime);
  schedule.endTime = normalizeScheduleTime(record?.endTime);
  return schedule;
};

const deriveAllowedSubjects = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }

  const normalized = raw
    .replace(/\band\b/gi, ",")
    .replace(/&/g, ",")
    .replace(/\//g, ",")
    .replace(/\+/g, ",")
    .replace(/;/g, ",")
    .replace(/\s+/g, " ");

  const unique = new Set<string>();
  for (const segment of normalized.split(",")) {
    const subject = normalizeSubjectValue(segment);
    if (subject) {
      unique.add(subject);
    }
  }

  return Array.from(unique);
};

const sanitizeSubjectSelection = (input: string | null | undefined, allowedSubjects: string[]): string | null => {
  if (allowedSubjects.length === 0) {
    return null;
  }

  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) {
    return allowedSubjects[0] ?? null;
  }

  const match = allowedSubjects.find((subject) => subject.toLowerCase() === raw.toLowerCase());
  if (match) {
    return match;
  }

  const derived = deriveAllowedSubjects(raw);
  for (const candidate of derived) {
    const intersection = allowedSubjects.find((subject) => subject.toLowerCase() === candidate.toLowerCase());
    if (intersection) {
      return intersection;
    }
  }

  return allowedSubjects[0] ?? null;
};

const parseDateInput = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const createDateWithTime = (baseDate: Date, time: string): Date => {
  const [hour, minute] = time.split(":").map(Number);
  const result = new Date(baseDate);
  result.setHours(hour, minute, 0, 0);
  return result;
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

const formatMonthRangeShort = (start: Date | null, end: Date | null): string => {
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "--";
  }
  const startLabel = start.toLocaleDateString("en-US", { month: "short" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short" });
  if (startLabel === endLabel) {
    return startLabel;
  }
  return `${startLabel}-${endLabel}`;
};

const parseTimestamp = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const primary = new Date(trimmed);
  if (!Number.isNaN(primary.getTime())) {
    return primary;
  }
  const normalized = trimmed.replace(/\s/, "T");
  const fallback = new Date(normalized);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }
  return null;
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

const buildQuarterRange = (
  schoolYear: string,
  startMonth: number | null | undefined,
  endMonth: number | null | undefined,
): { start: Date; end: Date } | null => {
  if (!startMonth || !endMonth) return null;
  const startYear = yearForMonth(schoolYear, startMonth);
  const endYear = yearForMonth(schoolYear, endMonth);
  if (!startYear || !endYear) return null;

  const start = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, endMonth, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const formatDateOnly = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveDefaultSchoolYear = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  return month >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const formatApprovalMetadata = (
  approvedAt: string | null | undefined,
  approvedBy: string | null | undefined,
): string | null => {
  const approvedDate = parseTimestamp(approvedAt ?? null);
  const approvedLabel = approvedDate
    ? approvedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  if (approvedLabel && approvedBy) {
    return `${approvedLabel} • ${approvedBy}`;
  }

  if (approvedLabel) {
    return approvedLabel;
  }

  if (approvedBy && approvedBy.trim().length > 0) {
    return approvedBy.trim();
  }

  return null;
};

const formatLongDate = (date: Date): string =>
  date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const buildWeekKey = (gradeLevel: string, weekStart: string) => `${gradeLevel}-${weekStart}`;

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

const deriveGradeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).toLowerCase();
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

const normalizeGradeLabel = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  if (trimmed.length === 0) {
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

const getSubjectColor = (subject: string | null | undefined) => {
  const value = subject?.toLowerCase() ?? "";
  if (value.includes("english")) return "border-emerald-200 bg-emerald-50";
  if (value.includes("filipino")) return "border-blue-200 bg-blue-100";
  if (value.includes("math")) return "border-rose-200 bg-rose-100";
  if (value.includes("assessment")) return "border-amber-200 bg-amber-100";
  return "border-gray-100";
};

const buildStoredProfileName = (profile: StoredUserProfile | null, fallback: string | null): string | null => {
  if (profile) {
    const parts: string[] = [];
    const first = typeof profile.firstName === "string" ? profile.firstName.trim() : "";
    const middle = typeof profile.middleName === "string" ? profile.middleName.trim() : "";
    const last = typeof profile.lastName === "string" ? profile.lastName.trim() : "";
    if (first) {
      parts.push(first);
    }
    if (middle) {
      parts.push(`${middle.charAt(0).toUpperCase()}.`);
    }
    if (last) {
      parts.push(last);
    }
    if (parts.length > 0) {
      return parts.join(" ").trim();
    }
  }

  if (fallback && fallback.trim().length > 0) {
    return fallback.trim();
  }

  return null;
};

const normalizeDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const isWeekendDate = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

export default function MasterTeacherCalendar() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleFormData | null>(null);

  // React Hook Form setup
  const formMethods = useForm<CalendarFormValues>({
    defaultValues: {
      title: "",
      date: "",
      teachers: [],
      subject: "",
    },
  });
  const { reset, setValue, setError, clearErrors } = formMethods;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [gradeLevel, setGradeLevel] = useState<string | null>(null);
  const [coordinatorSubject, setCoordinatorSubject] = useState<string | null>(null);
  const [allowedSubjects, setAllowedSubjects] = useState<string[]>([]);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [coordinatorName, setCoordinatorName] = useState<string | null>(null);
  const [coordinatorUserId, setCoordinatorUserId] = useState<number | null>(null);
  const [remedialWindow, setRemedialWindow] = useState<RemedialScheduleWindow | null>(null);
  const [remedialWindowLoading, setRemedialWindowLoading] = useState<boolean>(true);
  const [remedialWindowError, setRemedialWindowError] = useState<string | null>(null);
  const [remedialGuardMessage, setRemedialGuardMessage] = useState<string | null>(null);
  const [weeklySubjectSchedule, setWeeklySubjectSchedule] = useState<WeeklySubjectSchedule | null>(null);
  const [weeklySubjectScheduleLoading, setWeeklySubjectScheduleLoading] = useState<boolean>(true);
  const [weeklySubjectScheduleError, setWeeklySubjectScheduleError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "info" | "error" } | null>(null);
  const [importActionToast, setImportActionToast] = useState<string | null>(null);
  const [pendingImportIds, setPendingImportIds] = useState<number[]>([]);
  const [activityToast, setActivityToast] = useState<{ message: string; tone: "success" | "info" | "error" } | null>(null);

  const scheduleRange = useMemo(() => {
    if (!remedialWindow?.startDate || !remedialWindow?.endDate) {
      return null;
    }
    const start = new Date(`${remedialWindow.startDate}T00:00:00`);
    const end = new Date(`${remedialWindow.endDate}T23:59:59`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end } as const;
  }, [remedialWindow?.startDate, remedialWindow?.endDate]);

  const remedialWindowStatus = useMemo(() => {
    if (!scheduleRange || !remedialWindow?.active) {
      return "inactive" as const;
    }
    const now = new Date();
    if (now < scheduleRange.start) {
      return "upcoming" as const;
    }
    if (now > scheduleRange.end) {
      return "completed" as const;
    }
    return "active" as const;
  }, [scheduleRange, remedialWindow?.active]);

  const subjectScheduleConfigured = useMemo(() => {
    if (!weeklySubjectSchedule) {
      return false;
    }
    return WEEKDAY_ORDER.some((day) => (weeklySubjectSchedule[day] ?? "").trim().length > 0);
  }, [weeklySubjectSchedule]);

  const hasActiveRemedialWindow = remedialWindowStatus === "active";

  const showToast = useCallback(
    (message: string, tone: "success" | "info" | "error" = "success") => {
      const trimmed = message.trim();
      if (!trimmed) {
        return;
      }
      setToast({ message: trimmed, tone });
    },
    [],
  );

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!activityToast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setActivityToast(null);
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [activityToast]);

  const handleDeclineImportedActivities = useCallback(() => {
    if (!pendingImportIds.length) {
      setImportActionToast(null);
      return;
    }

    setActivities((prev) => prev.filter((activity) => !pendingImportIds.includes(activity.id)));
    setPendingImportIds([]);
    setImportActionToast(null);
    setActivityToast({ message: "Imported activities were removed.", tone: "info" });
  }, [pendingImportIds, showToast]);

  const scheduleWindowLabel = useMemo(() => {
    if (!scheduleRange) {
      return null;
    }
    const startLabel = scheduleRange.start.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const endLabel = scheduleRange.end.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return `${startLabel} – ${endLabel}`;
  }, [scheduleRange]);

  const gradeLabel = gradeLevel ?? FALLBACK_GRADE_LEVEL;
  const hasAssignedGrade = Boolean(gradeLevel);
  const canPlanActivities =
    hasAssignedGrade &&
    !profileLoading &&
    !profileError &&
    allowedSubjects.length > 0 &&
    hasActiveRemedialWindow;
  const missingAssignments: string[] = [];
  if (!hasAssignedGrade) {
    missingAssignments.push("grade level");
  }
  if (allowedSubjects.length === 0) {
    missingAssignments.push("coordinator subject");
  }
  const schedulingLocked = !profileLoading && !profileError && missingAssignments.length > 0;
  const assignmentsDescription =
    missingAssignments.length > 1
      ? `${missingAssignments.slice(0, -1).join(", ")} and ${missingAssignments[missingAssignments.length - 1]}`
      : missingAssignments[0] ?? "";

  const scheduleBlockingReason = useMemo(() => {
    if (remedialWindowLoading) {
      return null;
    }
    if (hasActiveRemedialWindow) {
      return null;
    }
    if (!remedialWindow) {
      return "Waiting for the principal to enable a remedial period.";
    }
    if (remedialWindowStatus === "upcoming" && scheduleWindowLabel) {
      const [startLabel] = scheduleWindowLabel.split(" – ");
      return `Remedial window starts on ${startLabel}.`;
    }
    if (remedialWindowStatus === "completed" && scheduleWindowLabel) {
      const [, endLabel] = scheduleWindowLabel.split(" – ");
      return `The last remedial window ended on ${endLabel ?? scheduleWindowLabel}.`;
    }
    return "The configured remedial window is not active.";
  }, [hasActiveRemedialWindow, remedialWindowLoading, remedialWindow, remedialWindowStatus, scheduleWindowLabel]);

  const hasApprovedConflict = useCallback(
    (date: Date, subjectValue: string | null, gradeValue: string | null) => {
      const targetDate = normalizeDateKey(date);
      const targetSubject = (subjectValue ?? "").toLowerCase().trim();
      const targetGrade = normalizeGradeLabel(gradeValue ?? null);

      return activities.some((activity) => {
        if (!activity.status || normalizeStatusLabel(activity.status) !== "Approved") {
          return false;
        }
        const activityDate = normalizeDateKey(activity.date);
        if (activityDate !== targetDate) {
          return false;
        }
        const activitySubject = (activity.subject ?? "").toLowerCase().trim();
        if (targetSubject && activitySubject && activitySubject !== targetSubject) {
          return false;
        }
        const activityGrade = normalizeGradeLabel(activity.gradeLevel ?? null);
        if (targetGrade && activityGrade && activityGrade !== targetGrade) {
          return false;
        }
        return true;
      });
    },
    [activities],
  );

  const remedialStatusBanner = useMemo(() => {
    if (remedialWindowError) {
      return null;
    }

    if (remedialWindowStatus === "active") {
      const subjectDescriptor =
        allowedSubjects.length === 1
          ? allowedSubjects[0]
          : allowedSubjects.length > 1
          ? `${allowedSubjects.length} assigned subjects`
          : "your assigned subjects";
      return {
        tone: "success" as const,
        message: scheduleWindowLabel
          ? `Principal enabled the remedial window (${scheduleWindowLabel}). Plan ${gradeLabel} activities for ${subjectDescriptor}.`
          : "Principal enabled the remedial window. Plan your remediation activities.",
      };
    }

    if (remedialWindowStatus === "upcoming") {
      const [startLabel] = (scheduleWindowLabel ?? "").split(" – ");
      return {
        tone: "info" as const,
        message: startLabel
          ? `Remedial window starts on ${startLabel}. Scheduling opens once it is active.`
          : "Remedial window will start soon. Scheduling opens once it is active.",
      };
    }

    if (remedialWindowStatus === "completed") {
      const [, endLabel] = (scheduleWindowLabel ?? "").split(" – ");
      return {
        tone: "info" as const,
        message: endLabel
          ? `Last remedial window ended on ${endLabel}. Await the principal's next activation.`
          : "The previous remedial window has ended. Await the principal's next activation.",
      };
    }

    if (!remedialWindowLoading) {
      return {
        tone: "info" as const,
        message: "Awaiting a remedial window from the principal.",
      };
    }

    return null;
  }, [allowedSubjects, gradeLabel, remedialWindowError, remedialWindowLoading, remedialWindowStatus, scheduleWindowLabel]);

  useEffect(() => {
    if (hasActiveRemedialWindow) {
      setRemedialGuardMessage(null);
    }
  }, [hasActiveRemedialWindow]);

  const loadWeeklySubjectSchedule = useCallback(async () => {
    setWeeklySubjectScheduleLoading(true);
    setWeeklySubjectScheduleError(null);
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
      const message = error instanceof Error ? error.message : "Unable to load the weekly subject schedule.";
      console.warn("Failed to load weekly subject schedule", error);
      setWeeklySubjectSchedule(null);
      setWeeklySubjectScheduleError(message);
    } finally {
      setWeeklySubjectScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeeklySubjectSchedule();
  }, [loadWeeklySubjectSchedule]);

  const loadRemedialWindow = useCallback(async () => {
    setRemedialWindowLoading(true);
    setRemedialWindowError(null);
    try {
      const response = await fetch("/api/master_teacher/coordinator/calendar/remedial-schedule", { cache: "no-store" });
      if (response.status === 404) {
        setRemedialWindow(null);
        return;
      }
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as {
        success: boolean;
        schedule:
          | { quarter: string | null; startDate: string | null; endDate: string | null; active?: boolean | null }
          | { schoolYear?: string | null; quarters?: Record<string, { startMonth: number | null; endMonth: number | null }> | null }
          | null;
      };
      if (!payload.success) {
        throw new Error("Server indicated failure.");
      }
      const schedule = payload.schedule;
      if (schedule && "startDate" in schedule && schedule.startDate && schedule.endDate) {
        setRemedialWindow({
          quarter: schedule.quarter ?? null,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          active: schedule.active !== false,
        });
        return;
      }

      if (schedule && "quarters" in schedule && schedule.quarters) {
        const schoolYear = schedule.schoolYear ?? resolveDefaultSchoolYear();
        const quarterEntries = Object.entries(schedule.quarters)
          .map(([label, range]) => {
            const window = buildQuarterRange(schoolYear, range?.startMonth ?? null, range?.endMonth ?? null);
            if (!window) return null;
            return { label, start: window.start, end: window.end };
          })
          .filter((entry): entry is { label: string; start: Date; end: Date } => Boolean(entry));

        if (quarterEntries.length > 0) {
          const today = new Date();
          let selected = quarterEntries.find((entry) => today >= entry.start && today <= entry.end) ?? null;
          if (!selected) {
            const upcoming = quarterEntries
              .filter((entry) => entry.start > today)
              .sort((a, b) => a.start.getTime() - b.start.getTime());
            selected = upcoming[0] ?? quarterEntries.sort((a, b) => b.end.getTime() - a.end.getTime())[0] ?? null;
          }

          if (selected) {
            setRemedialWindow({
              quarter: selected.label,
              startDate: formatDateOnly(selected.start),
              endDate: formatDateOnly(selected.end),
              active: true,
            });
            return;
          }
        }
      }

      setRemedialWindow(null);
    } catch (error) {
      console.error("Failed to load remedial window", error);
      setRemedialWindowError("Unable to load the remedial window. Try refreshing the page.");
    } finally {
      setRemedialWindowLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRemedialWindow();
  }, [loadRemedialWindow]);

  useEffect(() => {
    if (allowedSubjects.length > 0) {
      setValue("subject", allowedSubjects[0], { shouldValidate: false, shouldDirty: false });
      clearErrors("subject");
    } else {
      setValue("subject", "", { shouldValidate: false, shouldDirty: false });
    }
  }, [allowedSubjects, setValue, clearErrors]);

  useEffect(() => {
    const profile = getStoredUserProfile();
    if (!profile?.userId) {
      setProfileError("Coordinator profile is unavailable. Please sign in again.");
      setProfileLoading(false);
      return;
    }

    const parsedUserId = Number(profile.userId);
    setCoordinatorUserId(Number.isFinite(parsedUserId) ? parsedUserId : null);
  setCoordinatorName((prev) => prev ?? buildStoredProfileName(profile, null));

    const controller = new AbortController();

    const fetchMasterTeacherProfile = async (userId: string, signal: AbortSignal) => {
      try {
        const response = await fetch(`/api/master_teacher/profile?userId=${encodeURIComponent(userId)}`, {
          signal,
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = await response.json();
        if (!payload?.success) {
          return null;
        }
        return payload.profile ?? null;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return null;
        }
        console.warn("Fallback master teacher profile lookup failed", error);
        return null;
      }
    };

    const extractSubject = (value: unknown): string | null => {
      if (Array.isArray(value)) {
        const joined = value
          .map((entry) => (entry === null || entry === undefined ? "" : String(entry).trim()))
          .filter(Boolean)
          .join(", ");
        return joined.length > 0 ? joined : null;
      }
      if (value === null || value === undefined) {
        return null;
      }
      const trimmed = String(value).trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const loadCoordinatorContext = async () => {
      setProfileLoading(true);
      try {
        const encodedUserId = encodeURIComponent(String(profile.userId));
        const response = await fetch(`/api/master_teacher/coordinator/profile?userId=${encodedUserId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = await response.json();

        if (!payload?.success) {
          setProfileError(payload?.error ?? "Unable to load coordinator details.");
          setAllowedSubjects([]);
          setActivities([]);
          return;
        }

        const coordinator = payload.coordinator ?? {};
        const gradeCandidates: Array<string | null> = [
          normalizeGradeLabel(coordinator.gradeLevel ?? coordinator.grade ?? null),
        ];

        const coordinatorSubjectValue = extractSubject(
          coordinator.coordinatorSubject ??
            coordinator.subjectsHandled ??
            coordinator.subject ??
            null,
        );
        const subjectSet = new Set<string>(deriveAllowedSubjects(coordinatorSubjectValue));

        let fallbackProfile: Record<string, unknown> | null = null;

        if (!gradeCandidates[0] || subjectSet.size === 0) {
          fallbackProfile = await fetchMasterTeacherProfile(String(profile.userId), controller.signal);
          if (fallbackProfile) {
            gradeCandidates.push(normalizeGradeLabel(fallbackProfile.grade as string | null));

            const fallbackSubjectValue = extractSubject(
              fallbackProfile.subjectHandled ??
                fallbackProfile.subject ??
                fallbackProfile.subjects ??
                fallbackProfile.coordinatorSubject ??
                null,
            );
            if (fallbackSubjectValue) {
              for (const subject of deriveAllowedSubjects(fallbackSubjectValue)) {
                subjectSet.add(subject);
              }
            }
          }
        }

        const resolvedGrade = gradeCandidates.find((grade): grade is string => Boolean(grade)) ?? null;
        setGradeLevel(resolvedGrade);

        const subjectArray = Array.from(subjectSet);
        setAllowedSubjects(subjectArray);
        setCoordinatorSubject(
          subjectArray.length > 0
            ? subjectArray.join(", ")
            : coordinatorSubjectValue ?? null,
        );

        const apiCoordinatorName = typeof coordinator.name === "string" ? coordinator.name.trim() : "";
        const resolvedCoordinatorName = apiCoordinatorName.length > 0
          ? apiCoordinatorName
          : buildStoredProfileName(profile, coordinatorName);
        setCoordinatorName(resolvedCoordinatorName);

        const coordinatorIdCandidate = Number(
          coordinator.userId ?? coordinator.masterTeacherId ?? coordinator.master_teacher_id ?? profile.userId,
        );
        if (Number.isFinite(coordinatorIdCandidate)) {
          setCoordinatorUserId(coordinatorIdCandidate);
        }

        if (Array.isArray(payload.activities)) {
          const gradeForActivities = normalizeGradeLabel(resolvedGrade ?? gradeLevel ?? null);
          let droppedInvalid = 0;
          let droppedGrade = 0;
          let droppedSubject = 0;

          const parsedActivities: Activity[] = (payload.activities as Array<Record<string, unknown>>)
            .map((item, index): Activity | null => {
              if (!item) return null;
              const rawStart =
                (item.startDate as string | null | undefined) ??
                (item.start as string | null | undefined) ??
                (item.start_time as string | null | undefined) ??
                (item.startTime as string | null | undefined) ??
                (item.date as string | null | undefined) ??
                null;

              const start =
                parseTimestamp(rawStart) ??
                parseTimestamp(item.date as string | null | undefined);

              if (!start) {
                return null;
              }

              const rawEnd =
                (item.endDate as string | null | undefined) ??
                (item.end as string | null | undefined) ??
                (item.finish as string | null | undefined) ??
                (item.end_time as string | null | undefined) ??
                (item.endTime as string | null | undefined) ??
                null;

              let end = rawEnd ? parseTimestamp(rawEnd) : null;
              if (!end) {
                end = new Date(start.getTime() + 60 * 60 * 1000);
              }

              const activityGrade =
                normalizeGradeLabel(
                  (item.gradeLevel as string | null | undefined) ??
                    (item.grade as string | null | undefined) ??
                    null,
                );

              const subjectValueRaw =
                extractSubject(item.subject) ?? extractSubject(item.title) ?? coordinatorSubjectValue;
              const sanitizedSubject = subjectArray.length > 0
                ? sanitizeSubjectSelection(subjectValueRaw, subjectArray)
                : subjectValueRaw ?? undefined;

              if (subjectArray.length > 0 && !sanitizedSubject) {
                return null;
              }

              const statusLabel = normalizeStatusLabel(item.status as string | null | undefined);
              const planBatchCandidate =
                typeof item.planBatchId === "string" && item.planBatchId.trim().length > 0
                  ? item.planBatchId.trim()
                  : undefined;
              const weekRefRaw =
                typeof item.weekRef === "string" && item.weekRef.trim().length > 0
                  ? item.weekRef.trim()
                  : undefined;
              const resolvedPlanBatchId = planBatchCandidate ?? weekRefRaw ?? undefined;
              const sourceTable =
                typeof item.sourceTable === "string" && item.sourceTable.trim().length > 0
                  ? item.sourceTable.trim()
                  : undefined;
              const requestedAt = typeof item.requestedAt === "string" ? item.requestedAt : undefined;
              const approvedAt = typeof item.approvedAt === "string" ? item.approvedAt : undefined;
              const approvedBy = typeof item.approvedBy === "string" ? item.approvedBy : undefined;
              const requester =
                typeof item.requester === "string" && item.requester.trim().length > 0
                  ? item.requester.trim()
                  : typeof item.requestedBy === "string" && item.requestedBy.trim().length > 0
                  ? item.requestedBy.trim()
                  : typeof item.submittedBy === "string" && item.submittedBy.trim().length > 0
                  ? item.submittedBy.trim()
                  : undefined;

              return {
                id: Number.isFinite(Number(item.id)) ? Number(item.id) : index + 1,
                title:
                  typeof item.title === "string" && item.title.trim().length > 0
                    ? item.title.trim()
                    : sanitizedSubject ?? "Remediation Session",
                day: start.toLocaleDateString("en-US", { weekday: "long" }),
                date: start,
                end,
                type:
                  typeof item.type === "string" && item.type.trim().length > 0
                    ? item.type.trim()
                    : "class",
                gradeLevel: activityGrade ?? undefined,
                subject: sanitizedSubject ?? undefined,
                isWeeklyTemplate: Boolean(item.isWeeklyTemplate ?? item.is_template),
                weekRef: weekRefRaw ?? resolvedPlanBatchId,
                status: statusLabel,
                planBatchId: resolvedPlanBatchId ?? null,
                requestedAt: requestedAt ?? null,
                approvedAt: approvedAt ?? null,
                approvedBy: approvedBy ?? null,
                sourceTable: sourceTable ?? null,
                requester: requester ?? null,
              } satisfies Activity;
            })
            .filter((activity): activity is Activity => {
              if (!activity) {
                droppedInvalid += 1;
                return false;
              }
              if (gradeForActivities && activity.gradeLevel) {
                const normalizedActivityGrade = normalizeGradeLabel(activity.gradeLevel);
                if (normalizedActivityGrade && normalizedActivityGrade !== gradeForActivities) {
                  droppedGrade += 1;
                  return false;
                }
              }
              if (subjectArray.length > 0) {
                const subjectValue = activity.subject;
                if (!subjectValue) {
                  droppedSubject += 1;
                  return false;
                }
                const allowedSubject = subjectArray.some(
                  (subject) => subject.toLowerCase() === subjectValue.toLowerCase(),
                );
                if (!allowedSubject) {
                  droppedSubject += 1;
                  return false;
                }
              }
              return true;
            });

          if (payload.activities.length > 0) {
            const approvedCount = parsedActivities.filter((activity) => activity.status === "Approved").length;
            const pendingCount = parsedActivities.filter((activity) => activity.status === "Pending").length;
            const declinedCount = parsedActivities.filter((activity) => activity.status === "Declined").length;
            // eslint-disable-next-line no-console
            console.log("Coordinator calendar sync", {
              sourceCount: payload.activities.length,
              parsedCount: parsedActivities.length,
              approvedCount,
              pendingCount,
              declinedCount,
              droppedInvalid,
              droppedGrade,
              droppedSubject,
            });
          }

          setActivities(parsedActivities);
        } else {
          setActivities([]);
        }

        setProfileError(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to load coordinator calendar context", error);
        setAllowedSubjects([]);
        setProfileError("Unable to load coordinator details right now. Please refresh to retry.");
      } finally {
        setProfileLoading(false);
      }
    };

    loadCoordinatorContext();
    return () => controller.abort();
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

  const deriveSessionTimes = useCallback(
    (baseDate: Date) => {
      const normalized = new Date(baseDate);
      normalized.setHours(0, 0, 0, 0);

      let start: Date;
      let end: Date;

      if (weeklySchedule) {
        start = createDateWithTime(normalized, weeklySchedule.startTime);
        end = createDateWithTime(normalized, weeklySchedule.endTime);
        if (end.getTime() <= start.getTime()) {
          end = new Date(start.getTime() + 60 * 60 * 1000);
        }
      } else {
        start = createDateWithTime(normalized, "09:00");
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }

      return { start, end } as const;
    },
    [weeklySchedule],
  );

  const isCoordinatorSubjectDay = useCallback(
    (date: Date) => {
      if (!subjectScheduleConfigured || !weeklySubjectSchedule) {
        return true;
      }
      if (allowedSubjects.length === 0) {
        return true;
      }
      const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
      if (!WEEKDAY_ORDER.includes(weekday as Weekday)) {
        return false;
      }
      const scheduledSubject = weeklySubjectSchedule[weekday as Weekday];
      if (!scheduledSubject || !scheduledSubject.trim()) {
        return false;
      }
      const normalizedScheduled = normalizeSubjectValue(scheduledSubject) ?? scheduledSubject.trim();
      return allowedSubjects.some((subject) => subject.toLowerCase() === normalizedScheduled.toLowerCase());
    },
    [allowedSubjects, subjectScheduleConfigured, weeklySubjectSchedule],
  );

  const isDateWithinRemedialWindow = useCallback(
    (date: Date | null | undefined) => {
      if (!date || !scheduleRange) {
        return false;
      }
      if (remedialWindowStatus !== "active") {
        return false;
      }
      const candidate = new Date(date);
      candidate.setHours(12, 0, 0, 0);
      if (isWeekendDate(candidate)) {
        return false;
      }
      if (!isCoordinatorSubjectDay(candidate)) {
        return false;
      }
      return candidate >= scheduleRange.start && candidate <= scheduleRange.end;
    },
    [isCoordinatorSubjectDay, remedialWindowStatus, scheduleRange],
  );

  // Handle double click on date
  const handleDateDoubleClick = (date: Date) => {
    if (!canPlanActivities) {
      if (!hasActiveRemedialWindow && scheduleBlockingReason) {
        setRemedialGuardMessage(scheduleBlockingReason);
      }
      return;
    }
    if (isWeekendDate(date)) {
      setRemedialGuardMessage("Remedial sessions are only scheduled Monday to Friday.");
      return;
    }
    if (!isCoordinatorSubjectDay(date)) {
      setRemedialGuardMessage("This day is assigned to a different subject in the weekly schedule.");
      return;
    }
    if (!isDateWithinRemedialWindow(date)) {
      setRemedialGuardMessage(
        scheduleWindowLabel
          ? `Remedial window runs from ${scheduleWindowLabel}. Choose a date within this range.`
          : "Selected date is outside the active remedial window.",
      );
      return;
    }
    setRemedialGuardMessage(null);
    setSelectedDate(date);
    setValue("date", date.toLocaleDateString("en-CA")); 
    if (allowedSubjects.length > 0) {
      setValue("subject", allowedSubjects[0], { shouldValidate: false, shouldDirty: false });
    }
    setShowAddModal(true);
  };

  // Add new schedule from modal (single)
  const handleAddSchedule = (data: CalendarFormValues) => {
    if (!canPlanActivities) {
      return;
    }

    if (!data.date) {
      setError("date", {
        type: "required",
        message: "Date is required.",
      });
      return;
    }
    clearErrors("date");

    const sanitizedSubject = sanitizeSubjectSelection(data.subject, allowedSubjects);
    if (!sanitizedSubject) {
      setError("subject", {
        type: "validate",
        message: "You can only schedule activities for your assigned subject.",
      });
      return;
    }
    clearErrors("subject");

    const [year, month, day] = data.date.split("-").map(Number);
    const baseDate = new Date(year, month - 1, day);
    if (!isDateWithinRemedialWindow(baseDate)) {
      setError("date", {
        type: "validate",
        message: scheduleWindowLabel
          ? `Remedial window runs from ${scheduleWindowLabel}.`
          : "Date must fall within the active remedial window.",
      });
      setRemedialGuardMessage(
        scheduleWindowLabel
          ? `Remedial window runs from ${scheduleWindowLabel}.`
          : "The principal has not enabled a remedial window for this date.",
      );
      return;
    }
    const { start: startDate, end: endDate } = deriveSessionTimes(baseDate);
    const normalizedTitle = data.title.trim().length > 0 ? data.title.trim() : `${sanitizedSubject} Remediation`;

    if (hasApprovedConflict(startDate, sanitizedSubject, gradeLabel)) {
      showToast("An approved activity already exists for this day, subject, and grade.", "info");
      return;
    }

    const newActivity: Activity = {
      id: activities.length > 0 ? Math.max(...activities.map((a) => a.id)) + 1 : 1,
      ...data,
      day: startDate.toLocaleDateString("en-US", { weekday: "long" }),
      date: startDate,
      end: endDate,
      type: "class",
      gradeLevel: gradeLabel,
      title: normalizedTitle,
      subject: sanitizedSubject,
    };

    setActivities((prev) => [...prev, newActivity].sort((a, b) => a.date.getTime() - b.date.getTime()));
    setShowAddModal(false);
    setSelectedDate(null);
    reset({
      title: "",
      date: "",
      teachers: [],
    });
    clearErrors();
  };

  const parseImportedDateCell = useCallback((value: unknown): Date | null => {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        return null;
      }
      const cloned = new Date(value);
      cloned.setHours(0, 0, 0, 0);
      return cloned;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      const parsed = XLSX.SSF?.parse_date_code?.(value);
      if (!parsed) {
        return null;
      }

      const candidate = new Date(parsed.y, (parsed.m ?? 1) - 1, parsed.d ?? 1);
      if (Number.isNaN(candidate.getTime())) {
        return null;
      }
      candidate.setHours(0, 0, 0, 0);
      return candidate;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const timestamp = Date.parse(trimmed);
      if (Number.isNaN(timestamp)) {
        return null;
      }
      const candidate = new Date(timestamp);
      if (Number.isNaN(candidate.getTime())) {
        return null;
      }
      candidate.setHours(0, 0, 0, 0);
      return candidate;
    }

    return null;
  }, []);

  const persistRemedialActivities = useCallback(
    async (items: Activity[]) => {
      if (!items.length) return;

      try {
        const response = await fetch("/api/master_teacher/coordinator/calendar/remedial-activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gradeLabel: gradeLabel ?? null,
            activities: items.map((activity) => ({
              title: activity.title,
              date: activity.date.toISOString(),
            })),
          }),
        });

        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          inserted?: number;
          skipped?: Array<{ title: string; reason: string }>;
          error?: string | null;
        } | null;

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? "Unable to save remedial activities.");
        }

        const inserted = typeof payload.inserted === "number" ? payload.inserted : items.length;
        const skippedCount = Array.isArray(payload.skipped) ? payload.skipped.length : 0;
        const messageParts = [`Saved ${inserted} remedial activit${inserted === 1 ? "y" : "ies"}.`];
        if (skippedCount > 0) {
          messageParts.push(`${skippedCount} entr${skippedCount === 1 ? "y was" : "ies were"} skipped.`);
        }
        showToast(messageParts.join(" "), skippedCount > 0 ? "info" : "success");
      } catch (error) {
        console.error("Failed to persist remedial activities", error);
        showToast(error instanceof Error ? error.message : "Unable to save remedial activities.", "error");
      }
    },
    [gradeLabel],
  );

  const processImportFile = useCallback(
    async (file: File) => {
      if (!canPlanActivities) {
        if (!hasActiveRemedialWindow && scheduleBlockingReason) {
          setRemedialGuardMessage(scheduleBlockingReason);
        }
        return;
      }

      setImporting(true);
      setImportError(null);

      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });

        if (!workbook.SheetNames.length) {
          throw new Error("The selected file does not contain any worksheets.");
        }

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) {
          throw new Error("Unable to read the first worksheet from the file.");
        }

        const rows = XLSX.utils.sheet_to_json<Array<string | number | Date | null>>(sheet, {
          header: 1,
          raw: true,
          blankrows: false,
          defval: null,
        });

        if (rows.length <= 1) {
          throw new Error("The worksheet does not contain any activity rows to import.");
        }

        const headersRow = rows[0] ?? [];
        const headers = headersRow.map((cell) => (cell === null || cell === undefined ? "" : String(cell).trim().toLowerCase()));

        const matchesHeader = (header: string, candidates: readonly string[]) =>
          candidates.some((candidate) => header === candidate || header.includes(candidate));

        const dateIndex = headers.findIndex((header) =>
          matchesHeader(header, ["date", "day", "schedule date", "activity date", "session date"]),
        );
        const titleIndex = headers.findIndex((header) =>
          matchesHeader(header, ["title", "activity", "activity title", "session", "event"]),
        );

        if (dateIndex === -1 || titleIndex === -1) {
          throw new Error("Please include both 'Date' and 'Title' columns in the worksheet header before importing.");
        }

        let added = 0;
        let skipped = 0;
        let nextId = activities.length > 0 ? Math.max(...activities.map((activity) => activity.id)) + 1 : 1;

        const existingSignatures = new Set(
          activities.map(
            (activity) => `${activity.date.toISOString()}::${activity.title.toLowerCase()}::${activity.subject ?? ""}`,
          ),
        );

        const defaultSubject = sanitizeSubjectSelection(allowedSubjects[0], allowedSubjects) ?? allowedSubjects[0] ?? null;
        const newActivities: Activity[] = [];

        for (let i = 1; i < rows.length; i += 1) {
          const row = rows[i];
          if (!Array.isArray(row)) {
            continue;
          }

          const rawTitle = row[titleIndex];
          const title =
            typeof rawTitle === "string"
              ? rawTitle.trim()
              : rawTitle !== null && rawTitle !== undefined
              ? String(rawTitle).trim()
              : "";

          if (!title) {
            skipped += 1;
            continue;
          }

          const parsedDate = parseImportedDateCell(row[dateIndex]);
          if (!parsedDate) {
            skipped += 1;
            continue;
          }

          if (!isDateWithinRemedialWindow(parsedDate)) {
            skipped += 1;
            if (scheduleBlockingReason) {
              setRemedialGuardMessage(scheduleBlockingReason);
            }
            continue;
          }

          const resolvedSubject = sanitizeSubjectSelection(defaultSubject, allowedSubjects) ?? defaultSubject;
          if (!resolvedSubject) {
            skipped += 1;
            continue;
          }

          const { start, end } = deriveSessionTimes(parsedDate);
          const signature = `${start.toISOString()}::${title.toLowerCase()}::${resolvedSubject.toLowerCase()}`;
          if (existingSignatures.has(signature)) {
            skipped += 1;
            continue;
          }

          if (hasApprovedConflict(start, resolvedSubject, gradeLabel)) {
            skipped += 1;
            continue;
          }

          existingSignatures.add(signature);

          newActivities.push({
            id: nextId,
            title,
            day: start.toLocaleDateString("en-US", { weekday: "long" }),
            date: start,
            end,
            type: "class",
            gradeLevel: gradeLabel,
            subject: resolvedSubject,
          });

          nextId += 1;
          added += 1;
    }
        if (newActivities.length > 0) {
          setActivities((prev) => [...prev, ...newActivities].sort((a, b) => a.date.getTime() - b.date.getTime()));
          setSendFeedback(null);
        }

        const totalRows = Math.max(rows.length - 1, 0);
        if (added === 0) {
          setImportError("No new activities were imported from the selected file.");
        } else {
          setImportError(null);
          const summaryParts = [
            `Imported ${added} of ${totalRows} row${totalRows === 1 ? "" : "s"}.`,
          ];
          if (skipped > 0) {
            summaryParts.push(
              `Skipped ${skipped} entr${skipped === 1 ? "y" : "ies"} that could not be imported.`,
            );
          }
          const importedIds = newActivities.map((activity) => activity.id);
          if (importedIds.length > 0) {
            setPendingImportIds((prev) => Array.from(new Set([...prev, ...importedIds])));
            setImportActionToast(`${summaryParts.join(" ")} Send or decline the imported activities.`);
          }
        }
      } catch (error) {
        console.error("Failed to import activities", error);
        setImportError(error instanceof Error ? error.message : "Unable to import the schedule file.");
      } finally {
        setImporting(false);
      }
    },
    [
      activities,
      allowedSubjects,
      canPlanActivities,
      deriveSessionTimes,
      gradeLabel,
      hasActiveRemedialWindow,
      hasApprovedConflict,
      isDateWithinRemedialWindow,
      persistRemedialActivities,
      scheduleBlockingReason,
      showToast,
    ],
  );

  const handleImportButtonClick = () => {
    if (!hasConfiguredRemedialWindow) {
      setRemedialGuardMessage("The principal has not set a remedial period yet.");
      showToast("The principal has not set a remedial period yet.", "info");
      return;
    }
    if (!canPlanActivities) {
      if (!hasActiveRemedialWindow && scheduleBlockingReason) {
        setRemedialGuardMessage(scheduleBlockingReason);
      }
      return;
    }

    setImportError(null);
    setSendFeedback(null);
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = async () => {
    if (!hasConfiguredRemedialWindow) {
      setRemedialGuardMessage("The principal has not set a remedial period yet.");
      showToast("The principal has not set a remedial period yet.", "info");
      return;
    }
    if (templateDownloading) {
      return;
    }

    setTemplateDownloading(true);
    setImportError(null);

    try {
      const response = await fetch("/api/master_teacher/coordinator/calendar/remedial-template", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        rows?: Array<Record<string, string>>;
        meta?: { schoolYear?: string } | null;
        error?: string | null;
      } | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to download the template.");
      }

      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      if (!rows.length) {
        throw new Error("No template rows were generated for your assignment.");
      }

      const headerOrder = ["Quarter", "Date", "Day", "Subject", "Grade", "Title"];
      const worksheet = XLSX.utils.json_to_sheet(rows, { header: headerOrder });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Remedial Template");

      const schoolYear = payload.meta?.schoolYear ?? "remedial";
      const filename = `Remedial_Template_${schoolYear.replace(/\s+/g, "_")}.xlsx`;
      XLSX.writeFile(workbook, filename);

      showToast("Template downloaded.", "success");
    } catch (error) {
      console.error("Failed to download template", error);
      showToast(error instanceof Error ? error.message : "Unable to download the template.", "error");
    } finally {
      setTemplateDownloading(false);
    }
  };

  const handleImportInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    await processImportFile(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenSendModal = () => {
    if (!activities.length) {
      setSendFeedback("Add at least one activity to your calendar before sending it to the principal.");
      return;
    }

    const unresolvedSubject = activities.some((activity) => !activity.subject);
    if (unresolvedSubject && allowedSubjects.length === 0) {
      setSendFeedback("Assign a subject to each activity before sending them to the principal.");
      return;
    }

    setSendError(null);
    setSendFeedback(null);
    setShowSendModal(true);
  };

  const handleSendActivities = async () => {
    if (!activities.length || sending) {
      return;
    }

    setSending(true);
    setSendError(null);

    try {
      if (!sendableActivities.length) {
        showToast("All scheduled activities have already been approved.", "info");
        setShowSendModal(false);
        return;
      }

      const fallbackSubject = sanitizeSubjectSelection(allowedSubjects[0], allowedSubjects) ?? allowedSubjects[0] ?? null;
      const storedProfile = getStoredUserProfile();
      const resolvedName = buildStoredProfileName(storedProfile, coordinatorName) ?? "Master Teacher";

      const payload = {
        gradeLevel: gradeLabel,
        coordinatorName: resolvedName,
        coordinatorId: coordinatorUserId,
        subjectFallback: fallbackSubject,
        activities: sendableActivities.map((activity) => ({
          id: activity.id,
          title: activity.title,
          subject: activity.subject ?? fallbackSubject,
          gradeLevel: activity.gradeLevel ?? gradeLabel,
          date: activity.date.toISOString(),
          end: activity.end.toISOString(),
          day: activity.date.toLocaleDateString("en-US", { weekday: "long" }),
          weekRef: activity.weekRef ?? null,
        })),
      };

      const response = await fetch("/api/master_teacher/coordinator/calendar/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({ success: false }));

      if (!response.ok || !result?.success) {
        throw new Error(result?.error ?? "Unable to send activities to the principal right now.");
      }

      const inserted = typeof result.inserted === "number" && result.inserted >= 0 ? result.inserted : activities.length;
      const skippedCount = Array.isArray(result.skipped) ? result.skipped.length : 0;
      const feedbackParts = [`Sent ${inserted} activit${inserted === 1 ? "y" : "ies"} to the principal for approval.`];
      if (skippedCount > 0) {
        feedbackParts.push(`${skippedCount} entr${skippedCount === 1 ? "y" : "ies"} were skipped.`);
      }
      showToast(feedbackParts.join(" "), skippedCount > 0 ? "info" : "success");
      setShowSendModal(false);
      setImportActionToast(null);
      setPendingImportIds([]);

      const sendableIds = new Set(sendableActivities.map((activity) => activity.id));
      setActivities((prev) =>
        prev.map((activity) =>
          sendableIds.has(activity.id)
            ? { ...activity, status: "Pending" }
            : activity,
        ),
      );
    } catch (error) {
      console.error("Failed to send activities", error);
      setSendError(error instanceof Error ? error.message : "Unable to send activities to the principal right now.");
    } finally {
      setSending(false);
    }
  };

  const generateActivitiesForWeek = (schedule: WeeklyScheduleFormData): Activity[] | null => {
    const baseId = activities.length > 0 ? Math.max(...activities.map((a) => a.id)) + 1 : 1;
    const mondayDate = parseDateInput(schedule.weekStart);
    const weekKey = buildWeekKey(gradeLabel, schedule.weekStart);

    const outsideDay = WEEKDAY_ORDER.find((day, index) => {
      const checkDate = new Date(mondayDate);
      checkDate.setDate(checkDate.getDate() + index);
      return !isDateWithinRemedialWindow(checkDate);
    });

    if (outsideDay) {
      setRemedialGuardMessage(
        scheduleWindowLabel
          ? `${outsideDay} falls outside the active remedial window (${scheduleWindowLabel}).`
          : `${outsideDay} is outside the active remedial window.`,
      );
      return null;
    }
    setRemedialGuardMessage(null);

    const planned = WEEKDAY_ORDER.map((day, index) => {
      const activityDate = new Date(mondayDate);
      activityDate.setDate(activityDate.getDate() + index);
      const startDate = createDateWithTime(activityDate, schedule.startTime);
      const endDate = createDateWithTime(activityDate, schedule.endTime);
      const subjectForDay = sanitizeSubjectSelection(schedule.subjects[day], allowedSubjects) ?? schedule.subjects[day];
      const title = subjectForDay ? `${subjectForDay} Remediation Session` : "Remediation Session";

      if (hasApprovedConflict(startDate, subjectForDay ?? null, gradeLabel)) {
        return null;
      }

      return {
        id: baseId + index,
        title,
        day,
        date: startDate,
        end: endDate,
        type: "class",
        gradeLevel: gradeLabel,
        subject: subjectForDay,
        isWeeklyTemplate: true,
        weekRef: weekKey,
      } satisfies Activity;
    });

    if (planned.some((item) => item === null)) {
      showToast("Some days already have approved activities. Remove or change those before scheduling.", "info");
      return null;
    }

    return planned as Activity[];
  };

  const handleWeeklySave = (data: WeeklyScheduleFormData) => {
    if (!canPlanActivities) {
      if (!hasActiveRemedialWindow && scheduleBlockingReason) {
        setRemedialGuardMessage(scheduleBlockingReason);
      }
      return;
    }
    const normalizedSubjects = WEEKDAY_ORDER.reduce<Record<Weekday, string>>((acc, day) => {
      const subject = sanitizeSubjectSelection(data.subjects[day], allowedSubjects) ?? data.subjects[day];
      acc[day] = subject;
      return acc;
    }, { ...data.subjects });

    const normalizedSchedule: WeeklyScheduleFormData = {
      ...data,
      subjects: normalizedSubjects,
    };

    const weekActivities = generateActivitiesForWeek(normalizedSchedule);
    if (!weekActivities) {
      return;
    }
    const weekKey = buildWeekKey(gradeLabel, normalizedSchedule.weekStart);

    setActivities((prev) => {
      const filtered = prev.filter((activity) => activity.weekRef !== weekKey);
      return [...filtered, ...weekActivities];
    });

    setWeeklySchedule(normalizedSchedule);
    setShowWeeklyModal(false);
    // Only persist when sending to principal.
  };

  // Delete schedule with confirmation
  const handleDeleteClick = (activity: Activity) => {
    if (isActivityLocked(activity)) {
      showToast("Approved activities are view-only and cannot be removed.", "info");
      return;
    }
    setActivityToDelete(activity);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    if (activityToDelete) {
      if (isActivityLocked(activityToDelete)) {
        showToast("Approved activities are view-only and cannot be removed.", "info");
        setShowDeleteModal(false);
        setActivityToDelete(null);
        return;
      }
      setActivities(activities.filter((activity) => activity.id !== activityToDelete.id));
      setSelectedActivity(null);
      setShowDeleteModal(false);
      setActivityToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setActivityToDelete(null);
  };

  const resolveActivityTone = (type: string | null | undefined): ActivityTone => {
    const normalized = (type ?? "").toLowerCase();

    if (normalized.includes("english") || normalized === "class") {
      return {
        backgroundClass: "bg-blue-50",
        borderClass: "border-blue-200",
        titleClass: "text-blue-900",
        accentColor: "#2563EB",
      };
    }

    if (normalized.includes("filipino")) {
      return {
        backgroundClass: "bg-purple-50",
        borderClass: "border-purple-200",
        titleClass: "text-purple-900",
        accentColor: "#7C3AED",
      };
    }

    if (normalized.includes("math")) {
      return {
        backgroundClass: "bg-amber-50",
        borderClass: "border-amber-200",
        titleClass: "text-amber-900",
        accentColor: "#D97706",
      };
    }

    if (normalized.includes("meeting")) {
      return {
        backgroundClass: "bg-green-50",
        borderClass: "border-green-200",
        titleClass: "text-green-900",
        accentColor: "#047857",
      };
    }

    if (normalized.includes("appointment")) {
      return {
        backgroundClass: "bg-rose-50",
        borderClass: "border-rose-200",
        titleClass: "text-rose-900",
        accentColor: "#DB2777",
      };
    }

    if (normalized.includes("event")) {
      return {
        backgroundClass: "bg-sky-50",
        borderClass: "border-sky-200",
        titleClass: "text-sky-900",
        accentColor: "#0EA5E9",
      };
    }

    return {
      backgroundClass: "bg-gray-50",
      borderClass: "border-gray-200",
      titleClass: "text-gray-900",
      accentColor: "#047857",
    };
  };

  // Render the calendar based on view
  const renderCalendar = () => {
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
    const today = new Date();

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
          currentDay.setHours(0, 0, 0, 0);
          const dayActivities = activities.filter(
            (a) => a.date.getDate() === day && a.date.getMonth() === month && a.date.getFullYear() === year
          );
          const isToday =
            currentDay.getDate() === today.getDate() &&
            currentDay.getMonth() === today.getMonth() &&
            currentDay.getFullYear() === today.getFullYear();
          const withinRemedialWindow = scheduleRange
            ? currentDay >= scheduleRange.start && currentDay <= scheduleRange.end
            : false;
          const highlightDay =
            withinRemedialWindow && !isWeekendDate(currentDay) && isCoordinatorSubjectDay(currentDay);
          const subjectColor = highlightDay
            ? getSubjectColor(dayActivities[0]?.subject ?? coordinatorSubject ?? null)
            : "border-gray-100";

          days.push(
            <div
              key={`day-${day}`}
              className={`h-24 p-1 border overflow-hidden relative hover:bg-gray-50 transition-colors cursor-pointer ${subjectColor}`}
              onDoubleClick={() => handleDateDoubleClick(currentDay)}
            >
              <div className="text-right text-sm font-medium text-gray-800 mb-1">
                {isToday ? (
                  <span className="inline-block w-6 h-6 bg-[#013300] text-white rounded-full text-center leading-6">
                    {day}
                  </span>
                ) : (
                  <span>{day}</span>
                )}
              </div>
              <div className="overflow-y-auto max-h-12 space-y-1">
                {dayActivities.slice(0, 2).map((activity) => {
                  const viewOnly = isActivityLocked(activity);
                  const displayTitle = activity.title?.trim().length
                    ? activity.title
                    : activity.subject ?? "Scheduled Activity";
                  const activitySubject = resolveActivitySubject(displayTitle, activity.subject ?? null);
                  const indicator =
                    activitySubject?.toLowerCase().startsWith("eng")
                      ? "E"
                      : activitySubject?.toLowerCase().startsWith("fil")
                      ? "F"
                      : activitySubject?.toLowerCase().startsWith("math")
                      ? "M"
                      : null;

                  return (
                    <div
                      key={activity.id}
                      className={`rounded-lg border px-2 py-1 text-[0.7rem] font-semibold shadow-sm ${getSubjectChipTone(activitySubject)}`}
                      onClick={() => setSelectedActivity(activity)}
                      title={displayTitle}
                    >
                      <div className="flex items-start gap-2">
                        {indicator && (
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[0.6rem] font-semibold text-white">
                            {indicator}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 text-[0.7rem] font-semibold leading-snug text-white line-clamp-2">
                          {displayTitle}
                        </span>
                        {!viewOnly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(activity);
                            }}
                            className="text-xs text-white/80 hover:text-white"
                            aria-label="Delete activity"
                          >
                            ??
                          </button>
                        )}
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

    const normalizedGrade = normalizeGradeLabel(gradeLabel) ?? `Grade ${gradeLabel}`;

    return (
      <div>
        <div className="px-4 py-3 border-b border-gray-100 bg-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{normalizedGrade} Calendar</h3>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-gray-600">
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gray-500">Legend</span>
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
    const formatSubjectLabel = (subject: string | null) => {
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
          onDoubleClick={() => handleDateDoubleClick(dayDate)}
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
                const displayTitle = activity.title?.trim().length
                  ? activity.title
                  : activity.subject ?? "Scheduled Activity";
                const weekdayLabel = dayDate.toLocaleDateString("en-US", { weekday: "long" });
                const scheduleSubject = WEEKDAY_ORDER.includes(weekdayLabel as Weekday)
                  ? weeklySubjectSchedule?.[weekdayLabel as Weekday] ?? null
                  : null;
                const activitySubject = resolveActivitySubject(displayTitle, scheduleSubject);
                const subjectTone = getSubjectColor(activitySubject);
                const subjectLabel = formatSubjectLabel(activitySubject);
                const dateParts = formatStackedDate(activity.date);
                const timeLabel = subjectScheduleConfigured
                  ? `${formatTimeLabel(weeklySubjectSchedule?.startTime)} - ${formatTimeLabel(
                      weeklySubjectSchedule?.endTime,
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
                        <div className="text-base font-semibold text-gray-900">{displayTitle}</div>
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

  const subjectScheduleTimeLabel = useMemo(
    () =>
      `${formatTimeLabel(weeklySubjectSchedule?.startTime)} - ${formatTimeLabel(
        weeklySubjectSchedule?.endTime,
      )}`,
    [weeklySubjectSchedule],
  );
  const activeRemedialQuarter = remedialWindow?.quarter ?? null;
  const activeRemedialQuarterLabel = useMemo(() => {
    if (!remedialWindow?.startDate || !remedialWindow?.endDate) {
      return activeRemedialQuarter ?? "--";
    }
    const start = new Date(`${remedialWindow.startDate}T00:00:00`);
    const end = new Date(`${remedialWindow.endDate}T00:00:00`);
    const monthRange = formatMonthRangeShort(start, end);
    if (!activeRemedialQuarter) {
      return monthRange;
    }
    return monthRange && monthRange !== "--"
      ? `${activeRemedialQuarter} | ${monthRange}`
      : activeRemedialQuarter;
  }, [activeRemedialQuarter, remedialWindow?.endDate, remedialWindow?.startDate]);
  const subjectScheduleEmpty =
    !weeklySubjectScheduleLoading && !weeklySubjectScheduleError && !subjectScheduleConfigured;

  const sendableActivities = useMemo(
    () => activities.filter((activity) => !isActivityLocked(activity)),
    [activities],
  );

  const sortedActivitiesForSend = useMemo(
    () => [...sendableActivities].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [sendableActivities],
  );

  const subjectSummary = allowedSubjects.length > 0 ? allowedSubjects.join(", ") : null;
  const sendButtonDisabled = sortedActivitiesForSend.length === 0 || sending;
  const importButtonDisabled = !canPlanActivities || importing;
  const hasConfiguredRemedialWindow = Boolean(remedialWindow?.startDate && remedialWindow?.endDate);
  const templateButtonDisabled = templateDownloading || !hasConfiguredRemedialWindow;

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#f2f7f4]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-[-10%] h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] h-96 w-96 rounded-full bg-emerald-100/50 blur-3xl" />
        <div className="absolute top-16 left-1/2 h-40 w-96 -translate-x-1/2 rounded-full bg-white/70 blur-2xl" />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImportInputChange}
      />
      <Sidebar />
      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Calendar" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="relative z-10 h-full min-h-100 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-5 md:p-6">
              {/* Calendar Controls */}
              <div className="flex flex-col gap-3 mb-4">
                {profileLoading && !profileError && (
                  <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    Syncing coordinator schedule…
                  </div>
                )}
                {profileError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {profileError}
                  </div>
                )}
                {remedialWindowError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {remedialWindowError}
                  </div>
                )}
                {sendFeedback && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    {sendFeedback}
                  </div>
                )}
                {importError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {importError}
                  </div>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                    <button onClick={goToToday} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700">
                      Today
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-2">
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
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-2">
                      <KebabMenu
                        small
                        align="right"
                        menuWidthClass="w-56"
                        renderItems={(close) => (
                          <div className="py-1">
                            <button
                              type="button"
                              disabled={importButtonDisabled}
                              onClick={() => {
                                handleImportButtonClick();
                                close();
                              }}
                              title={!hasConfiguredRemedialWindow ? "Principal has not set a remedial period yet." : !canPlanActivities ? scheduleBlockingReason ?? "Scheduling is currently disabled." : undefined}
                              className={`w-full px-4 py-2 text-left text-sm text-[#013300] flex items-center gap-2 ${
                                importButtonDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
                              }`}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="m17 8-5-5-5 5" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              </svg>
                              {importing ? "Uploading..." : "Upload File"}
                            </button>
                            <button
                              type="button"
                              disabled={templateButtonDisabled}
                              onClick={() => {
                                handleDownloadTemplate();
                                close();
                              }}
                              title={!hasConfiguredRemedialWindow ? "Principal has not set a remedial period yet." : undefined}
                              className={`w-full px-4 py-2 text-left text-sm text-[#013300] flex items-center gap-2 ${
                                templateButtonDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
                              }`}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
                              </svg>
                              {templateDownloading ? "Preparing..." : "Download Template"}
                            </button>
                          </div>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-2 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold text-gray-900">Schedule Overview</h3>
                      {(weeklySubjectScheduleLoading || remedialWindowLoading) && (
                        <span className="text-xs text-gray-400">Loading...</span>
                      )}
                    </div>
                    <div />
                  </div>

                  <div className="mt-1 grid gap-3 text-xs font-semibold text-emerald-900 lg:grid-cols-3">
                    <div className="text-center">Remedial Time</div>
                    <div className="text-center">Remedial Subjects</div>
                    <div className="text-center">Remedial Period</div>
                  </div>

                  <div className="mt-1 flex flex-col gap-3 rounded-lg bg-white px-1 py-1 text-sm text-gray-700 lg:flex-row lg:items-center">
                    <div className="flex flex-1 justify-center">
                      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600">
                        <span className="inline-flex items-center justify-center rounded-full text-gray-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v6l4 2" />
                          </svg>
                        </span>
                        <span className="font-base">{subjectScheduleTimeLabel}</span>
                      </div>
                    </div>

                    <span className="hidden h-6 w-px bg-gray-300 lg:block" />

                    <div className="flex flex-1 justify-center">
                      <div className="flex items-center gap-2 overflow-x-auto text-center scrollbar-hide">
                        {WEEKDAY_ORDER.map((day) => (
                          <div key={day} className="flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-600">
                            <span className="font-semibold text-[#013300]">{SUBJECT_DAY_LABELS[day]}</span>
                            <span className="text-gray-500">|</span>
                            <span className="text-gray-600">{weeklySubjectSchedule?.[day] || "--"}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <span className="hidden h-6 w-px bg-gray-300 lg:block" />

                    <div className="flex flex-1 justify-center">
                      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600">
                        <span className="inline-flex items-center justify-center rounded-full text-gray-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <path d="M16 2v4M8 2v4M3 10h18" />
                          </svg>
                        </span>
                        <span className="text-gray-600">{activeRemedialQuarterLabel}</span>
                      </div>
                    </div>
                  </div>

                  {weeklySubjectScheduleError && (
                    <p className="mt-2 text-xs text-amber-600">{weeklySubjectScheduleError}</p>
                  )}
                  {remedialWindowError && (
                    <p className="mt-1 text-xs text-amber-600">{remedialWindowError}</p>
                  )}
                  {subjectScheduleEmpty && (
                    <p className="mt-2 text-xs text-gray-500">Weekly schedule is not set yet.</p>
                  )}
                </div>
              </div>

              <WeeklyScheduleModal
                show={showWeeklyModal}
                onClose={() => {
                  setShowWeeklyModal(false);
                  setRemedialGuardMessage(null);
                }}
                onSave={handleWeeklySave}
                initialData={weeklySchedule}
                gradeLevel={gradeLabel}
                allowedSubjects={allowedSubjects}
                scheduleWindowLabel={scheduleWindowLabel}
                scheduleStartDate={remedialWindow?.startDate ?? null}
                scheduleEndDate={remedialWindow?.endDate ?? null}
                scheduleActive={hasActiveRemedialWindow}
              />

              {/* Add Schedule Modal */}
              <AddScheduleModal
                show={showAddModal}
                onClose={() => {
                  setShowAddModal(false);
                  setSelectedDate(null);
                  reset({
                    title: "",
                    date: "",
                    teachers: [],
                    subject: allowedSubjects[0] ?? "",
                  });
                  clearErrors();
                  setRemedialGuardMessage(null);
                }}
                form={formMethods}
                onSubmit={handleAddSchedule}
                selectedDate={selectedDate}
                gradeLabel={gradeLabel}
                allowedSubjects={allowedSubjects}
                canSchedule={canPlanActivities}
                scheduleWindowLabel={scheduleWindowLabel}
                scheduleStartDate={remedialWindow?.startDate ?? null}
                scheduleEndDate={remedialWindow?.endDate ?? null}
              />

              {/* Activity Detail Modal */}
              <ActivityDetailModal 
                activity={selectedActivity} 
                onClose={() => setSelectedActivity(null)} 
                onDelete={(id) => {
                  const activity = activities.find(a => a.id === id);
                  if (activity) handleDeleteClick(activity);
                }}
              />

              {/* Delete Confirmation Modal */}
              <DeleteConfirmationModal
                show={showDeleteModal}
                onClose={handleDeleteCancel}
                onConfirm={handleDeleteConfirm}
                activityTitle={activityToDelete?.title}
                activityDate={activityToDelete?.date.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric"
                })}
              />

              {/* Calendar View */}
              <div className="border rounded-lg overflow-hidden bg-white">
                {renderCalendar()}
              </div>
            </div>
          </div>
        </main>
        <SendActivitiesModal
          show={showSendModal}
          onClose={() => {
            setShowSendModal(false);
            setSendError(null);
          }}
          onConfirm={handleSendActivities}
          loading={sending}
          error={sendError}
          activities={sortedActivitiesForSend}
          gradeLabel={gradeLabel}
          subjectSummary={subjectSummary}
        />
      </div>
      {toast && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pointer-events-none">
          <Toast message={toast.message} tone={toast.tone} className="mt-24" />
        </div>
      )}
      {activityToast && (
        <ToastActivity message={activityToast.message} tone={activityToast.tone} />
      )}
      {importActionToast && pendingImportIds.length > 0 && (
        <ToastActivity
          title="Imported activities"
          message={importActionToast}
          tone="info"
          actions={
            <>
              <button
                type="button"
                onClick={handleDeclineImportedActivities}
                disabled={sending}
                className={`rounded-full border border-gray-200 bg-white/80 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-white ${
                  sending ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleOpenSendModal}
                disabled={sendButtonDisabled}
                className={`rounded-full border border-[#013300] bg-[#013300] px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 ${
                  sendButtonDisabled ? "cursor-not-allowed opacity-60 hover:bg-emerald-600" : ""
                }`}
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </>
          }
        />
      )}
    </div>
  );
}

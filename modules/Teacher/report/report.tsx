"use client";
import Sidebar from "@/components/Teacher/Sidebar";
import Header from "@/components/Teacher/Header";
import ToastActivity from "@/components/ToastActivity";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, Printer } from "lucide-react";
import {
  SUBJECT_CONFIG,
  normalizeSubject,
} from "@/app/api/auth/teacher/report/subject-config";
import type {
  RemedialReportField,
  RemedialMonthColumn,
  RemedialQuarterGroup,
  RemedialReportRow,
  RemedialStudentRecord,
  RemedialStudentResponse,
  SubjectKey,
} from "./types";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

const createEmptyRows = (): Record<SubjectKey, RemedialReportRow[]> => ({
  english: [],
  filipino: [],
  math: [],
});

const createEmptyMonthValueLookup = (): Record<SubjectKey, Record<string, Record<string, string>>> => ({
  english: {},
  filipino: {},
  math: {},
});

const cloneMonthValueLookup = (value: Record<string, Record<string, string>>) =>
  Object.fromEntries(
    Object.entries(value).map(([studentId, monthValues]) => [studentId, { ...monthValues }]),
  ) as Record<string, Record<string, string>>;

type RemedialQuarterSchedule = {
  quarters?: Record<string, { startMonth?: number | null; endMonth?: number | null }>;
};

type MonthlyAssessmentResponse = {
  success?: boolean;
  error?: string;
  levelsByStudent?: Record<string, Record<string, string>>;
};

type MonthlyAssessmentSaveResponse = {
  success?: boolean;
  error?: string;
  savedEntries?: Array<{ studentId?: string | null; key?: string | null; levelName?: string | null }>;
  clearedEntries?: Array<{ studentId?: string | null; key?: string | null }>;
  savedCount?: number;
  clearedCount?: number;
};

type SaveFeedback = {
  tone: "success" | "info" | "error";
  message: string;
};

type SubjectLevelOptionResponse = {
  success?: boolean;
  error?: string;
  levels?: Array<{ level_name?: string | null }>;
};

const MONTH_NAMES = [
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

const REPORT_TIME_ZONE = "Asia/Manila";

const DEFAULT_QUARTERS: Array<{ label: string; months: number[] }> = [
  { label: "1st Quarter", months: [8, 9, 10] },
  { label: "2nd Quarter", months: [1, 2, 3] },
];

const makeMonthKey = (month: number) => `m${month}`;

const resolveCurrentMonthNumber = () => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    month: "numeric",
  });
  const currentMonth = Number.parseInt(formatter.format(new Date()), 10);
  return Number.isFinite(currentMonth) && currentMonth >= 1 && currentMonth <= 12
    ? currentMonth
    : new Date().getMonth() + 1;
};

const buildQuarterHeaders = (schedule?: RemedialQuarterSchedule | null) => {
  const quarterGroups: RemedialQuarterGroup[] = [];
  const monthColumns: RemedialMonthColumn[] = [];

  const resolveMonths = (label: string, fallback: number[]) => {
    const raw = schedule?.quarters?.[label];
    const start = raw?.startMonth ?? null;
    const end = raw?.endMonth ?? null;
    if (typeof start === "number" && typeof end === "number" && start >= 1 && start <= 12 && end >= 1 && end <= 12 && start <= end) {
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
    return fallback;
  };

  for (const quarter of DEFAULT_QUARTERS) {
    const months = resolveMonths(quarter.label, quarter.months);
    quarterGroups.push({ label: quarter.label, span: months.length });
    months.forEach((month) => {
      const label = MONTH_NAMES[month - 1] ?? `Month ${month}`;
      monthColumns.push({ key: makeMonthKey(month), label, quarterLabel: quarter.label });
    });
  }

  return { quarterGroups, monthColumns };
};

const sanitize = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : "";
};

const composeStudentName = (student: RemedialStudentRecord): string => {
  const last = sanitize(student.lastName);
  const first = sanitize(student.firstName);
  const middle = sanitize(student.middleName);
  const middleInitial = middle ? `${middle.charAt(0).toUpperCase()}.` : "";
  if (last || first) {
    const rightSide = [first, middleInitial].filter(Boolean).join(" ").trim();
    return [last, rightSide].filter(Boolean).join(", ");
  }
  const explicit = sanitize(student.fullName);
  return explicit || "Unnamed Student";
};

const toReportRow = (
  student: RemedialStudentRecord,
  index: number,
  fallbackGrade: string,
  overrides: Partial<RemedialReportRow> = {},
): RemedialReportRow => {
  const identifier = sanitize(student.studentIdentifier);
  const rowId = identifier || `student-${student.studentId ?? student.userId ?? index + 1}`;
  const gradeLevel = sanitize(student.grade) || fallbackGrade;
  const baseRow: RemedialReportRow = {
    id: rowId,
    studentId: sanitize(student.studentId),
    learner: composeStudentName(student),
    section: sanitize(student.section),
    gradeLevel,
    monthValues: {},
  };
  return { ...baseRow, ...overrides };
};

const buildRowsForStudents = (
  students: RemedialStudentRecord[],
  fallbackGrade: string,
  mapper?: (student: RemedialStudentRecord, index: number) => Partial<RemedialReportRow>,
): RemedialReportRow[] =>
  students
    .map((student, index) => toReportRow(student, index, fallbackGrade, mapper?.(student, index)))
    .sort((left, right) => left.learner.localeCompare(right.learner, undefined, { sensitivity: "base" }));

const SUBJECT_LABELS: Record<SubjectKey, string> = {
  english: "English",
  filipino: "Filipino",
  math: "Math",
};

const SUBJECT_LEVEL_FALLBACKS: Record<SubjectKey, string[]> = {
  english: ["Non-Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],
  filipino: ["Non-Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],
  math: ["Not Proficient", "Low Proficient", "Nearly Proficient", "Proficient", "Highly Proficient"],
};

const normalizeLevelName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const createLevelRankMap = (options: string[]) =>
  new Map(options.map((option, index) => [normalizeLevelName(option), index]));

const canonicalizeLevelOptions = (subjectKey: SubjectKey, options: string[]) => {
  const fallbackOptions = SUBJECT_LEVEL_FALLBACKS[subjectKey];
  const fallbackByNormalized = new Map(
    fallbackOptions.map((option) => [normalizeLevelName(option), option]),
  );

  const dedupedByNormalized = new Map<string, string>();
  for (const option of options) {
    const normalized = normalizeLevelName(option);
    if (!normalized || dedupedByNormalized.has(normalized)) {
      continue;
    }
    dedupedByNormalized.set(normalized, fallbackByNormalized.get(normalized) ?? option);
  }

  const fallbackOrder = new Map(
    fallbackOptions.map((option, index) => [normalizeLevelName(option), index]),
  );

  return Array.from(dedupedByNormalized.entries())
    .sort(([leftNormalized, leftLabel], [rightNormalized, rightLabel]) => {
      const leftOrder = fallbackOrder.get(leftNormalized);
      const rightOrder = fallbackOrder.get(rightNormalized);
      if (typeof leftOrder === "number" && typeof rightOrder === "number" && leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      if (typeof leftOrder === "number") {
        return -1;
      }
      if (typeof rightOrder === "number") {
        return 1;
      }
      return leftLabel.localeCompare(rightLabel);
    })
    .map(([, label]) => label);
};

const ACTION_BUTTON_CLASSNAME =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50";

type MasterTeacherReportProps = {
  subjectSlug?: string;
};

export default function MasterTeacherReport({ subjectSlug }: MasterTeacherReportProps) {
  const subject = normalizeSubject(subjectSlug);
  const { subjectLabel, Component } = SUBJECT_CONFIG[subject];
  const reportRef = useRef<HTMLDivElement>(null);

  const normalizeGradeValue = useCallback((value: unknown): string => {
    const match = String(value ?? "").match(/(\d+)/);
    const digit = match?.[1] ?? "";
    return ["1", "2", "3", "4", "5", "6"].includes(digit) ? digit : "";
  }, []);

  const formatGradeLabel = useCallback((value: string | null | undefined): string => {
    const numeric = normalizeGradeValue(value);
    return numeric ? `Grade ${numeric}` : "Grade 3";
  }, [normalizeGradeValue]);

  const userProfile = useMemo(() => getStoredUserProfile(), []);
  const userId = useMemo(() => {
    if (!userProfile) {
      return null;
    }
    const raw = userProfile.userId;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === "string") {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }, [userProfile]);

  const fallbackGrade = useMemo(() => {
    const grade = sanitize(userProfile?.gradeLevel ?? "");
    return normalizeGradeValue(grade) || "3";
  }, [normalizeGradeValue, userProfile]);

  const [rowsBySubject, setRowsBySubject] = useState<Record<SubjectKey, RemedialReportRow[]>>(createEmptyRows);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [levelOptions, setLevelOptions] = useState<string[]>(() =>
    canonicalizeLevelOptions(subject, SUBJECT_LEVEL_FALLBACKS[subject]),
  );
  const defaultHeaders = useMemo(() => buildQuarterHeaders(null), []);
  const [monthColumns, setMonthColumns] = useState<RemedialMonthColumn[]>(defaultHeaders.monthColumns);
  const [quarterGroups, setQuarterGroups] = useState<RemedialQuarterGroup[]>(defaultHeaders.quarterGroups);
  const currentMonthNumber = useMemo(() => resolveCurrentMonthNumber(), []);
  const monthlyLoadedRef = useRef<Record<SubjectKey, string>>({
    english: "",
    filipino: "",
    math: "",
  });
  const loadedMonthValuesRef = useRef<Record<SubjectKey, Record<string, Record<string, string>>>>(
    createEmptyMonthValueLookup(),
  );

  const activeRows = useMemo(() => rowsBySubject[subject] ?? [], [rowsBySubject, subject]);
  const displayGradeLevel = useMemo(() => {
    if (activeRows.length > 0) {
      const gradeCandidate = sanitize(activeRows[0].gradeLevel);
      const normalized = normalizeGradeValue(gradeCandidate);
      if (normalized) {
        return normalized;
      }
    }
    return fallbackGrade;
  }, [activeRows, fallbackGrade, normalizeGradeValue]);

  const reportTitle = useMemo(
    () => `Progress Report for ${formatGradeLabel(displayGradeLevel)} - ${subjectLabel}`,
    [displayGradeLevel, formatGradeLabel, subjectLabel],
  );
  const levelRankMap = useMemo(() => createLevelRankMap(levelOptions), [levelOptions]);
  const lockedFieldKeys = useMemo(() => {
    const currentMonthKey = makeMonthKey(currentMonthNumber);
    return monthColumns.some((column) => column.key === currentMonthKey) ? [currentMonthKey] : [];
  }, [currentMonthNumber, monthColumns]);

  const validateMonthProgression = useCallback(
    (row: RemedialReportRow, monthValues: Record<string, string>) => {
      let previousLevel:
        | {
            rank: number;
            label: string;
            monthLabel: string;
          }
        | null = null;

      for (const column of monthColumns) {
        const levelName = sanitize(monthValues[column.key] ?? "");
        if (!levelName) {
          continue;
        }

        const rank = levelRankMap.get(normalizeLevelName(levelName));
        if (typeof rank !== "number") {
          continue;
        }

        if (previousLevel && rank < previousLevel.rank) {
          return `${row.learner}: ${column.label} cannot be lower than ${previousLevel.label} from ${previousLevel.monthLabel}.`;
        }

        previousLevel = {
          rank,
          label: levelName,
          monthLabel: column.label,
        };
      }

      return null;
    },
    [levelRankMap, monthColumns],
  );

  const isLevelOptionDisabled = useCallback(
    (row: RemedialReportRow, field: RemedialReportField, option: string) => {
      const currentValue = sanitize(row.monthValues?.[field] ?? "");
      if (currentValue && normalizeLevelName(currentValue) === normalizeLevelName(option)) {
        return false;
      }

      const optionRank = levelRankMap.get(normalizeLevelName(option));
      if (typeof optionRank !== "number") {
        return false;
      }

      const fieldIndex = monthColumns.findIndex((column) => column.key === field);
      if (fieldIndex === -1) {
        return false;
      }

      let minimumRank: number | null = null;
      for (let index = fieldIndex - 1; index >= 0; index -= 1) {
        const previousValue = sanitize(row.monthValues?.[monthColumns[index].key] ?? "");
        if (!previousValue) {
          continue;
        }
        const previousRank = levelRankMap.get(normalizeLevelName(previousValue));
        if (typeof previousRank === "number") {
          minimumRank = previousRank;
          break;
        }
      }

      let maximumRank: number | null = null;
      for (let index = fieldIndex + 1; index < monthColumns.length; index += 1) {
        const nextValue = sanitize(row.monthValues?.[monthColumns[index].key] ?? "");
        if (!nextValue) {
          continue;
        }
        const nextRank = levelRankMap.get(normalizeLevelName(nextValue));
        if (typeof nextRank === "number") {
          maximumRank = nextRank;
          break;
        }
      }

      if (minimumRank !== null && optionRank < minimumRank) {
        return true;
      }
      if (maximumRank !== null && optionRank > maximumRank) {
        return true;
      }
      return false;
    },
    [levelRankMap, monthColumns],
  );

  useEffect(() => {
    if (!saveFeedback || saveFeedback.tone === "error") {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setSaveFeedback(null);
    }, 3500);
    return () => window.clearTimeout(timeoutId);
  }, [saveFeedback]);

  useEffect(() => {
    const controller = new AbortController();
    const loadSchedule = async () => {
      try {
        const response = await fetch("/api/master_teacher/coordinator/calendar/remedial-schedule", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as { success?: boolean; schedule?: RemedialQuarterSchedule | null } | null;
        if (!response.ok || !payload?.success) {
          return;
        }
        const nextHeaders = buildQuarterHeaders(payload.schedule ?? null);
        setMonthColumns(nextHeaders.monthColumns);
        setQuarterGroups(nextHeaders.quarterGroups);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    };

    loadSchedule();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadLevelOptions = async () => {
      setLevelOptions(canonicalizeLevelOptions(subject, SUBJECT_LEVEL_FALLBACKS[subject]));
      try {
        const response = await fetch(
          `/api/subject-levels?subject=${encodeURIComponent(SUBJECT_LABELS[subject])}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as SubjectLevelOptionResponse | null;
        if (!response.ok || !payload?.success || !Array.isArray(payload.levels)) {
          return;
        }

        const nextOptions = payload.levels
          .map((level) => sanitize(level?.level_name))
          .filter(Boolean);

        if (nextOptions.length) {
          setLevelOptions(canonicalizeLevelOptions(subject, nextOptions));
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }
      }
    };

    void loadLevelOptions();

    return () => controller.abort();
  }, [subject]);

  useEffect(() => {
    if (userId === null) {
      setRowsBySubject(createEmptyRows());
      setIsLoading(false);
      setLoadError("Unable to identify the current user. Please sign in again.");
      loadedMonthValuesRef.current = createEmptyMonthValueLookup();
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      setSaveFeedback(null);
      try {
        const params = new URLSearchParams({
          userId: String(userId),
          subject,
        });
        const response = await fetch(
          `/api/teacher/remedial/students?${params.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as RemedialStudentResponse;
        if (!response.ok || !payload.success || !Array.isArray(payload.students)) {
          throw new Error(payload.error ?? "Failed to load students.");
        }

        const subjectRows = buildRowsForStudents(payload.students, fallbackGrade);
        monthlyLoadedRef.current = {
          english: "",
          filipino: "",
          math: "",
        };
        loadedMonthValuesRef.current = createEmptyMonthValueLookup();
        setRowsBySubject({
          ...createEmptyRows(),
          [subject]: subjectRows,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to load remedial report students", error);
        setRowsBySubject(createEmptyRows());
        setLoadError(error instanceof Error ? error.message : "Failed to load students.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      controller.abort();
    };
  }, [fallbackGrade, subject, userId]);

  useEffect(() => {
    if (!monthColumns.length) return;
    const months = monthColumns
      .map((column) => Number.parseInt(column.key.replace("m", ""), 10))
      .filter((value) => Number.isFinite(value));
    if (!months.length) return;

    const monthKey = monthColumns.map((column) => column.key).join("|");
    const loadForSubject = async (subjectKey: SubjectKey) => {
      if (monthlyLoadedRef.current[subjectKey] === monthKey) return;
      const rows = rowsBySubject[subjectKey] ?? [];
      if (!rows.length) return;
      const studentIds = rows
        .map((row) => row.studentId)
        .filter((value): value is string => Boolean(value));
      if (!studentIds.length) return;

      try {
        const response = await fetch("/api/remedial/assessment/monthly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: SUBJECT_LABELS[subjectKey],
            studentIds,
            months,
          }),
        });
        const payload = (await response.json().catch(() => null)) as MonthlyAssessmentResponse | null;
        if (!response.ok || !payload?.success) {
          return;
        }
        const levelsByStudent = payload.levelsByStudent ?? {};
        setRowsBySubject((prev) => {
          const current = prev[subjectKey] ?? [];
          const updated = current.map((row) => {
            const studentId = row.studentId ?? "";
            const monthValues = levelsByStudent[studentId];
            if (!monthValues) return row;
            return {
              ...row,
              monthValues: {
                ...row.monthValues,
                ...monthValues,
              },
            };
          });
          return { ...prev, [subjectKey]: updated };
        });
        loadedMonthValuesRef.current[subjectKey] = cloneMonthValueLookup(levelsByStudent);
        monthlyLoadedRef.current[subjectKey] = monthKey;
      } catch (error) {
        console.warn("Failed to load monthly assessment levels", error);
      }
    };

    void loadForSubject("english");
    void loadForSubject("filipino");
    void loadForSubject("math");
  }, [monthColumns, rowsBySubject]);

  const handleCellChange = useCallback(
    (subjectKey: SubjectKey, index: number, field: RemedialReportField, value: string) => {
      let validationMessage: string | null = null;
      setRowsBySubject((prev) => {
        const currentRows = prev[subjectKey] ?? [];
        if (!currentRows[index]) {
          return prev;
        }
        const updatedRows = [...currentRows];
        const currentValues = updatedRows[index].monthValues ?? {};
        const nextMonthValues = {
          ...currentValues,
          [field]: value,
        };
        const progressionError = validateMonthProgression(updatedRows[index], nextMonthValues);
        if (progressionError) {
          validationMessage = progressionError;
          return prev;
        }
        updatedRows[index] = {
          ...updatedRows[index],
          monthValues: nextMonthValues,
        };
        return {
          ...prev,
          [subjectKey]: updatedRows,
        };
      });
      if (validationMessage) {
        setSaveFeedback({ tone: "error", message: validationMessage });
      } else {
        setSaveFeedback((previous) => (previous?.tone === "error" ? null : previous));
      }
    },
    [validateMonthProgression],
  );

  const handleEditToggle = useCallback(async () => {
    if (!isEditing) {
      setSaveFeedback(null);
      setIsEditing(true);
      return;
    }

    const progressionError = activeRows
      .map((row) => validateMonthProgression(row, row.monthValues ?? {}))
      .find((message): message is string => Boolean(message));
    if (progressionError) {
      setSaveFeedback({ tone: "error", message: progressionError });
      return;
    }

    const loadedMonthValues = loadedMonthValuesRef.current[subject] ?? {};
    const entries = activeRows.flatMap((row) => {
      const studentId = sanitize(row.studentId);
      if (!studentId) {
        return [];
      }

      return monthColumns.flatMap((column) => {
        const month = Number.parseInt(column.key.replace("m", ""), 10);
        if (!Number.isFinite(month)) {
          return [];
        }

        const currentValue = sanitize(row.monthValues?.[column.key] ?? "");
        const loadedValue = sanitize(loadedMonthValues[studentId]?.[column.key] ?? "");
        if (currentValue === loadedValue) {
          return [];
        }

        return [{ studentId, month, levelName: currentValue }];
      });
    });

    if (!entries.length) {
      setIsEditing(false);
      setSaveFeedback({ tone: "info", message: "No month changes to save." });
      return;
    }

    setIsSaving(true);
    setSaveFeedback(null);

    try {
      const response = await fetch("/api/remedial/assessment/monthly", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: SUBJECT_LABELS[subject],
          entries,
          editorUserId: userId,
          editorRole: userProfile?.role ?? null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as MonthlyAssessmentSaveResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to save monthly report changes.");
      }

      const savedEntries = Array.isArray(payload.savedEntries)
        ? payload.savedEntries
            .map((entry) => ({
              studentId: sanitize(entry.studentId),
              key: sanitize(entry.key),
              levelName: sanitize(entry.levelName),
            }))
            .filter(
              (entry): entry is { studentId: string; key: string; levelName: string } =>
                Boolean(entry.studentId && entry.key),
            )
        : [];
      const clearedEntries = Array.isArray(payload.clearedEntries)
        ? payload.clearedEntries
            .map((entry) => ({
              studentId: sanitize(entry.studentId),
              key: sanitize(entry.key),
            }))
            .filter((entry): entry is { studentId: string; key: string } => Boolean(entry.studentId && entry.key))
        : [];

      setRowsBySubject((prev) => {
        const currentRows = prev[subject] ?? [];
        if (!currentRows.length) {
          return prev;
        }

        const savedByStudent = new Map<string, Record<string, string>>();
        for (const entry of savedEntries) {
          savedByStudent.set(entry.studentId, {
            ...(savedByStudent.get(entry.studentId) ?? {}),
            [entry.key]: entry.levelName,
          });
        }

        const clearedByStudent = new Map<string, string[]>();
        for (const entry of clearedEntries) {
          clearedByStudent.set(entry.studentId, [...(clearedByStudent.get(entry.studentId) ?? []), entry.key]);
        }

        const nextRows = currentRows.map((row) => {
          const studentId = sanitize(row.studentId);
          if (!studentId) {
            return row;
          }

          const savedMonthValues = savedByStudent.get(studentId);
          const clearedMonthKeys = clearedByStudent.get(studentId);
          if (!savedMonthValues && !clearedMonthKeys?.length) {
            return row;
          }

          const nextMonthValues = {
            ...(row.monthValues ?? {}),
            ...(savedMonthValues ?? {}),
          };
          for (const key of clearedMonthKeys ?? []) {
            delete nextMonthValues[key];
          }

          return {
            ...row,
            monthValues: nextMonthValues,
          };
        });

        return {
          ...prev,
          [subject]: nextRows,
        };
      });

      const nextLoadedMonthValues = cloneMonthValueLookup(loadedMonthValues);
      for (const entry of savedEntries) {
        nextLoadedMonthValues[entry.studentId] = {
          ...(nextLoadedMonthValues[entry.studentId] ?? {}),
          [entry.key]: entry.levelName,
        };
      }
      for (const entry of clearedEntries) {
        if (!nextLoadedMonthValues[entry.studentId]) {
          continue;
        }
        delete nextLoadedMonthValues[entry.studentId][entry.key];
        if (!Object.keys(nextLoadedMonthValues[entry.studentId]).length) {
          delete nextLoadedMonthValues[entry.studentId];
        }
      }
      loadedMonthValuesRef.current[subject] = nextLoadedMonthValues;

      const totalChanged =
        (typeof payload.savedCount === "number" ? payload.savedCount : savedEntries.length) +
        (typeof payload.clearedCount === "number" ? payload.clearedCount : clearedEntries.length);

      setIsEditing(false);
      setSaveFeedback({
        tone: "success",
        message: `${totalChanged} month ${totalChanged === 1 ? "change" : "changes"} saved.`,
      });
    } catch (error) {
      console.error("Failed to save monthly report changes", error);
      setSaveFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to save monthly report changes.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [activeRows, isEditing, monthColumns, subject, userId, userProfile?.role, validateMonthProgression]);

  const handlePrint = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
  }, []);

  const handleSubjectCellChange = useCallback(
    (index: number, field: RemedialReportField, value: string) => {
      handleCellChange(subject, index, field, value);
    },
    [handleCellChange, subject],
  );

  const disableActions = isLoading || isSaving || Boolean(loadError) || activeRows.length === 0;

  return (
    <div className="remedial-report-page relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      <div className="print-hidden">
        <Sidebar />
      </div>
      <div className="remedial-report-main relative z-10 flex flex-1 flex-col overflow-hidden pt-16">
        <div className="print-hidden">
          <Header title="Report" />
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="remedial-report-scroll h-full p-4 sm:p-5 md:p-6">
            <div className="remedial-report-surface relative z-10 h-full min-h-100 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-5 md:p-6">
              <div className="print-hidden mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h1 className="text-xl font-bold text-gray-800">{reportTitle}</h1>
                <div className="flex flex-wrap gap-2 md:ml-auto items-center">
                  <div className="flex bg-gray-100 rounded-md p-1">
                    <span
                      aria-current="page"
                      className="inline-flex items-center justify-center rounded-md bg-white px-3 py-1.5 text-xs text-gray-800 shadow-sm sm:text-sm"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 3h16" />
                        <path d="M4 8h16" />
                        <path d="M4 13h16" />
                        <path d="M4 18h16" />
                      </svg>
                    </span>
                    <Link
                      href={`/Teacher/report/${subject}/students`}
                      aria-label="Student report view"
                      className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs text-gray-600 transition hover:text-gray-800 sm:text-sm"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={handleEditToggle}
                    disabled={disableActions}
                    aria-label={isSaving ? "Saving report changes" : isEditing ? "Save report" : "Edit report"}
                    title={isSaving ? "Saving..." : isEditing ? "Save" : "Edit"}
                    className={ACTION_BUTTON_CLASSNAME}
                  >
                    {isEditing ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Pencil className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={disableActions}
                    aria-label="Print report"
                    title="Print"
                    className={ACTION_BUTTON_CLASSNAME}
                  >
                    <Printer className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div ref={reportRef} className="remedial-report-document">
                <div className="print-only remedial-report-print-header">
                  <h1 className="remedial-report-print-title">{reportTitle}</h1>
                </div>
                {isLoading ? (
                  <div className="py-12 text-center text-sm text-gray-500">Loading students...</div>
                ) : loadError ? (
                  <div className="py-12 text-center text-sm text-red-600">{loadError}</div>
                ) : (
                  <div className="report-table-shell">
                    <div className="report-table-printable">
                      <Component
                        rows={activeRows}
                        editable={isEditing}
                        onCellChange={handleSubjectCellChange}
                        monthColumns={monthColumns}
                        quarterGroups={quarterGroups}
                        showRowNumbers
                        lockedFields={lockedFieldKeys}
                        levelOptions={levelOptions}
                        isOptionDisabled={isLevelOptionDisabled}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
      <div className="print-hidden">
        {isSaving ? (
          <ToastActivity
            title="Saving changes"
            message="Saving monthly changes..."
            tone="info"
            timeoutMs={null}
          />
        ) : saveFeedback ? (
          <ToastActivity
            title={
              saveFeedback.tone === "success"
                ? "Changes saved"
                : saveFeedback.tone === "error"
                  ? "Unable to save"
                  : "Report update"
            }
            message={saveFeedback.message}
            tone={saveFeedback.tone}
            onClose={() => setSaveFeedback(null)}
            timeoutMs={saveFeedback.tone === "error" ? null : 3500}
          />
        ) : null}
      </div>
      <style jsx global>{`
        .print-only {
          display: none;
        }

        .remedial-report-page .report-row-number-cell {
          display: none;
        }

        @media print {
          @page {
            size: landscape;
            margin: 12mm;
          }

          html,
          body {
            background: #ffffff !important;
          }

          .print-hidden,
          .no-print {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .remedial-report-page,
          .remedial-report-main,
          .remedial-report-scroll,
          .remedial-report-surface,
          .remedial-report-document {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: "Times New Roman", Times, serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .report-table-printable,
          .report-table-printable * {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            font-family: "Times New Roman", Times, serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .remedial-report-main {
            padding-top: 0 !important;
          }

          .remedial-report-main main {
            overflow: visible !important;
          }

          .remedial-report-scroll {
            padding: 0 !important;
          }

          .remedial-report-surface {
            border: 0 !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            padding: 0 !important;
          }

          .remedial-report-page .pointer-events-none {
            display: none !important;
          }

          .remedial-report-print-header {
            margin: 0 0 12px !important;
            text-align: center !important;
          }

          .remedial-report-print-header::after {
            content: "";
            display: block;
            margin-top: 10px;
            border-top: 2px solid #000000;
          }

          .remedial-report-print-title {
            margin: 0 !important;
            color: #000000 !important;
            font-size: 16pt !important;
            font-weight: 700 !important;
            line-height: 1.2 !important;
            font-family: "Times New Roman", Times, serif !important;
          }

          .report-table-shell,
          .report-table-printable,
          .report-table-printable *,
          .report-table-printable > div,
          .report-table-printable > div > div {
            overflow: visible !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          .report-table-printable table {
            width: 100% !important;
            table-layout: fixed;
            border-collapse: collapse !important;
            font-size: 10.5pt !important;
          }

          .report-table-printable th,
          .report-table-printable td {
            border: 1px solid #666666 !important;
            padding: 8px 6px !important;
            color: #000000 !important;
            font-size: 10.5pt !important;
            line-height: 1.25 !important;
            background: #ffffff !important;
          }

          .report-table-printable .report-row-number-cell {
            display: table-cell !important;
            width: 6%;
          }

          .report-table-printable .report-learner-cell {
            width: 24%;
          }

          .report-table-printable .report-section-cell {
            width: 10%;
          }

          .report-table-printable thead {
            display: table-header-group !important;
          }

          .report-table-printable tfoot {
            display: table-footer-group !important;
          }

          .report-table-printable tr {
            page-break-inside: avoid;
            break-inside: avoid;
            background: #ffffff !important;
          }

          .report-table-printable input {
            width: 100% !important;
            border: 0 !important;
            outline: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            color: #000000 !important;
            box-shadow: none !important;
            font: inherit !important;
            text-align: center !important;
          }
        }
      `}</style>
    </div>
  );
}

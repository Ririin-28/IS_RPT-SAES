"use client";
import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";
import { buildFlashcardContentKey } from "@/lib/utils/flashcards-storage";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

const PAGE_SIZE = 8;

const normalizeLevelLabel = (value?: string | null): string => {
  if (!value) return "";
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
};

const toDisplaySubject = (value: string | null | undefined, fallback: string): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (lower === "math" || lower === "mathematics") return "Mathematics";
  if (lower === "english") return "English";
  if (lower === "filipino") return "Filipino";
  return trimmed.replace(/\b\w/g, (char) => char.toUpperCase());
};

/* ---------- Math flashcards data ---------- */
type MathFlashcard = {
  question: string;
  correctAnswer: string;
};

const INITIAL_FLASHCARDS: MathFlashcard[] = [
  { question: "5 + 3", correctAnswer: "8" },
  { question: "9 - 4", correctAnswer: "5" },
  { question: "6 × 7", correctAnswer: "42" },
  { question: "20 ÷ 4", correctAnswer: "5" },
  { question: "12 + 15", correctAnswer: "27" },
];

/* ---------- Student roster & performance storage ---------- */
const BASE_FLASHCARD_CONTENT_KEY = "MASTER_TEACHER_MATH_FLASHCARDS";

type StudentRecord = {
  id: string;
  studentId: string;
  name: string;
  grade?: string;
  section?: string;
  phonemicLevel?: string;
};

type StudentPerformanceEntry = {
  id: string;
  studentId: string;
  timestamp: string;
  score: number;
  responseTime: number;
  cardIndex: number;
  question: string;
  overallAverage?: number;
};

type SessionScore = {
  cardIndex: number;
  question: string;
  score: number;
  responseTime: number;
  readingSpeedWpm: number;
  transcription?: string | null;
};

type EnrichedStudent = StudentRecord & {
  lastPerformance: StudentPerformanceEntry | null;
};

function isValidMathFlashcardContent(value: unknown): value is MathFlashcard[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as { question?: unknown; correctAnswer?: unknown };
    return typeof candidate.question === "string" && typeof candidate.correctAnswer === "string";
  });
}

type MathFlashcardsProps = {
  students: StudentRecord[];
  performances: StudentPerformanceEntry[];
  onSavePerformance: (entry: StudentPerformanceEntry) => void;
  initialView?: "select" | "session";
  initialStudentId?: string | null;
  forceSessionOnly?: boolean;
  onExit?: () => void;
};

export default function MathFlashcards({
  students,
  performances,
  onSavePerformance,
  initialView,
  initialStudentId,
  forceSessionOnly,
  onExit,
}: MathFlashcardsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const startParam = searchParams?.get("start");
  const activityParam = searchParams?.get("activity") ?? "";
  const subjectParam = searchParams?.get("subject") ?? "";
  const subjectIdParam = searchParams?.get("subjectId");
  const gradeIdParam = searchParams?.get("gradeId");
  const phonemicIdParam = searchParams?.get("phonemicId");
  const phonemicNameParam = searchParams?.get("phonemicName") ?? "";
  const materialIdParam = searchParams?.get("materialId");
  const userProfile = useMemo(() => getStoredUserProfile(), []);
  const userId = useMemo(() => {
    const raw = userProfile?.userId;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }, [userProfile]);
  const flashcardContentKey = useMemo(() => {
    return buildFlashcardContentKey(BASE_FLASHCARD_CONTENT_KEY, {
      activityId: activityParam || null,
      phonemicId: phonemicIdParam || null,
      userId,
    });
  }, [activityParam, phonemicIdParam, userId]);

  const [flashcardsData, setFlashcardsData] = useState<MathFlashcard[]>(INITIAL_FLASHCARDS);
  const startIndex = useMemo(() => {
    if (!startParam) return 0;
    const parsed = Number.parseInt(startParam, 10);
    if (Number.isNaN(parsed)) return 0;
    const maxIndex = Math.max(flashcardsData.length - 1, 0);
    return Math.min(Math.max(parsed, 0), maxIndex);
  }, [flashcardsData.length, startParam]);

  const toNumberParam = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const approvedScheduleId = useMemo(() => toNumberParam(activityParam), [activityParam]);
  const subjectId = useMemo(() => toNumberParam(subjectIdParam), [subjectIdParam]);
  const gradeId = useMemo(() => toNumberParam(gradeIdParam), [gradeIdParam]);
  const phonemicId = useMemo(() => toNumberParam(phonemicIdParam), [phonemicIdParam]);
  const materialId = useMemo(() => toNumberParam(materialIdParam), [materialIdParam]);
  const expectedPhonemicLevel = useMemo(
    () => normalizeLevelLabel(phonemicNameParam),
    [phonemicNameParam],
  );
  const headerLevelLabel = useMemo(() => {
    const subjectLabel = toDisplaySubject(subjectParam, "Mathematics");
    const levelLabel = phonemicNameParam.trim();
    return levelLabel ? `${subjectLabel} ${levelLabel}` : subjectLabel;
  }, [phonemicNameParam, subjectParam]);

  type SessionLockState = { completed: boolean; lastIndex: number; updatedAt: string };
  const sessionLockEnabled = useMemo(() => {
    if (!pathname) return false;
    return pathname.includes("/Teacher/remedial") || pathname.includes("/MasterTeacher/RemedialTeacher/remedial");
  }, [pathname]);
  const sessionKeyBase = useMemo(() => {
    if (!sessionLockEnabled) return null;
    const subjectKey = subjectParam || "subject";
    const activityKey = activityParam || "activity";
    return `remedial-session:${subjectKey}:${activityKey}`;
  }, [activityParam, sessionLockEnabled, subjectParam]);
  const getSessionKey = useCallback(
    (studentId: string | null) => {
      if (!sessionKeyBase || !studentId) return null;
      return `${sessionKeyBase}:${studentId}`;
    },
    [sessionKeyBase],
  );
  const readSessionState = useCallback(
    (studentId: string | null): SessionLockState | null => {
      if (typeof window === "undefined") return null;
      const key = getSessionKey(studentId);
      if (!key) return null;
      try {
        const stored = window.localStorage.getItem(key);
        if (!stored) return null;
        const parsed = JSON.parse(stored) as SessionLockState;
        if (!parsed || typeof parsed !== "object") return null;
        if (typeof parsed.completed !== "boolean") return null;
        if (!Number.isFinite(parsed.lastIndex)) return null;
        if (typeof parsed.updatedAt !== "string") return null;
        return parsed;
      } catch {
        return null;
      }
    },
    [getSessionKey],
  );
  const writeSessionState = useCallback(
    (studentId: string | null, state: SessionLockState) => {
      if (typeof window === "undefined") return;
      const key = getSessionKey(studentId);
      if (!key) return;
      window.localStorage.setItem(key, JSON.stringify(state));
    },
    [getSessionKey],
  );

  const [view, setView] = useState<"select" | "session">(forceSessionOnly ? "session" : (initialView ?? "select"));
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId ?? null);
  const [studentSearch, setStudentSearch] = useState("");
  const [lastSavedStudentId, setLastSavedStudentId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [completedByStudent, setCompletedByStudent] = useState<Record<string, boolean>>({});
  const [dbCompletionByStudent, setDbCompletionByStudent] = useState<Record<string, boolean>>({});
  const [blockedSessionMessage, setBlockedSessionMessage] = useState<string | null>(null);
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [teacherFeedbackError, setTeacherFeedbackError] = useState<string | null>(null);
  const autoStartRef = useRef(false);

  useEffect(() => {
    if (forceSessionOnly) {
      setView("session");
      return;
    }
    setView(initialView ?? "select");
  }, [initialView, forceSessionOnly]);

  useEffect(() => {
    setSelectedStudentId(initialStudentId ?? null);
  }, [initialStudentId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(flashcardContentKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isValidMathFlashcardContent(parsed)) {
          setFlashcardsData(parsed);
          return;
        }
      }

      window.localStorage.setItem(flashcardContentKey, JSON.stringify(INITIAL_FLASHCARDS));
      setFlashcardsData(INITIAL_FLASHCARDS);
    } catch (error) {
      console.warn("Failed to load math flashcard content", error);
      setFlashcardsData(INITIAL_FLASHCARDS);
    }
  }, [flashcardContentKey]);

  useEffect(() => {
    if (lastSavedStudentId) {
      const timer = window.setTimeout(() => setLastSavedStudentId(null), 4000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [lastSavedStudentId]);

  useEffect(() => {
    if (!blockedSessionMessage) return undefined;
    const timer = window.setTimeout(() => setBlockedSessionMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [blockedSessionMessage]);

  useEffect(() => {
    if (!sessionKeyBase || typeof window === "undefined") return;
    const next: Record<string, boolean> = {};
    for (const student of students) {
      const state = readSessionState(student.id);
      if (state?.completed) {
        next[student.id] = true;
      }
    }
    setCompletedByStudent(next);
  }, [students, readSessionState, sessionKeyBase]);

  useEffect(() => {
    if (!sessionLockEnabled || !approvedScheduleId || !subjectId || !students.length) {
      setDbCompletionByStudent({});
      return;
    }

    const controller = new AbortController();
    const loadCompletion = async () => {
      try {
        const response = await fetch("/api/remedial/session/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            approvedScheduleId,
            subjectId,
            phonemicId: phonemicId ?? null,
            studentIds: students.map((student) => student.id),
          }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; statusByStudent?: Record<string, { completed?: boolean }> }
          | null;

        if (!response.ok || !payload?.success) {
          return;
        }

        const next: Record<string, boolean> = {};
        const status = payload.statusByStudent ?? {};
        for (const student of students) {
          next[student.id] = Boolean(status[student.id]?.completed);
        }
        setDbCompletionByStudent(next);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    };

    loadCompletion();
    return () => controller.abort();
  }, [approvedScheduleId, phonemicId, sessionLockEnabled, students, subjectId]);

  useEffect(() => {
    if (!sessionLockEnabled) {
      setBlockedSessionMessage(null);
      return;
    }
    const isDbCompleted = selectedStudentId ? Boolean(dbCompletionByStudent[selectedStudentId]) : false;
    if (isDbCompleted) {
      setBlockedSessionMessage("This remedial session was already completed for this student.");
      return;
    }
    const state = readSessionState(selectedStudentId);
    if (state?.completed) {
      setBlockedSessionMessage("This remedial session was already completed for this student.");
      return;
    }
  }, [dbCompletionByStudent, readSessionState, selectedStudentId, sessionLockEnabled]);

  const enrichedStudents = useMemo<EnrichedStudent[]>(() => {
    const latestByStudent = new Map<string, StudentPerformanceEntry>();
    for (const entry of performances) {
      const current = latestByStudent.get(entry.studentId);
      if (!current || current.timestamp < entry.timestamp) {
        latestByStudent.set(entry.studentId, entry);
      }
    }

    return students.map((student) => ({
      ...student,
      lastPerformance: latestByStudent.get(student.id) ?? null,
    }));
  }, [students, performances]);

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return enrichedStudents;
    return enrichedStudents.filter((student) => {
      const haystack = [student.studentId, student.name, student.section, student.grade]
        .map((value) => value?.toLowerCase?.() ?? "")
        .join(" ");
      return haystack.includes(term);
    });
  }, [enrichedStudents, studentSearch]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return enrichedStudents.find((student) => student.id === selectedStudentId) ?? null;
  }, [enrichedStudents, selectedStudentId]);

  const lastSavedStudent = useMemo(() => {
    if (!lastSavedStudentId) return null;
    return enrichedStudents.find((student) => student.id === lastSavedStudentId) ?? null;
  }, [enrichedStudents, lastSavedStudentId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [studentSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, currentPage]);

  useEffect(() => {
    if (forceSessionOnly) {
      return;
    }
    if (view === "session" && !selectedStudent) {
      setView("select");
    }
  }, [forceSessionOnly, selectedStudent, view]);

  const [current, setCurrent] = useState(startIndex);
  const [sessionScores, setSessionScores] = useState<SessionScore[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const hasRecordedScoreForCurrent = useMemo(
    () => sessionScores.some((item) => item.cardIndex === current),
    [current, sessionScores],
  );

  useEffect(() => {
    if (flashcardsData.length === 0) {
      setCurrent(0);
      return;
    }
    setCurrent((prev) => Math.min(Math.max(prev, 0), flashcardsData.length - 1));
  }, [flashcardsData.length]);

  useEffect(() => {
    setCurrent(startIndex);
  }, [startIndex]);

  const { question, correctAnswer } = flashcardsData[current] ?? { question: "", correctAnswer: "" };

  const validateInput = (input: string): boolean => {
    const validPattern = /^[0-9.\-]*$/;
    return validPattern.test(input);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (validateInput(value) || value === "") {
      setUserAnswer(value);
    }
  };

  const resetFields = useCallback(() => {
    setUserAnswer("");
    setFeedback("");
    setRate(null);
    setScore(null);
    setStartTime(Date.now());
  }, []);

  const upsertSessionScore = useCallback(
    (cardIndex: number, questionText: string, sc: { score: number; responseTime: number; transcription?: string | null }) => {
      setSessionScores((prev) => {
        const next = prev.filter((item) => item.cardIndex !== cardIndex);
        const speedWpm = sc.responseTime > 0 ? Math.round(60 / sc.responseTime) : 0;
        next.push({
          cardIndex,
          question: questionText,
          score: sc.score,
          responseTime: sc.responseTime,
          readingSpeedWpm: speedWpm,
          transcription: sc.transcription ?? null,
        });
        return next.sort((a, b) => a.cardIndex - b.cardIndex);
      });
    },
    [],
  );

  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "—";
    const totalSeconds = Math.round(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins === 0) return `${totalSeconds} sec${totalSeconds === 1 ? "" : "s"}`;
    const secsPart = secs > 0 ? ` ${secs} sec${secs === 1 ? "" : "s"}` : "";
    return `${mins} min${mins === 1 ? "" : "s"}${secsPart}`;
  };

  const updateSessionProgress = useCallback(
    (nextIndex: number) => {
      if (!sessionLockEnabled || !selectedStudentId) return;
      const currentState = readSessionState(selectedStudentId) ?? {
        completed: false,
        lastIndex: nextIndex,
        updatedAt: new Date().toISOString(),
      };
      if (nextIndex <= currentState.lastIndex) return;
      const updated: SessionLockState = {
        ...currentState,
        lastIndex: nextIndex,
        updatedAt: new Date().toISOString(),
      };
      writeSessionState(selectedStudentId, updated);
    },
    [readSessionState, selectedStudentId, sessionLockEnabled, writeSessionState],
  );

  const handlePrev = () => {
    if (sessionLockEnabled) return;
    setCurrent((prev) => Math.max(prev - 1, 0));
    resetFields();
  };

  const handleNext = () => {
    if (!hasRecordedScoreForCurrent) {
      setFeedback("Please submit an answer before moving to the next card.");
      return;
    }
    setCurrent((prev) => {
      if (showSummary) return prev;
      if (flashcardsData.length === 0) return 0;
      if (prev >= flashcardsData.length - 1) {
        setShowSummary(true);
        return prev;
      }
      const nextIndex = Math.min(prev + 1, flashcardsData.length - 1);
      if (sessionLockEnabled && nextIndex > prev) {
        updateSessionProgress(nextIndex);
      }
      return nextIndex;
    });
    resetFields();
  };

  const handleStartSession = useCallback(async (studentId: string) => {
    const selectedStudent = students.find((student) => student.id === studentId);
    const studentLevel = normalizeLevelLabel(selectedStudent?.phonemicLevel ?? "");
    if (expectedPhonemicLevel && studentLevel && expectedPhonemicLevel !== studentLevel) {
      setBlockedSessionMessage(
        `This student is assigned to ${selectedStudent?.phonemicLevel ?? "their level"} and cannot take ${phonemicNameParam} level.`,
      );
      return;
    }
    if (sessionLockEnabled) {
      if (dbCompletionByStudent[studentId]) {
        setBlockedSessionMessage("This remedial session was already completed for this student.");
        return;
      }
      const state = readSessionState(studentId);
      if (state?.completed) {
        setBlockedSessionMessage("This remedial session was already completed for this student.");
        return;
      }
    }
    setSelectedStudentId(studentId);
    const localLastIndex = readSessionState(studentId)?.lastIndex ?? startIndex;
    let resumeIndex = sessionLockEnabled
      ? Math.max(startIndex, localLastIndex)
      : startIndex;
    setSessionScores([]);
    setShowSummary(false);
    resetFields();
    if (sessionLockEnabled && approvedScheduleId) {
      try {
        const response = await fetch(
          `/api/remedial/session?studentId=${encodeURIComponent(studentId)}&approvedScheduleId=${encodeURIComponent(String(approvedScheduleId))}`,
        );
        const payload = (await response.json().catch(() => null)) as
          | {
              success?: boolean;
              found?: boolean;
              slides?: Array<{
                flashcardIndex: number;
                pronunciationScore: number;
                accuracyScore: number;
                fluencyScore: number;
                completenessScore: number;
                readingSpeedWpm: number;
                slideAverage: number;
                expectedText?: string | null;
                transcription?: string | null;
              }>;
            }
          | null;

        if (response.ok && payload?.success && payload.found && Array.isArray(payload.slides)) {
          const nextScores: SessionScore[] = payload.slides.map((slide) => {
            const speedWpm = Number.isFinite(slide.readingSpeedWpm) ? slide.readingSpeedWpm : 0;
            const responseTime = speedWpm > 0 ? Math.max(1, Math.round(60 / speedWpm)) : 0;
            return {
              cardIndex: slide.flashcardIndex,
              question: slide.expectedText ?? flashcardsData[slide.flashcardIndex]?.question ?? "",
              score: slide.slideAverage,
              responseTime,
              readingSpeedWpm: speedWpm,
              transcription: slide.transcription ?? null,
            };
          });

          setSessionScores(nextScores);
          const maxSavedIndex = nextScores.reduce((max, item) => Math.max(max, item.cardIndex), -1);
          resumeIndex = Math.max(resumeIndex, maxSavedIndex + 1);
          const lastIndex = Math.max(localLastIndex, maxSavedIndex);
          writeSessionState(studentId, {
            completed: false,
            lastIndex,
            updatedAt: new Date().toISOString(),
          });
        } else if (sessionLockEnabled) {
          writeSessionState(studentId, {
            completed: false,
            lastIndex: resumeIndex,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch {
        if (sessionLockEnabled) {
          writeSessionState(studentId, {
            completed: false,
            lastIndex: resumeIndex,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } else if (sessionLockEnabled) {
      writeSessionState(studentId, {
        completed: false,
        lastIndex: resumeIndex,
        updatedAt: new Date().toISOString(),
      });
    }
    const boundedResume = Math.min(Math.max(resumeIndex, 0), Math.max(0, flashcardsData.length - 1));
    setCurrent(boundedResume);
    setView("session");
  }, [
    approvedScheduleId,
    dbCompletionByStudent,
    expectedPhonemicLevel,
    flashcardsData,
    phonemicNameParam,
    readSessionState,
    resetFields,
    sessionLockEnabled,
    startIndex,
    students,
    writeSessionState,
  ]);

  useEffect(() => {
    if (!forceSessionOnly || !initialStudentId || autoStartRef.current) return;
    autoStartRef.current = true;
    void handleStartSession(initialStudentId);
  }, [forceSessionOnly, handleStartSession, initialStudentId]);

  const handleStopSession = async () => {
    if (showSummary && sessionLockEnabled && !teacherFeedback.trim()) {
      setTeacherFeedbackError("Teacher feedback is required before saving this session.");
      return;
    }
    const activeQuestion = flashcardsData[current]?.question ?? "";
    const overallAverageForSave = sessionScores.length
      ? Math.round(
          sessionScores.reduce((sum, item) => sum + item.score, 0) /
            Math.max(1, sessionScores.length),
        )
      : score ?? 0;

    const averageTimeForSave = sessionScores.length
      ? sessionScores.reduce((sum, item) => sum + item.responseTime, 0) /
          Math.max(1, sessionScores.length)
      : rate ?? 0;

    if (selectedStudentId !== null && (sessionScores.length || (score !== null && rate !== null))) {
      onSavePerformance({
        id: `perf-${Date.now()}`,
        studentId: selectedStudentId,
        timestamp: new Date().toISOString(),
        score: overallAverageForSave,
        responseTime: averageTimeForSave,
        cardIndex: showSummary ? -1 : current,
        question: activeQuestion,
        overallAverage: overallAverageForSave,
      });
      setLastSavedStudentId(selectedStudentId);
    }

    if (
      sessionLockEnabled &&
      selectedStudentId &&
      approvedScheduleId &&
      subjectId &&
      gradeId &&
      sessionScores.length
    ) {
      const slides = sessionScores.map((item) => ({
        flashcardIndex: item.cardIndex,
        expectedText: item.question,
        pronunciationScore: item.score,
        accuracyScore: item.score,
        fluencyScore: item.score,
        completenessScore: item.score,
        readingSpeedWpm: item.readingSpeedWpm,
        slideAverage: item.score,
        transcription: item.transcription ?? null,
      }));

      try {
        const response = await fetch("/api/remedial/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: selectedStudentId,
            approvedScheduleId,
            subjectId,
            gradeId,
            phonemicId: phonemicId ?? null,
            materialId: materialId ?? null,
            completed: showSummary,
            slides,
            teacherFeedback: teacherFeedback.trim() || null,
          }),
        });

        if (!response.ok && response.status !== 409) {
          const payload = await response.json().catch(() => null);
          console.warn("Failed to save remedial session", payload?.error ?? response.statusText);
        }
      } catch (error) {
        console.warn("Failed to save remedial session", error);
      }
    }

    if (sessionLockEnabled && selectedStudentId) {
      const existing = readSessionState(selectedStudentId) ?? {
        completed: false,
        lastIndex: current,
        updatedAt: new Date().toISOString(),
      };
      const lastIndexReached = Math.max(existing.lastIndex ?? 0, current);
      const hasScores = sessionScores.length > 0 || (score !== null && rate !== null);
      const completed =
        hasScores &&
        lastIndexReached >= Math.max(0, flashcardsData.length - 1) &&
        (showSummary || current >= flashcardsData.length - 1);
      const updated: SessionLockState = {
        ...existing,
        completed,
        lastIndex: lastIndexReached,
        updatedAt: new Date().toISOString(),
      };
      writeSessionState(selectedStudentId, updated);
      if (completed) {
        setCompletedByStudent((prev) => ({ ...prev, [selectedStudentId]: true }));
      }
    }

    resetFields();
    setSessionScores([]);
    setShowSummary(false);
    setCurrent(startIndex);
    setTeacherFeedback("");
    setTeacherFeedbackError(null);
    if (forceSessionOnly) {
      if (onExit) {
        onExit();
        return;
      }
      setSelectedStudentId((prev) => prev ?? initialStudentId ?? students[0]?.id ?? null);
      setView("session");
      return;
    }
    setSelectedStudentId(null);
    setView("select");
  };

  const handleBackToDashboard = () => {
    if (onExit) {
      onExit();
      return;
    }
    router.back();
  };

  useEffect(() => {
    resetFields();
  }, [current, resetFields, setUserAnswer, setFeedback, setRate, setScore, setStartTime]);

  const handleSubmit = () => {
    if (!userAnswer.trim()) {
      setFeedback("Please enter your answer first.");
      return;
    }

    const endTime = Date.now();
    const durationSec = (endTime - (startTime || endTime)) / 1000;
    setRate(durationSec);

    const isCorrect = userAnswer.trim() === correctAnswer;
    setScore(isCorrect ? 100 : 0);

    if (isCorrect) {
      if (durationSec < 3) setFeedback("Excellent speed and accuracy! ⚡");
      else if (durationSec < 6) setFeedback("Good job! Try to be faster next time.");
      else setFeedback("Correct! But a bit slow ⏱️");
    } else {
      setFeedback("Incorrect. Try again!");
    }

    // Log the interaction
    if (selectedStudentId) {
      onSavePerformance({
        id: `perf-${Date.now()}`,
        studentId: selectedStudentId,
        timestamp: new Date().toISOString(),
        score: isCorrect ? 100 : 0,
        responseTime: durationSec,
        cardIndex: current,
        question: question,
      });
    }

    upsertSessionScore(current, question, { score: isCorrect ? 100 : 0, responseTime: durationSec, transcription: userAnswer.trim() });
  };

  const selectionRows = paginatedStudents.map((student, index) => ({
    ...student,
    no: (currentPage - 1) * PAGE_SIZE + index + 1,
    lastAccuracy: student.lastPerformance
      ? `${(student.lastPerformance.overallAverage ?? student.lastPerformance.score).toFixed(0)}%`
      : "—",
  }));

  const selectionSummaryText = filteredStudents.length
    ? `Showing ${selectionRows.length} of ${filteredStudents.length} students • Page ${currentPage} of ${totalPages}`
    : "No students match your search.";

  const paginationControls = totalPages > 1 && (
    <div className="mt-5 flex items-center justify-end gap-3">
      <button
        className="rounded-full border border-[#013300] px-4 py-1.5 text-sm font-medium text-[#013300] disabled:opacity-40"
        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
        disabled={currentPage === 1}
      >
        Prev page
      </button>
      <button
        className="rounded-full border border-[#013300] px-4 py-1.5 text-sm font-medium text-[#013300] disabled:opacity-40"
        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
        disabled={currentPage === totalPages}
      >
        Next page
      </button>
    </div>
  );

  if (!forceSessionOnly && view === "select") {
    return (
      <div className="min-h-dvh bg-linear-to-br from-[#f2f8f4] via-white to-[#e6f2ec]">
        <div className="w-full max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex min-h-dvh flex-col">
          <header className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur px-8 py-5 sm:py-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between shadow-md shadow-gray-200">
            <div className="space-y-3 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">{headerLevelLabel}</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#0d1b16]">Remedial Flashcards</h1>
            </div>
            <button
              onClick={handleBackToDashboard}
              className="inline-flex items-center gap-2 rounded-full border border-[#013300] px-6 py-3 text-sm font-semibold text-[#013300] transition hover:bg-emerald-50"
            >
              <FiArrowLeft /> Back
            </button>
          </header>

          {lastSavedStudent && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm shadow-emerald-100">
              Latest accuracy for <span className="font-semibold">{lastSavedStudent.name}</span> has been saved.
            </div>
          )}

          {blockedSessionMessage && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm shadow-amber-100">
              {blockedSessionMessage}
            </div>
          )}

          <div className="mt-5 rounded-3xl border border-gray-300 bg-white shadow-md shadow-gray-200 p-6 space-y-6 flex flex-1 flex-col min-h-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-gray-600">{selectionSummaryText}</p>
              <div>
                <input
                  type="text"
                  placeholder="Search Students..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 text-black"
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <TableList
                columns={[
                  { key: "no", title: "No#" },
                  { key: "studentId", title: "Student ID" },
                  { key: "name", title: "Full Name" },
                  { key: "grade", title: "Grade" },
                  { key: "section", title: "Section" },
                  { key: "lastAccuracy", title: "Average" },
                ]}
                data={selectionRows}
                actions={(row: any) => {
                  const isCompleted = Boolean(
                    sessionLockEnabled &&
                      (dbCompletionByStudent[row.id] || completedByStudent[row.id]),
                  );
                  const resumeState = Boolean(
                    sessionLockEnabled &&
                      !isCompleted &&
                      (readSessionState(row.id)?.lastIndex ?? 0) > 0,
                  );
                  const label = isCompleted ? "Completed" : resumeState ? "Resume" : "Start";
                  return (
                    <UtilityButton
                      small
                      onClick={() => handleStartSession(row.id)}
                      disabled={isCompleted}
                      className={isCompleted ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      {label}
                    </UtilityButton>
                  );
                }}
                pageSize={PAGE_SIZE}
              />
            </div>

            {paginationControls}
          </div>
        </div>
      </div>
    );
  }

  if (sessionLockEnabled && blockedSessionMessage && forceSessionOnly) {
    return (
      <div className="min-h-dvh bg-linear-to-br from-[#f2f8f4] via-white to-[#e6f2ec]">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex min-h-dvh flex-col items-center justify-center">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-center text-amber-900 shadow-sm">
            <p className="text-lg font-semibold">Session Locked</p>
            <p className="mt-2 text-sm">{blockedSessionMessage}</p>
            <button
              onClick={handleBackToDashboard}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-300 px-6 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
            >
              <FiArrowLeft /> Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedStudent) {
    return null;
  }

  const progressPercent = flashcardsData.length
    ? (showSummary ? 100 : ((current + 1) / flashcardsData.length) * 100)
    : 0;
  const progressCircleStyle: CSSProperties = {
    background: `conic-gradient(#013300 ${progressPercent * 3.6}deg, #e6f4ef ${progressPercent * 3.6}deg)`,
  };

  // --- Get previewHeaderLabel from student name for main title, and subtitle from student name or a new prop ---
  // If the student name contains 'Preview', extract the subject and level for the subtitle
  let subtitle = phonemicNameParam || subjectParam ? headerLevelLabel : "";
  let mainTitle = selectedStudent.name;
  const previewRegex = /^(English|Filipino|Math) Preview$/i;
  const headerLabelRegex = /^(English|Filipino|Math) • (.+) Level$/i;
  if (headerLabelRegex.test(selectedStudent.name)) {
    // If the name is like 'Math • Proficient Level', split it
    const match = selectedStudent.name.match(headerLabelRegex);
    if (match) {
      const subject = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      subtitle = `${subject} • ${match[2]} Level`;
      mainTitle = `${subject} Preview`;
    }
  } else if (previewRegex.test(selectedStudent.name)) {
    // If the name is just 'Math Preview', keep as is
    mainTitle = selectedStudent.name;
    subtitle = "";
  }

  const buildMathInsights = (scores: SessionScore[]) => {
    if (!scores.length) return null;
    const avg = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    const scoreAvg = Math.round(avg(scores.map((item) => item.score ?? 0)));
    const timeAvg = avg(scores.map((item) => item.responseTime ?? 0));
    const timeAvgRounded = Math.round(timeAvg * 10) / 10;
    const weaknesses: string[] = [];
    const strengths: string[] = [];

    const accuracyLabel = scoreAvg < 60 ? "low" : scoreAvg < 75 ? "fair" : scoreAvg >= 85 ? "strong" : "ok";
    const speedLabel = timeAvg <= 4 ? "fast" : timeAvg <= 6 ? "steady" : "slow";

    if (scoreAvg < 75) weaknesses.push("getting answers right");
    if (timeAvg > 6) weaknesses.push("solving problems quickly");

    if (scoreAvg >= 85) strengths.push("good accuracy");
    if (timeAvg <= 4) strengths.push("fast problem solving");

    const recommendations: string[] = [];
    if (scoreAvg < 75) recommendations.push("practice 10–15 problems per session, three times a week");
    if (timeAvg > 6) recommendations.push("add short timed drills twice a week to build speed");
    if (!recommendations.length) {
      recommendations.push("keep a steady practice routine 2–3 times a week");
    }

    const formatList = (items: string[]) => {
      if (!items.length) return "";
      if (items.length === 1) return items[0];
      if (items.length === 2) return `${items[0]} and ${items[1]}`;
      return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
    };

    const confidence = scores.length >= 6 ? "High" : scores.length >= 3 ? "Medium" : "Low";
    const summary = weaknesses.length
      ? `Needs focus on ${formatList(weaknesses)}.`
      : "Strong overall performance in this session.";

    return {
      scoreAvg,
      timeAvg: timeAvgRounded,
      accuracyLabel,
      speedLabel,
      weaknesses,
      strengths,
      recommendations,
      confidence,
      summary,
    };
  };

  const buildInsightParagraph = (studentName: string, insights: ReturnType<typeof buildMathInsights>) => {
    if (!insights) return "Record a few slides to generate insights.";
    const name = studentName || "The student";
    const weaknessText = insights.weaknesses.length
      ? `${name} is having difficulty with ${insights.weaknesses.join(" and ")}.`
      : `${name} shows no major weaknesses in this session.`;
    const strengthText = insights.strengths.length
      ? `Strengths include ${insights.strengths.join(" and ")}.`
      : "Strengths are still building as more data is collected.";
    const recommendationText = insights.recommendations.length
      ? `Recommended next steps: ${insights.recommendations.join(" and ")}.`
      : "Recommended next steps will appear after more recorded slides.";

    return `${weaknessText} ${strengthText} ${recommendationText}`;
  };

  if (showSummary) {
    const overallAverage = sessionScores.length
      ? Math.round(
          sessionScores.reduce((sum, item) => sum + item.score, 0) /
            Math.max(1, sessionScores.length),
        )
      : 0;
    const insights = buildMathInsights(sessionScores);
    const insightParagraph = buildInsightParagraph(selectedStudent?.name ?? "", insights);

    return (
      <div className="min-h-dvh bg-linear-to-br from-[#f2f8f4] via-white to-[#e6f2ec]">
        <div className="w-full max-w-8xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex min-h-dvh flex-col gap-5">
          <header className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur px-8 py-5 flex flex-col gap-2 shadow-md shadow-gray-200">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Session Summary</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-black">Overall Performance</h1>
          </header>

          <div className="grid gap-4 lg:grid-cols-12">
            <div className="rounded-3xl border border-gray-300 bg-white shadow-md shadow-gray-200 p-6 flex flex-col gap-3 lg:col-span-3">
              <p className="text-3xl sm:text-2xl font-bold text-black">Total Average</p>
              <p className="text-7xl font-bold text-[#013300]">{overallAverage}%</p>
              <p className="text-sm text-slate-600">Based on {sessionScores.length} slide{sessionScores.length === 1 ? "" : "s"} with recorded scores.</p>
            </div>
            <div className="rounded-3xl border border-gray-300 bg-white shadow-md shadow-gray-200 p-6 flex flex-col gap-3 lg:col-span-9 min-h-[320px]">
              <p className="text-3xl sm:text-2xl font-bold text-black">Per-Slide Scores</p>
              <div className="overflow-auto -mx-4 px-4">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-2 pr-3">Slide</th>
                      <th className="py-2 pr-3">Question</th>
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionScores.length === 0 ? (
                      <tr>
                        <td className="py-3 text-slate-600" colSpan={4}>No recorded scores yet.</td>
                      </tr>
                    ) : (
                      sessionScores.map((item) => (
                        <tr key={item.cardIndex} className="border-t border-gray-200">
                          <td className="py-2 pr-3 font-bold text-[#013300]">{item.cardIndex + 1}</td>
                          <td className="py-2 pr-3 font-medium text-[#013300]">{item.question}</td>
                          <td className="py-2 pr-3 font-medium text-[#013300]">{formatDuration(item.responseTime)}</td>
                          <td className="py-2 pr-3 font-medium text-[#013300]">{item.score}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-white shadow-md shadow-emerald-100 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">AI Driven Insights</p>
              <h2 className="text-2xl font-bold text-black">Feedback &amp; Recommendations</h2>
            </div>
            <p className="mt-3 text-md text-slate-700 leading-relaxed">
              {insightParagraph}
            </p>

          </div>

          {sessionLockEnabled && (
            <div className="rounded-3xl border border-emerald-200 bg-white shadow-md shadow-emerald-100 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Teacher Feedback</p>
                <h2 className="text-2xl font-bold text-black">Required Notes</h2>
              </div>
              <textarea
                value={teacherFeedback}
                onChange={(event) => {
                  setTeacherFeedback(event.target.value);
                  if (teacherFeedbackError) setTeacherFeedbackError(null);
                }}
                className="mt-3 w-full min-h-[120px] rounded-2xl border border-emerald-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                placeholder="Write your feedback on the student's performance."
                required
              />
              {teacherFeedbackError && (
                <p className="mt-2 text-sm font-medium text-rose-600">{teacherFeedbackError}</p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-3 mt-auto">
            {!sessionLockEnabled && (
              <button
                onClick={() => setShowSummary(false)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#013300] px-6 py-3 text-sm font-medium text-[#013300] transition hover:border-[#013300] hover:bg-emerald-50 w-full sm:w-auto"
              >
                <FiArrowLeft /> Back to Cards
              </button>
            )}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                onClick={handleStopSession}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#013300] px-7 py-3 text-sm font-medium text-white shadow-md shadow-gray-200 transition hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 active:scale-95 w-full sm:w-auto"
              >
                <span className="h-2 w-2 rounded-full bg-white/70" /> Save &amp; Exit
              </button>
              {!sessionLockEnabled && (
                <button
                  onClick={() => {
                    setCurrent(0);
                    setSessionScores([]);
                    setShowSummary(false);
                    resetFields();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#013300] px-6 py-3 text-sm font-medium text-[#013300] transition hover:border-[#013300] hover:bg-emerald-50 w-full sm:w-auto"
                >
                  Restart Session
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-linear-to-br from-[#f2f8f4] via-white to-[#e6f2ec]">
      <div className="w-full max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex min-h-dvh flex-col">
        <header className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur px-6 py-5 sm:py-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between shadow-md shadow-gray-200">
          <div className="space-y-1 text-center lg:text-left">
            {subtitle && (
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">{subtitle}</p>
            )}
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0d1b16]">{mainTitle}</h1>
          </div>
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center lg:justify-end">
            <div className="relative grid place-items-center">
              <div className="w-20 h-20 rounded-full ring-8 ring-emerald-50 shadow-inner" style={progressCircleStyle} />
              <div className="absolute inset-3 rounded-full bg-white" />
              <span className="absolute text-lg font-semibold text-[#013300]">{Math.round(progressPercent)}%</span>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs uppercase tracking-wide text-slate-500">Card</p>
              <p className="text-xl font-semibold text-[#013300]">
                {current + 1} <span className="text-base font-normal text-slate-400">/ {flashcardsData.length}</span>
              </p>
            </div>
          </div>
        </header>

        <div className="mt-5 flex flex-1 flex-col gap-5">
          <div className="grid gap-3 xl:grid-cols-12 flex-1 min-h-0">
            <section className="xl:col-span-8 flex flex-col min-h-0">
              <div className="h-full rounded-3xl border border-gray-300 bg-white shadow-md shadow-gray-200 overflow-hidden flex flex-col">
                <div className="flex-1 px-6 sm:px-8 lg:px-12 py-12 flex flex-col items-center justify-center text-center gap-6">
                  <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
                    <p className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#013300] leading-tight">
                      {question}
                    </p>
                  </div>
                  <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                    <p className="text-sm font-semibold text-slate-700 text-center">Your answer</p>
                    <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
                      <input
                        type="text"
                        value={userAnswer}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg font-semibold text-[#013300] transition focus:border-[#013300] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#013300]/30"
                        placeholder="Type and submit"
                        inputMode="decimal"
                        pattern="[0-9.\-]*"
                        title="Only numbers, decimal point, and minus sign are allowed"
                      />
                      <button
                        onClick={handleSubmit}
                        className="w-full rounded-xl bg-[#013300] px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-green-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#013300]/60 md:w-auto"
                      >
                        Check Answer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="xl:col-span-4 flex flex-col gap-6 min-h-0">
              <div className="rounded-3xl border border-gray-300 bg-white/80 backdrop-blur px-6 py-7 shadow-md shadow-gray-200 flex flex-1 flex-col min-h-0">
                <h2 className="text-lg font-semibold text-[#013300]">Real-time Insights</h2>
                <div className="mt-6 flex flex-1 flex-col gap-4 min-h-0">
                  <div className="rounded-2xl border border-gray-300 bg-emerald-50/60 px-4 py-3 flex flex-col flex-1">
                    <p className="text-xs uppercase tracking-wide text-emerald-800">Remarks</p>
                    <p className="mt-1 text-sm font-medium text-[#013300]">
                      {feedback || "Submit an answer to see how you did."}
                    </p>
                  </div>
                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 auto-rows-fr">
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Result</dt>
                      <dd
                        className={`text-lg font-semibold ${score === 100 ? "text-[#013300]" : score === 0 ? "text-red-600" : "text-[#013300]"
                          }`}
                      >
                        {score === null ? "—" : score === 100 ? "Correct" : "Wrong"}
                      </dd>
                    </div>
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Correct answer</dt>
                      <dd className="text-lg font-semibold text-[#013300]">••••••</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </aside>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-center gap-3 w-full">
              <button
                onClick={handlePrev}
                disabled={current === 0 || sessionLockEnabled}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#013300] px-6 py-3 text-sm font-medium text-[#013300] transition hover:border-[#013300] hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-transparent w-full sm:w-auto"
              >
                <FiArrowLeft /> Previous
              </button>
              <button
                onClick={handleStopSession}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#013300] px-7 py-3 text-sm font-medium text-white shadow-md shadow-gray-200 transition hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 active:scale-95 w-full sm:w-auto"
              >
                <span className="h-2 w-2 rounded-full bg-white/70" /> Save &amp; Exit
              </button>
              <button
                onClick={handleNext}
                disabled={!hasRecordedScoreForCurrent}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#013300] px-6 py-3 text-sm font-medium text-[#013300] transition hover:border-[#013300] hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-transparent w-full sm:w-auto"
              >
                {current === flashcardsData.length - 1 ? "Summary" : "Next"} <FiArrowRight />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

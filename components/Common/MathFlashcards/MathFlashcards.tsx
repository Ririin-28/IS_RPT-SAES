"use client";
import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";
import { buildFlashcardContentKey } from "@/lib/utils/flashcards-storage";
import { getAiInsightsAction } from "@/app/actions/get-ai-insights";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

const ALLOW_BROWSER_FALLBACK = process.env.NEXT_PUBLIC_ALLOW_SPEECH_FALLBACK === "true";

/* ---------- Icons ---------- */
const Volume2Icon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/>
    <path d="M16 9a5 5 0 0 1 0 6"/>
    <path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>
  </svg>
);

const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19v3"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <rect x="9" y="2" width="6" height="13" rx="3"/>
  </svg>
);
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

const KNOWN_SUFFIXES = new Set([
  "jr",
  "jr.",
  "sr",
  "sr.",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
]);

const formatSuffix = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (lower === "jr" || lower === "jr.") return "Jr.";
  if (lower === "sr" || lower === "sr.") return "Sr.";
  if (KNOWN_SUFFIXES.has(lower)) return trimmed.toUpperCase();
  return trimmed;
};

const formatStudentName = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase().includes("preview")) return trimmed;

  if (trimmed.includes(",")) {
    const commaParts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
    const last = commaParts[0] ?? "";
    const firstAndMiddle = commaParts[1] ?? "";
    const firstParts = firstAndMiddle.split(/\s+/).filter(Boolean);
    const first = firstParts[0] ?? "";
    let suffixRaw = "";
    let middleFromComma = "";
    if (commaParts.length > 2) {
      const possibleSuffix = commaParts[commaParts.length - 1];
      if (KNOWN_SUFFIXES.has(possibleSuffix.toLowerCase())) {
        suffixRaw = possibleSuffix;
        middleFromComma = commaParts.slice(2, -1).join(" ");
      } else {
        middleFromComma = commaParts.slice(2).join(" ");
      }
    }
    const middle = [...firstParts.slice(1), ...middleFromComma.split(/\s+/).filter(Boolean)].join(" ");
    const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
    const suffix = formatSuffix(suffixRaw);
    if (!last || !first) return trimmed;
    return `${last}, ${first}${middleInitial ? ` ${middleInitial}` : ""}${suffix ? `, ${suffix}` : ""}`;
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return trimmed;
  const lastPart = parts[parts.length - 1];
  const suffix = KNOWN_SUFFIXES.has(lastPart.toLowerCase()) ? formatSuffix(lastPart) : "";
  const nameParts = suffix ? parts.slice(0, -1) : parts;
  if (nameParts.length < 2) return trimmed;
  const first = nameParts[0];
  const last = nameParts[nameParts.length - 1];
  const middle = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";
  const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
  if (!last || !first) return trimmed;
  return `${last}, ${first}${middleInitial ? ` ${middleInitial}` : ""}${suffix ? `, ${suffix}` : ""}`;
};

const formatNumberForSpeech = (value: number) => {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : String(value);
};

const formatQuestionForSpeech = (question: string) => {
  return question
    .replace(/×/g, " times ")
    .replace(/\bx\b/gi, " times ")
    .replace(/\*/g, " times ")
    .replace(/÷/g, " divided by ")
    .replace(/\//g, " divided by ")
    .replace(/\s+/g, " ")
    .trim();
};

type ParsedMathQuestion = {
  left: number;
  right: number;
  operator: "+" | "-" | "*" | "/";
  symbol: string;
  operatorWord: string;
  stepVerb: string;
  result: number;
};

const parseMathQuestion = (question: string): ParsedMathQuestion | null => {
  const match = question
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .match(/^\s*(-?\d+(?:\.\d+)?)\s*([+\-*/xX])\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const left = Number.parseFloat(match[1]);
  const rawOp = match[2];
  const right = Number.parseFloat(match[3]);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  const operator = rawOp.toLowerCase() === "x" ? "*" : (rawOp as "+" | "-" | "*" | "/");
  let operatorWord = "";
  let stepVerb = "";
  let result = 0;

  switch (operator) {
    case "+":
      operatorWord = "add";
      stepVerb = "add";
      result = left + right;
      break;
    case "-":
      operatorWord = "subtract";
      stepVerb = "take away";
      result = left - right;
      break;
    case "*":
      operatorWord = "multiply";
      stepVerb = "multiply by";
      result = left * right;
      break;
    case "/":
      operatorWord = "divide";
      stepVerb = "divide by";
      result = right === 0 ? Number.NaN : left / right;
      break;
    default:
      return null;
  }

  return {
    left,
    right,
    operator,
    symbol: operator,
    operatorWord,
    stepVerb,
    result,
  };
};

const buildMathTutorSteps = (parsed: ParsedMathQuestion): string[] => {
  const leftText = formatNumberForSpeech(parsed.left);
  const rightText = formatNumberForSpeech(parsed.right);
  const resultText = formatNumberForSpeech(parsed.result);

  switch (parsed.operator) {
    case "+":
      return [
        `Start with ${leftText}.`,
        `Add ${rightText}.`,
        `That makes ${resultText}.`,
      ];
    case "-":
      return [
        `Start with ${leftText}.`,
        `Take away ${rightText}.`,
        `That leaves ${resultText}.`,
      ];
    case "*":
      return [
        `We are multiplying ${leftText} by ${rightText}.`,
        `Think of ${leftText} groups of ${rightText}.`,
        `That equals ${resultText}.`,
      ];
    case "/":
      return [
        `We are dividing ${leftText} by ${rightText}.`,
        `Split ${leftText} into ${rightText} equal groups.`,
        `Each group has ${resultText}.`,
      ];
    default:
      return [];
  }
};

const buildMathTeachingSteps = (parsed: ParsedMathQuestion): string[] => {
  const leftText = formatNumberForSpeech(parsed.left);
  const rightText = formatNumberForSpeech(parsed.right);

  switch (parsed.operator) {
    case "+":
      return [
        `Start with ${leftText}.`,
        `Count forward ${rightText} step${parsed.right === 1 ? "" : "s"}.`,
        "Say the new number you land on.",
      ];
    case "-":
      return [
        `Start with ${leftText}.`,
        `Count back ${rightText} step${parsed.right === 1 ? "" : "s"}.`,
        "Say the number you land on.",
      ];
    case "*":
      return [
        `Multiplication means groups.`,
        `Make ${leftText} group${parsed.left === 1 ? "" : "s"} of ${rightText}.`,
        "Add the groups together.",
      ];
    case "/":
      return [
        `Division means equal groups.`,
        `Split ${leftText} into ${rightText} equal groups.`,
        "Count how many are in each group.",
      ];
    default:
      return [];
  }
};

const buildMathFormulaHint = (parsed: ParsedMathQuestion): string => {
  const leftText = formatNumberForSpeech(parsed.left);
  const rightText = formatNumberForSpeech(parsed.right);
  const symbol = parsed.operator === "*" ? "x" : parsed.operator === "/" ? "/" : parsed.operator;
  return `Formula: ${leftText} ${symbol} ${rightText} = ?`;
};

const buildMathSmartPrompt = (
  parsed: ParsedMathQuestion,
  numericAnswer: number | null,
  numericExpected: number | null,
): string => {
  if (numericAnswer !== null && numericExpected !== null) {
    const diff = numericExpected - numericAnswer;
    if (parsed.operator === "+" || parsed.operator === "-") {
      if (diff === 1) return "Almost there! Let\'s count forward one more time.";
      if (diff === -1) return "Almost there! Let\'s count back one more time.";
      if (Math.abs(diff) <= 2) return "Close! Count again carefully, one step at a time.";
    }
    if (parsed.operator === "*") {
      if (Math.abs(diff) === 1) {
        return "Almost there! Recount your groups one more time.";
      }
      if (Math.abs(diff) <= Math.max(2, Math.abs(parsed.right))) {
        return "Close! Check your groups and add them again.";
      }
    }
    if (parsed.operator === "/") {
      if (Math.abs(diff) === 1) {
        return "Almost there! Check the equal groups one more time.";
      }
      return "Nice try! Check how many equal groups you can make.";
    }
  }
  return "Nice try! Let\'s solve it together using the formula.";
};

const normalizeSpokenNumber = (text: string): string => {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9.\-\s]/g, " ").trim();
  const numericMatch = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (numericMatch) return numericMatch[0];

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (!tokens.length) return text.trim();

  const wordMap: Record<string, number> = {
    zero: 0,
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
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  };

  let sign = 1;
  let total = 0;
  let current = 0;
  let decimalMode = false;
  let decimalDigits = "";

  for (const token of tokens) {
    if (token === "minus" || token === "negative") {
      sign = -1;
      continue;
    }
    if (token === "point" || token === "dot") {
      decimalMode = true;
      continue;
    }
    const value = wordMap[token];
    if (typeof value === "number") {
      if (decimalMode) {
        decimalDigits += String(value);
      } else if (value >= 20) {
        current += value;
      } else {
        current += value;
      }
      continue;
    }
    if (token === "hundred") {
      current = current === 0 ? 100 : current * 100;
      continue;
    }
    if (token === "thousand") {
      total += current * 1000;
      current = 0;
    }
  }

  const baseNumber = sign * (total + current);
  if (decimalDigits) {
    return `${baseNumber}.${decimalDigits}`;
  }
  if (Number.isFinite(baseNumber)) return String(baseNumber);
  return text.trim();
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
  const [dbCompletionByStudent, setDbCompletionByStudent] = useState<Record<string, boolean>>({});
  const [dbProgressByStudent, setDbProgressByStudent] = useState<Record<string, boolean>>({});
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
    if (!sessionLockEnabled || !approvedScheduleId || !subjectId || !students.length) {
      setDbCompletionByStudent({});
      setDbProgressByStudent({});
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
          | {
              success?: boolean;
              statusByStudent?: Record<string, { completed?: boolean; hasProgress?: boolean }>;
            }
          | null;

        if (!response.ok || !payload?.success) {
          return;
        }

        const nextCompletion: Record<string, boolean> = {};
        const nextProgress: Record<string, boolean> = {};
        const status = payload.statusByStudent ?? {};
        for (const student of students) {
          nextCompletion[student.id] = Boolean(status[student.id]?.completed);
          nextProgress[student.id] = Boolean(status[student.id]?.hasProgress);
        }
        setDbCompletionByStudent(nextCompletion);
        setDbProgressByStudent(nextProgress);
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
  }, [dbCompletionByStudent, selectedStudentId, sessionLockEnabled]);

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
  const [isTutorAssistOn, setIsTutorAssistOn] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [tutorGuidance, setTutorGuidance] = useState<string[]>([]);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  // AI Insights State
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  useEffect(() => {
    if (showSummary && selectedStudent && sessionScores.length > 0) {
      if (aiInsight) return;
      setIsLoadingInsight(true);

      const scoreAvg = Math.round(
          sessionScores.reduce((sum, item) => sum + (item.score ?? 0), 0) /
            Math.max(1, sessionScores.length),
        );
      
      const timeAvg = sessionScores.reduce((sum, item) => sum + (item.responseTime ?? 0), 0) /
            Math.max(1, sessionScores.length);
      
      const metrics = {
          accuracyAvg: scoreAvg,
          responseTimeAvg: timeAvg,
          overallAverage: scoreAvg,
      };

      getAiInsightsAction(String(selectedStudent.id), metrics, selectedStudent.name, "Math")
        .then((res) => {
            if(res.success && res.insight) setAiInsight(res.insight);
            else setAiInsight("Unable to generate insights at this time.");
        })
        .catch(() => setAiInsight("Error generating insights."))
        .finally(() => setIsLoadingInsight(false));
    } else if (!showSummary) {
        setAiInsight(null);
    }
  }, [showSummary, selectedStudent, sessionScores, aiInsight]);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const synthesizerRef = useRef<SpeechSDK.SpeechSynthesizer | null>(null);
  const speechTokenRef = useRef<{ token: string; region: string; expiresAt: number } | null>(null);
  const browserRecognitionRef = useRef<any>(null);
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

  const getSpeechToken = useCallback(async () => {
    const now = Date.now();
    if (speechTokenRef.current && speechTokenRef.current.expiresAt > now + 30000) {
      return speechTokenRef.current;
    }
    const response = await fetch("/api/azure-speech/token", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as
      | { token?: string; region?: string; expiresIn?: number; error?: string }
      | null;

    if (!response.ok || !payload?.token || !payload.region) {
      throw new Error(payload?.error || "Azure Speech token request failed.");
    }

    const expiresIn = typeof payload.expiresIn === "number" ? payload.expiresIn : 540;
    const tokenInfo = {
      token: payload.token,
      region: payload.region,
      expiresAt: now + expiresIn * 1000,
    };
    speechTokenRef.current = tokenInfo;
    return tokenInfo;
  }, []);

  const escapeSsmlText = useCallback((value: string) => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }, []);

  const stopSpeechPlayback = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    try {
      synthesizerRef.current?.close();
    } catch {
      // ignore
    }
    synthesizerRef.current = null;
  }, []);

  const getPreferredFemaleVoice = useCallback((language: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const languagePrefix = language.toLowerCase().split("-")[0];
    const sameLanguage = voices.filter((voice) =>
      voice.lang?.toLowerCase().startsWith(languagePrefix),
    );
    const pool = sameLanguage.length ? sameLanguage : voices;

    const preferredTokens = [
      "jenny",
      "aria",
      "sara",
      "susan",
      "zira",
      "female",
      "woman",
      "girl",
      "katja",
      "olivia",
      "emma",
      "ava",
    ];

    const preferred = pool.find((voice) => {
      const name = (voice.name || "").toLowerCase();
      return preferredTokens.some((token) => name.includes(token));
    });

    return preferred ?? pool[0] ?? null;
  }, []);

  const speakWithAzureNeural = useCallback(async (
    text: string,
    options: {
      voiceName: string;
      locale: string;
      style?: string;
      rate?: string;
      sentenceBoundaryMs?: number;
    },
  ) => {
    const { token, region } = await getSpeechToken();
    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechSynthesisVoiceName = options.voiceName;
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
    const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);
    synthesizerRef.current = synthesizer;

    const content = escapeSsmlText(text);
    const rate = options.rate ?? "-8%";
    const sentenceBoundaryMs = Number.isFinite(options.sentenceBoundaryMs)
      ? Math.max(0, Math.round(options.sentenceBoundaryMs as number))
      : null;
    const boundarySilence = sentenceBoundaryMs !== null
      ? `<mstts:silence type="Sentenceboundary" value="${sentenceBoundaryMs}ms"/>`
      : "";
    const ssml = options.style
      ? `<speak version="1.0" xmlns="https://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${options.locale}"><voice name="${options.voiceName}">${boundarySilence}<mstts:express-as style="${options.style}"><prosody rate="${rate}">${content}</prosody></mstts:express-as></voice></speak>`
      : `<speak version="1.0" xmlns="https://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${options.locale}"><voice name="${options.voiceName}">${boundarySilence}<prosody rate="${rate}">${content}</prosody></voice></speak>`;

    return await new Promise<void>((resolve, reject) => {
      synthesizer.speakSsmlAsync(
        ssml,
        () => resolve(),
        (error) => reject(error),
      );
    }).finally(() => {
      synthesizer.close();
      synthesizerRef.current = null;
    });
  }, [escapeSsmlText, getSpeechToken]);

  const speakTutorFeedback = useCallback(async (text: string) => {
    if (!isTutorAssistOn || !text.trim()) return;
    setStatusMessage("Tutor speaking...");
    stopSpeechPlayback();
    try {
      await speakWithAzureNeural(text, {
        voiceName: "en-PH-RosaNeural",
        locale: "en-US",
        style: "cheerful",
        rate: "-6%",
        sentenceBoundaryMs: 80,
      });
    } catch (error) {
      console.error("Tutor feedback speech failed", error);
      if (ALLOW_BROWSER_FALLBACK && typeof window !== "undefined" && "speechSynthesis" in window) {
        const utter = new window.SpeechSynthesisUtterance(text);
        utter.lang = "en-US";
        utter.rate = 0.9;
        utter.pitch = 1;
        const voice = getPreferredFemaleVoice("en-US");
        if (voice) utter.voice = voice;
        window.speechSynthesis.speak(utter);
      }
    } finally {
      setStatusMessage("");
    }
  }, [getPreferredFemaleVoice, isTutorAssistOn, speakWithAzureNeural, stopSpeechPlayback]);

  const handleSpeakFallback = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new window.SpeechSynthesisUtterance(formatQuestionForSpeech(question));
      utter.rate = 0.88;
      utter.pitch = 1;
      utter.volume = 1;
      utter.lang = "en-US";
      const voice = getPreferredFemaleVoice("en-US");
      if (voice) utter.voice = voice;
      setIsPlaying(true);
      utter.onend = () => setIsPlaying(false);
      utter.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utter);
    }
  }, [getPreferredFemaleVoice, question]);

  const handleSpeak = async () => {
    const spokenQuestion = formatQuestionForSpeech(question);
    if (!spokenQuestion.trim() || isPlaying) return;
    setStatusMessage("Preparing audio...");
    setIsPlaying(true);
    stopSpeechPlayback();
    try {
      await speakWithAzureNeural(spokenQuestion, {
        voiceName: "en-PH-RosaNeural",
        locale: "en-US",
        style: "friendly",
        rate: "-8%",
      });
      setStatusMessage("");
    } catch (error) {
      console.error("Azure TTS failed", error);
      if (ALLOW_BROWSER_FALLBACK) {
        setStatusMessage("Azure TTS unavailable. Using browser voice.");
        handleSpeakFallback();
      } else {
        setStatusMessage("Azure TTS unavailable.");
      }
    } finally {
      setIsPlaying(false);
    }
  };

  const stopSpeechRecognition = useCallback(() => {
    if (browserRecognitionRef.current) {
      try {
        browserRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      browserRecognitionRef.current = null;
    }
  }, []);

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
    stopSpeechPlayback();
    stopSpeechRecognition();
    setIsListening(false);
    setIsPlaying(false);
    setStatusMessage("");
    setUserAnswer("");
    setFeedback("");
    setTutorGuidance([]);
    setShowCorrectAnswer(false);
    setRate(null);
    setScore(null);
    setStartTime(Date.now());
  }, [stopSpeechPlayback, stopSpeechRecognition]);

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

  const submitAnswer = useCallback((rawAnswer: string) => {
    const trimmedAnswer = rawAnswer.trim();
    if (!trimmedAnswer) {
      setFeedback("Please enter your answer first.");
      return;
    }

    setShowCorrectAnswer(false);

    const endTime = Date.now();
    const durationSec = (endTime - (startTime || endTime)) / 1000;
    setRate(durationSec);

    const numericAnswer = Number.parseFloat(trimmedAnswer);
    const numericExpected = Number.parseFloat(correctAnswer);
    const numericMatch = Number.isFinite(numericAnswer) && Number.isFinite(numericExpected)
      ? Math.abs(numericAnswer - numericExpected) < 0.000001
      : false;
    const isCorrect = trimmedAnswer === correctAnswer || numericMatch;
    setScore(isCorrect ? 100 : 0);

    const parsed = parseMathQuestion(question);

    if (isCorrect) {
      setTutorGuidance([]);
      if (durationSec < 3) setFeedback("Excellent speed and accuracy! ⚡");
      else if (durationSec < 6) setFeedback("Good job! Try to be faster next time.");
      else setFeedback("Correct! But a bit slow ⏱️");
    } else if (parsed) {
      const prompt = buildMathSmartPrompt(
        parsed,
        Number.isFinite(numericAnswer) ? numericAnswer : null,
        Number.isFinite(numericExpected) ? numericExpected : null,
      );
      const formulaHint = buildMathFormulaHint(parsed);
      const guidance = isTutorAssistOn
        ? [formulaHint, ...buildMathTeachingSteps(parsed)]
        : [formulaHint];
      setTutorGuidance(guidance);
      setFeedback(prompt);

      if (isTutorAssistOn) {
        void speakTutorFeedback(prompt);
      }
    } else {
      const fallbackPrompt = "Nice try! Let\'s solve it together using the formula.";
      setTutorGuidance(["Formula: Re-read the problem and solve it step by step."]);
      setFeedback(fallbackPrompt);

      if (isTutorAssistOn) {
        void speakTutorFeedback(fallbackPrompt);
      }
    }

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

    upsertSessionScore(current, question, { score: isCorrect ? 100 : 0, responseTime: durationSec, transcription: trimmedAnswer });
  }, [correctAnswer, current, isTutorAssistOn, onSavePerformance, question, selectedStudentId, speakTutorFeedback, startTime, upsertSessionScore]);

  const handleMicrophone = useCallback(() => {
    if (typeof window === "undefined") return;
    if (isListening) {
      stopSpeechRecognition();
      setIsListening(false);
      setStatusMessage("");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusMessage("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    browserRecognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript ?? "";
      const normalized = normalizeSpokenNumber(transcript);
      setUserAnswer(normalized);
      setStatusMessage("Answer captured. Submitting now...");
      submitAnswer(normalized);
    };

    recognition.onerror = () => {
      setStatusMessage("Speech recognition failed. Please type your answer.");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    setIsListening(true);
    setStatusMessage("Listening...");
    recognition.start();
  }, [isListening, stopSpeechRecognition, submitAnswer]);

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
    }
    setSelectedStudentId(studentId);
    const localLastIndex = startIndex;
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
        }
      } catch {
        // Keep local session status unchanged on fetch failures.
      }
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

    let remedialSessionSaved = !sessionLockEnabled;
    if (selectedStudentId && sessionScores.length) {
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
            approvedScheduleId: approvedScheduleId ?? null,
            subjectId: subjectId ?? null,
            gradeId: gradeId ?? null,
            subjectName: "Math",
            gradeLevel: selectedStudent?.grade ?? null,
            phonemicId: phonemicId ?? null,
            materialId: materialId ?? null,
            completed: showSummary,
            slides,
            teacherFeedback: teacherFeedback.trim() || null,
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; completed?: boolean; error?: string }
          | null;
        if (response.ok && payload?.success) {
          remedialSessionSaved = true;
          setDbProgressByStudent((prev) => ({ ...prev, [selectedStudentId]: true }));
          setDbCompletionByStudent((prev) => ({
            ...prev,
            [selectedStudentId]: Boolean(payload.completed),
          }));
        } else if (response.status !== 409) {
          console.warn("Failed to save remedial session", payload?.error ?? response.statusText);
        }
      } catch (error) {
        console.warn("Failed to save remedial session", error);
      }
    }

    if (sessionLockEnabled && selectedStudentId && remedialSessionSaved) {
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
    submitAnswer(userAnswer);
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
      <div className="relative min-h-dvh bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
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

          <div className="mt-5 rounded-3xl border border-white/70 bg-white/45 p-6 space-y-6 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl flex flex-1 flex-col min-h-0">
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
                    sessionLockEnabled && dbCompletionByStudent[row.id],
                  );
                  const resumeState = Boolean(
                    sessionLockEnabled &&
                      !isCompleted &&
                      dbProgressByStudent[row.id],
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
      <div className="relative min-h-dvh bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
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



  if (showSummary) {
    const overallAverage = sessionScores.length
      ? Math.round(
          sessionScores.reduce((sum, item) => sum + item.score, 0) /
            Math.max(1, sessionScores.length),
        )
      : 0;


    return (
      <div className="relative min-h-dvh bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
        <div className="w-full max-w-8xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex min-h-dvh flex-col gap-5">
          <header className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur px-8 py-5 flex flex-col gap-2 shadow-md shadow-gray-200">
            <h1 className="text-3xl sm:text-4xl font-bold text-black">Session Summary</h1>
            {selectedStudent?.name ? (
              <p className="text-3xl sm:text-2xl font-bold text-slate-500">
                {formatStudentName(selectedStudent.name)}
              </p>
            ) : null}
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
              <h2 className="text-2xl font-bold text-black">System Feedback</h2>
            </div>
            <p className="mt-3 text-md text-slate-700 leading-relaxed">
              {isLoadingInsight ? (
                <div className="flex items-center gap-2 text-slate-500 animate-pulse">
                  <span className="h-4 w-4 rounded-full bg-slate-300" />
                  Generating AI insights...
                </div>
              ) : (
                aiInsight || "No insights generated."
              )}
            </p>

          </div>

          {sessionLockEnabled && (
            <div className="rounded-3xl border border-emerald-200 bg-white shadow-md shadow-emerald-100 p-6">
              <div>
                <h2 className="text-2xl font-bold text-black">Teacher Feedback</h2>
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
    <div className="relative min-h-dvh bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="w-full max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex min-h-dvh flex-col">
        <header className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur px-8 py-5 sm:py-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between shadow-md shadow-gray-200">
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
              <div className="h-full rounded-3xl border border-white/70 bg-white/45 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl overflow-hidden flex flex-col">
                <div className="flex-1 px-6 sm:px-8 lg:px-12 py-6 flex flex-col items-center text-center gap-6">
                  <div className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Problem</p>
                    <p className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#013300] leading-tight">
                      {question}
                    </p>
                  </div>

                  <div className="w-full max-w-4xl grid gap-4">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-end">
                        <div className="flex-1 text-left">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type your answer</p>
                          <input
                            type="text"
                            value={userAnswer}
                            onChange={handleInputChange}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg font-semibold text-[#013300] transition focus:border-[#013300] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#013300]/30"
                            placeholder="Type and submit"
                            inputMode="decimal"
                            pattern="[0-9.\-]*"
                            title="Only numbers, decimal point, and minus sign are allowed"
                          />
                        </div>
                        <button
                          onClick={handleSubmit}
                          className="w-full md:w-auto rounded-xl bg-[#013300] px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-green-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#013300]/60"
                        >
                          Check Answer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-6 sm:px-8 py-6 border-t border-gray-300 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
                  <button
                    onClick={handleSpeak}
                    className={`group flex items-center gap-3 rounded-full px-6 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 active:scale-95 ${
                      isPlaying
                        ? "bg-[#013300] text-white shadow-md shadow-gray-200"
                        : "border border-[#013300] bg-white text-[#013300] hover:border-[#013300] hover:bg-[#013300] hover:text-white"
                    } w-full md:w-auto`}
                  >
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${
                        isPlaying
                          ? "bg-white/10 text-white animate-pulse"
                          : "bg-white text-[#013300] group-hover:bg-[#013300] group-hover:text-white group-focus-visible:bg-[#013300] group-focus-visible:text-white"
                      }`}
                    >
                      <Volume2Icon />
                    </span>
                    {isPlaying ? "Playing..." : "Listen"}
                  </button>
                  <button
                    onClick={() => {
                      setIsTutorAssistOn((prev) => {
                        if (prev) stopSpeechPlayback();
                        return !prev;
                      });
                    }}
                    className={`group flex items-center gap-3 rounded-full px-6 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 active:scale-95 ${
                      isTutorAssistOn
                        ? "border border-emerald-700 bg-emerald-50 text-emerald-800"
                        : "border border-gray-300 bg-white text-slate-600"
                    } w-full md:w-auto`}
                  >
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${
                        isTutorAssistOn
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-slate-500"
                      }`}
                    >
                      T
                    </span>
                    {isTutorAssistOn ? "Tutor Assist: On" : "Tutor Assist: Off"}
                  </button>
                  <button
                    onClick={handleMicrophone}
                    className={`group flex items-center gap-3 rounded-full px-6 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 active:scale-95 ${
                      isListening
                        ? "bg-[#013300] text-white shadow-md shadow-gray-200"
                        : "border border-[#013300] bg-white text-[#013300] hover:border-[#013300] hover:bg-[#013300] hover:text-white"
                    } w-full md:w-auto`}
                  >
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${
                        isListening
                          ? "bg-white/10 text-white animate-pulse"
                          : "bg-white text-[#013300] group-hover:bg-[#013300] group-hover:text-white group-focus-visible:bg-[#013300] group-focus-visible:text-white"
                      }`}
                    >
                      <MicIcon />
                    </span>
                    {isListening ? "Stop" : "Speak"}
                  </button>
                </div>
              </div>
            </section>

            <aside className="xl:col-span-4 flex flex-col gap-4 min-h-0">
              <div className="rounded-3xl border border-gray-300 bg-white/80 backdrop-blur px-5 py-5 shadow-md shadow-gray-200 flex flex-1 flex-col min-h-0">
                <h2 className="text-base font-semibold text-[#013300]">Performance Insights</h2>
                <div className="mt-4 flex flex-1 flex-col gap-3 min-h-0">
                  <div className="rounded-2xl border border-gray-300 bg-emerald-50/60 px-3 py-2.5 flex flex-col flex-1">
                    <p className="text-xs uppercase tracking-wide text-emerald-800">Solution Guidance</p>
                    <p className="mt-1 text-sm font-medium text-[#013300]">
                      {feedback || "Submit an answer to see how you did."}
                    </p>
                    {tutorGuidance.length ? (
                      <div className="mt-2 space-y-1 text-sm font-medium text-[#013300]">
                        {tutorGuidance.map((step, index) => (
                          <p key={`${step}-${index}`}>{index + 1}. {step}</p>
                        ))}
                      </div>
                    ) : null}
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
                      <dd className="text-lg font-semibold text-[#013300]">
                        {score === 100 && showCorrectAnswer ? correctAnswer : "••••••"}
                      </dd>
                      {score === 100 && (
                        <button
                          type="button"
                          onClick={() => setShowCorrectAnswer((prev) => !prev)}
                          className="mt-2 inline-flex items-center justify-center rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                        >
                          {showCorrectAnswer ? "Hide answer" : "Show answer"}
                        </button>
                      )}
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

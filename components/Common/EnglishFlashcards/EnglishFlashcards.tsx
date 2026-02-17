
"use client";
import { useState, useRef, useEffect, useMemo, useCallback, type CSSProperties } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";
import { buildFlashcardContentKey } from "@/lib/utils/flashcards-storage";
import { getAiInsightsAction } from "@/app/actions/get-ai-insights";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

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

/* ---------- String/phoneme utilities ---------- */

// Levenshtein distance for word similarity
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i-1][j] + 1,
        dp[i][j-1] + 1,
        dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

// Normalize text for English
function normalizeText(s: string) {
  return s.replace(/[^a-zA-Z\s']/g, "").toLowerCase().trim();
}

// English phoneme approximation
function approxPhonemes(word: string) {
  if (!word) return [];
  const w = word.toLowerCase().replace(/[^a-z']/g, "");
  
  // English vowel sounds and common patterns
  const vowels = ['a','e','i','o','u'];
  const digraphs: {[k:string]:string} = {
    'th':'TH', 'sh':'SH', 'ch':'CH', 'ph':'F', 'gh':'G', 'wh':'WH',
    'ck':'K', 'ng':'NG', 'nk':'NK', 'ee':'EE', 'oo':'OO', 'ai':'AY',
    'ay':'AY', 'ea':'EE', 'oa':'OA', 'ow':'OW', 'ou':'OU', 'oi':'OI',
    'oy':'OY', 'aw':'AW', 'au':'AW', 'ar':'AR', 'er':'ER', 'ir':'ER',
    'ur':'ER', 'or':'OR'
  };
  
  // replace digraphs first
  let tmp = w;
  for (const k in digraphs) {
    tmp = tmp.split(k).join(' '+digraphs[k]+' ');
  }
  
  // basic splitting: vowel clusters and consonants
  const out: string[] = [];
  let buffer = '';
  for (let i = 0; i < tmp.length; i++) {
    const c = tmp[i];
    if (c === ' ') {
      if (buffer) out.push(buffer);
      buffer = '';
      continue;
    }
    if (vowels.includes(c)) {
      if (buffer) { out.push(buffer); buffer = ''; }
      // capture vowel run
      let run = c;
      while (i+1 < tmp.length && vowels.includes(tmp[i+1])) { i++; run += tmp[i]; }
      out.push(run.toUpperCase());
    } else {
      buffer += c.toUpperCase();
    }
  }
  if (buffer) out.push(buffer);
  return out.filter(Boolean);
}

// Compare two phoneme arrays
function comparePhonemeArrays(expectedArr: string[], actualArr: string[]) {
  if (expectedArr.length === 0) return 0;
  let matches = 0;
  for (let i = 0; i < expectedArr.length; i++) {
    if (actualArr[i] === expectedArr[i]) matches++;
    else if (actualArr[i-1] === expectedArr[i] || actualArr[i+1] === expectedArr[i]) matches++;
  }
  return (matches / expectedArr.length) * 100;
}

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

/* ---------- Student roster & performance storage ---------- */

const BASE_FLASHCARD_CONTENT_KEY = "MASTER_TEACHER_ENGLISH_FLASHCARDS";

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
  pronScore: number;
  fluencyScore: number;
  phonemeAccuracy: number;
  wpm: number;
  correctness?: number;
  readingSpeedScore?: number;
  readingSpeedLabel?: string;
  wordCount?: number;
  overallAverage?: number;
  cardIndex: number;
  sentence: string;
};

type SessionScore = {
  cardIndex: number;
  sentence: string;
  pronScore: number;
  correctness: number;
  fluencyScore?: number;
  completenessScore?: number;
  readingSpeedWpm: number;
  readingSpeedScore: number;
  averageScore: number;
  transcription?: string | null;
};

type WordFeedback = {
  word: string;
  accuracyScore: number | null;
  errorType?: string | null;
};

type EnrichedStudent = StudentRecord & {
  lastPerformance: StudentPerformanceEntry | null;
};

function isValidFlashcardContent(value: unknown): value is FlashcardContent[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as { sentence?: unknown; highlights?: unknown };
    if (typeof candidate.sentence !== "string") return false;
    if (!Array.isArray(candidate.highlights)) return false;
    return candidate.highlights.every((word) => typeof word === "string");
  });
}

/* ---------- English Remedial Flashcards data ---------- */
type FlashcardContent = {
  sentence: string;
  highlights: string[];
};

const INITIAL_FLASHCARDS: FlashcardContent[] = [
  { sentence: "The cat sat on the mat.", highlights: ["cat", "sat", "mat"] },
  { sentence: "A big dog ran in the park.", highlights: ["big", "dog", "ran"] },
  { sentence: "She has a red ball and blue car.", highlights: ["red", "ball", "blue"] },
  { sentence: "We go to the store for milk.", highlights: ["go", "store", "milk"] },
  { sentence: "He can see the sun in the sky.", highlights: ["see", "sun", "sky"] },
  { sentence: "I like to play with my friends.", highlights: ["like", "play", "friends"] },
  { sentence: "The book is on the small table.", highlights: ["book", "small", "table"] },
  { sentence: "They eat lunch at twelve o'clock.", highlights: ["eat", "lunch", "twelve"] },
  { sentence: "My mother reads me a story.", highlights: ["mother", "reads", "story"] },
  { sentence: "We live in a green house.", highlights: ["live", "green", "house"] },
];

/* ---------- Component ---------- */
type EnglishFlashcardsProps = {
  students: StudentRecord[];
  performances: StudentPerformanceEntry[];
  onSavePerformance: (entry: StudentPerformanceEntry) => void;
  initialView?: "select" | "session";
  initialStudentId?: string | null;
  forceSessionOnly?: boolean;
  onExit?: () => void;
};

export default function EnglishFlashcards({
  students,
  performances,
  onSavePerformance,
  initialView,
  initialStudentId,
  forceSessionOnly,
  onExit,
}: EnglishFlashcardsProps) {
  const router = useRouter();
  const [flashcardsData, setFlashcardsData] = useState<FlashcardContent[]>(INITIAL_FLASHCARDS);
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
    const subjectLabel = toDisplaySubject(subjectParam, "English");
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
  const [dbCompletionByStudent, setDbCompletionByStudent] = useState<Record<string, boolean>>({});
  const [dbProgressByStudent, setDbProgressByStudent] = useState<Record<string, boolean>>({});
  const [blockedSessionMessage, setBlockedSessionMessage] = useState<string | null>(null);
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [teacherFeedbackError, setTeacherFeedbackError] = useState<string | null>(null);

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
        if (isValidFlashcardContent(parsed)) {
          setFlashcardsData(parsed);
          return;
        }
      }

      window.localStorage.setItem(flashcardContentKey, JSON.stringify(INITIAL_FLASHCARDS));
      setFlashcardsData(INITIAL_FLASHCARDS);
    } catch (error) {
      console.warn("Failed to load English flashcard content", error);
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

  // AI Insights State
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  useEffect(() => {
    if (showSummary && selectedStudent && sessionScores.length > 0) {
      if (aiInsight) return;
      setIsLoadingInsight(true);

      const overallAverage = Math.round(
          sessionScores.reduce((sum, item) => sum + item.averageScore, 0) /
            Math.max(1, sessionScores.length),
        );
      
      const avg = (values: number[]) =>
       Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
      
      const metrics = {
          pronunciationAvg: avg(sessionScores.map((item) => item.pronScore ?? 0)),
          accuracyAvg: avg(sessionScores.map((item) => item.correctness ?? 0)),
          fluencyScore: avg(sessionScores.map((item) => item.fluencyScore ?? 0)),
          readingSpeedAvg: avg(sessionScores.map((item) => item.readingSpeedWpm ?? 0)),
          overallAverage: overallAverage,
      };

      getAiInsightsAction(String(selectedStudent.id), metrics, selectedStudent.name, "English")
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

  const currentCard = flashcardsData[current] ?? flashcardsData[0] ?? INITIAL_FLASHCARDS[0];
  const sentence = currentCard?.sentence ?? "";
  const isParagraphLevel = expectedPhonemicLevel === "paragraph" || sentence.length > 280;
  const contentContainerClass =
    `flex-1 px-6 sm:px-8 lg:px-12 py-10 via-white flex flex-col items-center ${isParagraphLevel ? "justify-start" : "justify-center"} text-center gap-4 overflow-y-auto max-h-[48vh]`;

  // recognition + metrics state
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [liveTranscription, setLiveTranscription] = useState("");
  const [feedback, setFeedback] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [metrics, setMetrics] = useState<any>(null);
  const [wordFeedback, setWordFeedback] = useState<WordFeedback[]>([]);
  const hasRecordedScoreForCurrent = useMemo(
    () => sessionScores.some((item) => item.cardIndex === current),
    [current, sessionScores],
  );

  // refs for audio / timing
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const lastVoiceTimestampRef = useRef<number | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const speechEndRef = useRef<number | null>(null);
  const cumulativeSilentMsRef = useRef<number>(0);
  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);
  const recognizerSessionRef = useRef(0);
  const recognizerClosedRef = useRef(false);
  const synthesizerRef = useRef<SpeechSDK.SpeechSynthesizer | null>(null);
  const speechTokenRef = useRef<{ token: string; region: string; expiresAt: number } | null>(null);
  const autoStartRef = useRef(false);

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
    setCurrent((prev) => (flashcardsData.length > 0 ? Math.max(prev - 1, 0) : 0));
  };
  const handleNext = () => {
    if (!hasRecordedScoreForCurrent) {
      setFeedback("Please record a score before moving to the next card.");
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
  };

  const handleStopSession = async () => {
    if (showSummary && sessionLockEnabled && !teacherFeedback.trim()) {
      setTeacherFeedbackError("Teacher feedback is required before saving this session.");
      return;
    }
    const activeSentence = flashcardsData[current]?.sentence ?? "";
    const sentenceWordCount = Math.max(1, normalizeText(activeSentence).split(/\s+/).filter(Boolean).length);
    const latestScore = sessionScores[sessionScores.length - 1];
    const speedScore = metrics
      ? (typeof metrics.readingSpeedScore === "number"
          ? metrics.readingSpeedScore
          : gradeReadingSpeed(metrics.wpm, Math.max(1, metrics.wordCount ?? sentenceWordCount)).score)
      : undefined;

    const overallAverageForSave = sessionScores.length
      ? Math.round(
          sessionScores.reduce((sum, item) => sum + item.averageScore, 0) /
            Math.max(1, sessionScores.length),
        )
      : metrics
        ? Math.min(100, Math.max(0, Math.round(
            (
              metrics.pronScore +
              (metrics.correctness ?? metrics.pronScore) +
              (speedScore ?? metrics.pronScore)
            ) / 3,
          )))
        : latestScore
          ? latestScore.averageScore
          : 0;

    if (selectedStudentId && (metrics || sessionScores.length)) {
      const basePron = metrics?.pronScore ?? latestScore?.pronScore ?? 0;
      const baseCorrectness = metrics?.accuracyScore ?? metrics?.correctness ?? latestScore?.correctness ?? basePron;
      const baseSpeedScore = speedScore ?? latestScore?.readingSpeedScore ?? basePron;

      onSavePerformance({
        id: `perf-${Date.now()}`,
        studentId: selectedStudentId,
        timestamp: new Date().toISOString(),
        pronScore: basePron,
        fluencyScore: metrics?.fluencyScore ?? basePron,
        phonemeAccuracy: metrics?.accuracyScore ?? metrics?.phonemeAccuracy ?? basePron,
        wpm: metrics?.wpm ?? 0,
        correctness: baseCorrectness,
        readingSpeedScore: baseSpeedScore,
        readingSpeedLabel: metrics?.readingSpeedLabel,
        wordCount: metrics?.wordCount ?? sentenceWordCount,
        cardIndex: showSummary ? -1 : current,
        sentence: activeSentence,
        overallAverage: overallAverageForSave,
      });
      setLastSavedStudentId(selectedStudentId);
    }

    let remedialSessionSaved = !sessionLockEnabled;
    if (
      sessionLockEnabled &&
      selectedStudentId &&
      sessionScores.length
    ) {
      const slides = sessionScores.map((item) => ({
        flashcardIndex: item.cardIndex,
        expectedText: item.sentence,
        pronunciationScore: item.pronScore,
        accuracyScore: item.correctness,
        fluencyScore: item.fluencyScore ?? 0,
        completenessScore: item.completenessScore ?? 0,
        readingSpeedWpm: item.readingSpeedWpm,
        slideAverage: item.averageScore,
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
            subjectName: "English",
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
      const hasScores = sessionScores.length > 0;
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

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    recognizerRef.current?.close();
    recognizerRef.current = null;
    synthesizerRef.current?.close();
    synthesizerRef.current = null;

    resetSessionTracking();
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

  const applyOmissionsToWordFeedback = useCallback((
    mapped: WordFeedback[],
    expectedText: string,
  ): WordFeedback[] => {
    const expectedWords = normalizeText(expectedText).split(/\s+/).filter(Boolean);
    if (!expectedWords.length) return mapped;

    const normalizedMapped = mapped.map((item: WordFeedback) => item.word.toLowerCase());
    const output: WordFeedback[] = [];
    let j = 0;

    for (const expected of expectedWords) {
      if (j < normalizedMapped.length && normalizedMapped[j] === expected) {
        output.push(mapped[j]);
        j += 1;
      } else {
        output.push({ word: expected, accuracyScore: 0, errorType: "Omitted" });
      }
    }

    return output;
  }, []);

  const parseWordFeedback = useCallback((
    jsonResult: string | undefined | null,
    expectedText: string,
    mode: "raw" | "with-omissions" = "with-omissions",
  ): WordFeedback[] => {
    if (!jsonResult) return [];
    try {
      const parsed = JSON.parse(jsonResult) as any;
      const words = parsed?.NBest?.[0]?.Words ?? [];
      const mapped = words.map((word: any) => ({
        word: word?.Word ?? "",
        accuracyScore: typeof word?.PronunciationAssessment?.AccuracyScore === "number"
          ? Math.round(word.PronunciationAssessment.AccuracyScore)
          : null,
        errorType: word?.PronunciationAssessment?.ErrorType ?? null,
      })).filter((item: WordFeedback) => item.word);

      if (mode === "raw") {
        return mapped;
      }

      return applyOmissionsToWordFeedback(mapped, expectedText);
    } catch {
      return [];
    }
  }, [applyOmissionsToWordFeedback]);


  const handleSpeakFallback = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utter = new window.SpeechSynthesisUtterance(sentence);
      utter.rate = 0.9;
      utter.pitch = 1.1;
      utter.lang = "en-US";
      setIsPlaying(true);
      utter.onend = () => setIsPlaying(false);
      utter.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utter);
    }
  }, [sentence]);

  const handleSpeak = async () => {
    if (!sentence.trim() || isPlaying) return;
    setStatusMessage("Preparing audio...");
    setIsPlaying(true);
    try {
      const { token, region } = await getSpeechToken();
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);
      synthesizerRef.current = synthesizer;

      synthesizer.speakTextAsync(
        sentence,
        () => {
          synthesizer.close();
          synthesizerRef.current = null;
          setIsPlaying(false);
          setStatusMessage("");
        },
        (error) => {
          console.error("Azure TTS error", error);
          synthesizer.close();
          synthesizerRef.current = null;
          setIsPlaying(false);
          setStatusMessage("Azure TTS failed. Using browser voice.");
          handleSpeakFallback();
        },
      );
    } catch (error) {
      console.error("Azure TTS failed", error);
      setIsPlaying(false);
      setStatusMessage("Azure TTS unavailable. Using browser voice.");
      handleSpeakFallback();
    }
  };

  // ---------- Core: start mic, listen, measure silence + timestamps ----------
  const startAudioAnalyser = useCallback(async (stream: MediaStream) => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioContextRef.current!;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    analyserRef.current = analyser;

    const data = new Float32Array(analyser.fftSize);
    let rafId: number;
    const check = () => {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      const db = 20 * Math.log10(rms + 1e-12);
      const now = performance.now();

      const VOICE_DB_THRESHOLD = -50;
      if (db > VOICE_DB_THRESHOLD) {
        lastVoiceTimestampRef.current = now;
        if (!speechStartRef.current) speechStartRef.current = now;
        silenceStartRef.current = null;
      } else {
        if (!silenceStartRef.current) silenceStartRef.current = now;
        else {
          const silenceDur = now - (silenceStartRef.current || now);
          if (silenceDur > 200 && lastVoiceTimestampRef.current) {
            cumulativeSilentMsRef.current += silenceDur;
            lastVoiceTimestampRef.current = null;
          }
        }
      }
      rafId = requestAnimationFrame(check);
    };
    rafId = requestAnimationFrame(check);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const stopAudioAnalyser = useCallback(() => {
    try {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
    } catch { /* ignore */ }
  }, []);

  const resetSessionTracking = useCallback(() => {
    setRecognizedText("");
    setLiveTranscription("");
    setFeedback("");
    setStatusMessage("");
    setMetrics(null);
    setWordFeedback([]);
    cumulativeSilentMsRef.current = 0;
    speechStartRef.current = null;
    speechEndRef.current = null;
    stopAudioAnalyser();
    setIsListening(false);
    setIsProcessing(false);
    setIsPlaying(false);
  }, [stopAudioAnalyser]);

  useEffect(() => {
    return () => {
      stopAudioAnalyser();
      recognizerRef.current?.close();
      recognizerRef.current = null;
      synthesizerRef.current?.close();
      synthesizerRef.current = null;
    };
  }, [stopAudioAnalyser]);

  useEffect(() => {
    resetSessionTracking();
  }, [current, resetSessionTracking, setRecognizedText, setLiveTranscription, setFeedback, setStatusMessage, setMetrics, setWordFeedback, stopAudioAnalyser, setIsListening, setIsProcessing, setIsPlaying]);

  const readingSpeedBuckets = useMemo(
    () => ([
      { minWpm: 90, score: 100, label: "Very Fast" },
      { minWpm: 75, score: 95, label: "Moderately Fast" },
      { minWpm: 60, score: 90, label: "Fast" },
      { minWpm: 45, score: 85, label: "Moderate" },
      { minWpm: 30, score: 80, label: "Slightly Slow" },
      { minWpm: 20, score: 75, label: "Slow" },
      { minWpm: 0, score: 70, label: "Very Slow" },
    ]),
    [],
  );

  const gradeReadingSpeed = useCallback(
    (wpm: number, wordCount: number) => {
      const stableWordCount = Math.max(1, wordCount);
      const stabilityFactor = Math.min(1, stableWordCount / 10);
      const adjustedWpm = wpm * (0.65 + 0.35 * stabilityFactor);
      const bucket = readingSpeedBuckets.find((item) => adjustedWpm >= item.minWpm) ?? readingSpeedBuckets[readingSpeedBuckets.length - 1];
      return {
        adjustedWpm: Math.round(adjustedWpm),
        score: bucket.score,
        label: bucket.label,
      };
    },
    [readingSpeedBuckets],
  );

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
    resetSessionTracking();
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
          const nextScores: SessionScore[] = payload.slides.map((slide) => ({
            cardIndex: slide.flashcardIndex,
            sentence: slide.expectedText ?? flashcardsData[slide.flashcardIndex]?.sentence ?? "",
            pronScore: slide.pronunciationScore,
            correctness: slide.accuracyScore,
            fluencyScore: slide.fluencyScore,
            completenessScore: slide.completenessScore,
            readingSpeedWpm: slide.readingSpeedWpm,
            readingSpeedScore: gradeReadingSpeed(
              slide.readingSpeedWpm,
              Math.max(1, normalizeText(slide.expectedText ?? "").split(/\s+/).filter(Boolean).length),
            ).score,
            averageScore: slide.slideAverage,
            transcription: slide.transcription ?? null,
          }));

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
    gradeReadingSpeed,
    phonemicNameParam,
    readSessionState,
    resetSessionTracking,
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

  const upsertSessionScore = useCallback(
    (
      cardIndex: number,
      sentenceText: string,
      sc: {
        pronScore: number;
        correctness: number;
        fluencyScore?: number;
        completenessScore?: number;
        readingSpeedScore: number;
        averageScore: number;
        readingSpeedWpm: number;
        transcription?: string | null;
      },
    ) => {
      setSessionScores((prev) => {
        const next = prev.filter((item) => item.cardIndex !== cardIndex);
        next.push({
          cardIndex,
          sentence: sentenceText,
          pronScore: sc.pronScore,
          correctness: sc.correctness,
          fluencyScore: sc.fluencyScore,
          completenessScore: sc.completenessScore,
          readingSpeedWpm: sc.readingSpeedWpm,
          readingSpeedScore: sc.readingSpeedScore,
          averageScore: sc.averageScore,
          transcription: sc.transcription ?? null,
        });
        return next.sort((a, b) => a.cardIndex - b.cardIndex);
      });
    },
    [],
  );

  // ---------- Scoring logic for English ----------
  const computeScores = useCallback((expectedText: string, spokenText: string, resultConfidence: number | null) => {
    const expected = normalizeText(expectedText);
    const spoken = normalizeText(spokenText || "");

    // Word arrays
    const expWords = expected.split(/\s+/).filter(Boolean);
    const spkWords = spoken.split(/\s+/).filter(Boolean);

    // Word-level correctness
    let exactMatches = 0;
    let softMatches = 0;
    const perWordDetails: any[] = [];

    for (let i = 0; i < expWords.length; i++) {
      const ew = expWords[i];
      let best = "";
      let bestScore = Infinity;
      for (let j = Math.max(0, i-2); j < Math.min(spkWords.length, i+3); j++) {
        const dist = levenshtein(ew, spkWords[j]);
        if (dist < bestScore) { bestScore = dist; best = spkWords[j]; }
      }
      const lev = levenshtein(ew, best || "");
      const sim = (Math.max(0, ew.length - lev) / Math.max(1, ew.length)) * 100;
      if (sim >= 95) exactMatches++;
      else if (sim >= 60) softMatches++;
      perWordDetails.push({ expected: ew, matched: best || "", similarity: Math.round(sim) });
    }

    const wordAccuracy = ((exactMatches + 0.6 * softMatches) / Math.max(1, expWords.length)) * 100;

    const wordFeedback: WordFeedback[] = perWordDetails.map((item) => {
      const score = Number.isFinite(item.similarity) ? Math.round(item.similarity) : 0;
      let errorType: string | null = null;
      if (score === 0) errorType = "Omitted";
      else if (score < 85) errorType = "Mispronounced";
      else errorType = "None";
      return {
        word: item.expected,
        accuracyScore: score,
        errorType,
      };
    });
    const omittedCount = wordFeedback.filter((item) => (item.accuracyScore ?? 0) === 0).length;
    const completenessScore = expWords.length
      ? Math.max(0, Math.round(100 - ((omittedCount / expWords.length) * 100)))
      : 100;

    // English phoneme analysis
    const expPhArr = expWords.flatMap(w => approxPhonemes(w));
    const spkPhArr = spkWords.flatMap(w => approxPhonemes(w));
    const phonemeAccuracy = comparePhonemeArrays(expPhArr, spkPhArr);

    // Fluency metrics
    const totalSpeechMs = (speechEndRef.current && speechStartRef.current)
      ? Math.max(1, (speechEndRef.current - speechStartRef.current))
      : 1;
    const totalSilenceMs = cumulativeSilentMsRef.current;
    const pauseRatio = Math.min(1, totalSilenceMs / totalSpeechMs);
    const fluencyScore = Math.min(100, Math.max(0, Math.round((1 - pauseRatio) * 100)));

    const wpmRaw = Math.max(0, Math.round((expWords.length / (totalSpeechMs / 1000)) * 60));
    const wordCount = expWords.length;

    const conf = resultConfidence ?? 0.8;
    const pronScore = Math.min(100, Math.max(0, Math.round((0.5 * wordAccuracy) + (0.35 * phonemeAccuracy) + (0.15 * conf * 100))));
    const correctnessPercent = Math.min(100, Math.max(0, Math.round(wordAccuracy)));
    const { score: readingSpeedScore, label: readingSpeedLabel } = gradeReadingSpeed(wpmRaw, wordCount);
    const averageScore = Math.min(100, Math.max(0, Math.round((pronScore + correctnessPercent + readingSpeedScore) / 3)));

    let averageLabel: "Excellent" | "Very Good" | "Good" | "Fair" | "Poor";
    if (averageScore >= 90) averageLabel = "Excellent";
    else if (averageScore >= 80) averageLabel = "Very Good";
    else if (averageScore >= 70) averageLabel = "Good";
    else if (averageScore >= 60) averageLabel = "Fair";
    else averageLabel = "Poor";

    const remarkMessages: Record<typeof averageLabel, string> = {
      Excellent: "Excellent — outstanding delivery and pacing!",
      "Very Good": "Very Good — just a little polish needed.",
      Good: "Good — keep practicing for smoother speech.",
      Fair: "Fair — focus on clarity and confidence.",
      Poor: "Poor — let's build clarity and pace together.",
    };

    return {
      expWords,
      spkWords,
      perWordDetails,
      correctness: correctnessPercent,
      phonemeAccuracy: Math.round(phonemeAccuracy * 100) / 100,
      fluencyScore,
      readingSpeed: wpmRaw,
      wpm: wpmRaw,
      readingSpeedScore,
      readingSpeedLabel,
      wordCount,
      pronScore,
      completenessScore,
      averageScore,
      averageLabel,
      remarks: remarkMessages[averageLabel],
      wordFeedback,
    };
  }, [gradeReadingSpeed]);

  // ---------- Microphone handler ----------
  const handleMicrophoneFallback = useCallback(async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      await startAudioAnalyser(stream);

      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      cumulativeSilentMsRef.current = 0;
      speechStartRef.current = null;
      speechEndRef.current = null;
      lastVoiceTimestampRef.current = null;
      silenceStartRef.current = null;

      setIsListening(true);
      setIsProcessing(true);
      setRecognizedText("");
      setLiveTranscription("");
      setFeedback("Listening... 🎧");
      setStatusMessage("Using browser speech recognition.");

      recognition.onstart = () => {
        speechStartRef.current = performance.now();
      };

      recognition.onresult = (event: any) => {
        const spoken = event.results[0][0].transcript;
        const conf = event.results[0][0].confidence ?? null;
        setRecognizedText(spoken);
        setLiveTranscription(spoken);

        speechEndRef.current = performance.now();

        const sc = computeScores(sentence, spoken, conf);
        setMetrics(sc);
        setFeedback(sc.remarks);
        setWordFeedback(sc.wordFeedback ?? []);
        upsertSessionScore(current, sentence, {
          pronScore: sc.pronScore,
          correctness: sc.correctness,
          fluencyScore: sc.fluencyScore,
          completenessScore: sc.completenessScore,
          readingSpeedScore: sc.readingSpeedScore,
          averageScore: sc.averageScore,
          readingSpeedWpm: sc.wpm,
          transcription: spoken,
        });

        stopAudioAnalyser();
        setIsListening(false);
        setIsProcessing(false);
      };

      recognition.onerror = () => {
        setFeedback("Error in speech recognition. Please try again.");
        stopAudioAnalyser();
        setIsListening(false);
        setIsProcessing(false);
      };

      recognition.onend = () => {
        if (!speechEndRef.current) speechEndRef.current = performance.now();
        if (!recognizedText) {
          setFeedback("No speech detected. Please try again.");
          stopAudioAnalyser();
          setIsListening(false);
          setIsProcessing(false);
        }
      };

      recognition.start();

      setTimeout(() => {
        try { recognition.stop(); } catch {}
      }, 45000);
    } catch (err) {
      console.error(err);
      setFeedback("Microphone error or permission not granted.");
      setIsListening(false);
      setIsProcessing(false);
      stopAudioAnalyser();
    }
  }, [computeScores, current, recognizedText, sentence, startAudioAnalyser, stopAudioAnalyser, upsertSessionScore]);

  const handleMicrophone = async () => {
    if (!sentence.trim()) return;
    if (isListening || isProcessing) return;
    if (recognizerRef.current) {
      try {
        recognizerClosedRef.current = true;
        recognizerRef.current.close();
      } catch {
        // ignore
      }
      recognizerRef.current = null;
    }
    let didFallback = false;
    const sessionId = (recognizerSessionRef.current += 1);
    recognizerClosedRef.current = false;
    const isActiveSession = () =>
      sessionId === recognizerSessionRef.current && !recognizerClosedRef.current;
    setIsListening(true);
    setIsProcessing(true);
    setFeedback("");
    setStatusMessage("Connecting to Azure Speech...");
    setRecognizedText("");
    setLiveTranscription("");
    setWordFeedback([]);

    try {
      const { token, region } = await getSpeechToken();
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = "en-US";

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      const paConfig = new SpeechSDK.PronunciationAssessmentConfig(
        sentence,
        SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
        SpeechSDK.PronunciationAssessmentGranularity.Word,
        true,
      );
      (paConfig as any).enableProsodyAssessment = true;
      paConfig.applyTo(recognizer);

      recognizer.recognizing = (_sender, event) => {
        const interimText = event.result?.text ?? "";
        if (interimText) {
          setLiveTranscription(interimText);
          setRecognizedText(interimText);
          setStatusMessage("Listening... 🎧");
        }
      };

      const aggregate = await new Promise<{
        spoken: string;
        duration: number;
        wordCount: number;
        scores: { pronunciation: number; accuracy: number; fluency: number; completeness: number };
        words: WordFeedback[];
      } | null>((resolve, reject) => {
        let settled = false;
        let silenceTimer: number | undefined;
        const maxTimer = window.setTimeout(() => finish(), 120000);
        let totalDuration = 0;
        let totalWords = 0;
        let totalText = "";
        const weighted = { pronunciation: 0, accuracy: 0, fluency: 0, completeness: 0 };
        const allWords: WordFeedback[] = [];

        const finish = () => {
          if (settled) return;
          settled = true;
          if (silenceTimer) window.clearTimeout(silenceTimer);
          if (maxTimer) window.clearTimeout(maxTimer);
          if (!isActiveSession()) {
            resolve(null);
            return;
          }
          recognizer.stopContinuousRecognitionAsync(
            () => {
              if (!totalWords) {
                resolve(null);
                return;
              }
              resolve({
                spoken: totalText.trim(),
                duration: totalDuration,
                wordCount: totalWords,
                scores: {
                  pronunciation: weighted.pronunciation / totalWords,
                  accuracy: weighted.accuracy / totalWords,
                  fluency: weighted.fluency / totalWords,
                  completeness: weighted.completeness / totalWords,
                },
                words: applyOmissionsToWordFeedback(allWords, sentence),
              });
            },
            (error) => {
              if (!isActiveSession()) {
                resolve(null);
                return;
              }
              reject(error);
            },
          );
        };

        const bumpSilence = () => {
          if (silenceTimer) window.clearTimeout(silenceTimer);
          silenceTimer = window.setTimeout(() => finish(), 4000);
        };

        recognizer.recognized = (_sender, event) => {
          if (!isActiveSession()) return;
          if (event.result?.reason !== SpeechSDK.ResultReason.RecognizedSpeech) return;
          const result = event.result;
          const segmentText = result.text ?? "";
          if (segmentText) {
            totalText = totalText ? `${totalText} ${segmentText}` : segmentText;
          }
          const segmentWordCount = normalizeText(segmentText).split(/\s+/).filter(Boolean).length;
          if (segmentWordCount > 0) {
            const paResult = SpeechSDK.PronunciationAssessmentResult.fromResult(result);
            weighted.pronunciation += (paResult.pronunciationScore ?? 0) * segmentWordCount;
            weighted.accuracy += (paResult.accuracyScore ?? 0) * segmentWordCount;
            weighted.fluency += (paResult.fluencyScore ?? 0) * segmentWordCount;
            weighted.completeness += (paResult.completenessScore ?? 0) * segmentWordCount;
            totalWords += segmentWordCount;
          }
          totalDuration += result.duration ?? 0;
          const jsonResult = result.properties.getProperty(
            SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult,
          );
          const segmentWords = parseWordFeedback(jsonResult, sentence, "raw");
          allWords.push(...segmentWords);
          bumpSilence();
        };

        recognizer.recognizing = (_sender, event) => {
          if (!isActiveSession()) return;
          const interimText = event.result?.text ?? "";
          if (interimText) {
            setLiveTranscription(interimText);
            setRecognizedText(interimText);
            setStatusMessage("Listening... 🎧");
            bumpSilence();
          }
        };

        recognizer.canceled = () => finish();

        recognizer.startContinuousRecognitionAsync(
          () => {
            if (isActiveSession()) {
              setStatusMessage("Listening... 🎧");
            }
          },
          (error) => {
            if (!isActiveSession()) {
              resolve(null);
              return;
            }
            reject(error);
          },
        );
      });

      if (!aggregate) {
        setStatusMessage("No speech detected. Please try again.");
        setFeedback("No speech detected. Please try again.");
        return;
      }

      const durationSec = aggregate.duration ? aggregate.duration / 10000000 : 0;
      const wpmRaw = durationSec > 0
        ? Math.round((aggregate.wordCount / durationSec) * 60)
        : 0;
      const speedGrade = gradeReadingSpeed(wpmRaw, Math.max(1, aggregate.wordCount));
      const pronScore = Math.round(aggregate.scores.pronunciation);

      const expectedWordCount = Math.max(1, normalizeText(sentence).split(/\s+/).filter(Boolean).length);
      const scoredWords = aggregate.words.filter((item) => typeof item.accuracyScore === "number");
      const wordAccuracyAvg = scoredWords.length
        ? scoredWords.reduce((sum, item) => sum + (item.accuracyScore ?? 0), 0) / scoredWords.length
        : 0;
      const omittedCount = aggregate.words.filter((item) => (item.accuracyScore ?? 0) === 0).length;

      const accuracyScore = Math.round((aggregate.scores.accuracy * 0.6) + (wordAccuracyAvg * 0.4));
      const fluencyScore = Math.round(wordAccuracyAvg);
      const completenessScore = Math.round(
        Math.max(0, 100 - ((omittedCount / expectedWordCount) * 100)),
      );
      const averageScore = Math.min(
        100,
        Math.max(0, Math.round((pronScore + accuracyScore + speedGrade.score) / 3)),
      );

      const azureMetrics = {
        pronScore,
        accuracyScore,
        fluencyScore,
        completenessScore,
        wpm: wpmRaw,
        readingSpeedScore: speedGrade.score,
        readingSpeedLabel: speedGrade.label,
        wordCount: aggregate.wordCount,
        averageScore,
        transcription: aggregate.spoken,
        wordFeedback: aggregate.words,
      };

      const spoken = aggregate.spoken;
      const words = aggregate.words;

      setRecognizedText(spoken);
      setLiveTranscription(spoken);
      setWordFeedback(words);
      setMetrics(azureMetrics);
      setFeedback("Pronunciation assessment complete.");
      setStatusMessage("");

      upsertSessionScore(current, sentence, {
        pronScore: azureMetrics.pronScore,
        correctness: azureMetrics.accuracyScore,
        fluencyScore: azureMetrics.fluencyScore,
        completenessScore: azureMetrics.completenessScore,
        readingSpeedScore: azureMetrics.readingSpeedScore,
        averageScore: azureMetrics.averageScore,
        readingSpeedWpm: azureMetrics.wpm,
        transcription: spoken,
      });
    } catch (error) {
      console.error("Azure speech recognition failed", error);
      setStatusMessage("Azure Speech failed. Switching to browser speech.");
      setFeedback("Using browser speech recognition.");
      didFallback = true;
      await handleMicrophoneFallback();
      return;
    } finally {
      if (isActiveSession()) {
        recognizerClosedRef.current = true;
        try {
          recognizerRef.current?.close();
        } catch {
          // ignore
        }
        recognizerRef.current = null;
      }
      if (!didFallback) {
        setIsListening(false);
        setIsProcessing(false);
      }
    }
  };

  // Calculate average for student table
  const calculateStudentAverage = (student: EnrichedStudent) => {
    if (!student.lastPerformance) return "—";
    if (typeof student.lastPerformance.overallAverage === "number") {
      return `${student.lastPerformance.overallAverage}%`;
    }
    const {
      pronScore,
      correctness,
      readingSpeedScore,
      wpm,
      sentence,
      wordCount,
    } = student.lastPerformance;

    const resolvedWordCount = Math.max(
      1,
      wordCount ?? normalizeText(sentence ?? "").split(/\s+/).filter(Boolean).length,
    );
    const speedScore = typeof readingSpeedScore === "number"
      ? readingSpeedScore
      : gradeReadingSpeed(wpm, resolvedWordCount).score;
    const correctnessScore = typeof correctness === "number"
      ? correctness
      : pronScore;

    const average = Math.min(100, Math.max(0, Math.round((pronScore + correctnessScore + speedScore) / 3)));
    return `${average}%`;
  };

  const selectionRows = filteredStudents.map((student, index) => ({
    ...student,
    no: index + 1,
    average: calculateStudentAverage(student),
  }));

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
              Latest performance for <span className="font-semibold">{lastSavedStudent.name}</span> has been saved.
            </div>
          )}

          {blockedSessionMessage && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm shadow-amber-100">
              {blockedSessionMessage}
            </div>
          )}

          <div className="mt-5 rounded-3xl border border-gray-300 bg-white shadow-md shadow-gray-200 p-6 space-y-6 flex flex-1 flex-col min-h-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-gray-600">
                Showing {selectionRows.length} student{selectionRows.length === 1 ? "" : "s"}
              </p>
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
                  { key: "average", title: "Average" },
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
                pageSize={8}
              />
            </div>
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
    // If the name is like 'English • Non-Reader Level', split it
    const match = selectedStudent.name.match(headerLabelRegex);
    if (match) {
      const subject = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      subtitle = `${subject} • ${match[2]} Level`;
      mainTitle = `${subject} Preview`;
    }
  } else if (previewRegex.test(selectedStudent.name)) {
    // If the name is just 'English Preview', keep as is
    mainTitle = selectedStudent.name;
    subtitle = "";
  }

  



  const formatPercentValue = (value: number | null | undefined) =>
    typeof value === "number" ? `${Math.round(value)}%` : "—";

  const renderScoreBar = (value: number | null | undefined) => {
    const safeValue = typeof value === "number" ? Math.min(100, Math.max(0, value)) : 0;
    return (
      <div className="mt-2 h-2 w-full rounded-full bg-emerald-100">
        <div
          className="h-2 rounded-full bg-[#013300] transition-all"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    );
  };

  const wordItems = metrics?.wordFeedback ?? wordFeedback;

  if (showSummary) {
    const overallAverage = sessionScores.length
      ? Math.round(
          sessionScores.reduce((sum, item) => sum + item.averageScore, 0) /
            Math.max(1, sessionScores.length),
        )
      : 0;


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
            <div className="rounded-3xl border border-gray-300 bg-white shadow-md shadow-gray-200 p-6 flex flex-col gap-3 lg:col-span-9 min-h-80">
              <p className="text-3xl sm:text-2xl font-bold text-black">Per-Slide Average</p>
              <div className="overflow-auto -mx-4 px-4">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-2 pr-3">Slide</th>
                      <th className="py-2 pr-3">Pronunciation</th>
                      <th className="py-2 pr-3">Accuracy</th>
                      <th className="py-2 pr-3">Fluency</th>
                      <th className="py-2 pr-3">Completeness</th>
                      <th className="py-2 pr-3">Reading Speed</th>
                      <th className="py-2 pr-3">Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionScores.length === 0 ? (
                      <tr>
                        <td className="py-3 text-slate-600" colSpan={7}>No recorded scores yet.</td>
                      </tr>
                    ) : (
                      sessionScores.map((item) => (
                        <tr key={item.cardIndex} className="border-t border-gray-200">
                          <td className="py-2 pr-3 font-bold text-[#013300]">{item.cardIndex + 1}</td>
                          <td className="py-2 pr-3 font-base text-[#013300]">{item.pronScore}%</td>
                          <td className="py-2 pr-3 font-base text-[#013300]">{item.correctness}%</td>
                          <td className="py-2 pr-3 font-base text-[#013300]">{typeof item.fluencyScore === "number" ? `${item.fluencyScore}%` : "—"}</td>
                          <td className="py-2 pr-3 font-base text-[#013300]">{typeof item.completenessScore === "number" ? `${item.completenessScore}%` : "—"}</td>
                          <td className="py-2 pr-3 font-base text-[#013300]">{item.readingSpeedScore}%</td>
                          <td className="py-2 pr-3 font-bold text-[#013300]">{item.averageScore}%</td>
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
            <div className="mt-3 text-md text-slate-700 leading-relaxed">
              {isLoadingInsight ? (
                <div className="flex items-center gap-2 text-slate-500 animate-pulse">
                  <span className="h-4 w-4 rounded-full bg-slate-300" />
                  Generating AI insights...
                </div>
              ) : (
                <span>{aiInsight || "No insights generated."}</span>
              )}
            </div>

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
                    setShowSummary(false);
                    resetSessionTracking();
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

        {(statusMessage || feedback) && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
            <div className="flex items-center gap-2">
              {isProcessing && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
              <span className="font-semibold">{statusMessage || feedback}</span>
            </div>
            {statusMessage && feedback && (
              <p className="mt-1 text-xs text-emerald-800">{feedback}</p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-1 flex-col gap-5">
          <div className="grid gap-3 xl:grid-cols-12 flex-1 min-h-0">
            <section className="xl:col-span-8 flex flex-col min-h-0">
              <div className="h-full rounded-3xl border border-gray-300 bg-white shadow-md shadow-gray-200 overflow-hidden flex flex-col">
              <div className={contentContainerClass}>
                <p className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#013300] leading-tight">
                  {sentence}
                </p>
                <div className="w-full max-w-2xl">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Word-level feedback</p>
                  {wordItems?.length ? (
                    <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                      {wordItems.map((item: WordFeedback, index: number) => {
                        const accuracy = item.accuracyScore ?? 0;
                        const isError = item.errorType && item.errorType !== "None";
                        const badgeClass = isError
                          ? "bg-rose-100 text-rose-700"
                          : accuracy >= 85
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700";
                        return (
                          <span
                            key={`${item.word}-${index}`}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                          >
                            {item.word}
                            {typeof item.accuracyScore === "number" ? ` • ${item.accuracyScore}%` : ""}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-500">No word-level feedback yet.</p>
                  )}
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
                  {isListening ? "Listening..." : "Speak"}
                </button>
              </div>
              </div>
            </section>

            <aside className="xl:col-span-4 flex flex-col gap-4 min-h-0">
              <div className="rounded-3xl border border-gray-300 bg-white/80 backdrop-blur px-5 py-5 shadow-md shadow-gray-200 flex flex-1 flex-col min-h-0">
                <h2 className="text-base font-semibold text-[#013300]">Performance Insights</h2>
                <div className="mt-4 flex flex-1 flex-col gap-3 min-h-0">
                  <div className="rounded-2xl border border-gray-300 bg-emerald-50/60 px-3 py-2.5 flex flex-col">
                    <p className="text-[11px] uppercase tracking-wide text-emerald-800">Live Transcription</p>
                    <p className="mt-1 text-xs font-medium text-[#013300]">
                      {liveTranscription || recognizedText || "Waiting for microphone recording."}
                    </p>
                  </div>

                  <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 auto-rows-fr">
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Pronunciation</dt>
                      <dd className="text-base font-semibold text-[#013300]">{formatPercentValue(metrics?.pronScore)}</dd>
                      {renderScoreBar(metrics?.pronScore)}
                    </div>
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Accuracy</dt>
                      <dd className="text-base font-semibold text-[#013300]">{formatPercentValue(metrics?.accuracyScore ?? metrics?.correctness)}</dd>
                      {renderScoreBar(metrics?.accuracyScore ?? metrics?.correctness)}
                    </div>
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Fluency</dt>
                      <dd className="text-base font-semibold text-[#013300]">{formatPercentValue(metrics?.fluencyScore)}</dd>
                      {renderScoreBar(metrics?.fluencyScore)}
                    </div>
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Completeness</dt>
                      <dd className="text-base font-semibold text-[#013300]">{formatPercentValue(metrics?.completenessScore)}</dd>
                      {renderScoreBar(metrics?.completenessScore)}
                    </div>
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Reading Speed</dt>
                      <dd className="text-base font-semibold text-[#013300]">
                        {metrics
                          ? `${metrics.wpm} WPM${metrics.readingSpeedLabel ? ` (${metrics.readingSpeedLabel})` : ""}`
                          : "—"}
                      </dd>
                      {renderScoreBar(metrics?.readingSpeedScore)}
                    </div>
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Average</dt>
                      <dd className="text-base font-semibold text-[#013300]">{formatPercentValue(metrics?.averageScore)}</dd>
                      {renderScoreBar(metrics?.averageScore)}
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

"use client";
import { useState, useRef, useEffect, useMemo, useCallback, type CSSProperties } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useSearchParams, useRouter } from "next/navigation";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";

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

/* ---------- Student roster & performance storage ---------- */

const STUDENT_ROSTER_KEY = "MASTER_TEACHER_ENGLISH_STUDENTS";
const PERFORMANCE_HISTORY_KEY = "MASTER_TEACHER_ENGLISH_PERFORMANCE";
const FLASHCARD_CONTENT_KEY = "MASTER_TEACHER_ENGLISH_FLASHCARDS";

type StudentRecord = {
  id: string;
  studentId: string;
  name: string;
  grade?: string;
  section?: string;
};

type StudentPerformanceEntry = {
  id: string;
  studentId: string;
  timestamp: string;
  pronScore: number;
  fluencyScore: number;
  phonemeAccuracy: number;
  wpm: number;
  cardIndex: number;
  sentence: string;
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

const DEFAULT_ENGLISH_STUDENTS: StudentRecord[] = [
  { id: "eng-001", studentId: "EN-2025-001", name: "Ava Martinez", grade: "4", section: "A" },
  { id: "eng-002", studentId: "EN-2025-002", name: "Liam Santos", grade: "4", section: "B" },
  { id: "eng-003", studentId: "EN-2025-003", name: "Mia del Rosario", grade: "4", section: "A" },
  { id: "eng-004", studentId: "EN-2025-004", name: "Noah Cruz", grade: "4", section: "B" },
  { id: "eng-005", studentId: "EN-2025-005", name: "Sofia Reyes", grade: "4", section: "C" },
];

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
export default function MasterTeacherEnglishRemedialFlashcards() {
  const router = useRouter();
  const [flashcardsData, setFlashcardsData] = useState<FlashcardContent[]>(INITIAL_FLASHCARDS);
  const searchParams = useSearchParams();
  const startParam = searchParams?.get("start");
  const startIndex = useMemo(() => {
    if (!startParam) return 0;
    const parsed = Number.parseInt(startParam, 10);
    if (Number.isNaN(parsed)) return 0;
    const maxIndex = Math.max(flashcardsData.length - 1, 0);
    return Math.min(Math.max(parsed, 0), maxIndex);
  }, [flashcardsData.length, startParam]);

  const [view, setView] = useState<"select" | "session">("select");
  const [students, setStudents] = useState<StudentRecord[]>(DEFAULT_ENGLISH_STUDENTS);
  const [performances, setPerformances] = useState<StudentPerformanceEntry[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [lastSavedStudentId, setLastSavedStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(FLASHCARD_CONTENT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isValidFlashcardContent(parsed)) {
          setFlashcardsData(parsed);
          return;
        }
      }

      window.localStorage.setItem(FLASHCARD_CONTENT_KEY, JSON.stringify(INITIAL_FLASHCARDS));
      setFlashcardsData(INITIAL_FLASHCARDS);
    } catch (error) {
      console.warn("Failed to load English flashcard content", error);
      setFlashcardsData(INITIAL_FLASHCARDS);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedStudents = window.localStorage.getItem(STUDENT_ROSTER_KEY);
      if (storedStudents) {
        const parsed = JSON.parse(storedStudents) as StudentRecord[];
        if (Array.isArray(parsed)) {
          setStudents(parsed);
        }
      } else {
        window.localStorage.setItem(STUDENT_ROSTER_KEY, JSON.stringify(DEFAULT_ENGLISH_STUDENTS));
      }
    } catch (error) {
      console.warn("Failed to load English remedial roster", error);
    }

    try {
      const storedPerformances = window.localStorage.getItem(PERFORMANCE_HISTORY_KEY);
      if (storedPerformances) {
        const parsed = JSON.parse(storedPerformances) as StudentPerformanceEntry[];
        if (Array.isArray(parsed)) {
          setPerformances(parsed);
        }
      }
    } catch (error) {
      console.warn("Failed to load English remedial performance history", error);
    }
  }, []);

  useEffect(() => {
    if (lastSavedStudentId) {
      const timer = window.setTimeout(() => setLastSavedStudentId(null), 4000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [lastSavedStudentId]);

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
    if (view === "session" && !selectedStudent) {
      setView("select");
    }
  }, [selectedStudent, view]);

  const addPerformanceEntry = useCallback((entry: StudentPerformanceEntry) => {
    setPerformances((prev) => {
      const next = [...prev, entry];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PERFORMANCE_HISTORY_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const [current, setCurrent] = useState(startIndex);

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

  // recognition + metrics state
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [metrics, setMetrics] = useState<any>(null);

  // refs for audio / timing
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const lastVoiceTimestampRef = useRef<number | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const speechEndRef = useRef<number | null>(null);
  const cumulativeSilentMsRef = useRef<number>(0);

  const handlePrev = () =>
    setCurrent((prev) => (flashcardsData.length > 0 ? Math.max(prev - 1, 0) : 0));
  const handleNext = () =>
    setCurrent((prev) =>
      flashcardsData.length > 0 ? Math.min(prev + 1, flashcardsData.length - 1) : 0,
    );

  const handleStartSession = (studentId: string) => {
    setSelectedStudentId(studentId);
    setCurrent(startIndex);
    resetSessionTracking();
    setView("session");
  };

  const handleStopSession = () => {
    const activeSentence = flashcardsData[current]?.sentence ?? "";
    if (selectedStudentId && metrics) {
      addPerformanceEntry({
        id: `perf-${Date.now()}`,
        studentId: selectedStudentId,
        timestamp: new Date().toISOString(),
        pronScore: metrics.pronScore,
        fluencyScore: metrics.fluencyScore,
        phonemeAccuracy: metrics.phonemeAccuracy,
        wpm: metrics.wpm,
        cardIndex: current,
        sentence: activeSentence,
      });
      setLastSavedStudentId(selectedStudentId);
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    resetSessionTracking();
    setCurrent(startIndex);
    setSelectedStudentId(null);
    setView("select");
  };

  const handleBackToDashboard = () => {
    router.back();
  };

  const handleSpeak = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utter = new window.SpeechSynthesisUtterance(sentence);
      utter.rate = 0.9;
      utter.pitch = 1.1;
      utter.lang = "en-US"; // English language
      
      // Set playing state when speech starts
      setIsPlaying(true);
      
      // Reset playing state when speech ends
      utter.onend = () => {
        setIsPlaying(false);
      };
      
      // Also handle error case
      utter.onerror = () => {
        setIsPlaying(false);
      };
      
      window.speechSynthesis.speak(utter);
    }
  };

  // ---------- Core: start mic, listen, measure silence + timestamps ----------
  const startAudioAnalyser = async (stream: MediaStream) => {
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
  };

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
    } catch (e) { /* ignore */ }
  }, []);

  const resetSessionTracking = useCallback(() => {
    setRecognizedText("");
    setFeedback("");
    setMetrics(null);
    cumulativeSilentMsRef.current = 0;
    speechStartRef.current = null;
    speechEndRef.current = null;
    stopAudioAnalyser();
    setIsListening(false);
    setIsPlaying(false);
  }, [stopAudioAnalyser]);

  useEffect(() => {
    return () => stopAudioAnalyser();
  }, []);

  useEffect(() => {
    resetSessionTracking();
  }, [current, resetSessionTracking]);

  // ---------- Scoring logic for English ----------
  function computeScores(expectedText: string, spokenText: string, resultConfidence: number | null) {
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

  const conf = resultConfidence ?? 0.8;
  const pronScore = Math.min(100, Math.max(0, Math.round((0.5 * wordAccuracy) + (0.35 * phonemeAccuracy) + (0.15 * conf * 100))));
    const correctnessPercent = Math.min(100, Math.max(0, Math.round(wordAccuracy)));
    const readingSpeedPercent = Math.min(100, Math.max(0, wpmRaw));
    const averageScore = Math.min(100, Math.max(0, Math.round((pronScore + fluencyScore + readingSpeedPercent) / 3)));

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
      pronScore,
      averageScore,
      averageLabel,
      remarks: remarkMessages[averageLabel],
    };
  }

  // ---------- Microphone handler ----------
  const handleMicrophone = async () => {
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
      recognition.lang = "en-US"; // English language
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      cumulativeSilentMsRef.current = 0;
      speechStartRef.current = null;
      speechEndRef.current = null;
      lastVoiceTimestampRef.current = null;
      silenceStartRef.current = null;

      setIsListening(true);
      setRecognizedText("");
      setFeedback("Listening... 🎧");

      recognition.onstart = () => {
        speechStartRef.current = performance.now();
      };

      recognition.onresult = (event: any) => {
        const spoken = event.results[0][0].transcript;
        const conf = event.results[0][0].confidence ?? null;
        setRecognizedText(spoken);

        speechEndRef.current = performance.now();

        const sc = computeScores(sentence, spoken, conf);
        setMetrics(sc);
        setFeedback(sc.remarks);

        stopAudioAnalyser();
        setIsListening(false);
      };

      recognition.onerror = (e: any) => {
        setFeedback("Error in speech recognition. Please try again.");
        stopAudioAnalyser();
        setIsListening(false);
      };

      recognition.onend = () => {
        if (!speechEndRef.current) speechEndRef.current = performance.now();
        if (!recognizedText) {
          setFeedback("No speech detected. Please try again.");
          stopAudioAnalyser();
          setIsListening(false);
        }
      };

      recognition.start();

      setTimeout(() => {
        try { recognition.stop(); } catch (e) {}
      }, 45000);

    } catch (err) {
      console.error(err);
      setFeedback("Microphone error or permission not granted.");
      setIsListening(false);
      stopAudioAnalyser();
    }
  };

  // Calculate average for student table
  const calculateStudentAverage = (student: EnrichedStudent) => {
    if (!student.lastPerformance) return "—";
    const { pronScore, fluencyScore, wpm } = student.lastPerformance;
    const readingSpeedPercent = Math.min(100, Math.max(0, Math.round(wpm)));
    const average = Math.min(100, Math.max(0, Math.round((pronScore + fluencyScore + readingSpeedPercent) / 3)));
    return `${average}%`;
  };

  const selectionRows = filteredStudents.map((student, index) => ({
    ...student,
    no: index + 1,
    average: calculateStudentAverage(student),
  }));

  if (view === "select") {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-[#f2f8f4] via-white to-[#e6f2ec]">
        <div className="w-full max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex min-h-dvh flex-col">
          <header className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur px-3 py-3 sm:py-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between shadow-md shadow-gray-200">
            <div className="space-y-3 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">English</p>
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
                actions={(row: any) => (
                  <UtilityButton small onClick={() => handleStartSession(row.id)}>
                    Start Remedial
                  </UtilityButton>
                )}
                pageSize={8}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedStudent) {
    return null;
  }

  const progressPercent = flashcardsData.length
    ? ((current + 1) / flashcardsData.length) * 100
    : 0;
  const progressCircleStyle: CSSProperties = {
    background: `conic-gradient(#013300 ${progressPercent * 3.6}deg, #e6f4ef ${progressPercent * 3.6}deg)`,
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#f2f8f4] via-white to-[#e6f2ec]">
      <div className="w-full max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex min-h-dvh flex-col">
        <header className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur px-3 py-3 sm:py-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between shadow-md shadow-gray-200">
          <div className="space-y-2 text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">English</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0d1b16]">Non-Reader Level</h1>
            <p className="text-md font-semibold text-[#013300]">
              Student: {selectedStudent.studentId} - {selectedStudent.name}
            </p>
            {(selectedStudent.grade || selectedStudent.section) && (
              <p className="text-sm text-slate-500">
                {selectedStudent.grade ? `Grade ${selectedStudent.grade}` : ""}
                {selectedStudent.grade && selectedStudent.section ? " • " : ""}
                {selectedStudent.section ? `Section ${selectedStudent.section}` : ""}
              </p>
            )}
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
              <div className="flex-1 px-6 sm:px-8 lg:px-12 py-12 via-white flex items-center justify-center text-center">
                <p className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#013300] leading-tight">
                  {sentence}
                </p>
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
                  {isPlaying ? "Playing..." : "Play Sentence"}
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
                  {isListening ? "Listening..." : "Pronunciation Check"}
                </button>
              </div>
              </div>
            </section>

            <aside className="xl:col-span-4 flex flex-col gap-6 min-h-0">
              <div className="rounded-3xl border border-gray-300 bg-white/80 backdrop-blur px-6 py-7 shadow-md shadow-gray-200 flex flex-1 flex-col min-h-0">
                <h2 className="text-lg font-semibold text-[#013300]">Real-time Insights</h2>
                <div className="mt-6 flex flex-1 flex-col gap-4 min-h-0">
                  <div className="rounded-2xl border border-gray-300 bg-emerald-50/60 px-4 py-3 flex flex-col h-full">
                  <p className="text-xs uppercase tracking-wide text-emerald-800">Transcription:</p>
                  <p className="mt-1 text-sm font-medium text-[#013300]">
                    {recognizedText || "Waiting for microphone recording."}
                  </p>
                </div>
                  <dl className="grid flex-1 grid-cols-1 gap-3 text-sm sm:grid-cols-2 auto-rows-fr">
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Pronunciation</dt>
                    <dd className="text-lg font-semibold text-[#013300]">{metrics ? `${metrics.pronScore}%` : "—"}</dd>
                  </div>
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Correctness</dt>
                    <dd className="text-lg font-semibold text-[#013300]">{metrics ? `${metrics.correctness}%` : "—"}</dd>
                  </div>
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Reading Speed</dt>
                    <dd className="text-lg font-semibold text-[#013300]">{metrics ? `${metrics.readingSpeed ?? metrics.wpm} WPM` : "—"}</dd>
                  </div>
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Average</dt>
                    <dd className="text-lg font-semibold text-[#013300]">{metrics ? `${metrics.averageScore}%` : "—"}</dd>
                  </div>
                </dl>
                  <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 flex flex-col h-full">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Remark</p>
                  <p className="mt-1 text-sm text-[#013300]">{feedback || "Run a pronunciation check to receive feedback."}</p>
                </div>
                </div>
              </div>
            </aside>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-center gap-3 w-full">
              <button
                onClick={handlePrev}
                disabled={current === 0}
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
                disabled={current === flashcardsData.length - 1}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#013300] px-6 py-3 text-sm font-medium text-[#013300] transition hover:border-[#013300] hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-transparent w-full sm:w-auto"
              >
                Next <FiArrowRight />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
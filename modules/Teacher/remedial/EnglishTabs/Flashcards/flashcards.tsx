"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";
import FlashcardsTemplate, { MicIcon, Volume2Icon } from "@/components/Common/RemedialFlashcards/FlashcardsTemplate";

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
  const selectionProps = {
    summaryText: `Showing ${selectionRows.length} student${selectionRows.length === 1 ? "" : "s"}`,
    searchValue: studentSearch,
    onSearchChange: (value: string) => setStudentSearch(value),
    table: (
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
            Start
          </UtilityButton>
        )}
        pageSize={8}
      />
    ),
    lastSavedMessage: lastSavedStudent
      ? `Latest performance for ${lastSavedStudent.name} has been saved.`
      : undefined,
  };

  const insightMetrics = [
    { label: "Pronunciation", value: metrics ? `${metrics.pronScore}%` : "—" },
    { label: "Correctness", value: metrics ? `${metrics.correctness}%` : "—" },
    { label: "Reading Speed", value: metrics ? `${metrics.readingSpeed ?? metrics.wpm} WPM` : "—" },
    { label: "Average", value: metrics ? `${metrics.averageScore}%` : "—" },
  ];

  const sessionProps = view === "session" && selectedStudent
    ? {
        student: {
          studentId: selectedStudent.studentId,
          name: selectedStudent.name,
          grade: selectedStudent.grade,
          section: selectedStudent.section,
        },
        levelLabel: "Non-Reader Level",
        cardText: sentence,
        cardActions: [
          {
            id: "speak",
            label: "Play Sentence",
            activeLabel: "Playing...",
            icon: <Volume2Icon />,
            onClick: handleSpeak,
            isActive: isPlaying,
          },
          {
            id: "mic",
            label: "Pronunciation Check",
            activeLabel: "Listening...",
            icon: <MicIcon />,
            onClick: handleMicrophone,
            isActive: isListening,
          },
        ],
        insights: {
          heading: "Real-time Insights",
          highlightLabel: "Transcription",
          highlightText: recognizedText || "Waiting for microphone recording.",
          metrics: insightMetrics,
          footerLabel: "Remarks",
          footerText: feedback || "Run a pronunciation check to receive feedback.",
        },
        progress: { currentIndex: current, totalCount: flashcardsData.length },
        nav: {
          onPrev: handlePrev,
          onNext: handleNext,
          onStop: handleStopSession,
          disablePrev: current === 0,
          disableNext: current === flashcardsData.length - 1,
          prevLabel: "Previous",
          nextLabel: "Next",
          stopLabel: "Save & Exit",
        },
      }
    : undefined;

  const resolvedView: "select" | "session" = sessionProps ? view : "select";

  return (
    <FlashcardsTemplate
      view={resolvedView}
      subjectLabel="English"
      headline="Remedial Flashcards"
      cardLabel="Card"
      onBack={() => router.push("/Teacher/remedial/english")}
      selection={selectionProps}
      session={sessionProps}
    />
  );
}
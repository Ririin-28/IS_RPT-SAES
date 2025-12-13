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

// Normalize text for Filipino
function normalizeText(s: string) {
  return s.replace(/[^a-zA-ZáéíóúñÑäëïöüÁÉÍÓÚÑ\s']/g, "").toLowerCase().trim();
}

// Filipino phoneme approximation
function approxPhonemes(word: string) {
  if (!word) return [];
  const w = word.toLowerCase().replace(/[^a-záéíóúñ']/g, "");
  
  // Filipino vowel sounds and common patterns
  const vowels = ['a','e','i','o','u','á','é','í','ó','ú'];
  const digraphs: {[k:string]:string} = {
    'ng':'NG','ny':'NY','ts':'TS','dy':'DY','sy':'SY','ly':'LY',
    'th':'T','sh':'S','ch':'CH','ph':'F','gh':'G'
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

const STUDENT_ROSTER_KEY = "MASTER_TEACHER_FILIPINO_STUDENTS";
const PERFORMANCE_HISTORY_KEY = "MASTER_TEACHER_FILIPINO_PERFORMANCE";

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

const DEFAULT_FILIPINO_STUDENTS: StudentRecord[] = [
  { id: "fil-001", studentId: "FIL-2025-001", name: "Juan Dela Cruz", grade: "4", section: "A" },
  { id: "fil-002", studentId: "FIL-2025-002", name: "Maria Santos", grade: "4", section: "B" },
  { id: "fil-003", studentId: "FIL-2025-003", name: "Josefa Reyes", grade: "5", section: "A" },
  { id: "fil-004", studentId: "FIL-2025-004", name: "Andres Mercado", grade: "5", section: "B" },
  { id: "fil-005", studentId: "FIL-2025-005", name: "Luisa Villanueva", grade: "6", section: "C" },
];

/* ---------- Filipino Flashcards data ---------- */
const flashcardsData = [
  { sentence: "Ang bata ay naglalaro sa parke.", highlights: ["bata", "parke"] },
  { sentence: "Kumakain ng masarap na pagkain ang pamilya.", highlights: ["masarap", "pamilya"] },
  { sentence: "Maganda ang bulaklak sa hardin.", highlights: ["bulaklak", "hardin"] },
  { sentence: "Mabilis tumakbo ang maliit na aso.", highlights: ["mabilis", "aso"] },
  { sentence: "Malakas ang ulan kanina.", highlights: ["malakas", "ulan"] },
  { sentence: "Nagluluto ang nanay ng hapunan.", highlights: ["nanay", "hapunan"] },
  { sentence: "Mabait ang guro sa eskwelahan.", highlights: ["guro", "eskwelahan"] },
  { sentence: "Maliwanag ang buwan ngayong gabi.", highlights: ["buwan", "gabi"] },
  { sentence: "Matulungin ang batang lalaki.", highlights: ["matulungin", "batang"] },
  { sentence: "Masaya ang mga bata sa party.", highlights: ["masaya", "party"] },
];

/* ---------- Component ---------- */
export default function MasterTeacherFilipinoFlashcards() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const startParam = searchParams?.get("start");
  const startIndex = startParam
    ? Math.min(Math.max(parseInt(startParam), 0), flashcardsData.length - 1)
    : 0;

  const [view, setView] = useState<"select" | "session">("select");
  const [students, setStudents] = useState<StudentRecord[]>(DEFAULT_FILIPINO_STUDENTS);
  const [performances, setPerformances] = useState<StudentPerformanceEntry[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [lastSavedStudentId, setLastSavedStudentId] = useState<string | null>(null);

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
        window.localStorage.setItem(STUDENT_ROSTER_KEY, JSON.stringify(DEFAULT_FILIPINO_STUDENTS));
      }
    } catch (error) {
      console.warn("Failed to load Filipino remedial roster", error);
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
      console.warn("Failed to load Filipino remedial performance history", error);
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
  const currentCard = flashcardsData[current];
  const { sentence } = currentCard;

  // recognition + metrics state
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [metrics, setMetrics] = useState<any>(null);

  // refs for audio / timing - ADDED FOR MANUAL STOP
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const lastVoiceTimestampRef = useRef<number | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const speechEndRef = useRef<number | null>(null);
  const cumulativeSilentMsRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const manualStopRef = useRef(false);
  const finalizedRef = useRef(false);
  const transcriptRef = useRef<string>("");
  const lastConfidenceRef = useRef<number | null>(null);
  const restartTimeoutRef = useRef<number | null>(null);
  const analyserCleanupRef = useRef<(() => void) | null>(null);

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
      if (analyserCleanupRef.current) {
        analyserCleanupRef.current();
        analyserCleanupRef.current = null;
      }
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

  const clearMicRestart = useCallback(() => {
    if (restartTimeoutRef.current) {
      window.clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, []);

  const stopRecognitionLoop = useCallback(() => {
    clearMicRestart();
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }
  }, [clearMicRestart]);

  // NEW FUNCTION: Finalize recording and compute scores
  const finalizeRecording = useCallback((errorMessage?: string) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    stopRecognitionLoop();
    speechEndRef.current = performance.now();
    stopAudioAnalyser();
    setIsListening(false);
    manualStopRef.current = false;

    const spoken = (transcriptRef.current || "").trim();

    if (errorMessage) {
      setFeedback(errorMessage);
      return;
    }

    if (!spoken) {
      setFeedback("Walang narinig na pagsasalita. Pakisubukan muli.");
      setRecognizedText("");
      return;
    }

    const sc = computeScores(sentence, spoken, lastConfidenceRef.current);
    setMetrics(sc);
    setFeedback(sc.remarks);
    setRecognizedText(spoken);
  }, [sentence, stopAudioAnalyser, stopRecognitionLoop]);

  const resetSessionTracking = useCallback(() => {
    clearMicRestart();
    stopRecognitionLoop();
    manualStopRef.current = false;
    finalizedRef.current = false;
    transcriptRef.current = "";
    lastConfidenceRef.current = null;
    setRecognizedText("");
    setFeedback("");
    setMetrics(null);
    cumulativeSilentMsRef.current = 0;
    speechStartRef.current = null;
    speechEndRef.current = null;
    stopAudioAnalyser();
    setIsListening(false);
    setIsPlaying(false);
  }, [clearMicRestart, stopAudioAnalyser, stopRecognitionLoop]);

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      stopRecognitionLoop();
      clearMicRestart();
      stopAudioAnalyser();
    };
  }, [clearMicRestart, stopAudioAnalyser, stopRecognitionLoop]);

  useEffect(() => {
    resetSessionTracking();
  }, [current, resetSessionTracking]);

  const handlePrev = () => setCurrent((prev) => Math.max(prev - 1, 0));
  const handleNext = () => setCurrent((prev) => Math.min(prev + 1, flashcardsData.length - 1));

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
      utter.lang = "fil-PH";

      setIsPlaying(true);

      utter.onend = () => {
        setIsPlaying(false);
      };

      utter.onerror = () => {
        setIsPlaying(false);
      };

      window.speechSynthesis.speak(utter);
    }
  };

  // ---------- Scoring logic for Filipino ----------
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

    // Filipino phoneme analysis
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

    // Combine scores with confidence
    const conf = resultConfidence ?? 0.8;
    const pronScore = Math.min(100, Math.max(0, Math.round(
      (0.5 * wordAccuracy) + (0.35 * phonemeAccuracy) + (0.15 * conf * 100)
    )));

    // Calculate average metrics
    const correctnessPercent = Math.min(100, Math.max(0, Math.round(wordAccuracy)));
    const readingSpeedPercent = Math.min(100, Math.max(0, wpmRaw));
    const averageScore = Math.min(100, Math.max(0, Math.round(
      (pronScore + fluencyScore + readingSpeedPercent) / 3
    )));

    let averageLabel: "Excellent" | "Magaling" | "Katamtaman" | "Kailangan ng Tulong" | "Mahina";
    if (averageScore >= 90) averageLabel = "Excellent";
    else if (averageScore >= 80) averageLabel = "Magaling";
    else if (averageScore >= 70) averageLabel = "Katamtaman";
    else if (averageScore >= 60) averageLabel = "Kailangan ng Tulong";
    else averageLabel = "Mahina";

    const remarkMessages: Record<typeof averageLabel, string> = {
      Excellent: "Napakagaling! Walang pagkakamali sa pagbigkas! 🌟",
      Magaling: "Magaling! Kaunting pagsasanay pa para sa perpektong pagbigkas. 💪",
      Katamtaman: "Katamtaman — kailangan ng pagsasanay sa pagbigkas at fluency. 🗣️",
      "Kailangan ng Tulong": "Kailangan ng tulong — pagtuunan ng pansin ang mga tunog at bilis. 📚",
      Mahina: "Mahina ang pagbabasa — kailangan ng masinsinang paggabay at pagsasanay. 🆘",
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

  // ---------- REVISED Microphone handler for MANUAL STOP ----------
  const handleMicrophone = async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Hindi suportado ang speech recognition sa iyong browser.");
      return;
    }

    // If already listening, this click acts as a manual stop.
    if (isListening) {
      manualStopRef.current = true;
      finalizeRecording();
      return;
    }

    try {
      manualStopRef.current = false;
      finalizedRef.current = false;
      transcriptRef.current = "";
      lastConfidenceRef.current = null;
      setMetrics(null);
      setRecognizedText("");
      setFeedback("Nakikinig... 🎧");

      cumulativeSilentMsRef.current = 0;
      speechStartRef.current = performance.now();
      speechEndRef.current = null;
      lastVoiceTimestampRef.current = null;
      silenceStartRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      analyserCleanupRef.current = await startAudioAnalyser(stream);

      const recognition = new SpeechRecognition();
      recognition.lang = "fil-PH"; // Filipino language
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = true; // Continuous listening

      recognition.onstart = () => {
        if (!speechStartRef.current) speechStartRef.current = performance.now();
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const spoken = Array.from(event.results)
          .map((result: any) => result?.[0]?.transcript ?? "")
          .join(" ")
          .trim();

        if (spoken) {
          transcriptRef.current = spoken;
          const latestConf = event.results[event.results.length - 1]?.[0]?.confidence;
          if (typeof latestConf === "number") lastConfidenceRef.current = latestConf;
          setRecognizedText(spoken);
        }
      };

      recognition.onerror = () => {
        finalizeRecording("Error sa speech recognition. Pakisubukan muli.");
      };

      recognition.onend = () => {
        if (manualStopRef.current) {
          finalizeRecording();
          return;
        }
        if (finalizedRef.current) return;

        // Auto-restart if not manually stopped (for continuous listening)
        restartTimeoutRef.current = window.setTimeout(() => {
          try {
            recognition.start();
          } catch (err) {
            console.error(err);
            finalizeRecording("Namatay ang mikropono nang hindi inaasahan. Pakisimula muli.");
          }
        }, 250);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      finalizeRecording("Error sa mikropono o hindi ibinigay ang permiso.");
    }
  };

  const selectionRows = filteredStudents.map((student, index) => ({
    ...student,
    no: index + 1,
    lastPhonemic: student.lastPerformance ? `${Math.round(student.lastPerformance.phonemeAccuracy)}%` : "—",
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
          { key: "lastPhonemic", title: "Phonemic" },
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
      ? `Nai-save na ang pinakahuling performance ni ${lastSavedStudent.name}.`
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
            label: isListening ? "Stop Recording" : "Pronunciation Check",
            activeLabel: "Listening...",
            icon: <MicIcon />,
            onClick: handleMicrophone,
            isActive: isListening,
          },
        ],
        insights: {
          heading: "Real-time Insights",
          highlightLabel: "Transcription",
          highlightText: recognizedText || "Hintayin ang pag-record mula sa mikropono.",
          metrics: insightMetrics,
          footerLabel: "Remarks",
          footerText: feedback || "Pindutin ang 'Pronunciation Check' upang magsimula.",
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
      subjectLabel="Filipino"
      headline="Remedial Flashcards"
      cardLabel="Card"
      onBack={() => router.push("/Teacher/remedial/filipino")}
      selection={selectionProps}
      session={sessionProps}
    />
  );
}
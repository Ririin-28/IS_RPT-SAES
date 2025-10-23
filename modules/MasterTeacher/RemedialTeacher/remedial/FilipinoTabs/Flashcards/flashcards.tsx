"use client";
import { useState, useRef, useEffect, type CSSProperties } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useSearchParams, useRouter } from "next/navigation";

/* ---------- Icons (unchanged) ---------- */
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

/* ---------- Helpers ---------- */

// highlight function with Filipino character support
function highlightSentence(sentence: string, highlights: string[]) {
  const words = sentence.split(/(\s+)/);
  const lowered = highlights.map(h => h.toLowerCase());
  return words.map((word, idx) => {
    const clean = word.replace(/[^a-zA-ZáéíóúñÑäëïöüÁÉÍÓÚÑ]/g, "").toLowerCase();
    const isHighlight = lowered.includes(clean);
    return (
      <span
        key={idx}
        className={isHighlight ? "font-semibold text-[#0d1b16]" : undefined}
      >
        {word}
      </span>
    );
  });
}

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

  const [current, setCurrent] = useState(startIndex);
  const { sentence, highlights } = flashcardsData[current];

  // recognition + metrics state
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false); // NEW STATE FOR SPEAKER
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

  const handlePrev = () => setCurrent(prev => Math.max(prev - 1, 0));
  const handleNext = () => setCurrent(prev => Math.min(prev + 1, flashcardsData.length - 1));
  const handleStopSession = () => router.back();

  const handleSpeak = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utter = new window.SpeechSynthesisUtterance(sentence);
      utter.rate = 0.9;
      utter.pitch = 1.1;
      utter.lang = "fil-PH"; // Filipino language
      
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

  const stopAudioAnalyser = () => {
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
  };

  useEffect(() => {
    return () => stopAudioAnalyser();
  }, []);

  useEffect(() => {
    setRecognizedText("");
    setFeedback("");
    setMetrics(null);
    cumulativeSilentMsRef.current = 0;
    speechStartRef.current = null;
    speechEndRef.current = null;
    stopAudioAnalyser();
    setIsListening(false);
    setIsPlaying(false); // Reset playing state when changing cards
  }, [current]);

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
    const totalSpeechMs = (speechEndRef.current && speechStartRef.current) ? Math.max(1, (speechEndRef.current - speechStartRef.current)) : 1;
    const totalSilenceMs = cumulativeSilentMsRef.current;
    const pauseRatio = Math.min(1, totalSilenceMs / totalSpeechMs);
    const fluencyScore = Math.round((1 - pauseRatio) * 100);

    // Reading rate: words per minute
    const wpm = Math.round((expWords.length / (totalSpeechMs / 1000)) * 60);

    // Combine scores
    const conf = resultConfidence ?? 0.8;
    const pronScore = Math.round((0.5 * wordAccuracy) + (0.35 * phonemeAccuracy) + (0.15 * conf * 100));

    // Filipino remarks
    let remarks = "";
    if (pronScore > 85 && fluencyScore > 80) remarks = "Magaling! Napakagaling ng iyong pagbigkas at fluency! 🌟";
    else if (pronScore > 70) remarks = "Magaling — kaunting pagsasanay pa sa pagbigkas at fluency. 💪";
    else if (pronScore > 50) remarks = "Katamtaman — kailangan ng pagsasanay sa mga tunog at bawasan ang paghinto. 🗣️";
    else remarks = "Kailangan ng mas maraming pagsasanay — pagbutihin ang kalinasan at bilis. 📚";

    return {
      expWords, spkWords, perWordDetails,
      wordAccuracy: Math.round(wordAccuracy * 100) / 100,
      phonemeAccuracy: Math.round(phonemeAccuracy * 100) / 100,
      fluencyScore,
      wpm,
      pronScore,
      remarks
    };
  }

  // ---------- Microphone handler ----------
  const handleMicrophone = async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Hindi suportado ang speech recognition sa iyong browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      await startAudioAnalyser(stream);

      const recognition = new SpeechRecognition();
      recognition.lang = "fil-PH"; // Filipino language
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      cumulativeSilentMsRef.current = 0;
      speechStartRef.current = null;
      speechEndRef.current = null;
      lastVoiceTimestampRef.current = null;
      silenceStartRef.current = null;

      setIsListening(true);
      setRecognizedText("");
      setFeedback("Nakikinig... 🎧");

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
        setFeedback("May error sa pagkilala ng pagsasalita. Pakisubukan muli.");
        stopAudioAnalyser();
        setIsListening(false);
      };

      recognition.onend = () => {
        if (!speechEndRef.current) speechEndRef.current = performance.now();
        if (!recognizedText) {
          setFeedback("Walang narinig na pagsasalita. Pakisubukan muli.");
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
      setFeedback("Error sa mikropono o hindi naibigay ang permiso.");
      setIsListening(false);
      stopAudioAnalyser();
    }
  };

  const progressPercent = ((current + 1) / flashcardsData.length) * 100;
  const progressCircleStyle: CSSProperties = {
    background: `conic-gradient(#013300 ${progressPercent * 3.6}deg, #e6f4ef ${progressPercent * 3.6}deg)`
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f2f8f4] via-white to-[#e6f2ec] py-10">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur px-6 py-8 sm:py-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between shadow-md shadow-gray-200">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Filipino</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0d1b16]">Non-Reader Level</h1>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative grid place-items-center">
              <div className="w-20 h-20 rounded-full ring-8 ring-emerald-50 shadow-inner" style={progressCircleStyle} />
              <div className="absolute inset-3 rounded-full bg-white" />
              <span className="absolute text-lg font-semibold text-[#013300]">{Math.round(progressPercent)}%</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Card</p>
              <p className="text-xl font-semibold text-[#013300]">
                {current + 1} <span className="text-base font-normal text-slate-400">/ {flashcardsData.length}</span>
              </p>
            </div>
          </div>
        </header>

        <div className="mt-10 grid gap-8 xl:grid-cols-12">
          <section className="xl:col-span-8">
            <div className="h-full rounded-3xl border border-gray-300 bg-white shadow-md shadow-gray-200 overflow-hidden flex flex-col">
              <div className="flex-1 px-8 lg:px-12 py-12 via-white flex items-center justify-center text-center">
                <p className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#013300] leading-tight">
                  {highlightSentence(sentence, highlights)}
                </p>
              </div>
              <div className="px-6 sm:px-8 py-6 border-t border-gray-300 flex flex-wrap items-center justify-between gap-4">
                <button
                  onClick={handleSpeak}
                  className={`group flex items-center gap-3 rounded-full px-6 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 active:scale-95 ${
                    isPlaying
                      ? "bg-[#013300] text-white shadow-md shadow-gray-200"
                      : "border border-[#013300] bg-white text-[#013300] hover:border-[#013300] hover:bg-[#013300] hover:text-white"
                  }`}
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
                  }`}
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
                  {isListening ? "Listening.." : "Pronunciation Check"}
                </button>
              </div>
            </div>
          </section>

          <aside className="xl:col-span-4 flex flex-col gap-6">
            <div className="rounded-3xl border border-gray-300 bg-white/80 backdrop-blur px-6 py-7 shadow-md shadow-gray-200">
              <h2 className="text-lg font-semibold text-[#013300]">Real-time insights</h2>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-gray-300 bg-emerald-50/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-800">Transcription:</p>
                  <p className="mt-1 text-sm font-medium text-[#013300]">
                    {recognizedText || "Waiting for microphone recording."}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Pronunciation</dt>
                    <dd className="text-lg font-semibold text-[#013300]">{metrics ? `${metrics.pronScore}%` : "—"}</dd>
                  </div>
                  <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Fluency</dt>
                    <dd className="text-lg font-semibold text-[#013300]">{metrics ? `${metrics.fluencyScore}%` : "—"}</dd>
                  </div>
                  <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Sound Accuracy</dt>
                    <dd className="text-lg font-semibold text-[#013300]">{metrics ? `${metrics.phonemeAccuracy.toFixed(0)}%` : "—"}</dd>
                  </div>
                  <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Reading Speed</dt>
                    <dd className="text-lg font-semibold text-[#013300]">{metrics ? `${metrics.wpm} WPM` : "—"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePrev}
              disabled={current === 0}
              className="inline-flex items-center gap-2 rounded-full border border-[#013300] px-6 py-3 text-sm font-medium text-[#013300] transition hover:border-[#013300] hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <FiArrowLeft /> Previous
            </button>
            <button
              onClick={handleStopSession}
              className="inline-flex items-center gap-2 rounded-full bg-[#013300] px-7 py-3 text-sm font-medium text-white shadow-md shadow-gray-200 transition hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 active:scale-95"
            >
              <span className="h-2 w-2 rounded-full bg-white/70" /> End Session
            </button>
            <button
              onClick={handleNext}
              disabled={current === flashcardsData.length - 1}
              className="inline-flex items-center gap-2 rounded-full border border-[#013300] px-6 py-3 text-sm font-medium text-[#013300] transition hover:border-[#013300] hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Next <FiArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";
import { useState, useRef, useEffect, useMemo, useCallback, type CSSProperties } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useSearchParams, useRouter } from "next/navigation";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";

const PAGE_SIZE = 8;

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
const FLASHCARD_CONTENT_KEY = "MASTER_TEACHER_MATH_FLASHCARDS";

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
  score: number;
  responseTime: number;
  cardIndex: number;
  question: string;
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
  const startParam = searchParams?.get("start");

  const [flashcardsData, setFlashcardsData] = useState<MathFlashcard[]>(INITIAL_FLASHCARDS);
  const startIndex = useMemo(() => {
    if (!startParam) return 0;
    const parsed = Number.parseInt(startParam, 10);
    if (Number.isNaN(parsed)) return 0;
    const maxIndex = Math.max(flashcardsData.length - 1, 0);
    return Math.min(Math.max(parsed, 0), maxIndex);
  }, [flashcardsData.length, startParam]);

  const [view, setView] = useState<"select" | "session">(forceSessionOnly ? "session" : (initialView ?? "select"));
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId ?? null);
  const [studentSearch, setStudentSearch] = useState("");
  const [lastSavedStudentId, setLastSavedStudentId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

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
      const stored = window.localStorage.getItem(FLASHCARD_CONTENT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isValidMathFlashcardContent(parsed)) {
          setFlashcardsData(parsed);
          return;
        }
      }

      window.localStorage.setItem(FLASHCARD_CONTENT_KEY, JSON.stringify(INITIAL_FLASHCARDS));
      setFlashcardsData(INITIAL_FLASHCARDS);
    } catch (error) {
      console.warn("Failed to load math flashcard content", error);
      setFlashcardsData(INITIAL_FLASHCARDS);
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
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);

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

  const handlePrev = () => {
    setCurrent((prev) => Math.max(prev - 1, 0));
    resetFields();
  };

  const handleNext = () => {
    setCurrent((prev) => Math.min(prev + 1, flashcardsData.length - 1));
    resetFields();
  };

  const handleStartSession = (studentId: string) => {
    setSelectedStudentId(studentId);
    setCurrent(startIndex);
    resetFields();
    setView("session");
  };

  const handleStopSession = () => {
    const activeQuestion = flashcardsData[current]?.question ?? "";
    if (selectedStudentId !== null && score !== null && rate !== null) {
      onSavePerformance({
        id: `perf-${Date.now()}`,
        studentId: selectedStudentId,
        timestamp: new Date().toISOString(),
        score,
        responseTime: rate,
        cardIndex: current,
        question: activeQuestion,
      });
      setLastSavedStudentId(selectedStudentId);
    }

    resetFields();
    setCurrent(startIndex);
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
    router.push('/MasterTeacher/Coordinator/remedial');
  };

  useEffect(() => {
    setStartTime(Date.now());
  }, [current]);

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
  };

  const selectionRows = paginatedStudents.map((student, index) => ({
    ...student,
    no: (currentPage - 1) * PAGE_SIZE + index + 1,
    lastAccuracy: student.lastPerformance ? `${student.lastPerformance.score}%` : "—",
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
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Mathematics</p>
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
                actions={(row: any) => (
                  <UtilityButton small onClick={() => handleStartSession(row.id)}>
                    Start
                  </UtilityButton>
                )}
                pageSize={PAGE_SIZE}
              />
            </div>

            {paginationControls}
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

  // --- Get previewHeaderLabel from student name for main title, and subtitle from student name or a new prop ---
  // If the student name contains 'Preview', extract the subject and level for the subtitle
  let subtitle = "";
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
                  <div className="rounded-2xl border border-gray-300 bg-emerald-50/60 px-4 py-3 flex flex-col h-full">
                    <p className="text-xs uppercase tracking-wide text-emerald-800">Remarks</p>
                    <p className="mt-1 text-sm font-medium text-[#013300]">
                      {feedback || "Submit an answer to see how you did."}
                    </p>
                  </div>
                  <dl className="grid flex-1 grid-cols-1 gap-3 text-sm sm:grid-cols-2 auto-rows-fr">
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Accuracy</dt>
                      <dd className="text-lg font-semibold text-[#013300]">{score !== null ? `${score}%` : "—"}</dd>
                    </div>
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Response time</dt>
                      <dd className="text-lg font-semibold text-[#013300]">{rate !== null ? `${rate.toFixed(2)}s` : "—"}</dd>
                    </div>
                    <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 h-full flex flex-col">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Your input</dt>
                      <dd className="text-lg font-semibold text-[#013300]">{userAnswer || "—"}</dd>
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

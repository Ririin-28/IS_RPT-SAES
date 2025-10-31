"use client";
import { useState, useEffect, useMemo, useCallback, type CSSProperties } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useSearchParams, useRouter } from "next/navigation";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";

const flashcardsData = [
  { question: "5 + 3", correctAnswer: "8" },
  { question: "9 - 4", correctAnswer: "5" },
  { question: "6 × 7", correctAnswer: "42" },
  { question: "20 ÷ 4", correctAnswer: "5" },
  { question: "12 + 15", correctAnswer: "27" },
];

const STUDENT_ROSTER_KEY = "MASTER_TEACHER_MATH_STUDENTS";
const PERFORMANCE_HISTORY_KEY = "MASTER_TEACHER_MATH_PERFORMANCE";

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

const DEFAULT_MATH_STUDENTS: StudentRecord[] = [
  { id: "math-001", studentId: "MATH-2025-001", name: "Ethan Cruz", grade: "4", section: "A" },
  { id: "math-002", studentId: "MATH-2025-002", name: "Harper Dizon", grade: "4", section: "B" },
  { id: "math-003", studentId: "MATH-2025-003", name: "Gabriel Ramos", grade: "5", section: "A" },
  { id: "math-004", studentId: "MATH-2025-004", name: "Chloe Diaz", grade: "5", section: "C" },
  { id: "math-005", studentId: "MATH-2025-005", name: "Isabella Flores", grade: "6", section: "B" },
];

export default function MasterTeacherMathFlashcards() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const startParam = searchParams?.get("start");
  const startIndex = startParam
    ? Math.min(Math.max(parseInt(startParam), 0), flashcardsData.length - 1)
    : 0;

  const [view, setView] = useState<"select" | "session">("select");
  const [students, setStudents] = useState<StudentRecord[]>(DEFAULT_MATH_STUDENTS);
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
        window.localStorage.setItem(STUDENT_ROSTER_KEY, JSON.stringify(DEFAULT_MATH_STUDENTS));
      }
    } catch (error) {
      console.warn("Failed to load math remedial roster", error);
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
      console.warn("Failed to load math remedial performance history", error);
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
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null); // seconds
  const [score, setScore] = useState<number | null>(null);

  const { question, correctAnswer } = flashcardsData[current];

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
    const currentScore = score;
    const currentRate = rate;

    if (selectedStudentId !== null && currentScore !== null && currentRate !== null) {
      addPerformanceEntry({
        id: `perf-${Date.now()}`,
        studentId: selectedStudentId,
        timestamp: new Date().toISOString(),
        score: currentScore,
        responseTime: currentRate,
        cardIndex: current,
        question: activeQuestion,
      });
      setLastSavedStudentId(selectedStudentId);
    }

    resetFields();
    setCurrent(startIndex);
    setSelectedStudentId(null);
    setView("select");
  };

  const handleBackToDashboard = () => {
    router.back();
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
  };

  const selectionRows = filteredStudents.map((student, index) => ({
    ...student,
    no: index + 1,
    lastAccuracy: student.lastPerformance ? `${student.lastPerformance.score}%` : "—",
  }));

  if (view === "select") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f2f8f4] via-white to-[#e6f2ec] py-10">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur px-6 py-8 sm:py-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between shadow-md shadow-gray-200">
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
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm shadow-emerald-100">
              Latest accuracy for <span className="font-semibold">{lastSavedStudent.name}</span> has been saved.
            </div>
          )}

          <div className="mt-8 rounded-3xl border border-gray-300 bg-white shadow-md shadow-gray-200 p-6 space-y-6">
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

            <TableList
              columns={[
                { key: "no", title: "No#" },
                { key: "studentId", title: "Student ID" },
                { key: "name", title: "Full Name" },
                { key: "grade", title: "Grade" },
                { key: "section", title: "Section" },
                { key: "lastAccuracy", title: "Accuracy" },
              ]}
              data={selectionRows}
              actions={(row: any) => (
                <UtilityButton small onClick={() => handleStartSession(row.id)}>
                  Start Session
                </UtilityButton>
              )}
              pageSize={8}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!selectedStudent) {
    return null;
  }

  const progressPercent = ((current + 1) / flashcardsData.length) * 100;
  const progressCircleStyle: CSSProperties = {
    background: `conic-gradient(#013300 ${progressPercent * 3.6}deg, #e6f4ef ${progressPercent * 3.6}deg)`,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f2f8f4] via-white to-[#e6f2ec] py-10">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur px-6 py-8 sm:py-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between shadow-md shadow-gray-200">
          <div className="space-y-2 text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Mathematics</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0d1b16]">Non-Proficient Level</h1>
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

        <div className="mt-10 grid gap-8 xl:grid-cols-12">
<section className="xl:col-span-8">
  <div className="h-full rounded-3xl border border-gray-300 bg-white shadow-md shadow-gray-200 overflow-hidden flex flex-col">
    <div className="flex-1 px-6 sm:px-8 lg:px-12 py-12 flex items-center justify-center text-center bg-gradient-to-b from-white via-white to-[#f3f7f4]">
      <p className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-[#013300] tracking-tight">
        {question}
      </p>
    </div>
    <div className="px-6 sm:px-8 py-6 border-t border-gray-300 flex flex-col gap-4 md:flex-row md:items-stretch md:justify-between bg-white/90">
      <label className="w-full sm:flex-1 flex flex-col gap-2 text-sm font-medium text-slate-600">
        <span className="uppercase tracking-wide text-xs">Your answer</span>
        <input
          type="text"
          value={userAnswer}
          onChange={e => setUserAnswer(e.target.value)}
          className="w-full rounded-full border border-[#013300] px-5 py-3 text-center text-base font-semibold text-[#013300] focus:outline-none focus-visible:ring-2"
          placeholder="Type here"
        />
      </label>
      <div className="flex flex-col gap-2 w-full md:w-auto">
        <span className="uppercase tracking-wide text-xs text-slate-600 opacity-0">Action</span>
        <button
          onClick={handleSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#013300] px-7 py-3 text-base font-semibold text-white shadow-md shadow-gray-200 transition hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 active:scale-95 h-full w-full"
        >
          Check Answer
        </button>
      </div>
    </div>
  </div>
</section>

          <aside className="xl:col-span-4 flex flex-col gap-6">
            <div className="rounded-3xl border border-gray-300 bg-white/80 backdrop-blur px-6 py-7 shadow-md shadow-gray-200">
              <h2 className="text-lg font-semibold text-[#013300]">Live mastery insights</h2>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-gray-300 bg-emerald-50/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-800">Latest feedback</p>
                  <p className="mt-1 text-sm font-medium text-[#013300]">
                    {feedback || "Submit an answer to see how you did."}
                  </p>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Accuracy</dt>
                    <dd className="text-lg font-semibold text-[#013300]">{score !== null ? `${score}%` : "—"}</dd>
                  </div>
                  <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Response time</dt>
                    <dd className="text-lg font-semibold text-[#013300]">{rate !== null ? `${rate.toFixed(2)}s` : "—"}</dd>
                  </div>
                  <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Your input</dt>
                    <dd className="text-sm font-medium text-[#013300]">{userAnswer || "—"}</dd>
                  </div>
                </dl>
                {score === 0 && userAnswer && (
                  <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Correct answer</p>
                    <p className="text-base font-semibold text-[#013300]">{correctAnswer}</p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
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
  );
}

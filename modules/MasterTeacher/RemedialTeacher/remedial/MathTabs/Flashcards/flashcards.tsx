"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";
import FlashcardsTemplate from "@/components/Common/RemedialFlashcards/FlashcardsTemplate";

const PAGE_SIZE = 8;

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
  const [currentPage, setCurrentPage] = useState(1);

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
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  const { question, correctAnswer } = flashcardsData[current];

  // Validation function for input field
  const validateInput = (input: string): boolean => {
    // Regular expression to allow only numbers, hyphen, and dot
    const validPattern = /^[0-9.\-]*$/;
    return validPattern.test(input);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    
    // Only set the value if it passes validation
    if (validateInput(value)) {
      setUserAnswer(value);
    }
    // If the value is empty, still allow it (for backspace/delete)
    else if (value === "") {
      setUserAnswer("");
    }
  };

  const resetFields = useCallback(() => {
    setUserAnswer("");
    setFeedback("");
    setRate(null);
    setScore(null);
    setShowCorrectAnswer(false);
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

  const selectionTable = (
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
      pageSize={PAGE_SIZE}
    />
  );

  if (view === "session" && !selectedStudent) {
    return null;
  }

  const selectionProps = view === "select"
    ? {
        summaryText: selectionSummaryText,
        searchValue: studentSearch,
        onSearchChange: setStudentSearch,
        table: selectionTable,
        lastSavedMessage: lastSavedStudent
          ? `Latest accuracy for ${lastSavedStudent.name} has been saved.`
          : undefined,
        customBanner: paginationControls,
      }
    : undefined;

  const questionCardContent = (
    <div className="flex w-full flex-col gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mt-4 text-4xl font-semibold tracking-tight text-[#013300] sm:text-5xl">{question}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="text-sm font-semibold text-slate-700">Your answer</span>
            <input
              type="text"
              value={userAnswer}
              onChange={handleInputChange}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg font-semibold text-[#013300] transition focus:border-[#013300] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#013300]/30"
              placeholder="Type and submit"
              // Additional attributes for better user experience
              inputMode="decimal" // Shows appropriate keyboard on mobile
              pattern="[0-9.\-]*" // HTML5 pattern validation
              title="Only numbers, decimal point, and minus sign are allowed"
            />
          </label>
          <button
            onClick={handleSubmit}
            className="w-full rounded-xl bg-[#013300] px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-green-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#013300]/60 md:w-auto"
          >
            Check Answer
          </button>
        </div>
      </div>
    </div>
  );

  const sessionInsights = {
    heading: "Real-time Insights",
    highlightLabel: "Remarks",
    highlightText: feedback || "Submit an answer to see how you did.",
    metrics: [
      { label: "Accuracy", value: score !== null ? `${score}%` : "—" },
      { label: "Response time", value: rate !== null ? `${rate.toFixed(2)}s` : "—" },
      { label: "Your input", value: userAnswer || "—" },
      { 
        label: "Correct answer", 
        value: showCorrectAnswer ? correctAnswer : "••••••",
        onClick: () => setShowCorrectAnswer(true),
        clickable: !showCorrectAnswer
      },
    ],
  };

  const sessionProps = view === "session" && selectedStudent
    ? {
        student: {
          studentId: selectedStudent.studentId,
          name: selectedStudent.name,
          grade: selectedStudent.grade,
          section: selectedStudent.section,
        },
        levelLabel: "Non-Proficient Level",
        cardContent: questionCardContent,
        insights: sessionInsights,
        progress: { currentIndex: current, totalCount: flashcardsData.length },
        nav: {
          onPrev: handlePrev,
          onNext: handleNext,
          onStop: handleStopSession,
          disablePrev: current === 0,
          disableNext: current === flashcardsData.length - 1,
        },
      }
    : undefined;

  return (
    <FlashcardsTemplate
      view={view}
      subjectLabel="Mathematics"
      headline="Remedial Flashcards"
      cardLabel="Card"
      selection={selectionProps}
      session={sessionProps}
    />
  );
}
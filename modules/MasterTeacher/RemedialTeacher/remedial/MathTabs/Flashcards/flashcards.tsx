"use client";
import { useState, useEffect, type CSSProperties } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useSearchParams, useRouter } from "next/navigation";

const flashcardsData = [
  { question: "5 + 3", correctAnswer: "8" },
  { question: "9 - 4", correctAnswer: "5" },
  { question: "6 × 7", correctAnswer: "42" },
  { question: "20 ÷ 4", correctAnswer: "5" },
  { question: "12 + 15", correctAnswer: "27" },
];

export default function MasterTeacherMathFlashcards() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const startParam = searchParams?.get("start");
  const startIndex = startParam
    ? Math.min(Math.max(parseInt(startParam), 0), flashcardsData.length - 1)
    : 0;

  const [current, setCurrent] = useState(startIndex);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null); // seconds
  const [score, setScore] = useState<number | null>(null);

  const { question, correctAnswer } = flashcardsData[current];

  const handlePrev = () => {
    setCurrent(prev => Math.max(prev - 1, 0));
    resetFields();
  };

  const handleNext = () => {
    setCurrent(prev => Math.min(prev + 1, flashcardsData.length - 1));
    resetFields();
  };

  const handleStopSession = () => router.back();

  const resetFields = () => {
    setUserAnswer("");
    setFeedback("");
    setRate(null);
    setScore(null);
    setStartTime(Date.now());
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

  const progressPercent = ((current + 1) / flashcardsData.length) * 100;
  const progressCircleStyle: CSSProperties = {
    background: `conic-gradient(#013300 ${progressPercent * 3.6}deg, #e6f4ef ${progressPercent * 3.6}deg)`
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f2f8f4] via-white to-[#e6f2ec] py-10">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-gray-300 bg-white/70 backdrop-blur px-6 py-8 sm:py-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between shadow-md shadow-gray-200">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Mathematics</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0d1b16]">Non-Proficient Level</h1>
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
    <div className="flex-1 px-8 lg:px-12 py-12 flex items-center justify-center text-center bg-gradient-to-b from-white via-white to-[#f3f7f4]">
      <p className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-[#013300] tracking-tight">
        {question}
      </p>
    </div>
    <div className="px-6 sm:px-8 py-6 border-t border-gray-300 flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between bg-white/90">
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
      <div className="flex flex-col gap-2">
        <span className="uppercase tracking-wide text-xs text-slate-600 opacity-0">Action</span>
        <button
          onClick={handleSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#013300] px-7 py-3 text-base font-semibold text-white shadow-md shadow-gray-200 transition hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 active:scale-95 h-full"
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
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Accuracy</dt>
                    <dd className="text-lg font-semibold text-[#013300]">{score !== null ? `${score}%` : "—"}</dd>
                  </div>
                  <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Response time</dt>
                    <dd className="text-lg font-semibold text-[#013300]">{rate !== null ? `${rate.toFixed(2)}s` : "—"}</dd>
                  </div>
                  <div className="rounded-2xl border border-gray-300 bg-white px-4 py-3 col-span-2">
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
              <span className="h-2 w-2 rounded-full bg-white/70" /> Stop Session
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

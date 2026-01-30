"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface Choice {
    id: number;
    text: string;
}

interface Question {
    id: number;
    text: string;
    type: string; // multiple_choice, true_false, short_answer
    points: number;
    choices: Choice[];
}

interface QuizData {
    title: string;
    description: string;
    questions: Question[];
}

interface StudentInfo {
    name: string;
    lrn: string;
}

export default function StudentQuizPage() {
    const params = useParams();
    const quizCode = params?.code as string;
    const router = useRouter();

    // App State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stage, setStage] = useState<"join" | "quiz" | "completed">("join");

    // Data State
    const [lrn, setLrn] = useState("");
    const [attemptId, setAttemptId] = useState<number | null>(null);
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [student, setStudent] = useState<StudentInfo | null>(null);

    // Quiz Execution State
    const [currentIndex, setCurrentIndex] = useState(0);
    const [submittingAnswer, setSubmittingAnswer] = useState(false);
    const [score, setScore] = useState<number | null>(null);

    const currentQuestion = quiz?.questions[currentIndex];
    const isLastQuestion = quiz && currentIndex === quiz.questions.length - 1;
    const progress = quiz ? ((currentIndex + 1) / quiz.questions.length) * 100 : 0;

    useEffect(() => {
        // Check if we have student session (optional: restore session)
        // For now, we rely on them entering LRN again or if the previous page passed it via storage
        const storedLrn = localStorage.getItem("rpt_saes_lrn");
        if (storedLrn) {
            setLrn(storedLrn);
        }
    }, []);

    const handleStartQuiz = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lrn.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/assessments/attempts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quizCode, lrn }),
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || "Failed to join quiz.");
            }

            setAttemptId(data.attemptId);
            setQuiz(data.quiz);
            setStudent(data.student);
            setStage("quiz");
            localStorage.setItem("rpt_saes_lrn", lrn);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = async (choiceId?: number, textAnswer?: string) => {
        if (!attemptId || !currentQuestion || submittingAnswer) return;

        setSubmittingAnswer(true);

        try {
            const payload = {
                questionId: currentQuestion.id,
                selectedChoiceId: choiceId,
                answerText: textAnswer,
            };

            const res = await fetch(`/api/assessments/attempts/${attemptId}/answer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!data.success) {
                // Continue anyway? Or show error?
                console.error("Failed to save answer", data.error);
            }

            // Move to next question
            if (isLastQuestion) {
                finishQuiz();
            } else {
                setCurrentIndex((prev) => prev + 1);
            }
        } catch (err) {
            console.error("Error submitting answer", err);
        } finally {
            setSubmittingAnswer(false);
        }
    };

    const finishQuiz = async () => {
        if (!attemptId) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/assessments/attempts/${attemptId}/submit`, {
                method: "POST",
            });
            const data = await res.json();
            if (data.success) {
                setScore(data.totalScore);
                setStage("completed");
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError("Failed to submit quiz.");
        } finally {
            setLoading(false);
        }
    };

    // --- Render Components ---

    // Shared Background for consistency
    const Background = () => (
        <>
            <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(209,255,222,0.45),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(188,240,214,0.35),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(242,249,245,0.95))]" />
            <div className="pointer-events-none absolute left-[12%] right-[46%] top-40 -z-10 h-56 rounded-3xl bg-gradient-to-br from-green-200/50 via-white/40 to-transparent blur-4xl" />
            <div className="pointer-events-none absolute left-[52%] right-[12%] bottom-16 -z-10 h-56 rounded-[40px] bg-gradient-to-t from-green-200/60 via-white/35 to-transparent blur-4xl" />
        </>
    );

    if (stage === "join") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-[#013300] relative overflow-hidden p-4">
                <Background />

                <div className="flex flex-col items-center mb-8">
                    <img
                        src="/RPT-SAES/RPTLogo.png"
                        alt="RPT-SAES Logo"
                        className="h-20 w-20 object-contain drop-shadow-md mb-4"
                    />
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-green-800 to-[#013300] bg-clip-text text-transparent">RPT-SAES</h1>
                    <p className="text-[#013300]/70 font-medium mt-1">Assessment Portal</p>
                </div>

                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-green-100/60 p-8">
                    <h2 className="text-2xl font-bold text-[#013300] mb-2 text-center">Join Quiz</h2>
                    <p className="text-[#013300]/60 mb-8 text-center text-sm">Enter your credentials to start.</p>

                    {error && (
                        <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleStartQuiz} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-[#013300]/80 mb-2">
                                Quiz Code
                            </label>
                            <div className="bg-green-50/50 p-4 rounded-xl border border-green-200/50 text-center">
                                <span className="font-mono text-2xl font-bold text-[#013300] tracking-[0.2em]">{quizCode}</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-[#013300]/80 mb-2">
                                Learner Reference Number (LRN) *
                            </label>
                            <input
                                type="text"
                                value={lrn}
                                onChange={(e) => setLrn(e.target.value)}
                                required
                                placeholder="Enter your LRN"
                                className="w-full px-4 py-3.5 rounded-xl border-2 border-green-200/50 focus:border-[#013300] focus:ring-0 outline-none transition-all bg-white text-[#013300] placeholder-green-800/20"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-green-600 to-[#133000] text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-green-900/10 transform transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                        >
                            {loading ? "Verifying..." : "Start Quiz"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (stage === "quiz" && quiz && currentQuestion) {
        const isMultipleChoice = currentQuestion.type === "multiple_choice" || currentQuestion.type === "true_false";

        return (
            <div className="min-h-screen flex flex-col bg-[#F2F9F5] text-[#013300]">
                {/* Header Branding */}
                <header className="bg-white/90 backdrop-blur-md shadow-sm border-b border-green-100 sticky top-0 z-10">
                    <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <img
                                src="/RPT-SAES/RPTLogo.png"
                                alt="RPT-SAES Logo"
                                className="h-8 w-8 object-contain"
                            />
                            <span className="font-bold text-[#013300] hidden sm:block tracking-tight">RPT-SAES</span>
                        </div>
                        <div className="text-sm font-semibold text-[#013300]/70 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                            {student?.name}
                        </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-1.5 bg-green-100 w-full">
                        <div
                            className="h-full bg-gradient-to-r from-green-500 to-[#013300] transition-all duration-500 ease-out rounded-r-full"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </header>

                <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 flex flex-col justify-center">
                    <div className="mb-10 text-center">
                        <span className="inline-block px-4 py-1.5 bg-green-100 text-green-800 rounded-full text-xs font-bold tracking-wider uppercase mb-5">
                            Question {currentIndex + 1} of {quiz.questions.length}
                        </span>
                        <h2 className="text-2xl sm:text-4xl font-extrabold text-[#013300] leading-tight">
                            {currentQuestion.text}
                        </h2>
                        {currentQuestion.type === 'short_answer' && (
                            <p className="text-[#013300]/60 mt-3 font-medium">Type your answer below</p>
                        )}
                    </div>

                    <div className="w-full">
                        {isMultipleChoice ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {currentQuestion.choices.map((choice, idx) => {
                                    const colors = [
                                        "bg-red-500 hover:bg-red-600 border-b-4 border-red-700 active:border-b-0 active:translate-y-1",
                                        "bg-blue-500 hover:bg-blue-600 border-b-4 border-blue-700 active:border-b-0 active:translate-y-1",
                                        "bg-yellow-500 hover:bg-yellow-600 border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1",
                                        "bg-green-500 hover:bg-green-600 border-b-4 border-green-700 active:border-b-0 active:translate-y-1",
                                    ];
                                    const colorClass = colors[idx % 4];

                                    return (
                                        <button
                                            key={choice.id}
                                            onClick={() => handleAnswer(choice.id)}
                                            disabled={submittingAnswer}
                                            className={`${colorClass} text-white p-6 sm:p-8 rounded-2xl text-lg sm:text-xl font-bold shadow-xl transition-all disabled:opacity-50 flex items-center justify-center min-h-[120px] h-auto break-words leading-snug`}
                                        >
                                            {choice.text}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            // Short Answer Input
                            <div className="max-w-xl mx-auto">
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    const form = e.target as HTMLFormElement;
                                    const input = form.elements.namedItem('answer') as HTMLInputElement;
                                    handleAnswer(undefined, input.value);
                                }}>
                                    <input
                                        name="answer"
                                        type="text"
                                        autoFocus
                                        className="w-full p-5 text-xl border-2 border-green-200 rounded-2xl focus:border-[#013300] focus:ring-4 focus:ring-green-100 outline-none transition-all mb-6 text-center font-medium bg-white shadow-sm placeholder-gray-400 text-[#013300]"
                                        placeholder="Type your answer here..."
                                    />
                                    <button
                                        type="submit"
                                        disabled={submittingAnswer}
                                        className="w-full bg-gradient-to-r from-green-600 to-[#133000] hover:opacity-90 text-white font-bold py-4 rounded-xl shadow-lg transform transition active:scale-95"
                                    >
                                        Submit Answer
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    if (stage === "completed") {
        return (
            <div className="min-h-screen flex items-center justify-center text-[#013300] relative overflow-hidden p-4">
                <Background />
                <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-10 max-w-lg w-full text-center border border-green-100">
                    <div className="w-24 h-24 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>

                    <h1 className="text-3xl font-extrabold text-[#013300] mb-3">Quiz Completed!</h1>
                    <p className="text-[#013300]/70 mb-8 text-lg">
                        Thank you, {student?.name?.split(' ')[0]}.<br />Your answers have been recorded.
                    </p>

                    {score !== null && (
                        <div className="bg-green-50 rounded-2xl p-8 border border-green-100 shadow-sm">
                            <p className="text-green-800 font-bold uppercase text-xs tracking-widest mb-2">Your Score</p>
                            <p className="text-6xl font-black text-[#013300]">{score}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F2F9F5]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#013300]"></div>
        </div>
    );
}

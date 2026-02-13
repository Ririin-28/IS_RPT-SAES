"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";

type AssessmentChoice = {
  id: number;
  text: string;
};

type AssessmentQuestion = {
  id: number;
  questionText: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  points: number;
  choices?: AssessmentChoice[];
};

type Assessment = {
  id: number;
  title: string;
  description?: string;
  questions: AssessmentQuestion[];
};

interface RemedialAssessmentProps {
  assessment: Assessment;
  attemptId: number;
  onComplete: (summary: { score: number; correct: number; incorrect: number; total: number }) => void;
}

export default function RemedialAssessment({ assessment, attemptId, onComplete }: RemedialAssessmentProps) {
  const [current, setCurrent] = useState(0);
  const [shortAnswer, setShortAnswer] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [points, setPoints] = useState(0);
  const [feedback, setFeedback] = useState<{ type: "correct" | "incorrect" | "streak_milestone" | "streak_loss"; text: string; subtext?: string } | null>(null);
  const questions = useMemo(() => assessment.questions ?? [], [assessment.questions]);

  const item = questions[current];
  const isLast = current === questions.length - 1;
  const progress = questions.length > 0 ? ((current + 1) / questions.length) * 100 : 0;
  const optionLabels = ["A", "B", "C", "D", "E", "F"];
  const optionColors = [
    "bg-[#eb103b]", // Red
    "bg-[#1176d3]", // Blue
    "bg-[#ffa401]", // Orange
    "bg-[#46a301]", // Green
    "bg-[#9d27b0]", // Purple
    "bg-[#00bcd4]", // Cyan
  ];

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const saveAnswer = async (payload: { questionId: number; selectedChoiceId?: number; answerText?: string }) => {
    const response = await fetch(`/api/assessments/attempts/${attemptId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      throw new Error(data?.error ?? "Unable to save answer.");
    }
    return {
      isCorrect: Boolean(data?.isCorrect),
      score: Number(data?.score ?? 0),
    };
  };

  const handleChoiceSelect = async (choiceId: number) => {
    if (!item || isSaving) return;
    setIsSaving(true);
    setSelectedChoiceId(choiceId);
    try {
      const result = await saveAnswer({ questionId: item.id, selectedChoiceId: choiceId });
      
      let nextStreak = 0;
      setStreak((prev) => {
        nextStreak = result.isCorrect ? prev + 1 : 0;
        setBestStreak((best) => Math.max(best, nextStreak));
        return nextStreak;
      });

      if (result.isCorrect) {
        setPoints((prev) => prev + 100 + (streak * 10)); // Bonus for streaks
        
        // Streak milestones
        if (nextStreak === 3) {
          setFeedback({ type: "streak_milestone", text: "Triple Threat! 🔥", subtext: "3 in a row! You're on fire!" });
        } else if (nextStreak === 5) {
          setFeedback({ type: "streak_milestone", text: "Unstoppable! ⚡", subtext: "5 correct answers! Incredible!" });
        } else if (nextStreak >= 10 && nextStreak % 5 === 0) {
          setFeedback({ type: "streak_milestone", text: "Legendary! 👑", subtext: `${nextStreak} streak! You're a master!` });
        } else {
          setFeedback({ type: "correct", text: "Awesome! Keep it up! 🌟" });
        }
      } else {
        if (streak >= 3) {
          setFeedback({ type: "streak_loss", text: "Streak Ended! ❄️", subtext: `You had a ${streak} streak. Let's start a new one!` });
        } else {
          setFeedback({ type: "incorrect", text: "Nice try! You'll get it next time! 💪" });
        }
      }

      // Clear feedback after 1.5 seconds and move to next question
      setTimeout(async () => {
        setFeedback(null);
        if (isLast) {
          await handleSubmit();
        } else {
          setSelectedChoiceId(null);
          setCurrent((prev) => Math.min(prev + 1, questions.length - 1));
        }
      }, 1500);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShortAnswerNext = async () => {
    if (!item || isSaving) return;
    setIsSaving(true);
    try {
      const result = await saveAnswer({ questionId: item.id, answerText: shortAnswer });
      
      let nextStreak = 0;
      setStreak((prev) => {
        nextStreak = result.isCorrect ? prev + 1 : 0;
        setBestStreak((best) => Math.max(best, nextStreak));
        return nextStreak;
      });

      if (result.isCorrect) {
        setPoints((prev) => prev + 100 + (streak * 10)); // Bonus for streaks
        
        // Streak milestones
        if (nextStreak === 3) {
          setFeedback({ type: "streak_milestone", text: "Triple Threat! 🔥", subtext: "3 in a row! You're on fire!" });
        } else if (nextStreak === 5) {
          setFeedback({ type: "streak_milestone", text: "Unstoppable! ⚡", subtext: "5 correct answers! Incredible!" });
        } else if (nextStreak >= 10 && nextStreak % 5 === 0) {
          setFeedback({ type: "streak_milestone", text: "Legendary! 👑", subtext: `${nextStreak} streak! You're a master!` });
        } else {
          setFeedback({ type: "correct", text: "Great job! You're a star! ⭐" });
        }
      } else {
        if (streak >= 3) {
          setFeedback({ type: "streak_loss", text: "Streak Ended! ❄️", subtext: `You had a ${streak} streak. Let's start a new one!` });
        } else {
          setFeedback({ type: "incorrect", text: "Don't give up! Try another one! 🚀" });
        }
      }
      setShortAnswer("");

      // Clear feedback after 1.5 seconds and move to next question
      setTimeout(async () => {
        setFeedback(null);
        if (isLast) {
          await handleSubmit();
        } else {
          setCurrent((prev) => Math.min(prev + 1, questions.length - 1));
        }
      }, 1500);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/assessments/attempts/${attemptId}/submit`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? "Unable to submit quiz.");
      }
      onComplete({
        score: Number(data.totalScore ?? 0),
        correct: Number(data.correctCount ?? 0),
        incorrect: Number(data.incorrectCount ?? 0),
        total: Number(data.totalQuestions ?? questions.length),
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!item) {
    return (
      <div className="min-h-screen w-full bg-linear-to-b from-white to-green-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-green-100 bg-white p-6 text-center shadow-lg">
          <h2 className="text-xl font-bold text-[#013300]">{assessment.title}</h2>
          <p className="mt-3 text-sm text-[#013300]/70">No questions available for this assessment yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-linear-to-b from-white to-green-50 flex flex-col items-center p-0 sm:p-4">
      <div className="w-full max-w-md flex flex-col h-full min-h-screen sm:min-h-0">
        {/* Quizizz-style Header */}
        <div className="w-full p-4 flex items-center justify-between text-[#013300]">
          <div className="flex items-center gap-2">
            <div className="bg-green-100 rounded-full px-3 py-1 text-sm font-bold border border-green-200">
              {current + 1} / {questions.length}
            </div>
          </div>
          <div className="bg-green-100 rounded-full px-6 py-1 text-sm font-bold border border-green-200">
            {points} pts
          </div>
          <div className="flex items-center gap-1.5 bg-orange-100 rounded-full px-3 py-1 border border-orange-200">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-700">{streak} Streak</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full px-4 mb-4">
          <div className="h-2 w-full bg-green-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-[#46a301] transition-all duration-500"
            />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex flex-col p-4"
        >
          <div className="rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="p-6 sm:p-8 space-y-6 flex-1 flex flex-col overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6 flex-1 flex flex-col"
                >
                  {/* Question Section with Speaker */}
                  <div className="text-center relative py-4">
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <h2 className="text-2xl font-black text-[#222] tracking-tight">
                        {item.questionText}
                      </h2>
                      <button 
                        onClick={() => speak(item.questionText)}
                        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors shadow-sm"
                        title="Read question aloud"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Streak Badge */}
                    {streak > 1 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="inline-flex items-center gap-1 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md mt-2"
                      >
                        <span className="text-sm">🔥</span> {streak} STREAK!
                      </motion.div>
                    )}
                  </div>

                  <div className="w-full border-t border-dashed border-gray-200 my-2" />

                  {item.type !== "short_answer" && (
                    <div className="grid grid-cols-1 gap-4 flex-1 content-center">
                      {(item.choices ?? []).map((choice, index) => (
                        <button
                          key={choice.id}
                          onClick={() => handleChoiceSelect(choice.id)}
                          disabled={isSaving || isSubmitting}
                          className={`w-full py-6 rounded-2xl text-xl font-black text-white shadow-[0_6px_0_0_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-1 transition-all duration-100 ${
                            optionColors[index % optionColors.length]
                          } ${isSaving || isSubmitting ? 'opacity-50 grayscale' : 'hover:brightness-110'}`}
                        >
                          {choice.text?.trim() || `Option ${index + 1}`}
                        </button>
                      ))}
                    </div>
                  )}

                  {item.type === "short_answer" && (
                    <div className="space-y-4 flex-1 flex flex-col justify-center">
                      <div className="relative group">
                        <textarea
                          value={shortAnswer}
                          onChange={(event) => setShortAnswer(event.target.value)}
                          rows={4}
                          placeholder="Type your answer here..."
                          className="w-full rounded-2xl border-4 border-gray-100 bg-gray-50 p-6 text-lg font-bold text-[#222] focus:border-[#461a92] focus:bg-white outline-none transition-all resize-none"
                        />
                      </div>
                      <button
                        onClick={handleShortAnswerNext}
                        disabled={isSaving || isSubmitting || shortAnswer.trim().length === 0}
                        className="w-full py-5 rounded-2xl text-xl font-black text-white bg-[#46a301] shadow-[0_6px_0_0_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-1 transition-all"
                      >
                        {isLast ? "Submit Answer" : "Next Question"}
                      </button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Feedback Overlay */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
              className={`fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none`}
            >
              <div className={`rounded-3xl p-8 shadow-2xl text-center transform -rotate-2 ${
                feedback.type === "streak_milestone" ? "bg-orange-500 text-white" :
                feedback.type === "streak_loss" ? "bg-blue-600 text-white" :
                feedback.type === "correct" ? "bg-[#46a301] text-white" : "bg-[#eb103b] text-white"
              }`}>
                <h3 className="text-4xl font-black mb-2 tracking-tighter uppercase">
                  {feedback.text}
                </h3>
                {feedback.subtext && (
                  <p className="text-xl font-bold opacity-90">{feedback.subtext}</p>
                )}
                {!feedback.subtext && (
                  <p className="text-xl font-bold opacity-90">
                    {feedback.type === "correct" ? "Great job!" : "Try again!"}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info */}
        <div className="p-4 flex items-center justify-center gap-4 text-[#011330] text-xs font-bold uppercase tracking-widest">
          <span>{assessment.title}</span>
          <span>•</span>
          <span>Best Streak: {bestStreak}</span>
        </div>
      </div>
    </div>
  );
}

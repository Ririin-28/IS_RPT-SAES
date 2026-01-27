"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
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
  onComplete: (score: number) => void;
}

export default function RemedialAssessment({ assessment, attemptId, onComplete }: RemedialAssessmentProps) {
  const [current, setCurrent] = useState(0);
  const [shortAnswer, setShortAnswer] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const questions = useMemo(() => assessment.questions ?? [], [assessment.questions]);

  const item = questions[current];
  const isLast = current === questions.length - 1;

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
  };

  const handleChoiceSelect = async (choiceId: number) => {
    if (!item || isSaving) return;
    setIsSaving(true);
    try {
      await saveAnswer({ questionId: item.id, selectedChoiceId: choiceId });
      if (isLast) {
        await handleSubmit();
      } else {
        setCurrent((prev) => Math.min(prev + 1, questions.length - 1));
      }
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
      await saveAnswer({ questionId: item.id, answerText: shortAnswer });
      setShortAnswer("");
      if (isLast) {
        await handleSubmit();
      } else {
        setCurrent((prev) => Math.min(prev + 1, questions.length - 1));
      }
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
      onComplete(Number(data.totalScore ?? 0));
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl shadow-lg">
          <div className="p-5 space-y-5">
            <h2 className="text-xl font-bold text-center text-[#1b5e20]">
              Question {current + 1} / {questions.length}
            </h2>

            <p className="text-md font-medium text-gray-700 text-center">
              {item?.questionText}
            </p>

            {item?.type !== "short_answer" && (
              <div className="grid grid-cols-1 gap-3 mt-4">
                {(item?.choices ?? []).map((choice) => (
                  <UtilityButton
                    key={choice.id}
                    onClick={() => handleChoiceSelect(choice.id)}
                    className="w-full py-4 rounded-xl text-base font-semibold"
                    disabled={isSaving || isSubmitting}
                  >
                    {choice.text}
                  </UtilityButton>
                ))}
              </div>
            )}

            {item?.type === "short_answer" && (
              <div className="space-y-3 mt-4">
                <textarea
                  value={shortAnswer}
                  onChange={(event) => setShortAnswer(event.target.value)}
                  rows={3}
                  placeholder="Type your answer"
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm"
                />
                <UtilityButton
                  onClick={handleShortAnswerNext}
                  className="w-full py-3 rounded-xl text-base font-semibold"
                  disabled={isSaving || isSubmitting}
                >
                  {isLast ? "Submit" : "Next"}
                </UtilityButton>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
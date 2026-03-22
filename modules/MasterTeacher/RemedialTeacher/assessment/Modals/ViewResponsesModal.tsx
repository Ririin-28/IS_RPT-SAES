"use client";

import { type CSSProperties, useEffect, useState } from "react";
import BaseModal, { ModalLabel, ModalSection } from "@/components/Common/Modals/BaseModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import type { QuizResponse } from "../types";

interface ResponseQuestion {
  id: string;
  prompt: string;
  sectionTitle?: string;
  type?: string;
  options?: string[];
  correctAnswer?: string | string[];
}

interface ItemAnalysis {
  questionId: string;
  text: string;
  type: string;
  correctCount: number;
  totalAnswers: number;
  difficultyIndex: number;
}

interface ViewResponsesModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizTitle: string;
  responses: QuizResponse[];
  questions: ResponseQuestion[];
  totalStudents?: number;
  quizCode?: string;
  teacherId?: string;
}

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const formatAnswer = (answer: string | string[] | undefined): string => {
  if (!answer) {
    return "No response";
  }

  if (Array.isArray(answer)) {
    return answer.join(", ");
  }

  return answer;
};

const formatMetric = (value: unknown, fallback = "N/A") => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(1) : fallback;
};

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "--";

const getDifficultyTone = (value: number) => {
  if (value >= 80) return "bg-emerald-50 text-emerald-700 border border-emerald-100";
  if (value >= 50) return "bg-amber-50 text-amber-700 border border-amber-100";
  return "bg-rose-50 text-rose-700 border border-rose-100";
};

export default function ViewResponsesModal({
  isOpen,
  onClose,
  quizTitle,
  responses: initialResponses,
  questions,
  totalStudents: initialTotalStudents = 0,
  quizCode,
  teacherId,
}: ViewResponsesModalProps) {
  const [analysisData, setAnalysisData] = useState<{
    summary?: any;
    itemAnalysis?: ItemAnalysis[];
    responses?: any[];
  } | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && quizCode && teacherId) {
      setIsLoading(true);
      setError("");
      fetch(`/api/assessments/analysis?code=${quizCode}&teacherId=${teacherId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setAnalysisData(data);
          } else {
            setError(data.error || "Failed to load analysis data.");
          }
        })
        .catch((err) => {
          console.error("Failed to load analysis", err);
          setError("Could not load analysis data.");
        })
        .finally(() => setIsLoading(false));
    } else {
      setAnalysisData(null);
      setError("");
    }
  }, [isOpen, quizCode, teacherId]);

  const responses = analysisData?.responses
    ? analysisData.responses.map((response: any) => ({
        ...response,
        submittedAt: response.submittedAt,
        answers: initialResponses.find((item) => String(item.id) === String(response.id))?.answers ?? {},
      }))
    : initialResponses;

  const totalStudents = analysisData?.summary?.totalAssigned ?? initialTotalStudents;
  const responseCount = responses.length;
  const totalResponsesLabel = totalStudents > 0 ? `${responseCount}/${totalStudents}` : `${responseCount}`;
  const rawRate = totalStudents > 0 ? Math.round((responseCount / totalStudents) * 100) : responseCount > 0 ? 100 : 0;
  const clampedRate = Math.max(0, Math.min(100, rawRate));

  const completionBarStyle: CSSProperties = {
    width: `${clampedRate}%`,
  };

  const averageScore = formatMetric(analysisData?.summary?.averageScore);

  const footer = (
    <div className="flex w-full justify-end">
      <SecondaryButton type="button" onClick={onClose}>
        Close
      </SecondaryButton>
    </div>
  );

  return (
    <BaseModal
      show={isOpen}
      onClose={onClose}
      title={`Responses - ${quizTitle}`}
      footer={footer}
    >
      <div className="space-y-6">
        {error ? <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div> : null}

        <ModalSection title="Summary">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="p-4 sm:p-5">
                <ModalLabel>Total responses</ModalLabel>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{totalResponsesLabel}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {responseCount === 1 ? "1 submission recorded" : `${responseCount} submissions recorded`}
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <ModalLabel>Response rate</ModalLabel>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{clampedRate}%</p>
                <p className="mt-1 text-sm text-slate-500">
                  {totalStudents > 0 ? `${responseCount} of ${totalStudents} assigned students` : "No assigned students yet"}
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <ModalLabel>Average score</ModalLabel>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{averageScore}</p>
                <p className="mt-1 text-sm text-slate-500">points per submission</p>
              </div>
            </div>
            <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                <span>Completion</span>
                <span>{clampedRate}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[#013300]" style={completionBarStyle} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {totalStudents > 0
                  ? "Tracks how many assigned students have submitted the assessment."
                  : "Assign students to start measuring completion."}
              </p>
            </div>
          </div>
        </ModalSection>

        {analysisData?.itemAnalysis && analysisData.itemAnalysis.length > 0 && (
          <ModalSection title="Item Analysis">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em]">Question</th>
                    <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em]">Type</th>
                    <th scope="col" className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em]">Correct / Total</th>
                    <th scope="col" className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em]">Difficulty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {analysisData.itemAnalysis.map((item) => (
                    <tr key={item.questionId}>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {item.text.length > 50 ? `${item.text.substring(0, 50)}...` : item.text}
                      </td>
                      <td className="px-6 py-4 text-sm capitalize text-slate-500">{item.type.replace("_", " ")}</td>
                      <td className="px-6 py-4 text-center text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">{item.correctCount}</span>
                        <span className="mx-1 text-slate-300">/</span>
                        <span>{item.totalAnswers}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${getDifficultyTone(item.difficultyIndex)}`}>
                          {item.difficultyIndex.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ModalSection>
        )}

        <ModalSection title="Individual responses">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading analysis...</p>
          ) : responses.length === 0 ? (
            <p className="text-sm text-gray-500">No responses have been submitted yet. Share the quiz to start collecting answers.</p>
          ) : (
            <div className="space-y-3">
              {responses.map((response) => (
                <div key={response.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tracking-wide text-slate-600">
                        {getInitials(response.studentName)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{response.studentName}</p>
                        <p className="text-xs text-slate-500">ID: {response.studentId}</p>
                      </div>
                    </div>
                    <div className="text-sm text-slate-500">
                      Submitted {formatDateTime(response.submittedAt)}
                      {typeof response.score === "number" && (
                        <span className="ml-2 inline-flex rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                          Score: {response.score}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {questions.map((question, index) => (
                      <div key={question.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                          Question {index + 1}
                          {question.sectionTitle ? ` - ${question.sectionTitle}` : ""}
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-800">{question.prompt}</p>
                        <p className="mt-2 text-sm text-slate-700">
                          <span className="font-medium text-slate-500">Answer:</span> {formatAnswer(response.answers?.[question.id])}
                        </p>
                        {question.correctAnswer && (
                          <p className="mt-1 text-xs text-slate-500">
                            Correct answer: {formatAnswer(Array.isArray(question.correctAnswer) ? question.correctAnswer : String(question.correctAnswer))}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ModalSection>
      </div>
    </BaseModal>
  );
}

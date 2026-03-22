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

interface ViewResponsesModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizTitle: string;
  responses: QuizResponse[];
  questions: ResponseQuestion[];
  totalStudents?: number;
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
  totalStudents: initialTotalStudents = 0,
  quizCode,
  teacherId,
}: ViewResponsesModalProps & { quizCode?: string; teacherId?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysisData, setAnalysisData] = useState<any>(null);

  const responses = analysisData?.responses ?? initialResponses;
  const totalStudents = analysisData?.summary?.totalAssigned ?? initialTotalStudents;

  useEffect(() => {
    if (isOpen && quizCode && teacherId) {
      setLoading(true);
      setError("");

      fetch(`/api/assessments/analysis?code=${quizCode}&teacherId=${teacherId}`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to fetch analysis");
          const data = await res.json();
          if (data.success) {
            setAnalysisData(data);
          } else {
            setError(data.error || "Failed to load data");
          }
        })
        .catch((err) => {
          console.error(err);
          setError("Could not load analysis data.");
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setAnalysisData(null);
      setLoading(false);
    }
  }, [isOpen, quizCode, teacherId]);

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
        {loading ? (
          <div className="animate-pulse p-8 text-center text-gray-500">Loading analysis...</div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
        ) : (
          <>
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
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em]">Question</th>
                        <th className="w-32 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em]">Correct</th>
                        <th className="w-32 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em]">Difficulty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {analysisData.itemAnalysis.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 text-slate-800">
                            <div className="line-clamp-2" title={item.text}>
                              {item.text}
                            </div>
                            <div className="mt-1 text-xs capitalize text-slate-400">{item.type?.replace("_", " ")}</div>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {item.correctCount}/{item.totalAnswers}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${getDifficultyTone(Number(item.difficultyIndex))}`}>
                              {Number(item.difficultyIndex).toFixed(0)}%
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
              {responses.length === 0 ? (
                <p className="text-sm text-gray-500">No responses have been submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {responses.map((response: any) => (
                    <div key={response.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                          {typeof response.score !== "undefined" && (
                            <span className="ml-2 inline-flex rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                              Score: {response.score}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ModalSection>
          </>
        )}
      </div>
    </BaseModal>
  );
}

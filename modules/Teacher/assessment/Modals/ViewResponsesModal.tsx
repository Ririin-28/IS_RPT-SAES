"use client";
import { type CSSProperties, useState, useEffect } from "react";
import BaseModal, { ModalSection, ModalLabel } from "@/components/Common/Modals/BaseModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const buildSheetsHtml = (
  responses: QuizResponse[],
  questions: ResponseQuestion[],
  quizTitle: string,
  totalStudents: number,
) => {
  const sanitizedTitle = escapeHtml(quizTitle || "Quiz");
  const totalResponses = responses.length;
  const responseLabel = totalStudents > 0
    ? `${totalResponses}/${totalStudents}`
    : `${totalResponses}`;
  const responseRate = totalStudents > 0
    ? ((totalResponses / totalStudents) * 100).toFixed(1)
    : totalResponses > 0
      ? "100.0"
      : "0.0";

  const headers = ["Respondent", "Submitted At", ...questions.map((question) => question.prompt.replace(/\n/g, " "))];
  const answersRows = responses.map((response) => [
    response.studentName,
    formatDateTime(response.submittedAt),
    ...questions.map((question) => formatAnswer(response.answers?.[question.id])),
  ]);

  const tableRows = answersRows.length
    ? answersRows
      .map((row) => `      <tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? ""))}</td>`).join("")}</tr>`)
      .join("\n")
    : `      <tr><td colspan="${headers.length}">No responses recorded yet.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${sanitizedTitle} · Responses</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background-color: #f8fafc;
      }
      body {
        margin: 0;
        padding: 32px;
        background: radial-gradient(circle at top, #f1f5f9 0%, #fff 35%, #eef2ff 100%);
      }
      h1 {
        font-size: 24px;
        margin-bottom: 8px;
        color: #013300;
      }
      .summary {
        margin-bottom: 24px;
        padding: 16px 20px;
        border-radius: 16px;
        background-color: rgba(1, 51, 0, 0.06);
        color: #0f311d;
        border: 1px solid rgba(2, 76, 0, 0.15);
      }
      .summary strong {
        font-weight: 600;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        box-shadow: 0 30px 60px rgba(15, 55, 35, 0.12);
        border-radius: 18px;
        overflow: hidden;
        background-color: #fff;
      }
      th, td {
        border: 1px solid #e2e8f0;
        padding: 12px 14px;
        font-size: 14px;
        line-height: 1.4;
      }
      th {
        background-color: #f1f5f9;
        text-align: left;
        font-weight: 600;
        color: #0f172a;
      }
      tr:nth-child(even) td {
        background-color: #fafafa;
      }
      caption {
        caption-side: top;
        text-align: left;
        font-size: 16px;
        font-weight: 500;
        padding: 20px 0 12px;
        color: #475569;
      }
    </style>
  </head>
  <body>
    <h1>${sanitizedTitle} · Responses</h1>
    <div class="summary">
      <p><strong>Total responses:</strong> ${escapeHtml(responseLabel)}</p>
      <p><strong>Response rate:</strong> ${escapeHtml(responseRate)}%</p>
    </div>
    <table>
      <caption>Recorded submissions</caption>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
${tableRows}
      </tbody>
    </table>
  </body>
</html>`;
};

const openResponsesSheet = (
  responses: QuizResponse[],
  questions: ResponseQuestion[],
  quizTitle: string,
  totalStudents: number,
) => {
  const sheetWindow = window.open("", "_blank", "noopener,noreferrer,width=1000,height=800");

  if (!sheetWindow) {
    window.alert("Please allow pop-ups to view the responses in Sheets view.");
    return;
  }

  const html = buildSheetsHtml(responses, questions, quizTitle, totalStudents);
  sheetWindow.document.write(html);
  sheetWindow.document.close();
};

export default function ViewResponsesModal({
  isOpen,
  onClose,
  quizTitle,
  responses: initialResponses,
  questions: initialQuestions,
  totalStudents: initialTotalStudents = 0,
  quizCode,
  teacherId,
}: ViewResponsesModalProps & { quizCode?: string; teacherId?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysisData, setAnalysisData] = useState<any>(null);

  // Use props as fallback or initial state
  const responses = analysisData?.responses ?? initialResponses;
  const totalStudents = analysisData?.summary?.totalAssigned ?? initialTotalStudents;

  // Use itemAnalysis for questions if available, otherwise map initial questions
  const questionsDisplay = analysisData?.itemAnalysis
    ? analysisData.itemAnalysis.map((q: any) => ({
      id: String(q.questionId),
      prompt: q.text,
      type: q.type,
      difficultyIndex: q.difficultyIndex
    }))
    : initialQuestions;

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
      // Reset if we don't have enough info to fetch (or closed)
      setAnalysisData(null);
      setLoading(false);
    }
  }, [isOpen, quizCode, teacherId]);

  const responseCount = responses.length;

  const totalResponsesLabel = totalStudents > 0
    ? `${responseCount}/${totalStudents}`
    : `${responseCount}`;

  const rawRate = totalStudents > 0
    ? Math.round((responseCount / totalStudents) * 100)
    : responseCount > 0
      ? 100
      : 0;

  const clampedRate = Math.max(0, Math.min(100, rawRate));

  const completionBarStyle: CSSProperties = {
    width: `${clampedRate}%`,
  };

  const averageScore = formatMetric(analysisData?.summary?.averageScore);

  const footer = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <UtilityButton
        type="button"
        small
        onClick={() => openResponsesSheet(responses, questionsDisplay, quizTitle, totalStudents)}
      >
        View in Sheets
      </UtilityButton>
      <SecondaryButton type="button" onClick={onClose}>
        Close
      </SecondaryButton>
    </div>
  );

  return (
    <BaseModal
      show={isOpen}
      onClose={onClose}
      title={`Responses · ${quizTitle}`}
      footer={footer}
    >
      <div className="space-y-6">
        {loading ? (
          <div className="p-8 text-center text-gray-500 animate-pulse">Loading analysis...</div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
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
                  <table className="w-full text-sm text-left">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em]">Question</th>
                        <th className="px-4 py-3 w-32 text-center text-[11px] font-semibold uppercase tracking-[0.14em]">Correct</th>
                        <th className="px-4 py-3 w-32 text-center text-[11px] font-semibold uppercase tracking-[0.14em]">Difficulty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {analysisData.itemAnalysis.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 text-slate-800">
                            <div className="line-clamp-2" title={item.text}>{item.text}</div>
                            <div className="mt-1 text-xs capitalize text-slate-400">{item.type?.replace('_', ' ')}</div>
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
                <p className="text-sm text-gray-500">
                  No responses have been submitted yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {responses.map((response: any) => (
                    <div key={response.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 min-w-0">
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
                      {/* We hide the full answer detail if using API mode to save space/complexity, or we could expand it if API returned details per attempt 
                          The configured API route currently returns attempt summaries. If detailed breakdown per question per student is needed, we'd need to fetch that too.
                          For now, we show the summary card.
                      */}
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

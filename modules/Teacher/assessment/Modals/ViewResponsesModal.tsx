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

  const donutStyle: CSSProperties = {
    background: `conic-gradient(#013300 ${clampedRate * 3.6}deg, #e6f4ef ${clampedRate * 3.6}deg)`
  };

  // Calculate average from analysis or fallback
  const averageScore = analysisData?.summary?.averageScore
    ? Number(analysisData.summary.averageScore).toFixed(1)
    : "N/A";

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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-3">
                  <ModalLabel>Total responses</ModalLabel>
                  <p className="text-3xl font-semibold text-[#013300]">{totalResponsesLabel}</p>
                  <p className="text-sm text-gray-600">
                    {responseCount === 1 ? "1 submission" : `${responseCount} submissions`}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-3">
                  <ModalLabel>Response rate</ModalLabel>
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 flex-shrink-0">
                      <div className="h-12 w-12 rounded-full ring-4 ring-emerald-50" style={donutStyle} />
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#013300]">
                        {clampedRate}%
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 leading-tight">
                      {totalStudents > 0 ? "of assigned students" : "No students assigned"}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-3">
                  <ModalLabel>Average Score</ModalLabel>
                  <p className="text-3xl font-semibold text-[#013300]">{averageScore}</p>
                  <p className="text-sm text-gray-600">points</p>
                </div>
              </div>
            </ModalSection>

            {analysisData?.itemAnalysis && analysisData.itemAnalysis.length > 0 && (
              <ModalSection title="Item Analysis">
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">Question</th>
                        <th className="px-4 py-3 w-32 text-center">Correct</th>
                        <th className="px-4 py-3 w-32 text-center">Difficulty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {analysisData.itemAnalysis.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 text-gray-800">
                            <div className="line-clamp-2" title={item.text}>{item.text}</div>
                            <div className="text-xs text-gray-500 mt-1 capitalize">{item.type?.replace('_', ' ')}</div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {item.correctCount}/{item.totalAnswers}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${item.difficultyIndex > 80 ? 'bg-green-100 text-green-800' :
                              item.difficultyIndex > 50 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
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
                <div className="space-y-4">
                  {responses.map((response: any) => (
                    <div key={response.id} className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#013300]">{response.studentName}</p>
                          <p className="text-xs text-gray-500">ID: {response.studentId}</p>
                        </div>
                        <div className="text-sm text-gray-600">
                          Submitted {formatDateTime(response.submittedAt)}
                          {typeof response.score !== "undefined" && (
                            <span className="ml-2 px-2 py-0.5 bg-green-50 text-green-700 rounded font-semibold border border-green-100">
                              Score: {response.score}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 space-y-3">
                        {questionsDisplay.map((question: any) => {
                          const answerMap = response.answers ?? {};
                          const metaMap = response.answerMeta ?? {};
                          const answerValue = formatAnswer(answerMap[question.id]);
                          const meta = metaMap[question.id];
                          const scoreLabel = typeof meta?.score === "number" ? `Score: ${meta.score}` : null;
                          const correctnessLabel = meta?.isCorrect === 1 ? "Correct" : meta?.isCorrect === 0 ? "Incorrect" : null;

                          return (
                            <div key={question.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                              <p className="text-xs font-semibold text-gray-600 uppercase">Question</p>
                              <p className="text-sm text-gray-800">{question.prompt}</p>
                              <div className="mt-2 flex flex-col gap-1 text-sm text-gray-700">
                                <span>
                                  Answer: <span className="font-medium text-gray-900">{answerValue}</span>
                                </span>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                  {scoreLabel && (
                                    <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5">
                                      {scoreLabel}
                                    </span>
                                  )}
                                  {correctnessLabel && (
                                    <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5">
                                      {correctnessLabel}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
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

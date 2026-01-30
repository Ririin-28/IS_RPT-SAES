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

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && quizCode && teacherId) {
      setIsLoading(true);
      fetch(`/api/assessments/analysis?code=${quizCode}&teacherId=${teacherId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setAnalysisData(data);
          }
        })
        .catch((err) => console.error("Failed to load analysis", err))
        .finally(() => setIsLoading(false));
    } else {
      setAnalysisData(null);
    }
  }, [isOpen, quizCode, teacherId]);

  const responses = analysisData?.responses
    ? analysisData.responses.map((r: any) => ({
      ...r,
      submittedAt: r.submittedAt,
      answers: initialResponses.find(ir => String(ir.id) === String(r.id))?.answers ?? {}
    }))
    : initialResponses;

  const totalStudents = analysisData?.summary?.totalAssigned ?? initialTotalStudents;
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

  const footer = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <UtilityButton
        type="button"
        small
        onClick={() => openResponsesSheet(responses, questions, quizTitle, totalStudents)}
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
        <ModalSection title="Summary">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-3">
              <ModalLabel>Total responses</ModalLabel>
              <p className="text-3xl font-semibold text-[#013300]">{totalResponsesLabel}</p>
              <p className="text-sm text-gray-600">
                {responseCount === 1 ? "1 submission collected." : `${responseCount} submissions collected.`}
              </p>
              {totalStudents === 0 && (
                <p className="text-xs text-gray-500">Assign students to track response completion.</p>
              )}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-3">
              <ModalLabel>Response rate</ModalLabel>
              <div className="mt-3 flex items-center gap-4">
                <div className="relative h-20 w-20">
                  <div className="h-20 w-20 rounded-full ring-8 ring-emerald-50" style={donutStyle} />
                  <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-white">
                    <span className="text-lg font-semibold text-[#013300]">{clampedRate}%</span>
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">responses</span>
                  </div>
                </div>
                <p className="flex-1 text-sm text-gray-600">
                  {totalStudents > 0
                    ? `${responseCount} of ${totalStudents} students responded.`
                    : "Add students to calculate the completion rate."}
                </p>
              </div>
            </div>
          </div>
        </ModalSection>

        {analysisData?.itemAnalysis && analysisData.itemAnalysis.length > 0 && (
          <ModalSection title="Item Analysis">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#013300] text-white">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Question</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Correct / Total</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Difficulty Index</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {analysisData.itemAnalysis.map((item) => (
                    <tr key={item.questionId}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {item.text.length > 50 ? `${item.text.substring(0, 50)}...` : item.text}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 capitalize">
                        {item.type.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        <span className="font-semibold text-emerald-600">{item.correctCount}</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="text-gray-600">{item.totalAnswers}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                          ${item.difficultyIndex >= 75 ? 'bg-green-100 text-green-800' :
                            item.difficultyIndex >= 40 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'}`}>
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
          {responses.length === 0 ? (
            <p className="text-sm text-gray-500">
              No responses have been submitted yet. Share the quiz to start collecting answers.
            </p>
          ) : (
            <div className="space-y-4">
              {responses.map((response) => (
                <div key={response.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex flex-col gap-2 border-b border-gray-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#013300]">{response.studentName}</p>
                      <p className="text-xs text-gray-500">ID: {response.studentId}</p>
                    </div>
                    <div className="text-sm text-gray-600">
                      Submitted {formatDateTime(response.submittedAt)}
                      {typeof response.score === "number" && (
                        <span className="ml-2 font-semibold text-[#013300]">Score: {response.score}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {questions.map((question, index) => (
                      <div key={question.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Question {index + 1}
                          {question.sectionTitle ? ` · ${question.sectionTitle}` : ""}
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-800">{question.prompt}</p>
                        <p className="mt-2 text-sm text-gray-700">
                          <span className="font-medium text-gray-600">Answer:</span> {formatAnswer(response.answers?.[question.id])}
                        </p>
                        {question.correctAnswer && (
                          <p className="mt-1 text-xs text-gray-500">
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

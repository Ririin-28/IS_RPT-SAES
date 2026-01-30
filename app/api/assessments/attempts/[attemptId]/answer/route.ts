import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

type AnswerPayload = {
  questionId: number;
  selectedChoiceId?: number | null;
  answerText?: string | null;
};

export async function POST(request: NextRequest, { params }: { params: { attemptId: string } }) {
  const attemptId = Number(params.attemptId);
  if (!Number.isFinite(attemptId)) {
    return NextResponse.json({ success: false, error: "Invalid attempt id." }, { status: 400 });
  }

  try {
    const payload = (await request.json()) as AnswerPayload;
    if (!Number.isFinite(payload.questionId)) {
      return NextResponse.json({ success: false, error: "Invalid question." }, { status: 400 });
    }

    return await runWithConnection(async (connection) => {
      const [[attemptRow]] = await connection.query<RowDataPacket[]>(
        "SELECT assessment_id, status FROM assessment_attempts WHERE attempt_id = ? LIMIT 1",
        [attemptId],
      );
      if (!attemptRow) {
        return NextResponse.json({ success: false, error: "Attempt not found." }, { status: 404 });
      }
      if (attemptRow.status !== "in_progress") {
        return NextResponse.json({ success: false, error: "Attempt is already submitted." }, { status: 409 });
      }

      const [[questionRow]] = await connection.query<RowDataPacket[]>(
        "SELECT question_id, question_type, points FROM assessment_questions WHERE question_id = ? AND assessment_id = ? LIMIT 1",
        [payload.questionId, attemptRow.assessment_id],
      );
      if (!questionRow) {
        return NextResponse.json({ success: false, error: "Question not found for this quiz." }, { status: 404 });
      }

      const questionType = questionRow.question_type as string;
      let isCorrect = null as number | null;
      let score = 0;
      let selectedChoiceId: number | null = payload.selectedChoiceId ?? null;
      let answerText = payload.answerText ?? null;

      if (questionType !== "short_answer") {
        if (!selectedChoiceId) {
          return NextResponse.json({ success: false, error: "Choice is required." }, { status: 400 });
        }
        const [[choiceRow]] = await connection.query<RowDataPacket[]>(
          "SELECT is_correct FROM assessment_question_choices WHERE choice_id = ? AND question_id = ? LIMIT 1",
          [selectedChoiceId, payload.questionId],
        );
        if (!choiceRow) {
          return NextResponse.json({ success: false, error: "Choice not found." }, { status: 404 });
        }
        isCorrect = choiceRow.is_correct ? 1 : 0;
        score = isCorrect ? Number(questionRow.points ?? 0) : 0;
        answerText = null;
      } else {
        selectedChoiceId = null;
        // Basic case-insensitive check for short answer
        // Now using correcting_answer_text column if available, otherwise defaulting to null/0 or need manual check
        // The schema has "requires_manual_check", implying we might not auto-grade everything.
        // For now, let's do a simple string match if correct_answer_text is present.
        const [[qaRow]] = await connection.query<RowDataPacket[]>(
          "SELECT correct_answer_text, case_sensitive FROM assessment_questions WHERE question_id = ? LIMIT 1",
          [payload.questionId]
        );

        const correctText = qaRow?.correct_answer_text;

        if (correctText && answerText) {
          const isCaseSensitive = Boolean(qaRow?.case_sensitive);
          if (isCaseSensitive) {
            isCorrect = answerText.trim() === correctText.trim() ? 1 : 0;
          } else {
            isCorrect = answerText.trim().toLowerCase() === correctText.trim().toLowerCase() ? 1 : 0;
          }
          score = isCorrect ? Number(questionRow.points ?? 0) : 0;
        } else {
          // If no correct text defined, mark as 0 or pending? 
          // Requirement didn't specify, defaulting to 0/incorrect for now if no match found.
          isCorrect = 0;
          score = 0;
        }
      }

      const [existingRows] = await connection.query<RowDataPacket[]>(
        "SELECT answer_id FROM assessment_student_answers WHERE attempt_id = ? AND question_id = ? LIMIT 1",
        [attemptId, payload.questionId],
      );

      if (existingRows.length > 0) {
        await connection.query(
          `UPDATE assessment_student_answers
           SET selected_choice_id = ?, answer_text = ?, is_correct = ?, score = ?
           WHERE answer_id = ?`,
          [selectedChoiceId, answerText, isCorrect, score, existingRows[0].answer_id],
        );
      } else {
        await connection.query<ResultSetHeader>(
          `INSERT INTO assessment_student_answers
           (attempt_id, question_id, selected_choice_id, answer_text, is_correct, score)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [attemptId, payload.questionId, selectedChoiceId, answerText, isCorrect, score],
        );
      }

      return NextResponse.json({ success: true, isCorrect, score });
    });
  } catch (error) {
    console.error("Failed to save answer", error);
    return NextResponse.json({ success: false, error: "Failed to save answer." }, { status: 500 });
  }
}

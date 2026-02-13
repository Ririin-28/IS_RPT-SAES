import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export async function POST(
	request: NextRequest,
	props: { params: Promise<{ attemptId: string }> }
) {
	try {
		const { attemptId: attemptIdRaw } = await props.params;
		const attemptId = Number(attemptIdRaw);
		if (!Number.isInteger(attemptId) || attemptId <= 0) {
			return NextResponse.json({ success: false, error: "Invalid attempt id." }, { status: 400 });
		}

		const payload = (await request.json()) as {
			questionId?: number;
			selectedChoiceId?: number;
			answerText?: string;
		};

		const questionId = Number(payload.questionId);
		if (!Number.isInteger(questionId) || questionId <= 0) {
			return NextResponse.json({ success: false, error: "Invalid question id." }, { status: 400 });
		}

		const selectedChoiceId = payload.selectedChoiceId != null ? Number(payload.selectedChoiceId) : null;
		const answerText = payload.answerText?.trim() ?? "";

		const result = await runWithConnection(async (connection) => {
			await connection.beginTransaction();
			try {
				const [attemptRows] = await connection.query<RowDataPacket[]>(
					"SELECT attempt_id, assessment_id, status FROM assessment_attempts WHERE attempt_id = ? LIMIT 1",
					[attemptId]
				);

				if (attemptRows.length === 0) {
					throw new Error("Attempt not found.");
				}

				const attempt = attemptRows[0];
				if (String(attempt.status) !== "in_progress") {
					throw new Error("Attempt is no longer active.");
				}

				const [questionRows] = await connection.query<RowDataPacket[]>(
					`SELECT question_id, question_type, points, correct_answer_text, case_sensitive
					 FROM assessment_questions
					 WHERE question_id = ? AND assessment_id = ?
					 LIMIT 1`,
					[questionId, attempt.assessment_id]
				);

				if (questionRows.length === 0) {
					throw new Error("Question not found for this attempt.");
				}

				const question = questionRows[0];
				const points = Number(question.points ?? 1);
				let isCorrect = false;
				let resolvedChoiceId: number | null = null;

				if (selectedChoiceId != null && Number.isInteger(selectedChoiceId)) {
					const [choiceRows] = await connection.query<RowDataPacket[]>(
						`SELECT choice_id, is_correct
						 FROM assessment_question_choices
						 WHERE choice_id = ? AND question_id = ?
						 LIMIT 1`,
						[selectedChoiceId, questionId]
					);
					if (choiceRows.length === 0) {
						throw new Error("Selected choice is invalid for this question.");
					}
					resolvedChoiceId = Number(choiceRows[0].choice_id);
					isCorrect = Boolean(choiceRows[0].is_correct);
				} else {
					const correctAnswerRaw = String(question.correct_answer_text ?? "");
					const caseSensitive = Boolean(question.case_sensitive);
					if (caseSensitive) {
						isCorrect = answerText === correctAnswerRaw;
					} else {
						isCorrect = normalizeText(answerText) === normalizeText(correctAnswerRaw);
					}
				}

				const earnedScore = isCorrect ? points : 0;

				const [existingRows] = await connection.query<RowDataPacket[]>(
					"SELECT answer_id FROM assessment_student_answers WHERE attempt_id = ? AND question_id = ? LIMIT 1",
					[attemptId, questionId]
				);

				if (existingRows.length > 0) {
					await connection.query(
						`UPDATE assessment_student_answers
						 SET selected_choice_id = ?, answer_text = ?, is_correct = ?, score = ?
						 WHERE answer_id = ?`,
						[resolvedChoiceId, answerText || null, isCorrect ? 1 : 0, earnedScore, existingRows[0].answer_id]
					);
				} else {
					await connection.query<ResultSetHeader>(
						`INSERT INTO assessment_student_answers (attempt_id, question_id, selected_choice_id, answer_text, is_correct, score)
						 VALUES (?, ?, ?, ?, ?, ?)`,
						[attemptId, questionId, resolvedChoiceId, answerText || null, isCorrect ? 1 : 0, earnedScore]
					);
				}

				await connection.commit();
				return { isCorrect, score: earnedScore };
			} catch (error) {
				await connection.rollback();
				throw error;
			}
		});

		return NextResponse.json({ success: true, ...result });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to save answer.";
		return NextResponse.json({ success: false, error: message }, { status: 400 });
	}
}

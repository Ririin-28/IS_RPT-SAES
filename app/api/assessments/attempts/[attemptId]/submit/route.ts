import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
	_request: NextRequest,
	props: { params: Promise<{ attemptId: string }> }
) {
	try {
		const { attemptId: attemptIdRaw } = await props.params;
		const attemptId = Number(attemptIdRaw);
		if (!Number.isInteger(attemptId) || attemptId <= 0) {
			return NextResponse.json({ success: false, error: "Invalid attempt id." }, { status: 400 });
		}

		const result = await runWithConnection(async (connection) => {
			await connection.beginTransaction();
			try {
				const [attemptRows] = await connection.query<RowDataPacket[]>(
					`SELECT attempt_id, assessment_id, student_id, status
					 FROM assessment_attempts
					 WHERE attempt_id = ?
					 LIMIT 1`,
					[attemptId]
				);

				if (attemptRows.length === 0) {
					throw new Error("Attempt not found.");
				}

				const attempt = attemptRows[0];

				const [questionCountRows] = await connection.query<RowDataPacket[]>(
					"SELECT COUNT(*) AS total FROM assessment_questions WHERE assessment_id = ?",
					[attempt.assessment_id]
				);
				const totalQuestions = Number(questionCountRows[0]?.total ?? 0);

				const [answerSummaryRows] = await connection.query<RowDataPacket[]>(
					`SELECT
						 COALESCE(SUM(score), 0) AS total_score,
						 COALESCE(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct_count
					 FROM assessment_student_answers
					 WHERE attempt_id = ?`,
					[attemptId]
				);

				const totalScore = Number(answerSummaryRows[0]?.total_score ?? 0);
				const correctCount = Number(answerSummaryRows[0]?.correct_count ?? 0);
				const incorrectCount = Math.max(0, totalQuestions - correctCount);

				if (String(attempt.status) !== "submitted") {
					await connection.query(
						`UPDATE assessment_attempts
						 SET status = 'submitted', submitted_at = NOW(), total_score = ?
						 WHERE attempt_id = ?`,
						[totalScore, attemptId]
					);
				}

				const [studentRows] = await connection.query<RowDataPacket[]>(
					`SELECT first_name, middle_name, last_name, lrn
					 FROM student
					 WHERE student_id = ?
					 LIMIT 1`,
					[attempt.student_id]
				);

				const student = studentRows[0]
					? {
							name: [studentRows[0].first_name, studentRows[0].middle_name, studentRows[0].last_name]
								.filter(Boolean)
								.join(" ")
								.trim(),
							lrn: studentRows[0].lrn ?? undefined,
						}
					: undefined;

				await connection.commit();

				return {
					totalScore,
					correctCount,
					incorrectCount,
					totalQuestions,
					student,
				};
			} catch (error) {
				await connection.rollback();
				throw error;
			}
		});

		return NextResponse.json({ success: true, ...result });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to submit attempt.";
		return NextResponse.json({ success: false, error: message }, { status: 400 });
	}
}

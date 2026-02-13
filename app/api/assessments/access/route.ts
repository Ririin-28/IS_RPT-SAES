import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

type AssessmentRow = RowDataPacket & {
	assessment_id: number;
	title: string;
	description: string | null;
	start_time: string | Date | null;
	end_time: string | Date | null;
	qr_token: string | null;
	is_published: number | boolean;
};

type QuestionRow = RowDataPacket & {
	question_id: number;
	assessment_id: number;
	question_text: string;
	question_type: string;
	points: number;
	question_order: number;
};

type ChoiceRow = RowDataPacket & {
	choice_id: number;
	question_id: number;
	choice_text: string;
};

type StudentRow = RowDataPacket & {
	student_id: string;
	lrn: string | null;
	first_name: string | null;
	middle_name: string | null;
	last_name: string | null;
};

const toTimestamp = (value: string | Date | null | undefined) => {
	if (!value) return Number.NaN;
	if (value instanceof Date) return value.getTime();
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const assertAssessmentIsActive = (assessment: AssessmentRow) => {
	const now = Date.now();
	const startTime = toTimestamp(assessment.start_time);
	const endTime = toTimestamp(assessment.end_time);

	if (!Number.isFinite(startTime) || now < startTime) {
		throw new Error("This assessment is pending and not active yet.");
	}

	if (Number.isFinite(endTime) && now > endTime) {
		throw new Error("This assessment is already completed and no longer active.");
	}
};

const buildStudentName = (student: StudentRow) =>
	[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ").trim();

export async function GET() {
	return NextResponse.json({ success: false, error: "Use POST to access an assessment." }, { status: 405 });
}

export async function POST(request: NextRequest) {
	try {
		const payload = (await request.json()) as {
			quizCode?: string;
			qrToken?: string | null;
			studentId?: string;
		};

		const quizCode = payload.quizCode?.trim().toUpperCase();
		const studentLookup = payload.studentId?.trim();
		const qrToken = payload.qrToken?.trim() || null;

		if (!quizCode || !studentLookup) {
			return NextResponse.json(
				{ success: false, error: "Quiz code and student ID are required." },
				{ status: 400 }
			);
		}

		const result = await runWithConnection(async (connection) => {
			const [assessmentRows] = await connection.query<AssessmentRow[]>(
				`SELECT assessment_id, title, description, start_time, end_time, qr_token, is_published
				 FROM assessments
				 WHERE quiz_code = ?
				 LIMIT 1`,
				[quizCode]
			);

			if (assessmentRows.length === 0) {
				throw new Error("Assessment not found for this code.");
			}

			const assessment = assessmentRows[0];

			assertAssessmentIsActive(assessment);

			if (qrToken && assessment.qr_token && qrToken !== assessment.qr_token) {
				throw new Error("Invalid QR token.");
			}

			const [studentRows] = await connection.query<StudentRow[]>(
				`SELECT student_id, lrn, first_name, middle_name, last_name
				 FROM student
				 WHERE lrn = ? OR student_id = ?
				 LIMIT 1`,
				[studentLookup, studentLookup]
			);

			if (studentRows.length === 0) {
				throw new Error("Student not found.");
			}

			const student = studentRows[0];

			// Check if student has already submitted this assessment
			const [submittedAttemptRows] = await connection.query<RowDataPacket[]>(
				`SELECT attempt_id
				 FROM assessment_attempts
				 WHERE assessment_id = ? AND student_id = ? AND status = 'submitted'
				 LIMIT 1`,
				[assessment.assessment_id, student.student_id]
			);

			if (submittedAttemptRows.length > 0) {
				throw new Error("You have already completed this assessment and cannot retake it.");
			}

			const [questionRows] = await connection.query<QuestionRow[]>(
				`SELECT question_id, assessment_id, question_text, question_type, points, question_order
				 FROM assessment_questions
				 WHERE assessment_id = ?
				 ORDER BY question_order ASC, question_id ASC`,
				[assessment.assessment_id]
			);

			const questionIds = questionRows.map((question) => question.question_id);
			const choicesByQuestion = new Map<number, Array<{ id: number; text: string }>>();

			if (questionIds.length > 0) {
				const placeholders = questionIds.map(() => "?").join(", ");
				const [choiceRows] = await connection.query<ChoiceRow[]>(
					`SELECT choice_id, question_id, choice_text
					 FROM assessment_question_choices
					 WHERE question_id IN (${placeholders})
					 ORDER BY choice_id ASC`,
					questionIds
				);

				choiceRows.forEach((choice) => {
					const list = choicesByQuestion.get(choice.question_id) ?? [];
					list.push({ id: choice.choice_id, text: choice.choice_text });
					choicesByQuestion.set(choice.question_id, list);
				});
			}

			const [attemptRows] = await connection.query<RowDataPacket[]>(
				`SELECT attempt_id
				 FROM assessment_attempts
				 WHERE assessment_id = ? AND student_id = ? AND status = 'in_progress'
				 ORDER BY attempt_id DESC
				 LIMIT 1`,
				[assessment.assessment_id, student.student_id]
			);

			let attemptId: number;
			if (attemptRows.length > 0) {
				attemptId = Number(attemptRows[0].attempt_id);
			} else {
				const [insertAttempt] = await connection.query<ResultSetHeader>(
					`INSERT INTO assessment_attempts (assessment_id, student_id, lrn, started_at, status)
					 VALUES (?, ?, ?, NOW(), 'in_progress')`,
					[assessment.assessment_id, student.student_id, student.lrn ?? studentLookup]
				);
				attemptId = insertAttempt.insertId;
			}

			return {
				attemptId,
				student: {
					id: student.student_id,
					lrn: student.lrn ?? studentLookup,
					name: buildStudentName(student) || student.student_id,
				},
				assessment: {
					id: assessment.assessment_id,
					title: assessment.title,
					description: assessment.description ?? "",
					questions: questionRows.map((question) => ({
						id: question.question_id,
						questionText: question.question_text,
						type: question.question_type,
						points: Number(question.points ?? 1),
						choices: choicesByQuestion.get(question.question_id) ?? [],
					})),
				},
			};
		});

		return NextResponse.json({ success: true, ...result });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to access quiz.";
		return NextResponse.json({ success: false, error: message }, { status: 400 });
	}
}

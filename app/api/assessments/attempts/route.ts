import { NextRequest, NextResponse } from "next/server";
import { runWithConnection } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const { quizCode, lrn } = await request.json();

        if (!quizCode || !lrn) {
            return NextResponse.json({ success: false, error: "Quiz code and LRN are required." }, { status: 400 });
        }

        return await runWithConnection(async (connection) => {
            // 1. Verify Student
            const [students] = await connection.query<RowDataPacket[]>(
                "SELECT student_id, lrn, first_name, middle_name, last_name FROM student WHERE lrn = ? LIMIT 2",
                [lrn]
            );
            const student = students[0];

            if (!student) {
                return NextResponse.json({ success: false, error: "Student not found." }, { status: 404 });
            }

            if (students.length > 1) {
                return NextResponse.json({ success: false, error: "Duplicate LRN detected. Please contact your teacher." }, { status: 409 });
            }

            // 2. Verify Assessment
            const [assessments] = await connection.query<RowDataPacket[]>(
                "SELECT assessment_id, title, is_published, description FROM assessments WHERE quiz_code = ? LIMIT 1",
                [quizCode]
            );
            const assessment = assessments[0];

            if (!assessment) {
                return NextResponse.json({ success: false, error: "Quiz not found." }, { status: 404 });
            }

            if (!assessment.is_published) {
                return NextResponse.json({ success: false, error: "Quiz is not active." }, { status: 403 });
            }

            // 3. Check for existing attempts
            const [attempts] = await connection.query<RowDataPacket[]>(
                "SELECT attempt_id, status FROM assessment_attempts WHERE assessment_id = ? AND (student_id = ? OR lrn = ?) ORDER BY attempt_id DESC LIMIT 1",
                [assessment.assessment_id, student.student_id, student.lrn]
            );
            const existingAttempt = attempts[0];

            if (existingAttempt && existingAttempt.status !== 'in_progress') {
                return NextResponse.json({ success: false, error: "You have already completed this quiz." }, { status: 403 });
            }

            let attemptId = existingAttempt?.attempt_id;

            // 4. Create attempt if not in progress
            if (!attemptId) {
                const [result] = await connection.query<ResultSetHeader>(
                    `INSERT INTO assessment_attempts 
           (assessment_id, student_id, lrn, started_at, total_score, status)
           VALUES (?, ?, ?, NOW(), 0, 'in_progress')`,
                    [assessment.assessment_id, student.student_id, lrn]
                );
                attemptId = result.insertId;
            }

            // 5. Fetch Questions (Sanitized)
            const [rows] = await connection.query<RowDataPacket[]>(
                `SELECT 
          q.question_id, q.question_text, q.question_type, q.points, q.question_order,
          c.choice_id, c.choice_text
         FROM assessment_questions q
         LEFT JOIN assessment_question_choices c ON c.question_id = q.question_id
         WHERE q.assessment_id = ?
         ORDER BY q.question_order ASC, c.choice_id ASC`,
                [assessment.assessment_id]
            );

            // Group questions
            const questionsMap = new Map();
            rows.forEach((row) => {
                if (!questionsMap.has(row.question_id)) {
                    questionsMap.set(row.question_id, {
                        id: row.question_id,
                        text: row.question_text,
                        type: row.question_type,
                        points: row.points,
                        choices: []
                    });
                }
                if (row.choice_id) {
                    questionsMap.get(row.question_id).choices.push({
                        id: row.choice_id,
                        text: row.choice_text
                    });
                }
            });

            return NextResponse.json({
                success: true,
                attemptId,
                student: {
                    name: [student.first_name, student.middle_name, student.last_name]
                        .filter((part: string | null) => typeof part === "string" && part.trim().length > 0)
                        .join(" "),
                    lrn: student.lrn
                },
                quiz: {
                    title: assessment.title,
                    description: assessment.description,
                    questions: Array.from(questionsMap.values())
                }
            });
        });
    } catch (error) {
        console.error("Start attempt error:", error);
        return NextResponse.json({ success: false, error: "Failed to start quiz." }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const quizCode = searchParams.get('code');
    const userId = searchParams.get('teacherId'); // This comes as the numerical user ID from frontend

    if (!quizCode || !userId) {
        return NextResponse.json({ success: false, error: 'Missing quiz code or user ID' }, { status: 400 });
    }

    try {
        const pool = getPool();

        // 1. Get Assessment Details
        const [assessments] = await pool.query<RowDataPacket[]>(
            `SELECT assessment_id, title, description, subject_id, grade_id, phonemic_id 
             FROM assessments 
             WHERE quiz_code = ?`,
            [quizCode]
        );

        if (assessments.length === 0) {
            return NextResponse.json({ success: false, error: 'Assessment not found' }, { status: 404 });
        }
        const assessment = assessments[0];
        const assessmentId = assessment.assessment_id;

        // Resolve teacher_id from user_id
        const [teachers] = await pool.query<RowDataPacket[]>(
            `SELECT teacher_id FROM teacher WHERE user_id = ?`,
            [userId]
        );

        if (teachers.length === 0) {
            return NextResponse.json({ success: false, error: 'Teacher not found' }, { status: 404 });
        }

        const resolvedTeacherId = teachers[0].teacher_id;

        const [assignedCountRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(DISTINCT sta.student_id) AS total_assigned
             FROM student_teacher_assignment sta
             WHERE sta.teacher_id = ? AND sta.is_active = 1`,
            [resolvedTeacherId]
        );

        const totalAssigned = Number(assignedCountRows[0]?.total_assigned ?? 0);

        if (totalAssigned === 0) {
            return NextResponse.json({
                success: true,
                summary: {
                    totalAssigned: 0,
                    totalResponses: 0,
                    responseRate: 0,
                    averageScore: 0
                },
                responses: [],
                itemAnalysis: []
            });
        }

        const [attempts] = await pool.query<RowDataPacket[]>(
            `SELECT 
                aa.attempt_id,
                aa.student_id,
                aa.total_score,
                aa.submitted_at,
                s.first_name,
                s.last_name
             FROM assessment_attempts aa
             JOIN student s ON s.student_id = aa.student_id
             JOIN student_teacher_assignment sta ON sta.student_id = aa.student_id
             WHERE aa.assessment_id = ?
               AND aa.status IN ('submitted','graded')
               AND sta.teacher_id = ?
               AND sta.is_active = 1`,
            [assessmentId, resolvedTeacherId]
        );

        // 4. Calculate Summary Metrics
        const totalResponses = attempts.length;
        const responseRate = totalAssigned > 0 ? (totalResponses / totalAssigned) * 100 : 0;
        const totalScore = attempts.reduce((sum: number, a: any) => sum + (Number(a.total_score) || 0), 0);
        const averageScore = totalResponses > 0 ? totalScore / totalResponses : 0;

        // 5. Item Analysis
        // We need to know how many students got each question correct.
        // We query assessment_student_answers for the attempts we just found.
        const attemptIds = attempts.map((a: any) => a.attempt_id);

        let itemAnalysis: any[] = [];

        if (attemptIds.length > 0) {
            const [questionStats] = await pool.query<RowDataPacket[]>(
                `SELECT 
                    q.question_id, 
                    q.question_text, 
                    q.question_type,
                    COUNT(sa.answer_id) as total_answers,
                    SUM(CASE WHEN sa.is_correct = 1 THEN 1 ELSE 0 END) as correct_count
                 FROM assessment_questions q
                 JOIN assessment_student_answers sa ON q.question_id = sa.question_id
                 WHERE sa.attempt_id IN (?)
                 GROUP BY q.question_id, q.question_text, q.question_type
                 ORDER BY q.question_order ASC`,
                [attemptIds]
            );

            itemAnalysis = questionStats.map((q: any) => ({
                questionId: q.question_id,
                text: q.question_text,
                type: q.question_type,
                correctCount: Number(q.correct_count),
                totalAnswers: Number(q.total_answers),
                difficultyIndex: Number(q.total_answers) > 0
                    ? (Number(q.correct_count) / Number(q.total_answers)) * 100
                    : 0
            }));
        } else {
            // If no attempts, fetch questions structure at least
            const [questions] = await pool.query<RowDataPacket[]>(
                `SELECT question_id, question_text, question_type FROM assessment_questions WHERE assessment_id = ? ORDER BY question_order ASC`,
                [assessmentId]
            );
            itemAnalysis = questions.map((q: any) => ({
                questionId: q.question_id,
                text: q.question_text,
                type: q.question_type,
                correctCount: 0,
                totalAnswers: 0,
                difficultyIndex: 0
            }));
        }

        const answersByAttempt = new Map<string, Record<string, string>>();
        const answerMetaByAttempt = new Map<string, Record<string, { score: number | null; isCorrect: number | null }>>();

        if (attemptIds.length > 0) {
            const [answerRows] = await pool.query<RowDataPacket[]>(
                `SELECT 
                    sa.attempt_id,
                    sa.question_id,
                    sa.answer_text,
                    sa.is_correct,
                    sa.score,
                    q.question_text,
                    q.question_type,
                    q.points,
                    c.choice_text
                 FROM assessment_student_answers sa
                 JOIN assessment_questions q ON q.question_id = sa.question_id
                 LEFT JOIN assessment_question_choices c ON c.choice_id = sa.selected_choice_id
                 WHERE sa.attempt_id IN (?)`,
                [attemptIds]
            );

            answerRows.forEach((row: any) => {
                const attemptId = String(row.attempt_id);
                const questionId = String(row.question_id);
                const answerValue = row.choice_text ?? row.answer_text ?? "";
                const answers = answersByAttempt.get(attemptId) ?? {};
                const meta = answerMetaByAttempt.get(attemptId) ?? {};

                answers[questionId] = answerValue;
                meta[questionId] = {
                    score: row.score !== null && row.score !== undefined ? Number(row.score) : null,
                    isCorrect: row.is_correct !== null && row.is_correct !== undefined ? Number(row.is_correct) : null,
                };

                answersByAttempt.set(attemptId, answers);
                answerMetaByAttempt.set(attemptId, meta);
            });
        }

        const responses = attempts.map((a: any) => {
            const studentName = [a.first_name, a.last_name]
                .filter((part: string | null) => typeof part === "string" && part.trim().length > 0)
                .join(" ");
            return {
                id: a.attempt_id,
                studentId: a.student_id,
                studentName: studentName || `Student ${a.student_id}`,
                score: a.total_score,
                submittedAt: a.submitted_at,
                answers: answersByAttempt.get(String(a.attempt_id)) ?? {},
                answerMeta: answerMetaByAttempt.get(String(a.attempt_id)) ?? {},
            };
        });

        return NextResponse.json({
            success: true,
            summary: {
                totalAssigned,
                totalResponses,
                responseRate,
                averageScore
            },
            responses,
            itemAnalysis
        });

    } catch (error) {
        console.error('Error in assessment analysis:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

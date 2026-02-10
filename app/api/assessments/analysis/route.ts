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

        // Resolve teacher_id or remedial_role_id from user_id
        const [teachers] = await pool.query<RowDataPacket[]>(
            `SELECT teacher_id FROM teacher WHERE user_id = ?`,
            [userId]
        );

        let resolvedId = userId; // Fallback
        let isRemedial = false;

        if (teachers.length > 0) {
            resolvedId = teachers[0].teacher_id;
        } else {
            // Check if it's a remedial teacher
            const [remedials] = await pool.query<RowDataPacket[]>(
                `SELECT rh.remedial_role_id 
                 FROM mt_remedialteacher_handled rh
                 JOIN master_teacher mt ON mt.master_teacher_id = rh.master_teacher_id
                 WHERE mt.user_id = ?
                 LIMIT 1`,
                [userId]
            );
            if (remedials.length > 0) {
                resolvedId = remedials[0].remedial_role_id;
                isRemedial = true;
            }
        }

        const assignmentColumn = isRemedial ? 'remedial_role_id' : 'teacher_id';

        // 2. Get Assigned Students (Active only)
        // We only care about students assigned to THIS teacher / remedial teacher
        const [assignedStudents] = await pool.query<RowDataPacket[]>(
            `SELECT sta.student_id, s.lrn
             FROM student_teacher_assignment sta
             JOIN student s ON s.student_id = sta.student_id
             WHERE sta.${assignmentColumn} = ? AND sta.is_active = 1`,
            [resolvedId]
        );

        const assignedStudentIds = assignedStudents.map((s: any) => s.student_id).filter(Boolean);
        const assignedStudentLrns = assignedStudents.map((s: any) => s.lrn).filter(Boolean);

        // If no students are assigned, we return empty stats but valid success
        if (assignedStudentIds.length === 0) {
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

        // 3. Get Attempts for this assessment from assigned students only
        // We include student ID and LRN. 
        // Note: Use '?' for IN clause placeholder expansion in mysql2 if configured, or map it manually.
        // mysql2 usually supports 'IN (?)' with an array.
        const attemptFilters: string[] = [];
        const attemptParams: Array<number | string | string[]> = [assessmentId];

        if (assignedStudentIds.length > 0) {
            attemptFilters.push("a.student_id IN (?)");
            attemptParams.push(assignedStudentIds);
        }

        if (assignedStudentLrns.length > 0) {
            attemptFilters.push("a.lrn IN (?)");
            attemptParams.push(assignedStudentLrns);
        }

        const attemptsFilterSql = attemptFilters.length > 0
            ? `AND (${attemptFilters.join(" OR ")})`
            : "";

        const [attempts] = await pool.query<RowDataPacket[]>(
            `SELECT a.attempt_id, a.student_id, a.lrn, a.total_score, a.submitted_at 
             FROM assessment_attempts a
             WHERE a.assessment_id = ? 
             ${attemptsFilterSql}
             AND a.status = 'submitted'`,
            attemptParams
        );

        // 4. Calculate Summary Metrics
        const totalAssigned = assignedStudentIds.length;
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

        // 6. Format Individual Responses
        // Fetch names from 'student' table

        const studentMap = new Map<string, string>(); // ID -> Name
        const studentLrnMap = new Map<string, string>(); // LRN -> Name
        try {
            if (assignedStudentIds.length > 0) {
                const [students] = await pool.query<RowDataPacket[]>(
                    `SELECT student_id, lrn, first_name, middle_name, last_name FROM student WHERE student_id IN (?)`,
                    [assignedStudentIds]
                );
                students.forEach((s: any) => {
                    const fullName = [s.first_name, s.middle_name, s.last_name]
                        .filter((part: string | null) => typeof part === "string" && part.trim().length > 0)
                        .join(" ");
                    studentMap.set(String(s.student_id), fullName);
                    if (s.lrn) {
                        studentLrnMap.set(String(s.lrn), fullName);
                    }
                });
            }
        } catch (e) {
            console.warn("Could not fetch student names", e);
        }

        const responses = attempts.map((a: any) => ({
            id: a.attempt_id,
            studentId: a.student_id,
            studentName: studentMap.get(String(a.student_id))
                || studentLrnMap.get(String(a.lrn))
                || a.lrn
                || `Student ${a.student_id}`,
            score: a.total_score,
            submittedAt: a.submitted_at
        }));

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

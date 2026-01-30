import { NextRequest, NextResponse } from "next/server";
import { runWithConnection } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const { quizCode, lrn } = await request.json();

        if (!quizCode || !lrn) {
            return NextResponse.json(
                { success: false, error: "Quiz Code and LRN are required." },
                { status: 400 }
            );
        }

        return await runWithConnection(async (connection) => {
            // 1. Validate Quiz Code
            const [assessmentRows] = await connection.query<RowDataPacket[]>(
                `SELECT assessment_id, is_published, quiz_code 
         FROM assessments 
         WHERE quiz_code = ? 
         LIMIT 1`,
                [quizCode.trim()]
            );

            const assessment = assessmentRows[0];

            if (!assessment) {
                return NextResponse.json(
                    { success: false, error: "Invalid quiz code." },
                    { status: 404 }
                );
            }

            if (!assessment.is_published) {
                return NextResponse.json(
                    { success: false, error: "This quiz is not currently active." },
                    { status: 403 }
                );
            }

            // 2. Validate LRN
            const [studentRows] = await connection.query<RowDataPacket[]>(
                `SELECT student_id, lrn, first_name, last_name 
         FROM student 
         WHERE lrn = ? 
         LIMIT 1`,
                [lrn.trim()]
            );

            const student = studentRows[0];

            if (!student) {
                return NextResponse.json(
                    { success: false, error: "Invalid LRN. Please check your Learner Reference Number." },
                    { status: 404 }
                );
            }

            // 3. (Optional) Check if student is allowed significantly? 
            // For now, based on requirements, if LRN exists and Quiz Code exists -> Allow.
            // We might want to store a session or return a token, but for now we'll trust the flow.
            // Redirecting to the quiz page.

            return NextResponse.json({
                success: true,
                redirectUrl: `/quiz/${assessment.quiz_code}`,
                student: {
                    name: `${student.first_name} ${student.last_name}`,
                    lrn: student.lrn
                }
            });
        });

    } catch (error) {
        console.error("Join quiz error:", error);
        return NextResponse.json(
            { success: false, error: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_: NextRequest, props: { params: Promise<{ attemptId: string }> }) {
  const params = await props.params;
  const attemptId = Number(params.attemptId);
  if (!Number.isFinite(attemptId)) {
    return NextResponse.json({ success: false, error: "Invalid attempt id." }, { status: 400 });
  }

  try {
    return await runWithConnection(async (connection) => {
      const [[attemptRow]] = await connection.query<RowDataPacket[]>(
        "SELECT assessment_id, status, lrn FROM assessment_attempts WHERE attempt_id = ? LIMIT 1",
        [attemptId],
      );
      if (!attemptRow) {
        return NextResponse.json({ success: false, error: "Attempt not found." }, { status: 404 });
      }
      if (attemptRow.status !== "in_progress") {
        return NextResponse.json({ success: false, error: "Attempt already submitted." }, { status: 409 });
      }

      const [[scoreRow]] = await connection.query<RowDataPacket[]>(
        "SELECT COALESCE(SUM(score), 0) AS total FROM assessment_student_answers WHERE attempt_id = ?",
        [attemptId],
      );
      const totalScore = Number(scoreRow?.total ?? 0);

      const [[correctRow]] = await connection.query<RowDataPacket[]>(
        "SELECT COALESCE(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct FROM assessment_student_answers WHERE attempt_id = ?",
        [attemptId],
      );

      const [[questionRow]] = await connection.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM assessment_questions WHERE assessment_id = ?",
        [attemptRow.assessment_id],
      );

      const correctCount = Number(correctRow?.correct ?? 0);
      const totalQuestions = Number(questionRow?.total ?? 0);
      const incorrectCount = Math.max(0, totalQuestions - correctCount);

      let studentName: string | null = null;
      if (attemptRow.lrn) {
        const [studentRows] = await connection.query<RowDataPacket[]>(
          "SELECT first_name, middle_name, last_name FROM student WHERE lrn = ? LIMIT 1",
          [attemptRow.lrn],
        );
        const student = studentRows[0];
        if (student) {
          studentName = [student.first_name, student.middle_name, student.last_name]
            .filter((part: string | null) => typeof part === "string" && part.trim().length > 0)
            .join(" ");
        }
      }

      await connection.query(
        "UPDATE assessment_attempts SET submitted_at = NOW(), total_score = ?, status = 'submitted' WHERE attempt_id = ?",
        [totalScore, attemptId],
      );

      return NextResponse.json({
        success: true,
        totalScore,
        correctCount,
        incorrectCount,
        totalQuestions,
        student: {
          name: studentName,
          lrn: attemptRow.lrn ?? null,
        },
      });
    });
  } catch (error) {
    console.error("Failed to submit attempt", error);
    return NextResponse.json({ success: false, error: "Failed to submit attempt." }, { status: 500 });
  }
}

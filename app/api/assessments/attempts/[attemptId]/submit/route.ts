import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_: NextRequest, { params }: { params: { attemptId: string } }) {
  const attemptId = Number(params.attemptId);
  if (!Number.isFinite(attemptId)) {
    return NextResponse.json({ success: false, error: "Invalid attempt id." }, { status: 400 });
  }

  try {
    return await runWithConnection(async (connection) => {
      const [[attemptRow]] = await connection.query<RowDataPacket[]>(
        "SELECT status FROM assessment_attempts WHERE attempt_id = ? LIMIT 1",
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

      await connection.query(
        "UPDATE assessment_attempts SET submitted_at = NOW(), total_score = ?, status = 'submitted' WHERE attempt_id = ?",
        [totalScore, attemptId],
      );

      return NextResponse.json({ success: true, totalScore });
    });
  } catch (error) {
    console.error("Failed to submit attempt", error);
    return NextResponse.json({ success: false, error: "Failed to submit attempt." }, { status: 500 });
  }
}

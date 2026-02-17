import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensurePerformanceSchema } from "@/lib/performance/schema";

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toStringId = (value: number | string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

export async function POST(request: NextRequest) {
  try {
    await ensurePerformanceSchema();
    const payload = (await request.json().catch(() => null)) as {
      approvedScheduleId?: number | string | null;
      subjectId?: number | string | null;
      phonemicId?: number | string | null;
      studentIds?: Array<number | string>;
    } | null;

    const approvedScheduleId = toNumber(payload?.approvedScheduleId ?? null);
    const subjectId = toNumber(payload?.subjectId ?? null);
    const phonemicId = toNumber(payload?.phonemicId ?? null);
    const rawStudentIds = Array.isArray(payload?.studentIds) ? payload?.studentIds : [];
    const studentIds = rawStudentIds
      .map((value) => toStringId(value))
      .filter((value): value is string => Boolean(value));

    if (!approvedScheduleId || !subjectId) {
      return NextResponse.json({ success: false, error: "Missing required identifiers." }, { status: 400 });
    }

    if (!studentIds.length) {
      return NextResponse.json({ success: true, statusByStudent: {} });
    }

    const placeholders = studentIds.map(() => "?").join(", ");
    const params: Array<number | string | null> = [
      approvedScheduleId,
      subjectId,
      phonemicId,
      phonemicId,
      ...studentIds,
    ];

    const [rows] = await query<RowDataPacket[]>(
      `
        SELECT
          s.student_id,
          s.session_id,
          s.completed_at,
          EXISTS(
            SELECT 1
            FROM student_remedial_flashcard_performance p
            WHERE p.session_id = s.session_id
            LIMIT 1
          ) AS has_performance
        FROM student_remedial_session s
        WHERE s.approved_schedule_id = ?
          AND s.subject_id = ?
          AND (? IS NULL OR s.phonemic_id = ?)
          AND s.student_id IN (${placeholders})
      `,
      params,
    );

    const statusByStudent: Record<string, { completed: boolean; hasProgress: boolean }> = {};
    for (const studentId of studentIds) {
      statusByStudent[studentId] = { completed: false, hasProgress: false };
    }

    for (const row of rows) {
      const studentId = String(row.student_id);
      const hasPerformance = Boolean(row.has_performance);
      const completed = hasPerformance && Boolean(row.completed_at);
      statusByStudent[studentId] = {
        completed,
        hasProgress: hasPerformance,
      };
    }

    return NextResponse.json({ success: true, statusByStudent });
  } catch (error) {
    console.error("Failed to load remedial session status", error);
    return NextResponse.json({ success: false, error: "Server error." }, { status: 500 });
  }
}

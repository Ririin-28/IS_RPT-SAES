import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const toString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

type MonthlyAssessmentPayload = {
  subject?: string | null;
  subjectId?: number | string | null;
  studentIds?: Array<string | number>;
  months?: number[];
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => null)) as MonthlyAssessmentPayload | null;
    const subjectName = toString(payload?.subject ?? null);
    const subjectIdInput = toNumber(payload?.subjectId ?? null);

    const rawStudentIds = Array.isArray(payload?.studentIds) ? payload?.studentIds : [];
    const studentIds = rawStudentIds
      .map((value) => toString(value))
      .filter((value): value is string => Boolean(value));

    const rawMonths = Array.isArray(payload?.months) ? payload?.months : [];
    const months = rawMonths
      .map((value) => toNumber(value))
      .filter((value): value is number => Boolean(value && value >= 1 && value <= 12));

    if (!studentIds.length || !months.length) {
      return NextResponse.json({ success: true, levelsByStudent: {} });
    }

    let subjectId = subjectIdInput;
    if (!subjectId && subjectName) {
      const [rows] = await query<RowDataPacket[]>(
        "SELECT subject_id FROM subject WHERE LOWER(TRIM(subject_name)) = LOWER(TRIM(?)) LIMIT 1",
        [subjectName],
      );
      subjectId = toNumber(rows[0]?.subject_id ?? null);
    }

    if (!subjectId) {
      return NextResponse.json({ success: false, error: "Subject not found." }, { status: 400 });
    }

    const studentPlaceholders = studentIds.map(() => "?").join(", ");
    const monthPlaceholders = months.map(() => "?").join(", ");

    const sql = `
      SELECT
        ssa.student_id,
        MONTH(ssa.assessed_at) AS assessed_month,
        ssa.assessed_at,
        pl.level_name
      FROM student_subject_assessment ssa
      LEFT JOIN phonemic_level pl ON pl.phonemic_id = ssa.phonemic_id
      WHERE ssa.subject_id = ?
        AND ssa.student_id IN (${studentPlaceholders})
        AND MONTH(ssa.assessed_at) IN (${monthPlaceholders})
      ORDER BY ssa.student_id ASC, assessed_month ASC, ssa.assessed_at DESC
    `;

    const params: Array<string | number> = [subjectId, ...studentIds, ...months];
    const [rows] = await query<RowDataPacket[]>(sql, params);

    const levelsByStudent: Record<string, Record<string, string>> = {};
    for (const studentId of studentIds) {
      levelsByStudent[studentId] = {};
    }

    for (const row of rows) {
      const studentId = toString(row.student_id);
      const month = toNumber(row.assessed_month);
      if (!studentId || !month) continue;
      const key = `m${month}`;
      if (levelsByStudent[studentId]?.[key]) continue;
      const levelName = toString(row.level_name) ?? "";
      levelsByStudent[studentId] = {
        ...(levelsByStudent[studentId] ?? {}),
        [key]: levelName,
      };
    }

    return NextResponse.json({ success: true, levelsByStudent });
  } catch (error) {
    console.error("Failed to load monthly assessment levels", error);
    return NextResponse.json({ success: false, error: "Server error." }, { status: 500 });
  }
}

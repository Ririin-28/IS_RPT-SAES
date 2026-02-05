import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject") || "English";

    // Get subject_id from subject name
    const [subjectRows] = await query<RowDataPacket[]>(
      "SELECT subject_id FROM subject WHERE subject_name = ?",
      [subject]
    );

    if (!subjectRows || subjectRows.length === 0) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const subjectId = subjectRows[0].subject_id;

    // Query to get student progress by grade level
    const sql = `
      SELECT 
        g.grade_level,
        pl.level_name,
        COUNT(DISTINCT s.student_id) as student_count
      FROM student s
      INNER JOIN grade g ON s.grade_id = g.grade_id
      LEFT JOIN student_subject_assessment ssa ON s.student_id = ssa.student_id AND ssa.subject_id = ?
      LEFT JOIN phonemic_level pl ON ssa.phonemic_id = pl.phonemic_id AND pl.subject_id = ?
      GROUP BY g.grade_level, pl.level_name
      ORDER BY g.grade_level, pl.level_name
    `;

    const [rows] = await query<RowDataPacket[]>(sql, [subjectId, subjectId]);

    // Get total students per grade
    const [totalRows] = await query<RowDataPacket[]>(`
      SELECT g.grade_level, COUNT(DISTINCT s.student_id) as total
      FROM student s
      INNER JOIN grade g ON s.grade_id = g.grade_id
      GROUP BY g.grade_level
      ORDER BY g.grade_level
    `);

    // Structure data by grade level
    const gradeData: Record<string, Record<string, number>> = {};
    const gradeTotals: Record<string, number> = {};

    totalRows.forEach((row) => {
      gradeTotals[row.grade_level] = row.total;
      gradeData[row.grade_level] = {};
    });

    rows.forEach((row) => {
      const gradeLevel = row.grade_level;
      const levelName = row.level_name || "Not Assessed";
      const count = row.student_count;

      if (!gradeData[gradeLevel]) {
        gradeData[gradeLevel] = {};
      }
      gradeData[gradeLevel][levelName] = count;
    });

    // Calculate percentages
    const percentageData: Record<string, Record<string, number>> = {};
    Object.keys(gradeData).forEach((grade) => {
      percentageData[grade] = {};
      const total = gradeTotals[grade] || 1;
      Object.keys(gradeData[grade]).forEach((level) => {
        percentageData[grade][level] = Math.round((gradeData[grade][level] / total) * 100);
      });
    });

    return NextResponse.json({
      subject,
      gradeData,
      percentageData,
      gradeTotals,
    });
  } catch (error) {
    console.error("Failed to fetch student progress data", error);
    return NextResponse.json(
      { error: "Failed to fetch student progress data" },
      { status: 500 }
    );
  }
}

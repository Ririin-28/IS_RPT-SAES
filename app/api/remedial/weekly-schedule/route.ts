import { NextRequest, NextResponse } from "next/server";
import { query, getTableColumns } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";

const WEEKLY_TABLE = "weekly_subject_schedule";
const SUBJECT_TABLE = "subject";

type ScheduleRow = RowDataPacket & {
  day_of_week: string;
  start_time: string;
  end_time: string;
  subject_id: number;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subjectName = searchParams.get("subject");
  const gradeLevel = searchParams.get("grade");

  if (!subjectName) {
    return NextResponse.json({ success: false, error: "Missing subject parameter" }, { status: 400 });
  }

  try {
    // 1. Get subject_id
    const [subjectRows] = await query<RowDataPacket[]>(
      `SELECT subject_id FROM ${SUBJECT_TABLE} WHERE subject_name LIKE ? LIMIT 1`,
      [`%${subjectName}%`]
    );

    if (!subjectRows.length) {
      return NextResponse.json({ success: false, error: "Subject not found" }, { status: 404 });
    }

    const subjectId = subjectRows[0].subject_id;

    // 2. Check if weekly_subject_schedule has grade_id column
    const columns = await getTableColumns(WEEKLY_TABLE);
    const hasGradeId = columns.has("grade_id");

    let sql = `SELECT day_of_week, start_time, end_time FROM ${WEEKLY_TABLE} WHERE subject_id = ?`;
    const params: any[] = [subjectId];

    if (hasGradeId && gradeLevel) {
      // Try to parse grade number
      const gradeNum = parseInt(gradeLevel.replace(/\D/g, ""), 10);
      if (!isNaN(gradeNum)) {
        sql += ` AND grade_id = ?`;
        params.push(gradeNum);
      }
    }

    const [rows] = await query<ScheduleRow[]>(sql, params);

    if (!rows.length) {
      return NextResponse.json({ 
        success: true, 
        schedule: null, 
        message: "No specific weekly schedule found for this criteria." 
      });
    }

    // Format times (usually returned as HH:mm:ss)
    const formattedRows = rows.map(r => ({
      day: r.day_of_week,
      startTime: r.start_time ? String(r.start_time).substring(0, 5) : null,
      endTime: r.end_time ? String(r.end_time).substring(0, 5) : null,
    }));

    return NextResponse.json({
      success: true,
      schedule: formattedRows
    });

  } catch (error) {
    console.error("Error fetching weekly subject schedule:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

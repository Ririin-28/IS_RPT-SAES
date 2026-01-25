import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectName = searchParams.get("subject");

    if (!subjectName) {
      return NextResponse.json({ success: false, error: "Subject is required" }, { status: 400 });
    }

    // Map subject name to subject_id (Assuming 1: English, 2: Filipino, 3: Math based on init script)
    const subjectMap: Record<string, number> = {
      "English": 1,
      "Filipino": 2,
      "Math": 3
    };

    const subjectId = subjectMap[subjectName];

    if (!subjectId) {
      // Fallback: search by name in subject table if it exists
      const [subjectRows] = await query<RowDataPacket[]>(
        "SELECT subject_id FROM subject WHERE subject_name LIKE ?",
        [`%${subjectName}%`]
      );
      if (subjectRows.length > 0) {
        // use found id
      }
    }

    const [rows] = await query<RowDataPacket[]>(
      "SELECT phonemic_id, level_name FROM phonemic_level WHERE subject_id = ? ORDER BY phonemic_id ASC",
      [subjectId || 0]
    );

    return NextResponse.json({ success: true, levels: rows });
  } catch (error) {
    console.error("Failed to fetch levels", error);
    return NextResponse.json({ success: false, error: "Failed to load levels" }, { status: 500 });
  }
}

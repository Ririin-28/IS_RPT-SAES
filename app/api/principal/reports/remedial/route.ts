import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { query } from "@/lib/db";

const TABLE_NAME = "remedial_reports" as const;

type ReportRow = RowDataPacket & {
  id: number;
  user_id: number;
  subject: string;
  grade_level: string | null;
  teacher_name: string | null;
  file_name: string;
  created_at: Date | string;
};

const ensureTable = async () => {
  await query(
    `CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      subject VARCHAR(50) NOT NULL,
      grade_level VARCHAR(50) NULL,
      teacher_name VARCHAR(255) NULL,
      file_name VARCHAR(255) NOT NULL,
      report_json LONGTEXT NULL,
      pdf LONGBLOB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
};

const sanitize = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const normalizeSubject = (value: unknown): string => {
  const text = sanitize(value).toLowerCase();
  if (text === "filipino") {
    return "filipino";
  }
  if (text === "math" || text === "mathematics") {
    return "math";
  }
  return "english";
};

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const url = new URL(request.url);
    const subjectParam = url.searchParams.get("subject");
    const gradeParam = url.searchParams.get("grade");

    const where: string[] = [];
    const params: Array<string> = [];

    if (subjectParam) {
      where.push("subject = ?");
      params.push(normalizeSubject(subjectParam));
    }

    if (gradeParam) {
      where.push("(grade_level = ? OR grade_level IS NULL)");
      params.push(sanitize(gradeParam));
    }

    const sql = `
      SELECT id, user_id, subject, grade_level, teacher_name, file_name, created_at
      FROM \`${TABLE_NAME}\`
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC
    `;

    const [rows] = await query<ReportRow[]>(sql, params);

    const reports = rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      gradeLevel: row.grade_level,
      teacherName: row.teacher_name,
      fileName: row.file_name,
      uploadedAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      downloadPath: `/api/principal/reports/remedial/${row.id}`,
    }));

    return NextResponse.json({ success: true, reports });
  } catch (error) {
    console.error("Failed to load remedial reports for principal", error);
    return NextResponse.json({ success: false, error: "Failed to load reports." }, { status: 500 });
  }
}

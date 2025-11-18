import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { query } from "@/lib/db";

const TABLE_NAME = "remedial_reports" as const;

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

type SendReportPayload = {
  userId: number;
  subject: string;
  gradeLevel?: string | null;
  teacherName?: string | null;
  fileName: string;
  pdfData: string;
  reportData?: unknown;
};

const sanitizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const normalizeSubject = (value: unknown): string => {
  const text = sanitizeString(value).toLowerCase();
  if (text === "filipino") {
    return "filipino";
  }
  if (text === "math" || text === "mathematics") {
    return "math";
  }
  return "english";
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<SendReportPayload> | null;
    if (!body) {
      return NextResponse.json({ success: false, error: "Missing request body." }, { status: 400 });
    }

    const userId = Number(body.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid userId." }, { status: 400 });
    }

    const subject = normalizeSubject(body.subject);
    const fileName = sanitizeString(body.fileName);
    const pdfData = sanitizeString(body.pdfData);
    if (!fileName) {
      return NextResponse.json({ success: false, error: "Missing file name." }, { status: 400 });
    }
    if (!pdfData) {
      return NextResponse.json({ success: false, error: "Missing PDF data." }, { status: 400 });
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = Buffer.from(pdfData, "base64");
    } catch {
      return NextResponse.json({ success: false, error: "Invalid PDF payload." }, { status: 400 });
    }

    await ensureTable();

    const gradeLevel = sanitizeString(body.gradeLevel ?? "");
    const teacherName = sanitizeString(body.teacherName ?? "");
    const reportJson = body.reportData ? JSON.stringify(body.reportData) : null;

    await query(
      `INSERT INTO \`${TABLE_NAME}\` (user_id, subject, grade_level, teacher_name, file_name, report_json, pdf)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, subject, gradeLevel || null, teacherName || null, fileName, reportJson, pdfBuffer],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to store remedial report", error);
    return NextResponse.json({ success: false, error: "Failed to send report." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import type { RowDataPacket } from "mysql2";
import { query } from "@/lib/db";

const TABLE_NAME = "remedial_reports" as const;

type ReportRow = RowDataPacket & {
  file_name: string;
  pdf: Buffer;
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

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    await ensureTable();
    const rawId = context.params?.id;
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: "Invalid report id." }, { status: 400 });
    }

    const [rows] = await query<ReportRow[]>(
      `SELECT file_name, pdf FROM \`${TABLE_NAME}\` WHERE id = ? LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "Report not found." }, { status: 404 });
    }

    const row = rows[0];
    const fileName = (row.file_name || `remedial_report_${id}.pdf`).replace(/"/g, "'");

    return new NextResponse(new Uint8Array(row.pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Failed to deliver remedial report PDF", error);
    return NextResponse.json({ success: false, error: "Failed to download report." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { query, tableExists } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const subject = searchParams.get("subject");
    const pageSize = Number(searchParams.get("pageSize")) || 10;
    const page = Number(searchParams.get("page")) || 1;

    const materialsExists = await tableExists("teacher_materials");
    if (!materialsExists) {
      return NextResponse.json({
        data: [],
        pagination: { total: 0, page, pageSize, totalPages: 0 }
      });
    }

    let whereClause = "WHERE status = ?";
    const params: any[] = [status];

    if (subject) {
      whereClause += " AND subject = ?";
      params.push(subject);
    }

    const [countRows] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM teacher_materials ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const offset = (page - 1) * pageSize;
    const [rows] = await query<RowDataPacket[]>(
      `SELECT * FROM teacher_materials ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return NextResponse.json({
      data: rows,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error("Failed to fetch materials", error);
    return NextResponse.json({ error: "Failed to load materials" }, { status: 500 });
  }
}

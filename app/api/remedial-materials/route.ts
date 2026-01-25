import { NextRequest, NextResponse } from "next/server";
import { getTableColumns, query, tableExists } from "@/lib/db";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { normalizeMaterialStatus, type MaterialStatus } from "@/lib/materials/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");
    const submittedBy = searchParams.get("submittedBy");

    if (!requestId) {
      return NextResponse.json({ success: false, error: "requestId is required" }, { status: 400 });
    }

    let sql = `
      SELECT rm.*, pl.level_name
      FROM remedial_materials rm
      LEFT JOIN phonemic_level pl ON pl.phonemic_id = rm.phonemic_id
      WHERE rm.request_id = ?
    `;
    const params: any[] = [requestId];

    if (submittedBy) {
      sql += " AND rm.submitted_by = ?";
      params.push(submittedBy);
    }

    const [rows] = await query<RowDataPacket[]>(sql, params);

    const submittedIds = Array.from(
      new Set(
        rows
          .map((row) => row.submitted_by)
          .filter((value) => value !== null && value !== undefined)
          .map((value) => String(value).trim())
          .filter(Boolean),
      ),
    );

    let nameById = new Map<string, string>();
    if (submittedIds.length && (await tableExists("users"))) {
      const userColumns = await getTableColumns("users");
      const hasFirst = userColumns.has("first_name");
      const hasMiddle = userColumns.has("middle_name");
      const hasLast = userColumns.has("last_name");
      const hasCode = userColumns.has("user_code");
      const hasId = userColumns.has("user_id");

      if (hasFirst && hasLast && (hasCode || hasId)) {
        const idColumn = hasId ? "user_id" : "user_code";
        const placeholders = submittedIds.map(() => "?").join(", ");
        const [userRows] = await query<RowDataPacket[]>(
          `SELECT ${idColumn} as uid, first_name, middle_name, last_name FROM users WHERE ${idColumn} IN (${placeholders})`,
          submittedIds,
        );

        nameById = new Map(
          userRows.map((user) => {
            const uid = String(user.uid);
            const first = user.first_name ? String(user.first_name).trim() : "";
            const middle = user.middle_name ? String(user.middle_name).trim() : "";
            const last = user.last_name ? String(user.last_name).trim() : "";
            const middleInitial = middle ? `${middle.charAt(0).toUpperCase()}.` : "";
            const base = [last, first].filter(Boolean).join(", ");
            const display = [base, middleInitial].filter(Boolean).join(" ") || uid;
            return [uid, display];
          }),
        );
      }
    }

    const withNames = rows.map((row) => {
      const rawId = row.submitted_by ? String(row.submitted_by).trim() : "";
      const submitterName = nameById.get(rawId) ?? rawId ?? "Unknown";
      return {
        ...row,
        submitted_by_name: submitterName,
      };
    });

    return NextResponse.json({ success: true, materials: withNames });
  } catch (error) {
    console.error("Failed to fetch remedial materials", error);
    return NextResponse.json({ success: false, error: "Failed to load materials" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, phonemicId, fileName, filePath, submittedBy } = body;

    if (!requestId || !phonemicId || !fileName || !filePath || !submittedBy) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Check if THIS user already submitted a material for this activity/level
    const [existing] = await query<RowDataPacket[]>(
      "SELECT material_id FROM remedial_materials WHERE request_id = ? AND phonemic_id = ? AND submitted_by = ?",
      [requestId, phonemicId, submittedBy]
    );

    if (existing.length > 0) {
      // Update existing
      await query(
        "UPDATE remedial_materials SET file_path = ?, file_name = ?, status = 'Pending', submitted_by = ?, updated_at = NOW() WHERE material_id = ?",
        [filePath, fileName, submittedBy, existing[0].material_id]
      );
      return NextResponse.json({ success: true, message: "Material updated", id: existing[0].material_id });
    } else {
      // Insert new
      const [result] = await query<ResultSetHeader>(
        "INSERT INTO remedial_materials (request_id, phonemic_id, file_path, file_name, status, submitted_by, submitted_at, updated_at) VALUES (?, ?, ?, ?, 'Pending', ?, NOW(), NOW())",
        [requestId, phonemicId, filePath, fileName, submittedBy]
      );
      return NextResponse.json({ success: true, message: "Material saved", id: result.insertId });
    }
  } catch (error) {
    console.error("Failed to save remedial material", error);
    return NextResponse.json({ success: false, error: "Failed to save material" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const [result] = await query<ResultSetHeader>(
      "DELETE FROM remedial_materials WHERE material_id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, error: "Material not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Material removed" });
  } catch (error) {
    console.error("Failed to delete remedial material", error);
    return NextResponse.json({ success: false, error: "Failed to remove material" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as {
      id?: number | string;
      status?: string;
      rejectionReason?: string | null;
      approvedBy?: number | string | null;
    } | null;

    const materialId = body?.id ? Number.parseInt(String(body.id), 10) : null;
    const status = normalizeMaterialStatus(body?.status ?? "pending");

    if (!materialId || !status) {
      return NextResponse.json({ success: false, error: "Material id and valid status are required." }, { status: 400 });
    }

    const rejectionReason = typeof body?.rejectionReason === "string" ? body.rejectionReason.trim() || null : null;
    const approvedBy = body?.approvedBy ? String(body.approvedBy).trim() || null : null;

    const dbStatus = (status as MaterialStatus).charAt(0).toUpperCase() + (status as MaterialStatus).slice(1);

    const [result] = await query<ResultSetHeader>(
      "UPDATE remedial_materials SET status = ?, rejection_reason = ?, approved_by = ?, updated_at = NOW() WHERE material_id = ?",
      [dbStatus, rejectionReason, approvedBy, materialId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, error: "Material not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update remedial material", error);
    return NextResponse.json({ success: false, error: "Failed to update material" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const TABLE_NAME = "teacher_materials";

const COLUMN_CANDIDATES = {
  id: ["id", "material_id"],
  teacherUserId: ["teacher_user_id", "user_id", "teacherId", "teacher_id"],
} as const;

function pick(columns: Set<string>, candidates: readonly string[]): string | null {
  for (const c of candidates) {
    if (columns.has(c)) return c;
  }
  return null;
}

async function resolveColumns() {
  if (!(await tableExists(TABLE_NAME))) return null;
  const cols = await getTableColumns(TABLE_NAME);
  const id = pick(cols, COLUMN_CANDIDATES.id);
  if (!id) return null;
  return {
    id,
    teacherUserId: pick(cols, COLUMN_CANDIDATES.teacherUserId),
  };
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const columns = await resolveColumns();
    if (!columns) {
      return NextResponse.json({ success: false, error: "Materials table unavailable." }, { status: 404 });
    }

    const materialId = Number.parseInt(params.id, 10);
    if (!Number.isFinite(materialId)) {
      return NextResponse.json({ success: false, error: "Invalid material id." }, { status: 400 });
    }

    const body = await request.json().catch(() => null) as any;
    const teacherUserId = body?.teacherUserId;

    const whereParts = [`\`${columns.id}\` = ?`];
    const values: Array<number> = [materialId];

    if (teacherUserId && columns.teacherUserId) {
      whereParts.push(`\`${columns.teacherUserId}\` = ?`);
      values.push(Number.parseInt(String(teacherUserId), 10));
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [result] = await query<ResultSetHeader>(
      `DELETE FROM \`${TABLE_NAME}\` ${whereClause} LIMIT 1`,
      values,
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, error: "Material not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete material", error);
    return NextResponse.json({ success: false, error: "Failed to delete material" }, { status: 500 });
  }
}

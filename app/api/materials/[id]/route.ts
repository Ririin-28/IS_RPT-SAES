import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import { normalizeMaterialStatus, normalizeMaterialSubject } from "@/lib/materials/shared";

export const dynamic = "force-dynamic";

const SUBJECT_TABLES = {
  english: {
    pending: "pending_english_materials",
    approved: "english_materials",
  },
  filipino: {
    pending: "pending_filipino_materials",
    approved: "filipino_materials",
  },
  math: {
    pending: "pending_math_materials",
    approved: "math_materials",
  },
} as const;

const TABLE_NAME = "teacher_materials";

const COLUMN_CANDIDATES = {
  id: ["id", "material_id"],
  teacherUserId: ["teacher_user_id", "user_id", "teacherId", "teacher_id"],
  status: ["status", "material_status", "review_status"],
  rejectionReason: ["rejection_reason", "reject_reason", "remarks"],
  reviewedBy: ["reviewed_by", "reviewer_id", "approved_by"],
  reviewedAt: ["reviewed_at", "approved_at"],
  updatedAt: ["updated_at", "updatedAt", "date_updated"],
} as const;

function pick(columns: Set<string>, candidates: readonly string[]): string | null {
  for (const c of candidates) {
    if (columns.has(c)) return c;
  }
  return null;
}

function normalizeSubjectKey(value: string | null): keyof typeof SUBJECT_TABLES | null {
  if (!value) return null;
  const normalized = normalizeMaterialSubject(value);
  if (!normalized) return null;
  const key = normalized.toLowerCase() as keyof typeof SUBJECT_TABLES;
  return SUBJECT_TABLES[key] ? key : null;
}

function selectPendingTable(subject: keyof typeof SUBJECT_TABLES) {
  return SUBJECT_TABLES[subject].pending;
}

async function resolveColumns(tableName: string) {
  if (!(await tableExists(tableName))) return null;
  const cols = await getTableColumns(tableName);
  const id = pick(cols, COLUMN_CANDIDATES.id);
  if (!id) return null;
  return {
    id,
    teacherUserId: pick(cols, COLUMN_CANDIDATES.teacherUserId),
    status: pick(cols, COLUMN_CANDIDATES.status),
    rejectionReason: pick(cols, COLUMN_CANDIDATES.rejectionReason),
    reviewedBy: pick(cols, COLUMN_CANDIDATES.reviewedBy),
    reviewedAt: pick(cols, COLUMN_CANDIDATES.reviewedAt),
    updatedAt: pick(cols, COLUMN_CANDIDATES.updatedAt),
  };
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const columns = await resolveColumns(TABLE_NAME);
    if (!columns) {
      return NextResponse.json({ success: false, error: "Materials table unavailable." }, { status: 404 });
    }

    const materialId = Number.parseInt(id, 10);
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const materialId = Number.parseInt(id, 10);

    if (!Number.isFinite(materialId)) {
      return NextResponse.json({ success: false, error: "Invalid material id." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as {
      status?: string;
      rejectionReason?: string | null;
      reviewedBy?: number | string | null;
      subject?: string | null;
    } | null;

    const status = normalizeMaterialStatus(body?.status ?? "pending");
    const subjectKey = normalizeSubjectKey(body?.subject ?? null);

    if (!status || !subjectKey) {
      return NextResponse.json({ success: false, error: "Valid subject and status are required." }, { status: 400 });
    }

    const tableName = selectPendingTable(subjectKey);
    const columns = await resolveColumns(tableName);

    if (!columns) {
      return NextResponse.json({ success: false, error: "Materials table unavailable." }, { status: 404 });
    }

    const rejectionReason = typeof body?.rejectionReason === "string" ? body.rejectionReason.trim() || null : null;
    const reviewedBy = body?.reviewedBy !== undefined && body?.reviewedBy !== null
      ? Number.parseInt(String(body.reviewedBy), 10)
      : null;

    const updates: string[] = [];
    const values: Array<string | number | null> = [];

    if (columns.status) {
      updates.push(`\`${columns.status}\` = ?`);
      values.push(status);
    }

    if (columns.rejectionReason) {
      updates.push(`\`${columns.rejectionReason}\` = ?`);
      values.push(rejectionReason);
    }

    if (columns.reviewedBy && reviewedBy !== null) {
      updates.push(`\`${columns.reviewedBy}\` = ?`);
      values.push(reviewedBy);
    }

    if (columns.reviewedAt) {
      updates.push(`\`${columns.reviewedAt}\` = NOW()`);
    }

    if (columns.updatedAt) {
      updates.push(`\`${columns.updatedAt}\` = NOW()`);
    }

    if (!updates.length) {
      return NextResponse.json({ success: false, error: "No updatable columns found." }, { status: 400 });
    }

    const [result] = await query<ResultSetHeader>(
      `UPDATE \`${tableName}\` SET ${updates.join(", ")} WHERE \`${columns.id}\` = ? LIMIT 1`,
      [...values, materialId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, error: "Material not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update material", error);
    return NextResponse.json({ success: false, error: "Failed to update material" }, { status: 500 });
  }
}

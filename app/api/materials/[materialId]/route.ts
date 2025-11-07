import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  ensureMaterialsSchema,
  MATERIAL_STATUSES,
  MaterialStatus,
  normalizeMaterialStatus,
} from "@/lib/materials";
import { query, tableExists } from "@/lib/db";
import { deleteMaterialFile } from "@/lib/storage/materials";
import { fetchMaterialById } from "@/lib/materials/service";

export const dynamic = "force-dynamic";

function parseMaterialId(value: string | string[] | undefined): number | null {
  if (!value) return null;
  const text = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type UpdateMaterialPayload = {
  status?: string;
  reviewedBy?: number;
  rejectionReason?: string | null;
  attachmentUrl?: string | null;
  description?: string | null;
};

type DeleteMaterialPayload = {
  teacherUserId?: number;
};

export async function GET(_: NextRequest, context: { params: { materialId: string } }) {
  try {
    await ensureMaterialsSchema();
    const materialId = parseMaterialId(context.params.materialId);
    if (!materialId) {
      return NextResponse.json({ error: "Invalid material id" }, { status: 400 });
    }

    const material = await fetchMaterialById(materialId);
    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    return NextResponse.json({ data: material, meta: { statuses: MATERIAL_STATUSES } });
  } catch (error) {
    console.error("Failed to load material", error);
    return NextResponse.json({ error: "Failed to load material" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: { materialId: string } }) {
  try {
    await ensureMaterialsSchema();
    const materialId = parseMaterialId(context.params.materialId);
    if (!materialId) {
      return NextResponse.json({ error: "Invalid material id" }, { status: 400 });
    }

    const existing = await fetchMaterialById(materialId);
    if (!existing) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    const payload = (await request.json()) as Partial<UpdateMaterialPayload>;

    const updates: string[] = [];
    const params: Array<string | number | null> = [];

    let normalizedStatus: MaterialStatus | null = null;
    let reviewerUserId: number | null = null;
    let rejectionReason: string | null = null;

    if (payload.status !== undefined) {
      normalizedStatus = normalizeMaterialStatus(payload.status);
      if (!normalizedStatus) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
    }

    if (payload.reviewedBy !== undefined) {
      if (!Number.isFinite(payload.reviewedBy) || Number(payload.reviewedBy) <= 0) {
        return NextResponse.json({ error: "Invalid reviewedBy" }, { status: 400 });
      }
      reviewerUserId = Math.floor(Number(payload.reviewedBy));
    }

    if (payload.rejectionReason !== undefined) {
      rejectionReason = payload.rejectionReason === null ? null : String(payload.rejectionReason).trim();
    }

    if (payload.attachmentUrl !== undefined) {
      const value = typeof payload.attachmentUrl === "string" ? payload.attachmentUrl.trim() : null;
      updates.push("attachment_url = ?");
      params.push(value && value.length > 0 ? value : null);
    }

    if (payload.description !== undefined) {
      const value = typeof payload.description === "string" ? payload.description.trim() : null;
      updates.push("description = ?");
      params.push(value && value.length > 0 ? value : null);
    }

    if (normalizedStatus !== null) {
      if (normalizedStatus === "approved" || normalizedStatus === "rejected") {
        if (!reviewerUserId) {
          return NextResponse.json({ error: "reviewedBy is required when approving or rejecting" }, { status: 400 });
        }

        if (normalizedStatus === "rejected") {
          if (!rejectionReason || rejectionReason.length === 0) {
            return NextResponse.json({ error: "rejectionReason is required when rejecting" }, { status: 400 });
          }
          updates.push("rejection_reason = ?");
          params.push(rejectionReason);
        } else {
          updates.push("rejection_reason = NULL");
        }

        updates.push("status = ?");
        params.push(normalizedStatus);
        updates.push("reviewed_by = ?");
        params.push(reviewerUserId);
        updates.push("reviewed_at = NOW()");
      } else if (normalizedStatus === "pending") {
        updates.push("status = ?");
        params.push(normalizedStatus);
        updates.push("reviewed_by = NULL");
        updates.push("reviewed_at = NULL");
        updates.push("rejection_reason = NULL");
      }
    } else if (reviewerUserId !== null || rejectionReason !== null) {
      return NextResponse.json({ error: "Status must be provided when updating reviewer or rejection reason" }, { status: 400 });
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
    }

    if (reviewerUserId) {
      const usersAvailable = await tableExists("users");
      if (usersAvailable) {
        const [rows] = await query<RowDataPacket[]>(
          "SELECT user_id FROM `users` WHERE user_id = ? LIMIT 1",
          [reviewerUserId],
        );
        if (rows.length === 0) {
          return NextResponse.json({ error: "Reviewer not found" }, { status: 404 });
        }
      }
    }

    const setClause = updates.join(", ");

    await query<ResultSetHeader>(
      `UPDATE \`teacher_materials\` SET ${setClause} WHERE material_id = ?`,
      [...params, materialId],
    );

    const updated = await fetchMaterialById(materialId);
    if (!updated) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updated, meta: { statuses: MATERIAL_STATUSES } });
  } catch (error) {
    console.error("Failed to update material", error);
    return NextResponse.json({ error: "Failed to update material" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: { materialId: string } }) {
  try {
    await ensureMaterialsSchema();
    const materialId = parseMaterialId(context.params.materialId);
    if (!materialId) {
      return NextResponse.json({ error: "Invalid material id" }, { status: 400 });
    }

    const payload = (await request.json().catch(() => ({}))) as DeleteMaterialPayload;
    const teacherUserId = payload.teacherUserId ? Math.floor(Number(payload.teacherUserId)) : null;
    if (!teacherUserId || !Number.isFinite(teacherUserId) || teacherUserId <= 0) {
      return NextResponse.json({ error: "teacherUserId is required" }, { status: 400 });
    }

    const material = await fetchMaterialById(materialId);
    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    if (Number(material.teacherUserId) !== teacherUserId) {
      return NextResponse.json({ error: "You are not allowed to delete this material" }, { status: 403 });
    }

    await query<ResultSetHeader>("DELETE FROM `teacher_materials` WHERE material_id = ?", [materialId]);

    await Promise.all(material.files.map((file) => deleteMaterialFile(file.storagePath)));

    if (material.attachmentUrl) {
      await deleteMaterialFile(material.attachmentUrl);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete material", error);
    return NextResponse.json({ error: "Failed to delete material" }, { status: 500 });
  }
}

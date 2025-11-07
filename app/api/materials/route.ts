import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  ensureMaterialsSchema,
  MATERIAL_STATUSES,
  MATERIAL_SUBJECTS,
  fileRowToDto,
  materialRowToDto,
  MaterialDto,
  MaterialFileDto,
  MaterialFileRow,
  MaterialRow,
  MaterialStatus,
  normalizeMaterialStatus,
  normalizeMaterialSubject,
  normalizePublicPath,
} from "@/lib/materials";
import { query, runWithConnection, tableExists } from "@/lib/db";
import { fetchMaterialById } from "@/lib/materials/service";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const normalizeStoredPath = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
};

function parsePositiveInt(value: string | null, fallback: number, options?: { min?: number; max?: number }): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  const min = options?.min ?? 1;
  const max = options?.max ?? Number.POSITIVE_INFINITY;
  return Math.min(Math.max(parsed, min), max);
}

function buildUserSelect(includeUsers: boolean, role: "teacher" | "reviewer"): string[] {
  if (!includeUsers) {
    return [
      `NULL AS ${role}_username`,
      `NULL AS ${role}_first_name`,
      `NULL AS ${role}_middle_name`,
      `NULL AS ${role}_last_name`,
    ];
  }

  return [
    `${role}.username AS ${role}_username`,
    `${role}.first_name AS ${role}_first_name`,
    `${role}.middle_name AS ${role}_middle_name`,
    `${role}.last_name AS ${role}_last_name`,
  ];
}

export async function GET(request: NextRequest) {
  try {
    await ensureMaterialsSchema();

    const searchParams = request.nextUrl.searchParams;
    const subject = normalizeMaterialSubject(searchParams.get("subject"));
    const level = searchParams.get("level")?.trim() || null;
    const status = normalizeMaterialStatus(searchParams.get("status"));
    const teacherUserIdParam = searchParams.get("teacherUserId");
    const reviewedByParam = searchParams.get("reviewedBy");
    const searchTerm = searchParams.get("search") ?? searchParams.get("q");

    const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE, { min: 1 });
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, {
      min: 1,
      max: MAX_PAGE_SIZE,
    });
    const offset = (page - 1) * pageSize;

    const filters: string[] = [];
    const params: Array<string | number> = [];

    if (subject) {
      filters.push("tm.subject = ?");
      params.push(subject);
    }

    if (level) {
      filters.push("tm.level = ?");
      params.push(level);
    }

    if (status) {
      filters.push("tm.status = ?");
      params.push(status);
    }

    if (teacherUserIdParam) {
      const teacherUserId = Number.parseInt(teacherUserIdParam, 10);
      if (!Number.isFinite(teacherUserId)) {
        return NextResponse.json({ error: "Invalid teacherUserId" }, { status: 400 });
      }
      filters.push("tm.teacher_user_id = ?");
      params.push(teacherUserId);
    }

    if (reviewedByParam) {
      const reviewedBy = Number.parseInt(reviewedByParam, 10);
      if (!Number.isFinite(reviewedBy)) {
        return NextResponse.json({ error: "Invalid reviewedBy" }, { status: 400 });
      }
      filters.push("tm.reviewed_by = ?");
      params.push(reviewedBy);
    }

    if (searchTerm && searchTerm.trim().length > 0) {
      const term = `%${searchTerm.trim()}%`;
      filters.push("(tm.title LIKE ? OR tm.description LIKE ?)");
      params.push(term, term);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const usersAvailable = await tableExists("users");

    const selectColumns: string[] = [
      "tm.material_id",
      "tm.teacher_user_id",
      "tm.subject",
      "tm.level",
      "tm.title",
      "tm.description",
      "tm.attachment_url",
      "tm.status",
      "tm.rejection_reason",
      "tm.reviewed_by",
      "tm.reviewed_at",
      "tm.created_at",
      "tm.updated_at",
      ...buildUserSelect(usersAvailable, "teacher"),
      ...buildUserSelect(usersAvailable, "reviewer"),
    ];

    const joinClause = usersAvailable
      ? `
        LEFT JOIN \`users\` AS teacher ON teacher.user_id = tm.teacher_user_id
        LEFT JOIN \`users\` AS reviewer ON reviewer.user_id = tm.reviewed_by
      `
      : "";

    const [countRows] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM \`teacher_materials\` AS tm ${whereClause}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await query<RowDataPacket[]>(
      `SELECT ${selectColumns.join(", ")}
       FROM \`teacher_materials\` AS tm
       ${joinClause}
       ${whereClause}
       ORDER BY tm.created_at DESC, tm.material_id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    const materialRows = rows as unknown as MaterialRowPacket[];
    const materialIds = materialRows.map((row) => Number(row.material_id)).filter((id) => id > 0);

    let filesMap = new Map<number, MaterialFileDto[]>();
    if (materialIds.length > 0) {
      const placeholders = materialIds.map(() => "?").join(", ");
      const [fileRows] = await query<RowDataPacket[]>(
        `SELECT file_id, material_id, file_name, storage_path, mime_type, file_size, created_at
         FROM \`teacher_material_files\`
         WHERE material_id IN (${placeholders})
         ORDER BY material_id ASC, created_at ASC, file_id ASC`,
        materialIds,
      );
      filesMap = fileRows.reduce((acc, row) => {
        const file = fileRowToDto(row as MaterialFileRow);
        const materialId = file.materialId;
        const current = acc.get(materialId) ?? [];
        current.push(file);
        acc.set(materialId, current);
        return acc;
      }, new Map<number, MaterialFileDto[]>());
    }

    const materials: MaterialDto[] = materialRows.map((row) => {
      const files = filesMap.get(Number(row.material_id)) ?? [];
      return materialRowToDto(row, files);
    });

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    return NextResponse.json({
      data: materials,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
      filters: {
        subject,
        level,
        status,
        teacherUserId: teacherUserIdParam ? Number.parseInt(teacherUserIdParam, 10) : null,
        reviewedBy: reviewedByParam ? Number.parseInt(reviewedByParam, 10) : null,
        search: searchTerm ?? null,
      },
      meta: {
        subjects: MATERIAL_SUBJECTS,
        statuses: MATERIAL_STATUSES,
      },
    });
  } catch (error) {
    console.error("Failed to fetch materials", error);
    return NextResponse.json({ error: "Failed to fetch materials" }, { status: 500 });
  }
}

type CreateMaterialPayload = {
  teacherUserId: number;
  subject: string;
  level: string;
  title: string;
  description?: string | null;
  attachmentUrl?: string | null;
  status?: MaterialStatus;
  files?: Array<{
    fileName: string;
    storagePath: string;
    mimeType?: string | null;
    fileSize?: number | null;
  }>;
};

type MaterialRowPacket = MaterialRow & RowDataPacket;

export async function POST(request: NextRequest) {
  try {
    await ensureMaterialsSchema();

    const payload = (await request.json()) as Partial<CreateMaterialPayload>;

    const teacherUserId = Number.parseInt(String(payload.teacherUserId ?? ""), 10);
    if (!Number.isFinite(teacherUserId) || teacherUserId <= 0) {
      return NextResponse.json({ error: "teacherUserId is required" }, { status: 400 });
    }

    const subject = normalizeMaterialSubject(payload.subject);
    if (!subject) {
      return NextResponse.json({ error: "subject is invalid" }, { status: 400 });
    }

    const level = typeof payload.level === "string" ? payload.level.trim() : "";
    if (!level) {
      return NextResponse.json({ error: "level is required" }, { status: 400 });
    }

    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const description = typeof payload.description === "string" ? payload.description.trim() : null;
  const attachmentUrl = normalizeStoredPath(payload.attachmentUrl ?? null);

    const normalizedStatus = normalizeMaterialStatus(payload.status ?? "pending") ?? "pending";
    if (normalizedStatus !== "pending") {
      return NextResponse.json({ error: "New materials must start as pending" }, { status: 400 });
    }

    const files = Array.isArray(payload.files)
      ? payload.files
          .map((file) => ({
            fileName: typeof file.fileName === "string" ? file.fileName.trim() : "",
            storagePath: normalizeStoredPath(file.storagePath ?? ""),
            mimeType: typeof file.mimeType === "string" ? file.mimeType.trim() : null,
            fileSize:
              typeof file.fileSize === "number" && Number.isFinite(file.fileSize) && file.fileSize >= 0
                ? Math.floor(file.fileSize)
                : null,
          }))
      .filter((file) => file.fileName.length > 0 && !!file.storagePath)
      : [];

    const resolvedAttachmentUrl = attachmentUrl ?? (files[0] ? files[0].storagePath : null);

    const usersAvailable = await tableExists("users");
    if (usersAvailable) {
      const [userRows] = await query<RowDataPacket[]>(
        "SELECT user_id FROM `users` WHERE user_id = ? LIMIT 1",
        [teacherUserId],
      );
      if (userRows.length === 0) {
        return NextResponse.json({ error: "Unknown teacher user" }, { status: 404 });
      }
    }

  let materialId: number | null = null;

    await runWithConnection(async (connection) => {
      await connection.beginTransaction();
      try {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO \`teacher_materials\` (
            teacher_user_id,
            subject,
            level,
            title,
            description,
            attachment_url,
            status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
            .replace(/\s+/g, " "),
          [teacherUserId, subject, level, title, description, resolvedAttachmentUrl, normalizedStatus],
        );
  materialId = Number(result.insertId);

        if (files.length > 0) {
          const values = files
            .map(() => "(?, ?, ?, ?, ?, NOW())")
            .join(", ");
          const params: Array<string | number | null> = [];
          for (const file of files) {
            params.push(materialId, file.fileName, file.storagePath, file.mimeType, file.fileSize);
          }
          await connection.execute(
            `INSERT INTO \`teacher_material_files\` (
              material_id,
              file_name,
              storage_path,
              mime_type,
              file_size,
              created_at
            ) VALUES ${values}`,
            params,
          );
        }

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });

    if (!materialId) {
      throw new Error("Material insert did not return an identifier");
    }

    const material = await fetchMaterialById(materialId);
    if (!material) {
      return NextResponse.json({ error: "Material not found after creation" }, { status: 500 });
    }

    return NextResponse.json({ data: material }, { status: 201 });
  } catch (error) {
    console.error("Failed to create material", error);
    return NextResponse.json({ error: "Failed to create material" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import { normalizeMaterialSubject, normalizeMaterialStatus } from "@/lib/materials/shared";

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

const COLUMN_CANDIDATES = {
  id: ["id", "material_id"],
  teacherUserId: ["teacher_user_id", "user_id", "teacherId", "teacher_id"],
  subject: ["subject", "material_subject"],
  level: ["level", "grade_level", "material_level"],
  title: ["title", "material_title", "name"],
  attachmentUrl: ["attachment_url", "file_path", "file_url", "attachment"],
  status: ["status", "material_status", "review_status"],
  rejectionReason: ["rejection_reason", "reject_reason", "remarks"],
  reviewedBy: ["reviewed_by", "reviewer_id", "approved_by"],
  reviewedAt: ["reviewed_at", "approved_at"],
  createdAt: ["created_at", "createdAt", "date_created"],
  updatedAt: ["updated_at", "updatedAt", "date_updated"],
} as const;

type ResolvedColumns = {
  id: string;
  teacherUserId: string | null;
  subject: string | null;
  level: string | null;
  title: string | null;
  attachmentUrl: string | null;
  status: string | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function pick(columns: Set<string>, candidates: readonly string[]): string | null {
  for (const c of candidates) {
    if (columns.has(c)) return c;
  }
  return null;
}

function normalizeSubjectKey(value: string | null): keyof typeof SUBJECT_TABLES | null {
  if (!value) return null;
  const subject = normalizeMaterialSubject(value);
  if (!subject) return null;
  const key = subject.toLowerCase() as keyof typeof SUBJECT_TABLES;
  return SUBJECT_TABLES[key] ? key : null;
}

function selectTable(subject: keyof typeof SUBJECT_TABLES, status: "pending" | "approved") {
  return SUBJECT_TABLES[subject][status];
}

async function resolveColumns(tableName: string): Promise<ResolvedColumns | null> {
  if (!(await tableExists(tableName))) return null;
  const cols = await getTableColumns(tableName);
  const id = pick(cols, COLUMN_CANDIDATES.id);
  if (!id) return null;
  return {
    id,
    teacherUserId: pick(cols, COLUMN_CANDIDATES.teacherUserId),
    subject: pick(cols, COLUMN_CANDIDATES.subject),
    level: pick(cols, COLUMN_CANDIDATES.level),
    title: pick(cols, COLUMN_CANDIDATES.title),
    attachmentUrl: pick(cols, COLUMN_CANDIDATES.attachmentUrl),
    status: pick(cols, COLUMN_CANDIDATES.status),
    rejectionReason: pick(cols, COLUMN_CANDIDATES.rejectionReason),
    reviewedBy: pick(cols, COLUMN_CANDIDATES.reviewedBy),
    reviewedAt: pick(cols, COLUMN_CANDIDATES.reviewedAt),
    createdAt: pick(cols, COLUMN_CANDIDATES.createdAt),
    updatedAt: pick(cols, COLUMN_CANDIDATES.updatedAt),
  };
}

function buildWhere(columns: ResolvedColumns, searchParams: URLSearchParams) {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  const level = searchParams.get("level")?.trim();
  if (level && columns.level) {
    clauses.push(`LOWER(\`${columns.level}\`) = ?`);
    params.push(level.toLowerCase());
  }

  const teacherUserId = searchParams.get("teacherUserId");
  if (teacherUserId && columns.teacherUserId) {
    clauses.push(`\`${columns.teacherUserId}\` = ?`);
    params.push(Number.parseInt(teacherUserId, 10));
  }

  const statusRaw = searchParams.get("status")?.trim();
  const status = statusRaw ? normalizeMaterialStatus(statusRaw) : null;
  if (status && columns.status) {
    clauses.push(`LOWER(\`${columns.status}\`) = ?`);
    params.push(status.toLowerCase());
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { whereClause, params };
}

function mapRow(columns: ResolvedColumns, row: Record<string, any>) {
  const nowIso = new Date().toISOString();
  return {
    id: row[columns.id],
    teacherUserId: columns.teacherUserId ? row[columns.teacherUserId] ?? null : null,
    subject: columns.subject ? row[columns.subject] ?? null : null,
    level: columns.level ? row[columns.level] ?? null : null,
    title: columns.title ? row[columns.title] ?? null : null,
    description: null,
    attachmentUrl: columns.attachmentUrl ? row[columns.attachmentUrl] ?? null : null,
    status: columns.status ? row[columns.status] ?? "pending" : "pending",
    rejectionReason: columns.rejectionReason ? row[columns.rejectionReason] ?? null : null,
    reviewedBy: columns.reviewedBy ? row[columns.reviewedBy] ?? null : null,
    reviewedAt: columns.reviewedAt ? row[columns.reviewedAt] ?? null : null,
    createdAt: columns.createdAt ? row[columns.createdAt] ?? nowIso : nowIso,
    updatedAt: columns.updatedAt ? row[columns.updatedAt] ?? nowIso : nowIso,
    teacher: {
      userId: columns.teacherUserId ? row[columns.teacherUserId] ?? null : null,
      username: null,
      firstName: null,
      middleName: null,
      lastName: null,
    },
    reviewer: null,
    files: [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectKey = normalizeSubjectKey(searchParams.get("subject"));
    if (!subjectKey) {
      return NextResponse.json({ success: false, error: "Subject is required (English, Filipino, or Math)." }, { status: 400 });
    }

    const statusParam = normalizeMaterialStatus(searchParams.get("status") ?? "pending") ?? "pending";
    const tableName = selectTable(subjectKey, statusParam === "approved" ? "approved" : "pending");

    const columns = await resolveColumns(tableName);
    if (!columns) {
      return NextResponse.json({ success: true, data: [], pagination: { total: 0, page: 1, pageSize: 0, totalPages: 0 }, metadata: { table: tableName } });
    }

    const pageSize = Number(searchParams.get("pageSize")) || 10;
    const page = Number(searchParams.get("page")) || 1;
    const offset = (page - 1) * pageSize;

    const { whereClause, params } = buildWhere(columns, searchParams);

    const [countRows] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM \`${tableName}\` ${whereClause}`,
      params,
    );
    const total = Number(countRows?.[0]?.total ?? 0);

    const orderBy = columns.createdAt ? `ORDER BY \`${columns.createdAt}\` DESC` : columns.id ? `ORDER BY \`${columns.id}\` DESC` : "";

    const [rows] = await query<RowDataPacket[]>(
      `SELECT * FROM \`${tableName}\` ${whereClause} ${orderBy} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    const data = rows.map((row) => mapRow(columns, row));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      metadata: {
        table: tableName,
        subject: subjectKey,
        status: statusParam,
      },
    });
  } catch (error) {
    console.error("Failed to fetch materials", error);
    return NextResponse.json({ success: false, error: "Failed to load materials" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as any;
    const subjectKey = normalizeSubjectKey(body?.subject ?? null);
    if (!subjectKey) {
      return NextResponse.json({ success: false, error: "Invalid subject. Use English, Filipino, or Math." }, { status: 400 });
    }

    const tableName = selectTable(subjectKey, "pending");
    const columns = await resolveColumns(tableName);
    if (!columns || !columns.teacherUserId || !columns.level || !columns.title) {
      return NextResponse.json({ success: false, error: "Pending materials table is missing required columns." }, { status: 500 });
    }

    const teacherUserId = body?.teacherUserId;
    const level = typeof body?.level === "string" ? body.level.trim() : null;
    const title = typeof body?.title === "string" ? body.title.trim() : null;
    const attachmentUrl = typeof body?.attachmentUrl === "string" ? body.attachmentUrl.trim() : null;
    const status = normalizeMaterialStatus(body?.status) ?? "pending";

    if (!teacherUserId || !level || !title) {
      return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
    }

    const now = new Date();
    const insertCols: string[] = [columns.teacherUserId, columns.level, columns.title];
    const placeholders: string[] = ["?", "?", "?"];
    const values: Array<string | number | null> = [teacherUserId, level, title];

    if (columns.subject) {
      insertCols.push(columns.subject);
      placeholders.push("?");
      values.push(subjectKey);
    }

    if (columns.status) {
      insertCols.push(columns.status);
      placeholders.push("?");
      values.push(status);
    }

    if (columns.attachmentUrl) {
      insertCols.push(columns.attachmentUrl);
      placeholders.push("?");
      values.push(attachmentUrl ?? null);
    }

    if (columns.createdAt) {
      insertCols.push(columns.createdAt);
      placeholders.push("?");
      values.push(now);
    }

    if (columns.updatedAt) {
      insertCols.push(columns.updatedAt);
      placeholders.push("?");
      values.push(now);
    }

    const [result] = await query<ResultSetHeader>(
      `INSERT INTO \`${tableName}\` (${insertCols.map((c) => `\`${c}\``).join(", ")}) VALUES (${placeholders.join(", ")})`,
      values,
    );

    return NextResponse.json({ success: true, id: result.insertId, table: tableName });
  } catch (error) {
    console.error("Failed to create material", error);
    return NextResponse.json({ success: false, error: "Failed to create material" }, { status: 500 });
  }
}

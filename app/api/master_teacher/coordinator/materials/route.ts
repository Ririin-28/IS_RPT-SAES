import { NextRequest, NextResponse } from "next/server";
import { getTableColumns, query, tableExists } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";

const MATERIALS_TABLE = "remedial_materials";
const REQUEST_TABLE = "request_remedial_schedule";
const SUBJECT_TABLE = "subject";
const GRADE_TABLE = "grade";

const DATE_COLUMN_CANDIDATES = [
  "submitted_at",
  "created_at",
  "updated_at",
] as const;

const GRADE_WORD_TO_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const ROMAN_NUMERAL_TO_NUMBER: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
};

function normalizeSubject(raw?: string | null): "english" | "filipino" | "math" | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  if (text.includes("eng")) return "english";
  if (text.includes("fil")) return "filipino";
  if (text.includes("math")) return "math";
  return null;
}

function normalizeStatus(raw?: string | null): "pending" | "approved" {
  const text = raw?.trim().toLowerCase();
  if (text === "approved") return "approved";
  return "pending";
}

function pickDateColumn(columns: Set<string>): string | null {
  for (const candidate of DATE_COLUMN_CANDIDATES) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

function normalizeDateParam(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function extractGradeNumber(raw: string): number | null {
  const digitMatch = raw.match(/(\d+)/);
  if (digitMatch) {
    const parsed = Number(digitMatch[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const romanMatch = raw.match(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/i);
  if (romanMatch) {
    const mapped = ROMAN_NUMERAL_TO_NUMBER[romanMatch[1].toLowerCase()];
    return Number.isFinite(mapped) ? mapped : null;
  }

  const wordMatch = raw.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  if (wordMatch) {
    const mapped = GRADE_WORD_TO_NUMBER[wordMatch[1].toLowerCase()];
    return Number.isFinite(mapped) ? mapped : null;
  }

  return null;
}

function buildGradeTerms(raw: string): string[] {
  const terms = new Set<string>();
  const trimmed = raw.trim().toLowerCase();
  if (trimmed) {
    terms.add(trimmed);
  }

  const numeric = extractGradeNumber(trimmed);
  if (numeric !== null) {
    terms.add(String(numeric));
    terms.add(`grade ${numeric}`);
  }

  const wordMatch = trimmed.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (wordMatch) {
    terms.add(wordMatch[1]);
    terms.add(`grade ${wordMatch[1]}`);
  }

  const romanMatch = trimmed.match(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/);
  if (romanMatch) {
    terms.add(romanMatch[1]);
    terms.add(`grade ${romanMatch[1]}`);
  }

  return Array.from(terms).filter(Boolean);
}

async function safeGetColumns(tableName: string): Promise<Set<string>> {
  try {
    return await getTableColumns(tableName);
  } catch {
    return new Set<string>();
  }
}

async function resolveSubjectId(subjectKey: "english" | "filipino" | "math"): Promise<number | null> {
  const columns = await safeGetColumns(SUBJECT_TABLE);
  if (!columns.size || !columns.has("subject_id")) {
    return null;
  }

  const nameColumn = columns.has("subject_name")
    ? "subject_name"
    : columns.has("name")
      ? "name"
      : null;

  if (!nameColumn) {
    return null;
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT subject_id FROM ${SUBJECT_TABLE} WHERE LOWER(${nameColumn}) = ? LIMIT 1`,
    [subjectKey.toLowerCase()],
  );

  const subjectId = rows?.[0]?.subject_id;
  const parsed = Number(subjectId);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectParam = normalizeSubject(searchParams.get("subject"));
    const gradeParam = searchParams.get("grade")?.trim() || null;
    const statusParam = normalizeStatus(searchParams.get("status"));
    const fromParam = normalizeDateParam(searchParams.get("from"));
    const toParam = normalizeDateParam(searchParams.get("to"));
    const pageSize = Number(searchParams.get("pageSize")) || 10;
    const page = Number(searchParams.get("page")) || 1;

    if (!subjectParam) {
      return NextResponse.json({ success: false, error: "Subject is required (English, Filipino, or Math)." }, { status: 400 });
    }

    const [materialsExists, requestExists] = await Promise.all([
      tableExists(MATERIALS_TABLE),
      tableExists(REQUEST_TABLE),
    ]);

    if (!materialsExists || !requestExists) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { total: 0, page, pageSize, totalPages: 0 },
        metadata: { table: MATERIALS_TABLE, reason: "materials_or_request_table_missing" },
      });
    }

    const [materialColumns, requestColumns] = await Promise.all([
      safeGetColumns(MATERIALS_TABLE),
      safeGetColumns(REQUEST_TABLE),
    ]);

    if (!materialColumns.has("request_id") || !materialColumns.has("status")) {
      return NextResponse.json({ success: false, error: "Remedial materials table is missing required columns." }, { status: 500 });
    }

    if (!requestColumns.has("request_id")) {
      return NextResponse.json({ success: false, error: "Request schedule table is missing required columns." }, { status: 500 });
    }

    const subjectId = await resolveSubjectId(subjectParam);
    if (subjectId === null) {
      return NextResponse.json({ success: false, error: "Unable to resolve subject." }, { status: 400 });
    }

    const dateColumn = pickDateColumn(materialColumns);
    const statusValue = statusParam === "approved" ? "approved" : "pending";
    const gradeNumber = gradeParam ? extractGradeNumber(gradeParam) : null;
    const gradeTerms = gradeParam ? buildGradeTerms(gradeParam) : [];
    const gradeTableColumns = gradeParam ? await safeGetColumns(GRADE_TABLE) : new Set<string>();
    const hasGradeTable = gradeTableColumns.size > 0 && gradeTableColumns.has("grade_id");

    const whereParts: string[] = [];
    const params: Array<string | number> = [];

    whereParts.push("LOWER(rm.status) = ?");
    params.push(statusValue);

    if (requestColumns.has("subject_id")) {
      whereParts.push("rrs.subject_id = ?");
      params.push(subjectId);
    }

    if (gradeParam && requestColumns.has("grade_id")) {
      const gradeClauses: string[] = [];
      if (gradeNumber !== null) {
        gradeClauses.push("rrs.grade_id = ?");
        params.push(gradeNumber);
      }

      if (hasGradeTable && gradeTerms.length) {
        const labelColumn = gradeTableColumns.has("grade_level")
          ? "grade_level"
          : gradeTableColumns.has("grade")
            ? "grade"
            : null;

        if (labelColumn) {
          gradeTerms.forEach((term) => {
            gradeClauses.push(`LOWER(CAST(g.${labelColumn} AS CHAR)) LIKE ?`);
            params.push(`%${term}%`);
          });
        }
      }

      if (gradeClauses.length) {
        whereParts.push(`(${gradeClauses.join(" OR ")})`);
      }
    }

    if (dateColumn && (fromParam || toParam)) {
      if (fromParam) {
        whereParts.push(`DATE(rm.${dateColumn}) >= ?`);
        params.push(fromParam);
      }
      if (toParam) {
        whereParts.push(`DATE(rm.${dateColumn}) <= ?`);
        params.push(toParam);
      }
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const joins = [
      `FROM ${MATERIALS_TABLE} rm`,
      `INNER JOIN ${REQUEST_TABLE} rrs ON rrs.request_id = rm.request_id`,
      hasGradeTable ? `LEFT JOIN ${GRADE_TABLE} g ON g.grade_id = rrs.grade_id` : "",
    ].filter(Boolean).join(" ");

    const [countRows] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total ${joins} ${whereClause}`,
      params,
    );

    const total = Number(countRows?.[0]?.total ?? 0);
    const offset = (page - 1) * pageSize;

    const orderClause = dateColumn
      ? `ORDER BY rm.${dateColumn} DESC`
      : materialColumns.has("material_id")
        ? "ORDER BY rm.material_id DESC"
        : "";

    const [rows] = await query<RowDataPacket[]>(
      `SELECT rm.material_id, rm.status, rm.submitted_at, rrs.grade_id, rrs.subject_id ${joins} ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    return NextResponse.json({
      success: true,
      data: rows ?? [],
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      metadata: {
        table: MATERIALS_TABLE,
        status: statusParam,
        dateColumn,
        dateFilterApplied: Boolean(dateColumn && (fromParam || toParam)),
        gradeFilterApplied: Boolean(gradeParam),
        subjectId,
      },
    });
  } catch (error) {
    console.error("Failed to fetch materials", error);
    return NextResponse.json({ success: false, error: "Failed to load materials" }, { status: 500 });
  }
}

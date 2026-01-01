import { NextRequest, NextResponse } from "next/server";
import { getTableColumns, query, tableExists } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

export const dynamic = "force-dynamic";

const SUBJECT_TABLE_MAP: Record<string, string> = {
  english: "pending_english_materials",
  filipino: "pending_filipino_materials",
  math: "pending_math_materials",
};

const GRADE_COLUMN_CANDIDATES = [
  "grade_level",
  "grade",
  "handled_grade",
  "year_level",
  "gradeLevel",
  "gradelevel",
  "grade_section",
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

function normalizeSubject(raw?: string | null): keyof typeof SUBJECT_TABLE_MAP | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  if (text.includes("eng")) return "english";
  if (text.includes("fil")) return "filipino";
  if (text.includes("math")) return "math";
  return null;
}

function pickGradeColumn(columns: Set<string>): string | null {
  for (const candidate of GRADE_COLUMN_CANDIDATES) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }
  return null;
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectParam = normalizeSubject(searchParams.get("subject"));
    const gradeParam = searchParams.get("grade")?.trim() || null;
    const pageSize = Number(searchParams.get("pageSize")) || 10;
    const page = Number(searchParams.get("page")) || 1;

    if (!subjectParam) {
      return NextResponse.json({ success: false, error: "Subject is required (English, Filipino, or Math)." }, { status: 400 });
    }

    const tableName = SUBJECT_TABLE_MAP[subjectParam];
    if (!(await tableExists(tableName))) {
      return NextResponse.json({ success: true, data: [], pagination: { total: 0, page, pageSize, totalPages: 0 }, metadata: { table: tableName, gradeColumn: null } });
    }

    const columns = await getTableColumns(tableName);
    const gradeColumn = gradeParam ? pickGradeColumn(columns) : null;

    const whereParts: string[] = [];
    const params: Array<string | number> = [];

    if (gradeParam && gradeColumn) {
      const gradeTerms = buildGradeTerms(gradeParam);
      const gradeNumber = extractGradeNumber(gradeParam);
      const gradeExpr = `LOWER(CAST(\`${gradeColumn}\` AS CHAR))`;

      if (gradeNumber !== null) {
        whereParts.push(`CAST(\`${gradeColumn}\` AS SIGNED) = ?`);
        params.push(gradeNumber);
      }

      for (const term of gradeTerms) {
        whereParts.push(`${gradeExpr} LIKE ?`);
        params.push(`%${term}%`);
      }
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.map((p) => `(${p})`).join(" OR ")}` : "";

    const [countRows] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM \`${tableName}\` ${whereClause}`,
      params,
    );
    const total = Number(countRows?.[0]?.total ?? 0);

    const offset = (page - 1) * pageSize;

    let orderClause = "";
    if (columns.has("created_at")) {
      orderClause = "ORDER BY created_at DESC";
    } else if (columns.has("id")) {
      orderClause = "ORDER BY id DESC";
    }

    const [rows] = await query<RowDataPacket[]>(
      `SELECT * FROM \`${tableName}\` ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      metadata: {
        table: tableName,
        gradeColumn,
        gradeFilterApplied: Boolean(gradeParam && gradeColumn),
      },
    });
  } catch (error) {
    console.error("Failed to fetch materials", error);
    return NextResponse.json({ success: false, error: "Failed to load materials" }, { status: 500 });
  }
}

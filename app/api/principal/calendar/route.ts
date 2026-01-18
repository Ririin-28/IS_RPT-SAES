import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getPrincipalSessionFromCookies } from "@/lib/server/principal-session";

export const dynamic = "force-dynamic";

const APPROVED_REMEDIAL_TABLE = "approved_remedial_schedule";
const SUBJECT_TABLE = "subject";

const DATE_COLUMN_CANDIDATES = ["schedule_date", "activity_date", "date"] as const;
const TITLE_COLUMN_CANDIDATES = ["title", "activity_title", "name"] as const;
const SUBJECT_ID_COLUMN_CANDIDATES = ["subject_id", "subject"] as const;
const GRADE_COLUMN_CANDIDATES = ["grade_id", "grade", "grade_level"] as const;
const DAY_COLUMN_CANDIDATES = ["day", "day_of_week"] as const;
const ID_COLUMN_CANDIDATES = ["request_id", "id"] as const;

const pickColumn = (columns: Set<string>, candidates: readonly string[]): string | null => {
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }
  return null;
};

const parseDateValue = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

type ApprovedRow = RowDataPacket & {
  request_id: number;
  title: string | null;
  subject_id: number | null;
  subject_name?: string | null;
  grade_id: number | null;
  schedule_date: string | null;
  day: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getPrincipalSessionFromCookies();
    if (!session?.principalId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const gradeFilter = request.nextUrl.searchParams.get("grade");
    const gradeId = gradeFilter ? Number(gradeFilter.match(/(\d+)/)?.[1]) : null;

    const columns = await getTableColumns(APPROVED_REMEDIAL_TABLE).catch(() => new Set<string>());
    const idColumn = pickColumn(columns, ID_COLUMN_CANDIDATES);
    const dateColumn = pickColumn(columns, DATE_COLUMN_CANDIDATES);
    if (!idColumn || !dateColumn) {
      return NextResponse.json({ success: true, activities: [] });
    }

    const titleColumn = pickColumn(columns, TITLE_COLUMN_CANDIDATES);
    const subjectIdColumn = pickColumn(columns, SUBJECT_ID_COLUMN_CANDIDATES);
    const gradeColumn = pickColumn(columns, GRADE_COLUMN_CANDIDATES);
    const dayColumn = pickColumn(columns, DAY_COLUMN_CANDIDATES);

    if (gradeId && !gradeColumn) {
      return NextResponse.json({ success: true, activities: [] });
    }

    const selectParts = [
      `r.${idColumn} AS request_id`,
      titleColumn ? `r.${titleColumn} AS title` : "NULL AS title",
      subjectIdColumn ? `r.${subjectIdColumn} AS subject_id` : "NULL AS subject_id",
      gradeColumn ? `r.${gradeColumn} AS grade_id` : "NULL AS grade_id",
      `r.${dateColumn} AS schedule_date`,
      dayColumn ? `r.${dayColumn} AS day` : "NULL AS day",
    ];

    if (subjectIdColumn) {
      selectParts.push("s.subject_name AS subject_name");
    }

    const subjectJoin = subjectIdColumn
      ? `LEFT JOIN ${SUBJECT_TABLE} s ON s.subject_id = r.${subjectIdColumn}`
      : "";
    const whereClause = gradeId && gradeColumn ? `WHERE r.${gradeColumn} = ?` : "";

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM ${APPROVED_REMEDIAL_TABLE} r
      ${subjectJoin}
      ${whereClause}
      ORDER BY r.${dateColumn} ASC, r.${idColumn} ASC
      LIMIT 1000
    `;

    const [rows] = await query<ApprovedRow[]>(sql, gradeId && gradeColumn ? [gradeId] : []);

    const activities = rows
      .map((row) => {
        const dateValue = parseDateValue(row.schedule_date);
        if (!dateValue) {
          return null;
        }
        return {
          id: String(row.request_id),
          title: row.title ? String(row.title) : row.subject_name ? String(row.subject_name) : "Remedial Activity",
          description: null,
          date: dateValue.toISOString(),
          end: new Date(dateValue.getTime() + 60 * 60 * 1000).toISOString(),
          type: "remedial",
        };
      })
      .filter((item): item is { id: string; title: string; description: null; date: string; end: string; type: string } => item !== null);

    return NextResponse.json({ success: true, activities });
  } catch (error) {
    console.error("Failed to load principal calendar activities", error);
    return NextResponse.json({ success: false, error: "Unable to load calendar activities." }, { status: 500 });
  }
}

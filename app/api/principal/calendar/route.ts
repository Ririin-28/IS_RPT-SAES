import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getPrincipalSessionFromCookies } from "@/lib/server/principal-session";

export const dynamic = "force-dynamic";

const APPROVED_REMEDIAL_TABLE = "approved_remedial_schedule";
const SUBJECT_TABLE = "subject";
const MT_HANDLED_TABLE = "mt_coordinator_handled";
const USERS_TABLE = "users";

const DATE_COLUMN_CANDIDATES = ["schedule_date", "activity_date", "date"] as const;
const TITLE_COLUMN_CANDIDATES = ["title", "activity_title", "name"] as const;
const SUBJECT_ID_COLUMN_CANDIDATES = ["subject_id", "subject"] as const;
const GRADE_COLUMN_CANDIDATES = ["grade_id", "grade", "grade_level"] as const;
const DAY_COLUMN_CANDIDATES = ["day", "day_of_week"] as const;
const ID_COLUMN_CANDIDATES = ["request_id", "id"] as const;
const SUBMITTED_BY_COLUMN_CANDIDATES = ["submitted_by", "submittedBy"] as const;
const MASTER_TEACHER_ID_COLUMN_CANDIDATES = ["master_teacher_id", "masterTeacherId"] as const;

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
  submitted_by?: string | number | null;
  master_teacher_id?: string | number | null;
  user_name?: string | null;
  user_first_name?: string | null;
  user_middle_name?: string | null;
  user_last_name?: string | null;
  user_suffix?: string | null;
};

const buildRequesterName = (row: ApprovedRow): string | null => {
  const direct = row.user_name ? String(row.user_name).trim() : "";
  if (direct) return direct;
  const parts = [
    row.user_first_name ? String(row.user_first_name).trim() : "",
    row.user_middle_name ? String(row.user_middle_name).trim() : "",
    row.user_last_name ? String(row.user_last_name).trim() : "",
  ].filter(Boolean);
  const base = parts.join(" ").trim();
  const suffix = row.user_suffix ? String(row.user_suffix).trim() : "";
  const combined = suffix ? `${base} ${suffix}`.trim() : base;
  return combined || null;
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
    const submittedByColumn = pickColumn(columns, SUBMITTED_BY_COLUMN_CANDIDATES);
    const masterTeacherIdColumn = pickColumn(columns, MASTER_TEACHER_ID_COLUMN_CANDIDATES);

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
      submittedByColumn ? `r.${submittedByColumn} AS submitted_by` : "NULL AS submitted_by",
      masterTeacherIdColumn ? `r.${masterTeacherIdColumn} AS master_teacher_id` : "NULL AS master_teacher_id",
    ];

    if (subjectIdColumn) {
      selectParts.push("s.subject_name AS subject_name");
    }

    const userColumns = await getTableColumns(USERS_TABLE).catch(() => new Set<string>());
    const userSelectParts: string[] = [];
    const addUserColumn = (column: string, alias: string) => {
      if (userColumns.has(column)) {
        userSelectParts.push(`u.${column} AS ${alias}`);
      }
    };
    addUserColumn("name", "user_name");
    addUserColumn("first_name", "user_first_name");
    addUserColumn("middle_name", "user_middle_name");
    addUserColumn("last_name", "user_last_name");
    addUserColumn("suffix", "user_suffix");
    if (userSelectParts.length > 0) {
      selectParts.push(...userSelectParts);
    }

    const subjectJoin = subjectIdColumn
      ? `LEFT JOIN ${SUBJECT_TABLE} s ON s.subject_id = r.${subjectIdColumn}`
      : "";
     const submitterColumn = submittedByColumn ?? masterTeacherIdColumn ?? null;
     const userJoin = userColumns.has("user_code") && submitterColumn
      ? `LEFT JOIN (SELECT DISTINCT master_teacher_id FROM ${MT_HANDLED_TABLE}) mch ON mch.master_teacher_id = r.${submitterColumn}
        LEFT JOIN ${USERS_TABLE} u ON u.user_code = mch.master_teacher_id`
      : "";
    const whereClause = gradeId && gradeColumn ? `WHERE r.${gradeColumn} = ?` : "";

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM ${APPROVED_REMEDIAL_TABLE} r
      ${subjectJoin}
      ${userJoin}
      ${whereClause}
      ORDER BY r.${dateColumn} ASC, r.${idColumn} ASC
      LIMIT 1000
    `;

    const [rows] = await query<ApprovedRow[]>(sql, gradeId && gradeColumn ? [gradeId] : []);

    const uniqueByDate = new Map<
      string,
      {
        id: string;
        title: string;
        submittedBy: string | null;
        date: string;
        end: string;
        type: string;
        subject: string | null;
        gradeLevel: string | null;
        day: string | null;
      }
    >();

    for (const row of rows) {
      const dateValue = parseDateValue(row.schedule_date);
      if (!dateValue) {
        continue;
      }
      const dateKey = dateValue.toISOString().slice(0, 10);
      if (uniqueByDate.has(dateKey)) {
        continue;
      }
      const submittedByValue = row.submitted_by ?? row.master_teacher_id ?? null;
      const requesterName = buildRequesterName(row) ?? (submittedByValue ? `MT ${submittedByValue}` : null);
      uniqueByDate.set(dateKey, {
        id: String(row.request_id),
        title: row.title ? String(row.title) : row.subject_name ? String(row.subject_name) : "Remedial Activity",
        submittedBy: requesterName,
        date: dateValue.toISOString(),
        end: new Date(dateValue.getTime() + 60 * 60 * 1000).toISOString(),
        type: "remedial",
        subject: row.subject_name ? String(row.subject_name) : null,
        gradeLevel:
          row.grade_id !== null && row.grade_id !== undefined && Number.isFinite(Number(row.grade_id))
            ? `Grade ${Number(row.grade_id)}`
            : null,
        day: row.day ? String(row.day) : null,
      });
    }

    const activities = Array.from(uniqueByDate.values());

    return NextResponse.json({ success: true, activities });
  } catch (error) {
    console.error("Failed to load principal calendar activities", error);
    return NextResponse.json({ success: false, error: "Unable to load calendar activities." }, { status: 500 });
  }
}

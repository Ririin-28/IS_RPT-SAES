import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getTeacherSessionFromCookies } from "@/lib/server/teacher-session";

export const dynamic = "force-dynamic";

const APPROVED_REMEDIAL_TABLE = "approved_remedial_schedule";
const SUBJECT_TABLE = "subject";

const DATE_COLUMN_CANDIDATES = ["schedule_date", "activity_date", "date"] as const;
const TITLE_COLUMN_CANDIDATES = ["title", "activity_title", "name"] as const;
const SUBJECT_ID_COLUMN_CANDIDATES = ["subject_id", "subject"] as const;
const GRADE_COLUMN_CANDIDATES = ["grade_id", "grade", "grade_level"] as const;
const STATUS_COLUMN_CANDIDATES = ["status", "activity_status", "approval_status"] as const;
const DESCRIPTION_COLUMN_CANDIDATES = ["description", "remarks", "notes"] as const;
const DAY_COLUMN_CANDIDATES = ["day", "day_of_week"] as const;
const ID_COLUMN_CANDIDATES = ["request_id", "activity_id", "id"] as const;

const pickColumn = (columns: Set<string>, candidates: readonly string[]): string | null => {
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }
  return null;
};

const resolveGradeFromTeacherId = async (teacherId: string | null): Promise<{ gradeId: number | null; gradeLabel: string | null }> => {
  if (!teacherId) {
    return { gradeId: null, gradeLabel: null };
  }

  try {
    const [rows] = await query<RowDataPacket[]>(
      `
        SELECT th.grade_id, g.grade_level
        FROM teacher_handled th
        LEFT JOIN grade g ON g.grade_id = th.grade_id
        WHERE th.teacher_id = ?
        LIMIT 1
      `,
      [teacherId],
    );

    if (!rows.length) {
      return { gradeId: null, gradeLabel: null };
    }

    const row = rows[0];
    const gradeId = row.grade_id != null && Number.isFinite(Number(row.grade_id)) ? Number(row.grade_id) : null;
    const gradeLabel = row.grade_level ? String(row.grade_level) : gradeId ? `Grade ${gradeId}` : null;
    return { gradeId, gradeLabel };
  } catch {
    return { gradeId: null, gradeLabel: null };
  }
};

type TeacherActivity = {
  id: string;
  title: string | null;
  subject: string | null;
  grade: string | null;
  status: string | null;
  activityDate: string | null;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  day: string | null;
  sourceTable: string;
};
const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

export async function GET(request: NextRequest) {
  try {
    const gradeFilter = toNullableString(request.nextUrl.searchParams.get("grade"));
    const gradeId = gradeFilter ? Number(gradeFilter.match(/(\d+)/)?.[1]) : null;
    const session = await getTeacherSessionFromCookies();
    const sessionGrade = gradeId ? { gradeId, gradeLabel: gradeFilter } : await resolveGradeFromTeacherId(session?.teacherId ?? null);
    const effectiveGradeId = sessionGrade.gradeId ?? gradeId ?? null;
    const effectiveGradeLabel = sessionGrade.gradeLabel ?? gradeFilter ?? null;

    const columns = await getTableColumns(APPROVED_REMEDIAL_TABLE).catch(() => new Set<string>());
    const idColumn = pickColumn(columns, ID_COLUMN_CANDIDATES);
    const dateColumn = pickColumn(columns, DATE_COLUMN_CANDIDATES);
    if (!idColumn || !dateColumn) {
      return NextResponse.json({ success: true, activities: [], metadata: { gradeFilter, tables: [] } });
    }

    const titleColumn = pickColumn(columns, TITLE_COLUMN_CANDIDATES);
    const subjectIdColumn = pickColumn(columns, SUBJECT_ID_COLUMN_CANDIDATES);
    const gradeColumn = pickColumn(columns, GRADE_COLUMN_CANDIDATES);
    const statusColumn = pickColumn(columns, STATUS_COLUMN_CANDIDATES);
    const descriptionColumn = pickColumn(columns, DESCRIPTION_COLUMN_CANDIDATES);
    const dayColumn = pickColumn(columns, DAY_COLUMN_CANDIDATES);

    if (effectiveGradeId && !gradeColumn) {
      return NextResponse.json({ success: true, activities: [], metadata: { gradeFilter: effectiveGradeLabel, tables: [] } });
    }

    const selectParts = [
      `r.${idColumn} AS request_id`,
      titleColumn ? `r.${titleColumn} AS title` : "NULL AS title",
      descriptionColumn ? `r.${descriptionColumn} AS description` : "NULL AS description",
      statusColumn ? `r.${statusColumn} AS status` : "NULL AS status",
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
    const useGradeFilter = Boolean(effectiveGradeId && gradeColumn);
    const whereClause = useGradeFilter
      ? `WHERE (r.${gradeColumn} = ? OR r.${gradeColumn} = ?)`
      : "";

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM ${APPROVED_REMEDIAL_TABLE} r
      ${subjectJoin}
      ${whereClause}
      ORDER BY r.${dateColumn} DESC, r.${idColumn} DESC
      LIMIT 500
    `;

    const queryParams = useGradeFilter
      ? [effectiveGradeId, effectiveGradeLabel ?? `Grade ${effectiveGradeId}`]
      : [];
    const [rows] = await query<RowDataPacket[]>(sql, queryParams);

    const activities: TeacherActivity[] = rows.map((row) => {
      const dayName = row.day ? String(row.day) : null;
      const activityDate = row.schedule_date ? String(row.schedule_date) : null;

      const gradeLabel = row.grade_id ? `Grade ${row.grade_id}` : null;
      const subjectLabel = row.subject_name
        ? String(row.subject_name)
        : row.subject_id
        ? `Subject ${row.subject_id}`
        : null;

      return {
        id: String(row.request_id),
        title: row.title ? String(row.title) : null,
        subject: subjectLabel,
        grade: gradeLabel,
        status: row.status ? String(row.status) : null,
        activityDate,
        startTime: null,
        endTime: null,
        description: row.description ? String(row.description) : null,
        day: dayName,
        sourceTable: APPROVED_REMEDIAL_TABLE,
      } satisfies TeacherActivity;
    });

    return NextResponse.json({
      success: true,
      activities,
      metadata: {
        gradeFilter: effectiveGradeLabel,
        tables: [{ table: APPROVED_REMEDIAL_TABLE, subject: "Remedial", count: activities.length }],
      },
    });
  } catch (error) {
    console.error("Failed to load teacher calendar activities", error);
    return NextResponse.json(
      { success: false, error: "Unable to load teacher calendar activities." },
      { status: 500 },
    );
  }
}

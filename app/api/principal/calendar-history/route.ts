import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getPrincipalSessionFromCookies } from "@/lib/server/principal-session";

export const dynamic = "force-dynamic";

const APPROVED_REMEDIAL_TABLE = "approved_remedial_schedule";
const REJECTED_REMEDIAL_TABLE = "rejected_remedial_schedule";
const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
const SUBJECT_TABLE = "subject";
const MT_HANDLED_TABLE = "mt_coordinator_handled";
const USERS_TABLE = "users";

const DATE_COLUMN_CANDIDATES = ["schedule_date", "activity_date", "date"] as const;
const TITLE_COLUMN_CANDIDATES = ["title", "activity_title", "name"] as const;
const SUBJECT_ID_COLUMN_CANDIDATES = ["subject_id", "subject"] as const;
const GRADE_COLUMN_CANDIDATES = ["grade_id", "grade", "grade_level"] as const;
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

type HistoryRow = RowDataPacket & {
  request_id: number | string;
  title?: string | null;
  subject_id?: number | null;
  subject_name?: string | null;
  grade_id?: number | string | null;
  schedule_date?: string | null;
  day?: string | null;
  quarter_name?: string | null;
  submitted_by?: number | string | null;
  master_teacher_id?: number | string | null;
  submitted_at?: string | null;
  status?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  user_name?: string | null;
  user_first_name?: string | null;
  user_middle_name?: string | null;
  user_last_name?: string | null;
  user_suffix?: string | null;
};

const buildRequesterName = (row: HistoryRow): string | null => {
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

const normalizeStatusLabel = (raw: string | null | undefined, fallback: string) => {
  const trimmed = raw ? String(raw).trim() : "";
  if (!trimmed) return fallback;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const loadHistoryTable = async (tableName: string, fallbackStatus: string) => {
  const columns = await getTableColumns(tableName).catch(() => new Set<string>());
  const idColumn = pickColumn(columns, ID_COLUMN_CANDIDATES);
  const dateColumn = pickColumn(columns, DATE_COLUMN_CANDIDATES);
  if (!idColumn || !dateColumn) {
    return [] as HistoryRow[];
  }

  const titleColumn = pickColumn(columns, TITLE_COLUMN_CANDIDATES);
  const subjectIdColumn = pickColumn(columns, SUBJECT_ID_COLUMN_CANDIDATES);
  const gradeColumn = pickColumn(columns, GRADE_COLUMN_CANDIDATES);
  const dayColumn = pickColumn(columns, DAY_COLUMN_CANDIDATES);

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

  const selectParts = [
    `r.${idColumn} AS request_id`,
    titleColumn ? `r.${titleColumn} AS title` : "NULL AS title",
    subjectIdColumn ? `r.${subjectIdColumn} AS subject_id` : "NULL AS subject_id",
    gradeColumn ? `r.${gradeColumn} AS grade_id` : "NULL AS grade_id",
    `r.${dateColumn} AS schedule_date`,
    dayColumn ? `r.${dayColumn} AS day` : "NULL AS day",
  ];

  if (columns.has("quarter_id")) {
    selectParts.push("r.quarter_id AS quarter_id");
  }
  if (columns.has("submitted_by")) {
    selectParts.push("r.submitted_by AS submitted_by");
  }
  if (columns.has("master_teacher_id")) {
    selectParts.push("r.master_teacher_id AS master_teacher_id");
  }
  if (columns.has("submitted_at")) {
    selectParts.push("r.submitted_at AS submitted_at");
  }
  if (columns.has("status")) {
    selectParts.push("r.status AS status");
  }
  if (columns.has("approved_by")) {
    selectParts.push("r.approved_by AS approved_by");
  }
  if (columns.has("approved_at")) {
    selectParts.push("r.approved_at AS approved_at");
  }
  if (columns.has("rejected_by")) {
    selectParts.push("r.rejected_by AS rejected_by");
  }
  if (columns.has("rejected_at")) {
    selectParts.push("r.rejected_at AS rejected_at");
  }
  if (columns.has("rejection_reason")) {
    selectParts.push("r.rejection_reason AS rejection_reason");
  }

  if (subjectIdColumn) {
    selectParts.push("s.subject_name AS subject_name");
  }
  if (columns.has("quarter_id")) {
    selectParts.push("rq.quarter_name AS quarter_name");
  }

  const subjectJoin = subjectIdColumn
    ? `LEFT JOIN ${SUBJECT_TABLE} s ON s.subject_id = r.${subjectIdColumn}`
    : "";
  const quarterJoin = columns.has("quarter_id")
    ? `LEFT JOIN ${REMEDIAL_QUARTER_TABLE} rq ON rq.quarter_id = r.quarter_id`
    : "";

  const userJoinSql = userColumns.has("user_code")
    ? `LEFT JOIN (SELECT DISTINCT master_teacher_id FROM ${MT_HANDLED_TABLE}) mch ON mch.master_teacher_id = r.submitted_by
       LEFT JOIN ${USERS_TABLE} u ON u.user_code = mch.master_teacher_id`
    : "";

  const userSelectSql = userSelectParts.length ? `, ${userSelectParts.join(", ")}` : "";

  const sql = `
    SELECT
      ${selectParts.join(", ")}
      ${userSelectSql}
    FROM ${tableName} r
    ${quarterJoin}
    ${subjectJoin}
    ${userJoinSql}
    ORDER BY r.${dateColumn} DESC, r.${idColumn} DESC
    LIMIT 500
  `;

  const [rows] = await query<HistoryRow[]>(sql);
  return rows.map((row) => ({ ...row, status: row.status ?? fallbackStatus }));
};

export async function GET() {
  try {
    const session = await getPrincipalSessionFromCookies();
    if (!session?.principalId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const approvedRows = await loadHistoryTable(APPROVED_REMEDIAL_TABLE, "Approved");
    const rejectedRows = await loadHistoryTable(REJECTED_REMEDIAL_TABLE, "Rejected");

    const grouped = new Map<string, HistoryRow[]>();
    for (const row of [...approvedRows, ...rejectedRows]) {
      const submitterId = row.submitted_by ?? row.master_teacher_id ?? null;
      const key = submitterId
        ? `requester-${submitterId}`
        : row.submitted_at
        ? String(row.submitted_at)
        : `request-${row.request_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    const requests = Array.from(grouped.entries()).map(([groupKey, groupRows]) => {
      const row = groupRows[0];
      const statusLabel = normalizeStatusLabel(row.status, "Approved");
      const requesterName = buildRequesterName(row);
      const requesterId = row.submitted_by ? String(row.submitted_by) : row.master_teacher_id ? String(row.master_teacher_id) : null;
      const requestedDate = row.submitted_at
        ? new Date(String(row.submitted_at)).toISOString().slice(0, 10)
        : (row.schedule_date ? String(row.schedule_date) : null);

      const activitiesPlan = groupRows.map((entry) => {
        const activityDate = entry.schedule_date ? String(entry.schedule_date) : null;
        const gradeLabel = entry.grade_id ? `Grade ${entry.grade_id}` : null;
        const subjectLabel = entry.subject_name
          ? String(entry.subject_name)
          : entry.subject_id
          ? `Subject ${entry.subject_id}`
          : null;
        return {
          title: entry.title ? String(entry.title) : null,
          description: entry.rejection_reason ? String(entry.rejection_reason) : null,
          activityDate,
          startTime: null,
          endTime: null,
          day: entry.day ? String(entry.day) : null,
          quarter: entry.quarter_name ? String(entry.quarter_name) : null,
          subject: subjectLabel,
          grade: gradeLabel,
        };
      });

      const uniqueSubjects = new Set(activitiesPlan.map((item) => item.subject).filter(Boolean));
      const uniqueGrades = new Set(activitiesPlan.map((item) => item.grade).filter(Boolean));
      const uniqueQuarters = new Set(activitiesPlan.map((item) => item.quarter).filter(Boolean));

      const approver = row.approved_by ?? row.rejected_by ?? null;
      const updatedAt = row.approved_at ?? row.rejected_at ?? row.submitted_at ?? null;

      return {
        id: String(row.request_id),
        title: row.title ? String(row.title) : null,
        requester: requesterName ?? (requesterId ? `MT ${requesterId}` : null),
        requesterId,
        grade: uniqueGrades.size === 1 ? Array.from(uniqueGrades)[0] : null,
        subject: uniqueSubjects.size === 1 ? Array.from(uniqueSubjects)[0] : null,
        quarter: uniqueQuarters.size === 1 ? Array.from(uniqueQuarters)[0] : null,
        status: statusLabel,
        requestedDate,
        requestedTimestamp: row.submitted_at ? new Date(String(row.submitted_at)).getTime() : null,
        type: "Remedial",
        description: row.rejection_reason ? String(row.rejection_reason) : null,
        startDate: requestedDate,
        endDate: requestedDate,
        approvedAt: updatedAt ? String(updatedAt) : null,
        approvedBy: approver ? String(approver) : null,
        updatedAt: updatedAt ? String(updatedAt) : null,
        displayLabel: "Remedial Schedule",
        displayStatus: statusLabel,
        sourceTable: row.status && row.status.toLowerCase().includes("reject") ? REJECTED_REMEDIAL_TABLE : APPROVED_REMEDIAL_TABLE,
        relatedRowIds: groupRows.slice(1).map((entry) => String(entry.request_id)),
        planBatchId: groupKey,
        activitiesPlan,
      };
    });

    const sorted = requests.sort((a, b) => (b.requestedTimestamp ?? 0) - (a.requestedTimestamp ?? 0));

    return NextResponse.json({ success: true, requests: sorted });
  } catch (error) {
    console.error("Failed to load principal calendar history", error);
    return NextResponse.json({ success: false, error: "Unable to load calendar history." }, { status: 500 });
  }
}

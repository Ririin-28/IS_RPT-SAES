import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { DbConnection } from "@/lib/server/emergency-access";
import { getTableColumns } from "@/lib/db";

export const REQUEST_REMEDIAL_TABLE = "request_remedial_schedule";
export const APPROVED_REMEDIAL_TABLE = "approved_remedial_schedule";
export const REJECTED_REMEDIAL_TABLE = "rejected_remedial_schedule";
export const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
export const SUBJECT_TABLE = "subject";
export const MT_HANDLED_TABLE = "mt_coordinator_handled";
export const USERS_TABLE = "users";

const ID_COLUMN_CANDIDATES = ["request_id", "activity_id", "id"] as const;

const pickColumn = (columns: Set<string>, candidates: readonly string[]): string | null => {
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }
  return null;
};

export async function listPendingPrincipalRequests(db: DbConnection): Promise<RowDataPacket[]> {
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

  const userSelectSql = userSelectParts.length ? `, ${userSelectParts.join(", ")}` : "";
  const userJoinSql = userColumns.has("user_code")
    ? `LEFT JOIN (SELECT DISTINCT master_teacher_id FROM ${MT_HANDLED_TABLE}) mch ON mch.master_teacher_id = r.submitted_by
       LEFT JOIN ${USERS_TABLE} u ON u.user_code = mch.master_teacher_id`
    : "";

  const sql = `
    SELECT
      r.request_id,
      r.title,
      r.status,
      r.submitted_at,
      r.subject_id,
      s.subject_name,
      r.grade_id,
      r.submitted_by,
      r.schedule_date,
      r.day,
      rq.quarter_name
      ${userSelectSql}
    FROM ${REQUEST_REMEDIAL_TABLE} r
    LEFT JOIN ${REMEDIAL_QUARTER_TABLE} rq ON rq.quarter_id = r.quarter_id
    LEFT JOIN ${SUBJECT_TABLE} s ON s.subject_id = r.subject_id
    ${userJoinSql}
    WHERE COALESCE(r.status, 'Pending') = 'Pending'
    ORDER BY r.submitted_at ASC, r.request_id ASC
    LIMIT 500
  `;

  const [rows] = await db.query<RowDataPacket[]>(sql);
  return rows;
}

async function ensurePendingRequestForUpdate(
  db: DbConnection,
  requestId: number,
): Promise<{ row: RowDataPacket; requestCols: Set<string>; requestIdColumn: string }> {
  const requestCols = await getTableColumns(REQUEST_REMEDIAL_TABLE).catch(() => new Set<string>());
  const requestIdColumn = pickColumn(requestCols, ID_COLUMN_CANDIDATES);
  if (!requestIdColumn) {
    throw new Error("Unable to resolve request identifier column.");
  }

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM ${REQUEST_REMEDIAL_TABLE} WHERE ${requestIdColumn} = ? LIMIT 1 FOR UPDATE`,
    [requestId],
  );
  const row = rows[0];
  if (!row) {
    throw new Error("REQUEST_NOT_FOUND");
  }

  const status = typeof row.status === "string" ? row.status : "Pending";
  if (status !== "Pending") {
    throw new Error("REQUEST_NOT_PENDING");
  }

  return { row, requestCols, requestIdColumn };
}

export async function approvePendingRequest(
  db: DbConnection,
  requestId: number,
): Promise<{ previous: string; current: string }> {
  const { requestCols, requestIdColumn } = await ensurePendingRequestForUpdate(db, requestId);

  const baseColumns = [
    "quarter_id",
    "schedule_date",
    "day",
    "subject_id",
    "grade_id",
    "title",
    "submitted_by",
    "master_teacher_id",
    "status",
    "submitted_at",
  ];

  const approvedCols = await getTableColumns(APPROVED_REMEDIAL_TABLE).catch(() => new Set<string>());
  const approvedIdColumn = pickColumn(approvedCols, ID_COLUMN_CANDIDATES);
  const insertCols = baseColumns.filter((col) => approvedCols.has(col) && requestCols.has(col));
  if (approvedIdColumn && requestIdColumn && !insertCols.includes(approvedIdColumn)) {
    insertCols.unshift(approvedIdColumn);
  }

  const selectCols = insertCols.map((col) => {
    if (col === "status") {
      return "'Approved'";
    }
    if (approvedIdColumn && requestIdColumn && col === approvedIdColumn) {
      return `r.${requestIdColumn}`;
    }
    return `r.${col}`;
  });

  const dedupeChecks: string[] = [];
  if (approvedIdColumn && requestIdColumn) {
    dedupeChecks.push(`a.${approvedIdColumn} = r.${requestIdColumn}`);
  }
  if (approvedCols.has("schedule_date") && requestCols.has("schedule_date")) {
    dedupeChecks.push("a.schedule_date = r.schedule_date");
  }
  if (approvedCols.has("subject_id") && requestCols.has("subject_id")) {
    dedupeChecks.push("a.subject_id = r.subject_id");
  }
  if (approvedCols.has("grade_id") && requestCols.has("grade_id")) {
    dedupeChecks.push("a.grade_id = r.grade_id");
  }

  const dedupeClause = dedupeChecks.length
    ? `AND NOT EXISTS (SELECT 1 FROM ${APPROVED_REMEDIAL_TABLE} a WHERE ${dedupeChecks.join(" AND ")})`
    : "";

  await db.execute<ResultSetHeader>(
    `INSERT INTO ${APPROVED_REMEDIAL_TABLE} (${insertCols.join(", ")})
     SELECT ${selectCols.join(", ")}
     FROM ${REQUEST_REMEDIAL_TABLE} r
     WHERE r.${requestIdColumn} = ?
     ${dedupeClause}`,
    [requestId],
  );

  await db.execute<ResultSetHeader>(
    `DELETE FROM ${REQUEST_REMEDIAL_TABLE} WHERE ${requestIdColumn} = ? LIMIT 1`,
    [requestId],
  );

  return { previous: "Pending", current: "Approved" };
}

export async function rejectPendingRequest(
  db: DbConnection,
  requestId: number,
  rejectionReason: string,
  rejectedBy: string,
): Promise<{ previous: string; current: string }> {
  const { requestCols, requestIdColumn } = await ensurePendingRequestForUpdate(db, requestId);

  const baseColumns = [
    "quarter_id",
    "schedule_date",
    "day",
    "subject_id",
    "grade_id",
    "title",
    "submitted_by",
    "master_teacher_id",
    "status",
    "submitted_at",
  ];

  const rejectedCols = await getTableColumns(REJECTED_REMEDIAL_TABLE).catch(() => new Set<string>());
  const rejectedIdColumn = pickColumn(rejectedCols, ID_COLUMN_CANDIDATES);
  const insertCols = baseColumns.filter((col) => rejectedCols.has(col) && requestCols.has(col));
  if (rejectedIdColumn && requestIdColumn && !insertCols.includes(rejectedIdColumn)) {
    insertCols.unshift(rejectedIdColumn);
  }

  const extraCols: string[] = [];
  const selectExtras: string[] = [];
  const params: Array<string> = [];

  if (rejectedCols.has("rejection_reason")) {
    extraCols.push("rejection_reason");
    selectExtras.push("?");
    params.push(rejectionReason);
  }
  if (rejectedCols.has("rejected_by")) {
    extraCols.push("rejected_by");
    selectExtras.push("?");
    params.push(rejectedBy);
  }
  if (rejectedCols.has("rejected_at")) {
    extraCols.push("rejected_at");
    selectExtras.push("NOW()");
  }

  const selectCols = insertCols.map((col) => {
    if (col === "status") {
      return "'Rejected'";
    }
    if (rejectedIdColumn && requestIdColumn && col === rejectedIdColumn) {
      return `r.${requestIdColumn}`;
    }
    return `r.${col}`;
  });

  const dedupeChecks: string[] = [];
  if (rejectedIdColumn && requestIdColumn) {
    dedupeChecks.push(`rr.${rejectedIdColumn} = r.${requestIdColumn}`);
  }
  if (rejectedCols.has("schedule_date") && requestCols.has("schedule_date")) {
    dedupeChecks.push("rr.schedule_date = r.schedule_date");
  }
  if (rejectedCols.has("subject_id") && requestCols.has("subject_id")) {
    dedupeChecks.push("rr.subject_id = r.subject_id");
  }
  if (rejectedCols.has("grade_id") && requestCols.has("grade_id")) {
    dedupeChecks.push("rr.grade_id = r.grade_id");
  }

  const dedupeClause = dedupeChecks.length
    ? `AND NOT EXISTS (SELECT 1 FROM ${REJECTED_REMEDIAL_TABLE} rr WHERE ${dedupeChecks.join(" AND ")})`
    : "";

  await db.execute<ResultSetHeader>(
    `INSERT INTO ${REJECTED_REMEDIAL_TABLE} (${[...insertCols, ...extraCols].join(", ")})
     SELECT ${[...selectCols, ...selectExtras].join(", ")}
     FROM ${REQUEST_REMEDIAL_TABLE} r
     WHERE r.${requestIdColumn} = ?
     ${dedupeClause}`,
    [...params, requestId],
  );

  await db.execute<ResultSetHeader>(
    `DELETE FROM ${REQUEST_REMEDIAL_TABLE} WHERE ${requestIdColumn} = ? LIMIT 1`,
    [requestId],
  );

  return { previous: "Pending", current: "Rejected" };
}

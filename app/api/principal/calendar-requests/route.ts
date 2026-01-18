import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getPrincipalSessionFromCookies } from "@/lib/server/principal-session";

export const dynamic = "force-dynamic";

const REQUEST_REMEDIAL_TABLE = "request_remedial_schedule";
const APPROVED_REMEDIAL_TABLE = "approved_remedial_schedule";
const REJECTED_REMEDIAL_TABLE = "rejected_remedial_schedule";
const REMEDIAL_QUARTER_TABLE = "remedial_quarter";
const SUBJECT_TABLE = "subject";
const MT_HANDLED_TABLE = "mt_coordinator_handled";
const USERS_TABLE = "users";
const PRINCIPAL_TABLE_CANDIDATES = ["principal", "principals", "principal_info", "principal_profile", "principal_profiles"] as const;

type UpdateAction = "approve" | "reject";

const ACTION_STATUS_LABEL: Record<UpdateAction, string> = {
  approve: "Approved",
  reject: "Rejected",
};

export async function GET() {
  try {
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
      ORDER BY r.submitted_at DESC, r.request_id DESC
      LIMIT 500
    `;

    const [rows] = await query<RowDataPacket[]>(sql);
    const buildRequesterName = (row: RowDataPacket): string | null => {
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

    const grouped = new Map<string, RowDataPacket[]>();
    for (const row of rows) {
      const key = row.submitted_by ? `requester-${row.submitted_by}` : (row.submitted_at ? String(row.submitted_at) : `request-${row.request_id}`);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    const requests = Array.from(grouped.entries()).map(([groupKey, groupRows]) => {
      const row = groupRows[0];
      const statusLabel = row.status ? String(row.status) : "Pending";
      const requesterName = buildRequesterName(row);
      const requesterId = row.submitted_by ? String(row.submitted_by) : null;
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
          description: null,
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
        description: null,
        startDate: requestedDate,
        endDate: requestedDate,
        approvedAt: null,
        approvedBy: null,
        updatedAt: row.submitted_at ? String(row.submitted_at) : null,
        displayLabel: "Remedial Schedule",
        displayStatus: statusLabel,
        sourceTable: REQUEST_REMEDIAL_TABLE,
        relatedRowIds: groupRows.slice(1).map((entry) => String(entry.request_id)),
        planBatchId: groupKey,
        activitiesPlan,
      };
    });

    return NextResponse.json({
      success: true,
      requests,
      metadata: {
        sources: [REQUEST_REMEDIAL_TABLE],
      },
    });
  } catch (error) {
    console.error("Failed to load principal calendar requests", error);
    return NextResponse.json(
      { success: false, error: "Unable to load calendar requests." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getPrincipalSessionFromCookies();
    if (!session?.principalId) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as {
      requestId?: string | number;
      sourceTable?: string;
      action?: string;
      relatedRowIds?: Array<string | number | null>;
      approverName?: string | null;
      rejectionReason?: string | null;
    } | null;

    const requestId = payload?.requestId;
    const sourceTable = payload?.sourceTable;
    const actionRaw = payload?.action ?? "";

    if (!requestId || !sourceTable || sourceTable !== REQUEST_REMEDIAL_TABLE) {
      return NextResponse.json({ success: false, error: "Invalid request target." }, { status: 400 });
    }

    const normalizedAction = actionRaw.toLowerCase() as UpdateAction;
    if (!Object.prototype.hasOwnProperty.call(ACTION_STATUS_LABEL, normalizedAction)) {
      return NextResponse.json({ success: false, error: "Unsupported action." }, { status: 400 });
    }

    if (normalizedAction === "reject") {
      const rejectionText = payload?.rejectionReason ? String(payload.rejectionReason).trim() : "";
      if (!rejectionText) {
        return NextResponse.json({ success: false, error: "Rejection reason is required." }, { status: 400 });
      }
    }

    const targetIds = new Set<string>();
    targetIds.add(String(requestId));

    if (Array.isArray(payload?.relatedRowIds)) {
      for (const related of payload.relatedRowIds) {
        if (related === null || related === undefined) {
          continue;
        }
        const text = String(related).trim();
        if (text.length) {
          targetIds.add(text);
        }
      }
    }

    const desiredLabel = ACTION_STATUS_LABEL[normalizedAction];
    const requestIds = Array.from(targetIds);

    const usersColumns = await getTableColumns(USERS_TABLE).catch(() => new Set<string>());
    let approverName = payload?.approverName ? String(payload.approverName).trim() : "";
    if (!approverName) {
      const [userRows] = await query<RowDataPacket[]>(
        `SELECT first_name, middle_name, last_name, suffix, name FROM ${USERS_TABLE} WHERE user_code = ? LIMIT 1`,
        [session.principalId],
      );
      const user = userRows[0] ?? null;
      if (user) {
        const direct = user.name ? String(user.name).trim() : "";
        if (direct) {
          approverName = direct;
        } else {
          const parts = [user.first_name, user.middle_name, user.last_name]
            .map((part) => (part ? String(part).trim() : ""))
            .filter(Boolean);
          const suffix = user.suffix ? String(user.suffix).trim() : "";
          approverName = [...parts, suffix].filter(Boolean).join(" ").trim();
        }
      }
    }
    if (!approverName) {
      approverName = "Principal";
    }

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

    if (normalizedAction === "approve") {
      const approvedCols = await getTableColumns(APPROVED_REMEDIAL_TABLE).catch(() => new Set<string>());
      const insertCols = baseColumns.filter((col) => approvedCols.has(col));
      const selectCols = insertCols.map((col) => (col === "status" ? `"Approved"` : `r.${col}`));
      const insertSql = `
        INSERT INTO ${APPROVED_REMEDIAL_TABLE} (${insertCols.join(", ")})
        SELECT ${selectCols.join(", ")}
        FROM ${REQUEST_REMEDIAL_TABLE} r
        WHERE r.request_id IN (${requestIds.map(() => "?").join(", ")})
      `;
      await query<ResultSetHeader>(insertSql, requestIds);
    } else {
      const rejectedCols = await getTableColumns(REJECTED_REMEDIAL_TABLE).catch(() => new Set<string>());
      const rejectionReason = payload?.rejectionReason ? String(payload.rejectionReason).trim() : "Rejected by principal";
      const insertCols = baseColumns.filter((col) => rejectedCols.has(col));
      const extraCols: string[] = [];
      const selectExtras: string[] = [];
      if (rejectedCols.has("rejection_reason")) {
        extraCols.push("rejection_reason");
        selectExtras.push("?");
      }
      if (rejectedCols.has("rejected_by")) {
        extraCols.push("rejected_by");
        selectExtras.push("?");
      }
      if (rejectedCols.has("rejected_at")) {
        extraCols.push("rejected_at");
        selectExtras.push("NOW()");
      }
      const allCols = [...insertCols, ...extraCols];
      const selectCols = insertCols.map((col) => (col === "status" ? `"Rejected"` : `r.${col}`));
      const insertSql = `
        INSERT INTO ${REJECTED_REMEDIAL_TABLE} (${allCols.join(", ")})
        SELECT ${[...selectCols, ...selectExtras].join(", ")}
        FROM ${REQUEST_REMEDIAL_TABLE} r
        WHERE r.request_id IN (${requestIds.map(() => "?").join(", ")})
      `;
      const params = [...(rejectedCols.has("rejection_reason") ? [rejectionReason] : []), ...(rejectedCols.has("rejected_by") ? [approverName] : [])];
      await query<ResultSetHeader>(insertSql, [...params, ...requestIds]);
    }

    await query<ResultSetHeader>(
      `DELETE FROM ${REQUEST_REMEDIAL_TABLE} WHERE request_id IN (${requestIds.map(() => "?").join(", ")})`,
      requestIds,
    );

    return NextResponse.json({ success: true, status: desiredLabel });
  } catch (error) {
    console.error("Failed to update request status", error);
    return NextResponse.json({ success: false, error: "Unable to update request status." }, { status: 500 });
  }
}


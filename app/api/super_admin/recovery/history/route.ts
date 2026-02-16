import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";

export const dynamic = "force-dynamic";

type CountRow = RowDataPacket & { total: number };

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(max, Math.floor(parsed));
}

function safeParseJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:logs.view" });
  if (!auth.ok) {
    return auth.response;
  }

  const params = request.nextUrl.searchParams;
  const page = parsePositiveInt(params.get("page"), 1, 100000);
  const pageSize = parsePositiveInt(params.get("pageSize"), 20, 100);
  const offset = (page - 1) * pageSize;
  const entity = String(params.get("entity") ?? "").trim().toLowerCase();
  const actionType = String(params.get("actionType") ?? "").trim().toLowerCase(); // restore|delete|archive|all

  try {
    const result = await runWithConnection(async (connection) => {
      let columns: Set<string>;
      try {
        const [colRows] = await connection.query<RowDataPacket[]>("SHOW COLUMNS FROM `security_audit_logs`");
        columns = new Set(colRows.map((row) => String(row.Field)));
      } catch {
        return { total: 0, rows: [] as RowDataPacket[], missingTable: true };
      }

      if (!columns.has("action")) {
        throw new Error("security_audit_logs.action column is missing.");
      }

      const whereParts: string[] = [
        "(" +
          [
            "action LIKE 'emergency_restore_%'",
            "action = 'archive_restore_users'",
            "action = 'archive_delete_users'",
          ].join(" OR ") +
          ")",
      ];
      const whereValues: Array<string | number> = [];

      if (entity) {
        whereParts.push("(action LIKE ? OR details LIKE ?)");
        whereValues.push(`%${entity}%`, `%\"entity\":\"${entity}\"%`);
      }

      if (actionType && actionType !== "all") {
        if (actionType === "restore") {
          whereParts.push("action LIKE '%restore%'");
        } else if (actionType === "delete") {
          whereParts.push("action LIKE '%delete%'");
        } else if (actionType === "archive") {
          whereParts.push("action LIKE '%archive%'");
        }
      }

      const whereSql = whereParts.join(" AND ");

      const [countRows] = await connection.query<CountRow[]>(
        `SELECT COUNT(*) AS total FROM security_audit_logs WHERE ${whereSql}`,
        whereValues,
      );
      const total = Number(countRows[0]?.total ?? 0);

      const selectParts = [
        columns.has("log_id") ? "log_id" : "NULL AS log_id",
        columns.has("action") ? "action" : "NULL AS action",
        columns.has("user_id") ? "user_id" : "NULL AS user_id",
        columns.has("ip_address") ? "ip_address" : "NULL AS ip_address",
        columns.has("details") ? "details" : "NULL AS details",
        columns.has("created_at") ? "created_at" : "NULL AS created_at",
      ];

      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT ${selectParts.join(", ")}
         FROM security_audit_logs
         WHERE ${whereSql}
         ORDER BY ${columns.has("created_at") ? "created_at" : "log_id"} DESC
         LIMIT ? OFFSET ?`,
        [...whereValues, pageSize, offset],
      );

      return { total, rows, missingTable: false };
    });

    if (result.missingTable) {
      return NextResponse.json({
        success: true,
        pagination: { page, pageSize, total: 0, totalPages: 1 },
        records: [],
        metadata: { missingTable: "security_audit_logs" },
      });
    }

    const records = result.rows.map((row) => ({
      logId: Number(row.log_id ?? 0),
      action: row.action ? String(row.action) : null,
      userId: row.user_id ? String(row.user_id) : null,
      ipAddress: row.ip_address ? String(row.ip_address) : null,
      createdAt: row.created_at ? new Date(row.created_at as string | Date).toISOString() : null,
      details: safeParseJson(row.details),
    }));

    return NextResponse.json({
      success: true,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
      },
      records,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load recovery history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

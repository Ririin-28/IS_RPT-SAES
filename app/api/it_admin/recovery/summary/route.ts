import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";
import { RECOVERY_ENTITIES, modeFlagColumn, modeTimeColumn } from "@/lib/server/recovery-center";

export const dynamic = "force-dynamic";

type CountRow = RowDataPacket & { total: number };

export async function GET(request: Request): Promise<Response> {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:data.restore" });
  if (!auth.ok) {
    return auth.response;
  }

  const counts: Array<{ entity: string; table: string; totalRecoverable: number }> = [];
  const unavailable: Array<{ entity: string; reason: string }> = [];

  for (const entity of RECOVERY_ENTITIES) {
    const hasTable = await tableExists(entity.table);
    if (!hasTable) {
      unavailable.push({ entity: entity.key, reason: `Table '${entity.table}' not found.` });
      continue;
    }

    const columns = await getTableColumns(entity.table);
    const statusColumn = modeFlagColumn(entity.mode);
    if (!columns.has(statusColumn)) {
      unavailable.push({ entity: entity.key, reason: `Column '${statusColumn}' not found in '${entity.table}'.` });
      continue;
    }

    const [rows] = await query<CountRow[]>(
      `SELECT COUNT(*) AS total FROM \`${entity.table}\` WHERE \`${statusColumn}\` = 1`,
    );

    counts.push({
      entity: entity.key,
      table: entity.table,
      totalRecoverable: Number(rows[0]?.total ?? 0),
    });
  }

  const recent: Array<{ entity: string; id: string | number; occurredAt: string | null }> = [];
  for (const entity of RECOVERY_ENTITIES) {
    if (recent.length >= 20) {
      break;
    }

    const hasTable = await tableExists(entity.table);
    if (!hasTable) {
      continue;
    }
    const columns = await getTableColumns(entity.table);
    const statusColumn = modeFlagColumn(entity.mode);
    const timeColumn = modeTimeColumn(entity.mode);
    if (!columns.has(statusColumn) || !columns.has(entity.idColumn)) {
      continue;
    }

    const selectTime = columns.has(timeColumn) ? `\`${timeColumn}\`` : "NULL";
    const [rows] = await query<RowDataPacket[]>(
      `SELECT \`${entity.idColumn}\` AS entity_id, ${selectTime} AS occurred_at
       FROM \`${entity.table}\`
       WHERE \`${statusColumn}\` = 1
       ORDER BY ${columns.has(timeColumn) ? `\`${timeColumn}\`` : `\`${entity.idColumn}\``} DESC
       LIMIT 3`,
    );

    for (const row of rows) {
      recent.push({
        entity: entity.key,
        id: (row.entity_id as string | number) ?? "",
        occurredAt: row.occurred_at ? new Date(row.occurred_at as string | Date).toISOString() : null,
      });
    }
  }

  return NextResponse.json({
    success: true,
    counts,
    recent: recent.slice(0, 20),
    unavailable,
  });
}

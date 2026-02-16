import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";
import {
  archiveRoleFiltersForEntity,
  isArchiveBackedAccountEntity,
  normalizeRoleToken,
  RECOVERY_ENTITIES,
  modeFlagColumn,
  modeTimeColumn,
} from "@/lib/server/recovery-center";

export const dynamic = "force-dynamic";
const ARCHIVE_USERS_TABLE = "archived_users";

type CountRow = RowDataPacket & { total: number };

export async function GET(request: Request): Promise<Response> {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:data.restore" });
  if (!auth.ok) {
    return auth.response;
  }

  const counts: Array<{ entity: string; table: string; totalRecoverable: number }> = [];
  const unavailable: Array<{ entity: string; reason: string }> = [];

  for (const entity of RECOVERY_ENTITIES) {
    if (isArchiveBackedAccountEntity(entity.key)) {
      const hasArchiveTable = await tableExists(ARCHIVE_USERS_TABLE);
      if (!hasArchiveTable) {
        unavailable.push({ entity: entity.key, reason: `Table '${ARCHIVE_USERS_TABLE}' not found.` });
        continue;
      }

      const archiveColumns = await getTableColumns(ARCHIVE_USERS_TABLE);
      const roleFilters = archiveRoleFiltersForEntity(entity.key);
      if (roleFilters.length === 0) {
        counts.push({ entity: entity.key, table: ARCHIVE_USERS_TABLE, totalRecoverable: 0 });
        continue;
      }

      try {
        if (archiveColumns.has("role")) {
          const placeholders = roleFilters.map(() => "?").join(", ");
          const [rows] = await query<CountRow[]>(
            `SELECT COUNT(*) AS total
             FROM \`${ARCHIVE_USERS_TABLE}\`
             WHERE LOWER(REPLACE(REPLACE(TRIM(role), '-', '_'), ' ', '_')) IN (${placeholders})`,
            roleFilters,
          );
          counts.push({
            entity: entity.key,
            table: ARCHIVE_USERS_TABLE,
            totalRecoverable: Number(rows[0]?.total ?? 0),
          });
          continue;
        }

        if (archiveColumns.has("role_id")) {
          const [roleRows] = await query<RowDataPacket[]>(
            "SELECT role_id, role_name FROM role WHERE role_id IS NOT NULL AND role_name IS NOT NULL",
          );
          const roleIds = roleRows
            .map((row) => ({
              roleId: Number(row.role_id),
              roleName: normalizeRoleToken(String(row.role_name ?? "")),
            }))
            .filter((row) => Number.isFinite(row.roleId) && roleFilters.includes(row.roleName))
            .map((row) => row.roleId);

          if (roleIds.length === 0) {
            counts.push({ entity: entity.key, table: ARCHIVE_USERS_TABLE, totalRecoverable: 0 });
            continue;
          }

          const placeholders = roleIds.map(() => "?").join(", ");
          const [rows] = await query<CountRow[]>(
            `SELECT COUNT(*) AS total FROM \`${ARCHIVE_USERS_TABLE}\` WHERE role_id IN (${placeholders})`,
            roleIds,
          );
          counts.push({
            entity: entity.key,
            table: ARCHIVE_USERS_TABLE,
            totalRecoverable: Number(rows[0]?.total ?? 0),
          });
          continue;
        }

        unavailable.push({
          entity: entity.key,
          reason: `Columns 'role'/'role_id' not found in '${ARCHIVE_USERS_TABLE}'.`,
        });
      } catch (error) {
        unavailable.push({
          entity: entity.key,
          reason: error instanceof Error ? error.message : "Failed to count archived entries.",
        });
      }
      continue;
    }

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

    if (isArchiveBackedAccountEntity(entity.key)) {
      const hasArchiveTable = await tableExists(ARCHIVE_USERS_TABLE);
      if (!hasArchiveTable) {
        continue;
      }
      const archiveColumns = await getTableColumns(ARCHIVE_USERS_TABLE);
      const archiveIdColumn = archiveColumns.has("archived_id")
        ? "archived_id"
        : archiveColumns.has("archive_id")
          ? "archive_id"
          : null;
      if (!archiveIdColumn) {
        continue;
      }
      const roleFilters = archiveRoleFiltersForEntity(entity.key);
      if (roleFilters.length === 0) {
        continue;
      }

      const archiveTimeColumn = archiveColumns.has("archived_at")
        ? "archived_at"
        : archiveColumns.has("timestamp")
          ? "timestamp"
          : archiveColumns.has("created_at")
            ? "created_at"
            : null;

      if (archiveColumns.has("role")) {
        const placeholders = roleFilters.map(() => "?").join(", ");
        const [rows] = await query<RowDataPacket[]>(
          `SELECT \`${archiveIdColumn}\` AS entity_id, ${archiveTimeColumn ? `\`${archiveTimeColumn}\`` : "NULL"} AS occurred_at
           FROM \`${ARCHIVE_USERS_TABLE}\`
           WHERE LOWER(REPLACE(REPLACE(TRIM(role), '-', '_'), ' ', '_')) IN (${placeholders})
           ORDER BY ${archiveTimeColumn ? `\`${archiveTimeColumn}\`` : `\`${archiveIdColumn}\``} DESC
           LIMIT 3`,
          roleFilters,
        );
        for (const row of rows) {
          recent.push({
            entity: entity.key,
            id: (row.entity_id as string | number) ?? "",
            occurredAt: row.occurred_at ? new Date(row.occurred_at as string | Date).toISOString() : null,
          });
        }
        continue;
      }

      if (archiveColumns.has("role_id")) {
        const [roleRows] = await query<RowDataPacket[]>(
          "SELECT role_id, role_name FROM role WHERE role_id IS NOT NULL AND role_name IS NOT NULL",
        );
        const roleIds = roleRows
          .map((row) => ({
            roleId: Number(row.role_id),
            roleName: normalizeRoleToken(String(row.role_name ?? "")),
          }))
          .filter((row) => Number.isFinite(row.roleId) && roleFilters.includes(row.roleName))
          .map((row) => row.roleId);
        if (roleIds.length === 0) {
          continue;
        }
        const placeholders = roleIds.map(() => "?").join(", ");
        const [rows] = await query<RowDataPacket[]>(
          `SELECT \`${archiveIdColumn}\` AS entity_id, ${archiveTimeColumn ? `\`${archiveTimeColumn}\`` : "NULL"} AS occurred_at
           FROM \`${ARCHIVE_USERS_TABLE}\`
           WHERE role_id IN (${placeholders})
           ORDER BY ${archiveTimeColumn ? `\`${archiveTimeColumn}\`` : `\`${archiveIdColumn}\``} DESC
           LIMIT 3`,
          roleIds,
        );
        for (const row of rows) {
          recent.push({
            entity: entity.key,
            id: (row.entity_id as string | number) ?? "",
            occurredAt: row.occurred_at ? new Date(row.occurred_at as string | Date).toISOString() : null,
          });
        }
      }

      continue;
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

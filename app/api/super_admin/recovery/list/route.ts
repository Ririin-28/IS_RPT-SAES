import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";
import {
  archiveRoleFiltersForEntity,
  findRecoveryEntity,
  isArchiveBackedAccountEntity,
  modeFlagColumn,
  modeReasonColumn,
  modeTimeColumn,
  normalizeRoleToken,
  pickLabelColumns,
} from "@/lib/server/recovery-center";

export const dynamic = "force-dynamic";

type CountRow = RowDataPacket & { total: number };
const ARCHIVE_USERS_TABLE = "archived_users";

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(max, Math.floor(parsed));
}

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:data.restore" });
  if (!auth.ok) {
    return auth.response;
  }

  const params = request.nextUrl.searchParams;
  const entityKey = String(params.get("entity") ?? "").trim().toLowerCase();
  if (!entityKey) {
    return NextResponse.json({ error: "Query parameter 'entity' is required." }, { status: 400 });
  }

  const entity = findRecoveryEntity(entityKey);
  if (!entity) {
    return NextResponse.json({ error: "Unsupported recovery entity." }, { status: 400 });
  }

  const page = parsePositiveInt(params.get("page"), 1, 100000);
  const pageSize = parsePositiveInt(params.get("pageSize"), 20, 100);
  const offset = (page - 1) * pageSize;
  const queryText = String(params.get("query") ?? "").trim();

  try {
    const result = await runWithConnection(async (connection) => {
      if (isArchiveBackedAccountEntity(entity.key)) {
        const [archiveColumnRows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${ARCHIVE_USERS_TABLE}\``);
        const archiveColumns = new Set(archiveColumnRows.map((row) => String(row.Field)));
        if (!archiveColumns.size) {
          throw new Error(`Table '${ARCHIVE_USERS_TABLE}' is not accessible.`);
        }

        const archiveIdColumn = archiveColumns.has("archived_id")
          ? "archived_id"
          : archiveColumns.has("archive_id")
            ? "archive_id"
            : null;
        if (!archiveIdColumn) {
          throw new Error(`Table '${ARCHIVE_USERS_TABLE}' is missing archive identifier column.`);
        }

        const roleFilters = archiveRoleFiltersForEntity(entity.key);
        if (roleFilters.length === 0) {
          return { total: 0, records: [] as Array<Record<string, unknown>> };
        }

        const whereParts: string[] = [];
        const whereValues: Array<string | number> = [];
        if (archiveColumns.has("role")) {
          const placeholders = roleFilters.map(() => "?").join(", ");
          whereParts.push(`LOWER(REPLACE(REPLACE(TRIM(\`role\`), '-', '_'), ' ', '_')) IN (${placeholders})`);
          whereValues.push(...roleFilters);
        } else if (archiveColumns.has("role_id")) {
          const [roleRows] = await connection.query<RowDataPacket[]>(
            "SELECT role_id, role_name FROM role WHERE role_id IS NOT NULL AND role_name IS NOT NULL",
          );
          const acceptedRoleIds = roleRows
            .map((row) => ({
              roleId: Number(row.role_id),
              roleName: normalizeRoleToken(String(row.role_name ?? "")),
            }))
            .filter((row) => Number.isFinite(row.roleId) && roleFilters.includes(row.roleName))
            .map((row) => row.roleId);

          if (acceptedRoleIds.length === 0) {
            return { total: 0, records: [] as Array<Record<string, unknown>> };
          }

          const placeholders = acceptedRoleIds.map(() => "?").join(", ");
          whereParts.push(`\`role_id\` IN (${placeholders})`);
          whereValues.push(...acceptedRoleIds);
        } else {
          return { total: 0, records: [] as Array<Record<string, unknown>> };
        }

        const archiveTimeColumn = archiveColumns.has("archived_at")
          ? "archived_at"
          : archiveColumns.has("timestamp")
            ? "timestamp"
            : archiveColumns.has("created_at")
              ? "created_at"
              : null;
        const archiveReasonColumn = archiveColumns.has("reason") ? "reason" : null;
        const labelColumns = pickLabelColumns(
          archiveColumns,
          ["user_code", "first_name", "last_name", "email", "username", "name"],
        );

        if (queryText) {
          const searchable = [archiveIdColumn, ...labelColumns].filter((col, idx, arr) => arr.indexOf(col) === idx);
          if (searchable.length > 0) {
            const searchParts: string[] = [];
            for (const col of searchable) {
              searchParts.push(`CAST(\`${col}\` AS CHAR) LIKE ?`);
              whereValues.push(`%${queryText}%`);
            }
            whereParts.push(`(${searchParts.join(" OR ")})`);
          }
        }

        const selectParts: string[] = [`\`${archiveIdColumn}\` AS entity_id`];
        selectParts.push(archiveTimeColumn ? `\`${archiveTimeColumn}\` AS occurred_at` : "NULL AS occurred_at");
        selectParts.push(archiveReasonColumn ? `\`${archiveReasonColumn}\` AS reason_text` : "NULL AS reason_text");
        for (const col of labelColumns) {
          selectParts.push(`\`${col}\` AS \`label_${col}\``);
        }

        const whereSql = whereParts.length > 0 ? whereParts.join(" AND ") : "1=1";
        const orderExpr = archiveTimeColumn ? `\`${archiveTimeColumn}\` DESC` : `\`${archiveIdColumn}\` DESC`;

        const [countRows] = await connection.query<CountRow[]>(
          `SELECT COUNT(*) AS total FROM \`${ARCHIVE_USERS_TABLE}\` WHERE ${whereSql}`,
          whereValues,
        );
        const total = Number(countRows[0]?.total ?? 0);

        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT ${selectParts.join(", ")}
           FROM \`${ARCHIVE_USERS_TABLE}\`
           WHERE ${whereSql}
           ORDER BY ${orderExpr}
           LIMIT ? OFFSET ?`,
          [...whereValues, pageSize, offset],
        );

        const records = rows.map((row) => {
          const labels = labelColumns
            .map((col) => row[`label_${col}`])
            .filter((value) => value !== null && value !== undefined && String(value).trim().length > 0)
            .map((value) => String(value).trim());

          return {
            id: row.entity_id as string | number,
            occurredAt: row.occurred_at ? new Date(row.occurred_at as string | Date).toISOString() : null,
            reason: row.reason_text ? String(row.reason_text) : null,
            label: labels.length > 0 ? labels.join(" | ") : null,
            fields: Object.fromEntries(labelColumns.map((col) => [col, row[`label_${col}`] ?? null])),
          };
        });

        return { total, records };
      }

      const [columnRows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${entity.table}\``);
      const columns = new Set(columnRows.map((row) => String(row.Field)));
      if (!columns.size) {
        throw new Error(`Table '${entity.table}' is not accessible.`);
      }

      const flagColumn = modeFlagColumn(entity.mode);
      if (!columns.has(entity.idColumn) || !columns.has(flagColumn)) {
        throw new Error(`Entity '${entity.key}' is missing required recovery columns.`);
      }

      const timeColumn = modeTimeColumn(entity.mode);
      const reasonColumn = modeReasonColumn(entity.mode);
      const labelColumns = pickLabelColumns(columns, entity.defaultLabelColumns);

      const selectParts: string[] = [
        `\`${entity.idColumn}\` AS entity_id`,
      ];
      if (columns.has(timeColumn)) {
        selectParts.push(`\`${timeColumn}\` AS occurred_at`);
      } else {
        selectParts.push("NULL AS occurred_at");
      }
      if (columns.has(reasonColumn)) {
        selectParts.push(`\`${reasonColumn}\` AS reason_text`);
      } else {
        selectParts.push("NULL AS reason_text");
      }
      for (const col of labelColumns) {
        selectParts.push(`\`${col}\` AS \`label_${col}\``);
      }

      const whereParts: string[] = [`\`${flagColumn}\` = 1`];
      const whereValues: Array<string | number> = [];

      if (queryText) {
        const searchable = [entity.idColumn, ...labelColumns].filter((col, idx, arr) => arr.indexOf(col) === idx);
        if (searchable.length > 0) {
          const searchParts: string[] = [];
          for (const col of searchable) {
            searchParts.push(`CAST(\`${col}\` AS CHAR) LIKE ?`);
            whereValues.push(`%${queryText}%`);
          }
          whereParts.push(`(${searchParts.join(" OR ")})`);
        }
      }

      const whereSql = whereParts.join(" AND ");
      const orderExpr = columns.has(timeColumn) ? `\`${timeColumn}\` DESC` : `\`${entity.idColumn}\` DESC`;

      const [countRows] = await connection.query<CountRow[]>(
        `SELECT COUNT(*) AS total FROM \`${entity.table}\` WHERE ${whereSql}`,
        whereValues,
      );
      const total = Number(countRows[0]?.total ?? 0);

      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT ${selectParts.join(", ")}
         FROM \`${entity.table}\`
         WHERE ${whereSql}
         ORDER BY ${orderExpr}
         LIMIT ? OFFSET ?`,
        [...whereValues, pageSize, offset],
      );

      const records = rows.map((row) => {
        const labels = labelColumns
          .map((col) => row[`label_${col}`])
          .filter((value) => value !== null && value !== undefined && String(value).trim().length > 0)
          .map((value) => String(value).trim());

        return {
          id: row.entity_id as string | number,
          occurredAt: row.occurred_at ? new Date(row.occurred_at as string | Date).toISOString() : null,
          reason: row.reason_text ? String(row.reason_text) : null,
          label: labels.length > 0 ? labels.join(" | ") : null,
          fields: Object.fromEntries(
            labelColumns.map((col) => [col, row[`label_${col}`] ?? null]),
          ),
        };
      });

      return { total, records };
    });

    return NextResponse.json({
      success: true,
      entity: entity.key,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
      },
      records: result.records,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load recovery list.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

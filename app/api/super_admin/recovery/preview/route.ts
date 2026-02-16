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
const ARCHIVE_USERS_TABLE = "archived_users";

type PreviewPayload = {
  entity?: string;
  ids?: Array<string | number>;
};

function sanitizeIds(values: unknown): Array<string | number> {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("A non-empty 'ids' array is required.");
  }
  const deduped = new Set<string | number>();
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      deduped.add(value);
      continue;
    }
    const text = String(value ?? "").trim();
    if (text) {
      deduped.add(text);
    }
  }
  const ids = Array.from(deduped);
  if (ids.length === 0) {
    throw new Error("No valid IDs were provided.");
  }
  if (ids.length > 200) {
    throw new Error("Maximum 200 IDs per preview request.");
  }
  return ids;
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:data.restore" });
  if (!auth.ok) {
    return auth.response;
  }

  let payload: PreviewPayload;
  try {
    payload = (await request.json()) as PreviewPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const entityKey = String(payload.entity ?? "").trim().toLowerCase();
    const entity = findRecoveryEntity(entityKey);
    if (!entity) {
      return NextResponse.json({ error: "Unsupported recovery entity." }, { status: 400 });
    }
    const ids = sanitizeIds(payload.ids);

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
          return { recoverable: [], notRecoverable: [], notFound: ids };
        }

        const whereParts: string[] = [`\`${archiveIdColumn}\` IN (${ids.map(() => "?").join(", ")})`];
        const whereValues: Array<string | number> = [...ids];

        if (archiveColumns.has("role")) {
          whereParts.push(`LOWER(REPLACE(REPLACE(TRIM(\`role\`), '-', '_'), ' ', '_')) IN (${roleFilters.map(() => "?").join(", ")})`);
          whereValues.push(...roleFilters);
        } else if (archiveColumns.has("role_id")) {
          const [roleRows] = await connection.query<RowDataPacket[]>(
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
            return { recoverable: [], notRecoverable: [], notFound: ids };
          }
          whereParts.push(`\`role_id\` IN (${roleIds.map(() => "?").join(", ")})`);
          whereValues.push(...roleIds);
        }

        const labelColumns = pickLabelColumns(
          archiveColumns,
          ["user_code", "first_name", "last_name", "email", "username", "name"],
        );
        const archiveTimeColumn = archiveColumns.has("archived_at")
          ? "archived_at"
          : archiveColumns.has("timestamp")
            ? "timestamp"
            : archiveColumns.has("created_at")
              ? "created_at"
              : null;
        const archiveReasonColumn = archiveColumns.has("reason") ? "reason" : null;

        const selectParts = [
          `\`${archiveIdColumn}\` AS entity_id`,
          archiveTimeColumn ? `\`${archiveTimeColumn}\` AS occurred_at` : "NULL AS occurred_at",
          archiveReasonColumn ? `\`${archiveReasonColumn}\` AS reason_text` : "NULL AS reason_text",
          ...labelColumns.map((col) => `\`${col}\` AS \`label_${col}\``),
        ];

        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT ${selectParts.join(", ")}
           FROM \`${ARCHIVE_USERS_TABLE}\`
           WHERE ${whereParts.join(" AND ")}`,
          whereValues,
        );

        const byId = new Map<string, RowDataPacket>();
        for (const row of rows) {
          byId.set(String(row.entity_id), row);
        }

        const recoverable: Array<Record<string, unknown>> = [];
        const notFound: Array<string | number> = [];
        for (const requestedId of ids) {
          const key = String(requestedId);
          const row = byId.get(key);
          if (!row) {
            notFound.push(requestedId);
            continue;
          }

          const labels = labelColumns
            .map((col) => row[`label_${col}`])
            .filter((value) => value !== null && value !== undefined && String(value).trim().length > 0)
            .map((value) => String(value).trim());

          recoverable.push({
            id: row.entity_id as string | number,
            label: labels.length > 0 ? labels.join(" | ") : null,
            occurredAt: row.occurred_at ? new Date(row.occurred_at as string | Date).toISOString() : null,
            reason: row.reason_text ? String(row.reason_text) : null,
            fields: Object.fromEntries(labelColumns.map((col) => [col, row[`label_${col}`] ?? null])),
          });
        }

        return { recoverable, notRecoverable: [], notFound };
      }

      const [columnRows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${entity.table}\``);
      const columns = new Set(columnRows.map((row) => String(row.Field)));
      if (!columns.has(entity.idColumn)) {
        throw new Error(`Column '${entity.idColumn}' is missing in '${entity.table}'.`);
      }

      const flagColumn = modeFlagColumn(entity.mode);
      if (!columns.has(flagColumn)) {
        throw new Error(`Column '${flagColumn}' is missing in '${entity.table}'.`);
      }

      const timeColumn = modeTimeColumn(entity.mode);
      const reasonColumn = modeReasonColumn(entity.mode);
      const labelColumns = pickLabelColumns(columns, entity.defaultLabelColumns);

      const selectParts = [
        `\`${entity.idColumn}\` AS entity_id`,
        columns.has(flagColumn) ? `\`${flagColumn}\` AS flagged` : "0 AS flagged",
        columns.has(timeColumn) ? `\`${timeColumn}\` AS occurred_at` : "NULL AS occurred_at",
        columns.has(reasonColumn) ? `\`${reasonColumn}\` AS reason_text` : "NULL AS reason_text",
        ...labelColumns.map((col) => `\`${col}\` AS \`label_${col}\``),
      ];

      const placeholders = ids.map(() => "?").join(", ");
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT ${selectParts.join(", ")}
         FROM \`${entity.table}\`
         WHERE \`${entity.idColumn}\` IN (${placeholders})`,
        ids,
      );

      const byId = new Map<string, RowDataPacket>();
      for (const row of rows) {
        byId.set(String(row.entity_id), row);
      }

      const recoverable: Array<Record<string, unknown>> = [];
      const notRecoverable: Array<Record<string, unknown>> = [];
      const notFound: Array<string | number> = [];

      for (const requestedId of ids) {
        const key = String(requestedId);
        const row = byId.get(key);
        if (!row) {
          notFound.push(requestedId);
          continue;
        }

        const labels = labelColumns
          .map((col) => row[`label_${col}`])
          .filter((value) => value !== null && value !== undefined && String(value).trim().length > 0)
          .map((value) => String(value).trim());

        const snapshot = {
          id: row.entity_id as string | number,
          label: labels.length > 0 ? labels.join(" | ") : null,
          occurredAt: row.occurred_at ? new Date(row.occurred_at as string | Date).toISOString() : null,
          reason: row.reason_text ? String(row.reason_text) : null,
          fields: Object.fromEntries(labelColumns.map((col) => [col, row[`label_${col}`] ?? null])),
        };

        if (Number(row.flagged) === 1) {
          recoverable.push(snapshot);
        } else {
          notRecoverable.push(snapshot);
        }
      }

      return { recoverable, notRecoverable, notFound };
    });

    return NextResponse.json({
      success: true,
      entity: entity.key,
      requestedIds: ids,
      recoverable: result.recoverable,
      notRecoverable: result.notRecoverable,
      notFound: result.notFound,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to preview recovery.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

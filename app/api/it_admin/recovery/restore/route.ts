import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";
import { resolveRequestIp, writeSecurityAuditLog } from "@/lib/server/security-audit";
import { findRecoveryEntity, modeFlagColumn, type RecoveryMode } from "@/lib/server/recovery-center";

export const dynamic = "force-dynamic";

type RestorePayload = {
  entity?: string;
  ids?: Array<string | number>;
  reason?: string;
  approvalNote?: string;
};

function sanitizeText(value: unknown, field: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  if (trimmed.length > 500) {
    throw new Error(`${field} must be 500 characters or fewer.`);
  }
  return trimmed;
}

function sanitizeIdList(values: unknown): Array<string | number> {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("A non-empty 'ids' array is required.");
  }

  const deduped = new Set<string | number>();
  for (const raw of values) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      deduped.add(raw);
      continue;
    }
    const text = String(raw ?? "").trim();
    if (!text) {
      continue;
    }
    deduped.add(text);
  }

  const ids = Array.from(deduped);
  if (ids.length === 0) {
    throw new Error("No valid IDs were provided.");
  }
  if (ids.length > 200) {
    throw new Error("Maximum 200 IDs per recovery request.");
  }
  return ids;
}

function buildRestoreAssignments(mode: RecoveryMode, columns: Set<string>): string[] {
  const assignments: string[] = [];
  if (mode === "deleted") {
    if (columns.has("is_deleted")) assignments.push("`is_deleted` = 0");
    if (columns.has("deleted_at")) assignments.push("`deleted_at` = NULL");
    if (columns.has("deleted_by")) assignments.push("`deleted_by` = NULL");
  } else if (mode === "archived") {
    if (columns.has("is_archived")) assignments.push("`is_archived` = 0");
    if (columns.has("archived_at")) assignments.push("`archived_at` = NULL");
    if (columns.has("archived_by")) assignments.push("`archived_by` = NULL");
  } else {
    if (columns.has("is_voided")) assignments.push("`is_voided` = 0");
    if (columns.has("void_reason")) assignments.push("`void_reason` = NULL");
    if (columns.has("voided_at")) assignments.push("`voided_at` = NULL");
    if (columns.has("voided_by")) assignments.push("`voided_by` = NULL");
  }
  if (columns.has("updated_at")) {
    assignments.push("`updated_at` = NOW()");
  }
  return assignments;
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:data.restore" });
  if (!auth.ok) {
    return auth.response;
  }

  let payload: RestorePayload;
  try {
    payload = (await request.json()) as RestorePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const entityKey = String(payload.entity ?? "").trim().toLowerCase();
    const entityConfig = findRecoveryEntity(entityKey);
    if (!entityConfig) {
      return NextResponse.json({ error: "Unsupported entity for emergency restore." }, { status: 400 });
    }

    const ids = sanitizeIdList(payload.ids);
    const reason = sanitizeText(payload.reason, "reason");
    const approvalNote = sanitizeText(payload.approvalNote, "approvalNote");
    const flagColumn = modeFlagColumn(entityConfig.mode);
    const ipAddress = resolveRequestIp(request);

    const result = await runWithConnection(async (connection) => {
      const [columnRows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${entityConfig.table}\``);
      const columns = new Set(columnRows.map((row) => String(row.Field)));

      if (!columns.size) {
        throw new Error(`Table '${entityConfig.table}' is not accessible.`);
      }
      if (!columns.has(entityConfig.idColumn)) {
        throw new Error(`Column '${entityConfig.idColumn}' is not available on '${entityConfig.table}'.`);
      }
      if (!columns.has(flagColumn)) {
        throw new Error(`Column '${flagColumn}' is not available on '${entityConfig.table}'.`);
      }

      const placeholders = ids.map(() => "?").join(", ");
      const [recoverableRows] = await connection.query<RowDataPacket[]>(
        `SELECT \`${entityConfig.idColumn}\` AS id
         FROM \`${entityConfig.table}\`
         WHERE \`${entityConfig.idColumn}\` IN (${placeholders})
           AND \`${flagColumn}\` = 1`,
        ids,
      );

      const recoverableIds = recoverableRows.map((row) => row.id as string | number);
      if (recoverableIds.length === 0) {
        await writeSecurityAuditLog(connection, {
          action: `emergency_restore_${entityConfig.key}`,
          userId: auth.userId,
          ipAddress,
          details: {
            table: entityConfig.table,
            idColumn: entityConfig.idColumn,
            requestedIds: ids,
            restoredIds: [],
            restoredCount: 0,
            reason,
            approvalNote,
            outcome: "no-op",
          },
        });

        return {
          restoredCount: 0,
          restoredIds: [] as Array<string | number>,
        };
      }

      const assignments = buildRestoreAssignments(entityConfig.mode, columns);
      if (assignments.length === 0) {
        throw new Error("No writable recovery columns were found on the target table.");
      }

      const recoverablePlaceholders = recoverableIds.map(() => "?").join(", ");
      await connection.query(
        `UPDATE \`${entityConfig.table}\`
         SET ${assignments.join(", ")}
         WHERE \`${entityConfig.idColumn}\` IN (${recoverablePlaceholders})`,
        recoverableIds,
      );

      await writeSecurityAuditLog(connection, {
        action: `emergency_restore_${entityConfig.key}`,
        userId: auth.userId,
        ipAddress,
        details: {
          table: entityConfig.table,
          idColumn: entityConfig.idColumn,
          requestedIds: ids,
          restoredIds: recoverableIds,
          restoredCount: recoverableIds.length,
          reason,
          approvalNote,
          mode: entityConfig.mode,
        },
      });

      return {
        restoredCount: recoverableIds.length,
        restoredIds: recoverableIds,
      };
    });

    return NextResponse.json({
      success: true,
      entity: entityConfig.key,
      restoredCount: result.restoredCount,
      restoredIds: result.restoredIds,
      reason,
      approvalNote,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Emergency restore failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

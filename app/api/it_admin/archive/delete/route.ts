import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

const LEGACY_ARCHIVE_TABLE = "archive_users";
const NEW_ARCHIVE_TABLE = "archived_users";

async function fetchTableColumns(connection: import("mysql2/promise").PoolConnection, tableName: string): Promise<Set<string>> {
  const [rows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => String(row.Field)));
}

async function tryFetchTableColumns(
  connection: import("mysql2/promise").PoolConnection,
  tableName: string,
): Promise<Set<string> | null> {
  try {
    return await fetchTableColumns(connection, tableName);
  } catch {
    return null;
  }
}

function parseIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const numeric = Number(item);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    })
    .filter((item): item is number => item !== null);
}

export async function POST(request: NextRequest) {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const archiveIds = parseIdArray(payload?.archiveIds);

  if (archiveIds.length === 0) {
    return NextResponse.json({ error: "At least one archiveId is required." }, { status: 400 });
  }

  try {
    const result = await runWithConnection(async (connection) => {
      const legacyColumns = await tryFetchTableColumns(connection, LEGACY_ARCHIVE_TABLE);
      const newColumns = await tryFetchTableColumns(connection, NEW_ARCHIVE_TABLE);

      const legacyExists = !!legacyColumns && legacyColumns.size > 0;
      const newExists = !!newColumns && newColumns.size > 0;

      if (!legacyExists && !newExists) {
        return { deleted: [], affectedRows: 0 };
      }

      const placeholders = archiveIds.map(() => "?").join(", ");
      const existingIds = new Set<number>();

      if (legacyExists) {
        const [existingLegacy] = await connection.query<RowDataPacket[]>(
          `SELECT archive_id FROM ${LEGACY_ARCHIVE_TABLE} WHERE archive_id IN (${placeholders})`,
          archiveIds,
        );
        for (const row of existingLegacy) {
          const id = Number(row.archive_id);
          if (Number.isInteger(id) && id > 0) {
            existingIds.add(id);
          }
        }
      }

      if (newExists) {
        const [existingNew] = await connection.query<RowDataPacket[]>(
          `SELECT archived_id FROM ${NEW_ARCHIVE_TABLE} WHERE archived_id IN (${placeholders})`,
          archiveIds,
        );
        for (const row of existingNew) {
          const id = Number(row.archived_id);
          if (Number.isInteger(id) && id > 0) {
            existingIds.add(id);
          }
        }
      }

      const archiveIdsToDelete = Array.from(existingIds);
      if (archiveIdsToDelete.length === 0) {
        return { deleted: [], affectedRows: 0 };
      }

      const deletePlaceholders = archiveIdsToDelete.map(() => "?").join(", ");
      let affectedRows = 0;

      if (legacyExists) {
        const [deleteLegacy] = await connection.query<ResultSetHeader>(
          `DELETE FROM ${LEGACY_ARCHIVE_TABLE} WHERE archive_id IN (${deletePlaceholders})`,
          archiveIdsToDelete,
        );
        affectedRows += deleteLegacy.affectedRows ?? 0;
      }

      if (newExists) {
        const [deleteNew] = await connection.query<ResultSetHeader>(
          `DELETE FROM ${NEW_ARCHIVE_TABLE} WHERE archived_id IN (${deletePlaceholders})`,
          archiveIdsToDelete,
        );
        affectedRows += deleteNew.affectedRows ?? 0;
      }

      return { deleted: archiveIdsToDelete, affectedRows };
    });

    return NextResponse.json({
      success: result.affectedRows > 0,
      deletedArchiveIds: result.deleted,
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Failed to delete archived users", error);
    return NextResponse.json({ error: "Failed to delete archived users." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

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
      const placeholders = archiveIds.map(() => "?").join(", ");
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT archive_id FROM archive_users WHERE archive_id IN (${placeholders})`,
        archiveIds,
      );

      if (existing.length === 0) {
        return { deleted: [], affectedRows: 0 };
      }

      const archiveIdsToDelete = existing
        .map((row) => Number(row.archive_id))
        .filter((value) => Number.isInteger(value) && value > 0);

      if (archiveIdsToDelete.length === 0) {
        return { deleted: [], affectedRows: 0 };
      }

      const deletePlaceholders = archiveIdsToDelete.map(() => "?").join(", ");
      const [deleteResult] = await connection.query<ResultSetHeader>(
        `DELETE FROM archive_users WHERE archive_id IN (${deletePlaceholders})`,
        archiveIdsToDelete,
      );

      return { deleted: archiveIdsToDelete, affectedRows: deleteResult.affectedRows ?? 0 };
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

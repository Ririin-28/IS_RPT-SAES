import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getPrincipalSessionFromCookies } from "@/lib/server/principal-session";

export const dynamic = "force-dynamic";

const APPROVED_REMEDIAL_TABLE = "approved_remedial_schedule";
const REQUEST_REMEDIAL_TABLE = "request_remedial_schedule";
const ID_COLUMN_CANDIDATES = ["request_id", "activity_id", "id"] as const;

const pickColumn = (columns: Set<string>, candidates: readonly string[]): string | null => {
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }
  return null;
};

export async function DELETE(request: NextRequest) {
  try {
    const session = await getPrincipalSessionFromCookies();
    if (!session?.principalId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as {
      activityId?: string | number | null;
      sourceTable?: string | null;
      relatedRowIds?: Array<string | number | null> | null;
    } | null;

    const activityId = payload?.activityId ?? null;
    const sourceTable = payload?.sourceTable ? String(payload.sourceTable) : "";

    if (!activityId || !sourceTable) {
      return NextResponse.json({ success: false, error: "Missing activity identifier." }, { status: 400 });
    }

    const table = sourceTable === REQUEST_REMEDIAL_TABLE
      ? REQUEST_REMEDIAL_TABLE
      : sourceTable === APPROVED_REMEDIAL_TABLE
      ? APPROVED_REMEDIAL_TABLE
      : null;

    if (!table) {
      return NextResponse.json({ success: false, error: "Unsupported activity source." }, { status: 400 });
    }

    const columns = await getTableColumns(table).catch(() => new Set<string>());
    const idColumn = pickColumn(columns, ID_COLUMN_CANDIDATES);
    if (!idColumn) {
      return NextResponse.json({ success: false, error: "Unable to resolve activity identifier." }, { status: 400 });
    }

    const targetIds = new Set<string>();
    targetIds.add(String(activityId));
    if (Array.isArray(payload?.relatedRowIds)) {
      for (const related of payload.relatedRowIds) {
        if (related === null || related === undefined) continue;
        const text = String(related).trim();
        if (text.length > 0) {
          targetIds.add(text);
        }
      }
    }

    const ids = Array.from(targetIds);
    if (!columns.has("is_archived")) {
      return NextResponse.json(
        { success: false, error: `${table}.is_archived is required for safe archive.` },
        { status: 500 },
      );
    }

    const assignments = ["is_archived = 1"];
    if (columns.has("archived_at")) {
      assignments.push("archived_at = NOW()");
    }
    if (columns.has("archived_by")) {
      assignments.push("archived_by = ?");
    }
    const params: Array<string | number> = [];
    if (columns.has("archived_by")) {
      params.push(session.userId);
    }
    params.push(...ids);

    await query<ResultSetHeader>(
      `UPDATE ${table}
       SET ${assignments.join(", ")}
       WHERE ${idColumn} IN (${ids.map(() => "?").join(", ")})
         AND COALESCE(is_archived, 0) = 0`,
      params,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove calendar activity", error);
    return NextResponse.json({ success: false, error: "Unable to remove calendar activity." }, { status: 500 });
  }
}

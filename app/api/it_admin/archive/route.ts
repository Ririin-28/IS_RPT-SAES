import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query, tableExists, getTableColumns } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  admin: "IT Admin",
  it_admin: "IT Admin",
  principal: "Principal",
  master_teacher: "Master Teacher",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

type ArchiveRow = RowDataPacket & {
  archive_id: number;
  user_id: number | null;
  role: string | null;
  name: string | null;
  reason: string | null;
  timestamp: Date | null;
  user_email?: string | null;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

function normalizeName(row: ArchiveRow): string | null {
  const direct = row.name ?? null;
  if (direct && direct.trim().length > 0) {
    return direct;
  }

  const first = row.first_name ?? "";
  const last = row.last_name ?? "";
  const combined = `${first} ${last}`.trim();
  if (combined.length > 0) {
    return combined;
  }

  const username = row.username ?? null;
  return username && username.trim().length > 0 ? username : null;
}

export async function GET(request: NextRequest) {
  try {
    const archiveExists = await tableExists("archive_users");
    if (!archiveExists) {
      return NextResponse.json({ total: 0, records: [], metadata: { missingTables: ["archive_users"] } });
    }

    const archiveColumns = await getTableColumns("archive_users").catch(() => new Set<string>());
    const usersColumns = await getTableColumns("users").catch(() => new Set<string>());

    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get("role");

    const filters: string[] = [];
    const params: Array<string | number> = [];

    if (roleParam && roleParam.toLowerCase() !== "all") {
      filters.push("au.role = ?");
      params.push(roleParam.toLowerCase());
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const selectedFields: string[] = [];
    const missingFields: string[] = [];

    const pickArchive = (column: string, alias?: string) => {
      if (archiveColumns.has(column)) {
        selectedFields.push(alias ? `au.${column} AS ${alias}` : `au.${column}`);
      } else {
        missingFields.push(`archive_users.${column}`);
      }
    };

    const pickUser = (column: string, alias?: string) => {
      if (usersColumns.has(column)) {
        selectedFields.push(alias ? `u.${column} AS ${alias}` : `u.${column}`);
      } else {
        missingFields.push(`users.${column}`);
      }
    };

    pickArchive("archive_id");
    pickArchive("user_id");
    pickArchive("role");
    pickArchive("name");
    pickArchive("reason");
    pickArchive("timestamp");

    pickUser("email", "user_email");
    pickUser("username");
    pickUser("first_name");
    pickUser("last_name");

    if (selectedFields.length === 0) {
      return NextResponse.json({
        total: 0,
        records: [],
        metadata: {
          missingColumns: missingFields,
        },
      });
    }

    const [rows] = await query<ArchiveRow[]>(
      `SELECT
        ${selectedFields.join(",\n        ")}
      FROM archive_users au
      LEFT JOIN users u ON u.user_id = au.user_id
      ${whereClause}
      ORDER BY ${archiveColumns.has("timestamp") ? "au.timestamp" : "au.archive_id"} DESC`
      , params
    );

    const records = rows.map((row) => ({
      archiveId: row.archive_id,
      userId: row.user_id,
      role: row.role ?? undefined,
      roleLabel: row.role ? ROLE_LABELS[row.role] ?? row.role : "Unknown",
      name: normalizeName(row),
      email: row.user_email ?? undefined,
      reason: row.reason ?? undefined,
      archivedDate: row.timestamp ? row.timestamp.toISOString() : null,
    }));

    return NextResponse.json({
      total: rows.length,
      records,
      ...(missingFields.length > 0 ? { metadata: { missingColumns: missingFields } } : {}),
    });
  } catch (error) {
    console.error("Failed to fetch archived users", error);
    return NextResponse.json(
      { error: "Failed to fetch archived users." },
      { status: 500 }
    );
  }
}

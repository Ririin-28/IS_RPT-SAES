import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query, getTableColumns } from "@/lib/db";
import { getPrincipalSessionFromCookies } from "@/lib/server/principal-session";

export const dynamic = "force-dynamic";

const NOTIFICATIONS_TABLE = "principal_notifications";

const ensureNotificationsTable = async () => {
  await query(
    `CREATE TABLE IF NOT EXISTS ${NOTIFICATIONS_TABLE} (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      principal_id VARCHAR(64) NULL,
      message TEXT NOT NULL,
      status ENUM('unread', 'read') NOT NULL DEFAULT 'unread',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_principal_notifications_principal (principal_id),
      KEY idx_principal_notifications_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  );
};

export async function GET() {
  try {
    const session = await getPrincipalSessionFromCookies();
    if (!session?.principalId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await ensureNotificationsTable();

    const columns = await getTableColumns(NOTIFICATIONS_TABLE).catch(() => new Set<string>());
    const hasPrincipalId = columns.has("principal_id");

    const whereClause = hasPrincipalId ? "WHERE principal_id IS NULL OR principal_id = ?" : "";
    const [rows] = await query<RowDataPacket[]>(
      `SELECT id, message, status, created_at FROM ${NOTIFICATIONS_TABLE}
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT 100`,
      hasPrincipalId ? [session.principalId] : [],
    );

    const notifications = rows.map((row) => ({
      id: Number(row.id),
      message: row.message ? String(row.message) : "",
      status: row.status === "read" ? "read" : "unread",
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(String(row.created_at)).toISOString(),
    }));

    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error("Failed to load principal notifications", error);
    return NextResponse.json({ success: false, error: "Unable to load notifications." }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const session = await getPrincipalSessionFromCookies();
    if (!session?.principalId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await ensureNotificationsTable();

    const columns = await getTableColumns(NOTIFICATIONS_TABLE).catch(() => new Set<string>());
    const hasPrincipalId = columns.has("principal_id");

    const whereClause = hasPrincipalId
      ? "WHERE status = 'unread' AND (principal_id IS NULL OR principal_id = ?)"
      : "WHERE status = 'unread'";

    await query(
      `UPDATE ${NOTIFICATIONS_TABLE} SET status = 'read' ${whereClause}`,
      hasPrincipalId ? [session.principalId] : [],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update principal notifications", error);
    return NextResponse.json({ success: false, error: "Unable to update notifications." }, { status: 500 });
  }
}

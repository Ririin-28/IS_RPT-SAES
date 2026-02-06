import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import {
  extractAdminSessionToken,
  validateAdminSession,
} from "@/lib/server/admin-session";

type AdminUserRow = RowDataPacket & {
  role: string | null;
};

const ADMIN_ROLE_SET = new Set(["admin", "it_admin", "itadmin"]);

function normalizeRole(role: string | null): string {
  if (!role) return "";
  return role.trim().toLowerCase().replace(/[\s/\-]+/g, "_");
}

function buildNormalizeSql(tableName: string, columnName: string): string {
  return `UPDATE ${tableName}
    SET ${columnName} = CASE
      WHEN ${columnName} LIKE '/https:/%' THEN REPLACE(${columnName}, '/https:/', 'https://')
      WHEN ${columnName} LIKE 'https:/%' AND ${columnName} NOT LIKE 'https://%' THEN REPLACE(${columnName}, 'https:/', 'https://')
      WHEN ${columnName} LIKE '/http:/%' THEN REPLACE(${columnName}, '/http:/', 'http://')
      WHEN ${columnName} LIKE 'http:/%' AND ${columnName} NOT LIKE 'http://%' THEN REPLACE(${columnName}, 'http:/', 'http://')
      ELSE ${columnName}
    END
    WHERE ${columnName} LIKE '%https:/%' OR ${columnName} LIKE '%http:/%';`;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const cookieHeader = request.headers.get("cookie");
    const sessionToken = extractAdminSessionToken(cookieHeader);
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const result = await runWithConnection(async (connection) => {
      const session = await validateAdminSession(connection, sessionToken);
      if (!session) {
        return { status: 401, body: { success: false, error: "Session expired" } };
      }

      const [rows] = await connection.execute<AdminUserRow[]>(
        "SELECT role FROM users WHERE user_id = ? LIMIT 1",
        [session.userId],
      );
      const role = rows[0]?.role ?? null;
      if (!ADMIN_ROLE_SET.has(normalizeRole(role))) {
        return { status: 403, body: { success: false, error: "Forbidden" } };
      }

      const [materialsResult] = await connection.execute<ResultSetHeader>(
        buildNormalizeSql("remedial_materials", "file_path"),
      );
      const [contentResult] = await connection.execute<ResultSetHeader>(
        buildNormalizeSql("remedial_material_content", "file_path"),
      );

      return {
        status: 200,
        body: {
          success: true,
          updated: {
            remedialMaterials: materialsResult.affectedRows ?? 0,
            remedialMaterialContent: contentResult.affectedRows ?? 0,
          },
        },
      };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("Failed to normalize material paths", error);
    return NextResponse.json(
      { success: false, error: "Failed to normalize material paths" },
      { status: 500 },
    );
  }
}

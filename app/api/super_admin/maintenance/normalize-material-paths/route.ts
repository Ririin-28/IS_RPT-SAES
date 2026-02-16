import { NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";

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
  const auth = await requireSuperAdmin(request, { permission: "super_admin:maintenance.execute" });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const result = await runWithConnection(async (connection) => {
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

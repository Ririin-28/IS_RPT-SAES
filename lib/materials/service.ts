import type { RowDataPacket } from "mysql2/promise";
import { query, tableExists } from "@/lib/db";
import {
  MaterialDto,
  MaterialFileDto,
  MaterialFileRow,
  MaterialRow,
  fileRowToDto,
  materialRowToDto,
} from "@/lib/materials";

function buildUserSelect(aliases: {
  entity: "teacher" | "reviewer";
  include: boolean;
}): string[] {
  if (!aliases.include) {
    return [
      "NULL AS " + aliases.entity + "_username",
      "NULL AS " + aliases.entity + "_first_name",
      "NULL AS " + aliases.entity + "_middle_name",
      "NULL AS " + aliases.entity + "_last_name",
    ];
  }

  const prefix = aliases.entity;
  return [
    `${prefix}.username AS ${prefix}_username`,
    `${prefix}.first_name AS ${prefix}_first_name`,
    `${prefix}.middle_name AS ${prefix}_middle_name`,
    `${prefix}.last_name AS ${prefix}_last_name`,
  ];
}

export async function fetchMaterialById(materialId: number): Promise<MaterialDto | null> {
  if (!Number.isFinite(materialId) || materialId <= 0) {
    return null;
  }

  const usersAvailable = await tableExists("users");

  const selectColumns: string[] = [
    "tm.material_id",
    "tm.teacher_user_id",
    "tm.subject",
    "tm.level",
    "tm.title",
    "tm.description",
    "tm.attachment_url",
    "tm.status",
    "tm.rejection_reason",
    "tm.reviewed_by",
    "tm.reviewed_at",
    "tm.created_at",
    "tm.updated_at",
    ...buildUserSelect({ entity: "teacher", include: usersAvailable }),
    ...buildUserSelect({ entity: "reviewer", include: usersAvailable }),
  ];

  let joinClause = "";
  if (usersAvailable) {
    joinClause = `
      LEFT JOIN \`users\` AS teacher ON teacher.user_id = tm.teacher_user_id
      LEFT JOIN \`users\` AS reviewer ON reviewer.user_id = tm.reviewed_by
    `;
  }

  const [rows] = await query<RowDataPacket[]>(
    `SELECT ${selectColumns.join(", ")}
     FROM \`teacher_materials\` AS tm
     ${joinClause}
     WHERE tm.material_id = ?
     LIMIT 1`,
    [materialId],
  );

  if (rows.length === 0) {
    return null;
  }

  const materialRow = rows[0] as MaterialRow;

  const [fileRows] = await query<RowDataPacket[]>(
    `SELECT file_id, material_id, file_name, storage_path, mime_type, file_size, created_at
     FROM \`teacher_material_files\`
     WHERE material_id = ?
     ORDER BY created_at ASC, file_id ASC`,
    [materialId],
  );

  const files: MaterialFileDto[] = fileRows.map((row) => fileRowToDto(row as MaterialFileRow));

  return materialRowToDto(materialRow, files);
}

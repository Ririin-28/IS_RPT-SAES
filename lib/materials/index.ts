import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import {
  MATERIAL_SUBJECTS,
  type MaterialSubject,
  type MaterialStatus,
  type MaterialDto,
  type MaterialFileDto,
  normalizeMaterialSubject,
  normalizePublicPath,
} from "./shared";

export type MaterialRow = RowDataPacket & {
  material_id: number;
  teacher_user_id: number;
  subject: string;
  level: string;
  title: string;
  description: string | null;
  attachment_url: string | null;
  status: MaterialStatus;
  rejection_reason: string | null;
  reviewed_by: number | null;
  reviewed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  teacher_username?: string | null;
  teacher_first_name?: string | null;
  teacher_middle_name?: string | null;
  teacher_last_name?: string | null;
  reviewer_username?: string | null;
  reviewer_first_name?: string | null;
  reviewer_middle_name?: string | null;
  reviewer_last_name?: string | null;
};

export type MaterialFileRow = RowDataPacket & {
  file_id: number;
  material_id: number;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: Date | string;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function ensureMaterialsSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS \`teacher_materials\` (
      material_id INT AUTO_INCREMENT PRIMARY KEY,
      teacher_user_id INT NOT NULL,
      subject VARCHAR(50) NOT NULL,
      level VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      attachment_url VARCHAR(1024) NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      rejection_reason TEXT NULL,
      reviewed_by INT NULL,
      reviewed_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_teacher_user_id (teacher_user_id),
      INDEX idx_subject_level_status (subject, level, status),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS \`teacher_material_files\` (
      file_id INT AUTO_INCREMENT PRIMARY KEY,
      material_id INT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      storage_path VARCHAR(1024) NOT NULL,
      mime_type VARCHAR(255) NULL,
      file_size BIGINT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_material_id (material_id),
      CONSTRAINT fk_teacher_material_files_material_id
        FOREIGN KEY (material_id)
        REFERENCES \`teacher_materials\` (material_id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const materialsColumns = await getTableColumns("teacher_materials");

  if (!materialsColumns.has("attachment_url")) {
    await query(
      "ALTER TABLE `teacher_materials` ADD COLUMN attachment_url VARCHAR(1024) NULL AFTER description"
    );
  }

  if (!materialsColumns.has("reviewed_by")) {
    await query(
      "ALTER TABLE `teacher_materials` ADD COLUMN reviewed_by INT NULL AFTER rejection_reason"
    );
  }

  if (!materialsColumns.has("reviewed_at")) {
    await query(
      "ALTER TABLE `teacher_materials` ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by"
    );
  }
}

export function materialRowToDto(row: MaterialRow, files: MaterialFileDto[] = []): MaterialDto {
  const normalizedSubject = normalizeMaterialSubject(row.subject) ?? (row.subject as MaterialSubject);
  return {
    id: Number(row.material_id),
    teacherUserId: Number(row.teacher_user_id),
    subject: normalizedSubject,
    level: row.level,
    title: row.title,
    description: row.description ?? null,
    attachmentUrl: normalizePublicPath(row.attachment_url),
    status: row.status,
    rejectionReason: row.rejection_reason ?? null,
    reviewedBy: row.reviewed_by !== null && row.reviewed_by !== undefined ? Number(row.reviewed_by) : null,
    reviewedAt: toIso(row.reviewed_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
    teacher: {
      userId: Number(row.teacher_user_id),
      username: row.teacher_username ?? null,
      firstName: row.teacher_first_name ?? null,
      middleName: row.teacher_middle_name ?? null,
      lastName: row.teacher_last_name ?? null,
    },
    reviewer: row.reviewed_by
      ? {
          userId: Number(row.reviewed_by),
          username: row.reviewer_username ?? null,
          firstName: row.reviewer_first_name ?? null,
          middleName: row.reviewer_middle_name ?? null,
          lastName: row.reviewer_last_name ?? null,
        }
      : null,
    files,
  };
}

export function fileRowToDto(row: MaterialFileRow): MaterialFileDto {
  const storagePath = typeof row.storage_path === "string" ? row.storage_path : "";
  return {
    id: Number(row.file_id),
    materialId: Number(row.material_id),
    fileName: row.file_name,
    storagePath,
    publicUrl: normalizePublicPath(storagePath) ?? "",
    mimeType: row.mime_type ?? null,
    fileSize: row.file_size !== null && row.file_size !== undefined ? Number(row.file_size) : null,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

export * from "./shared";

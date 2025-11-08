import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const ensuredTable = { value: false };

const ensureNotificationsTable = async () => {
  if (ensuredTable.value) {
    return;
  }

  await query(
    `CREATE TABLE IF NOT EXISTS parent_notifications (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id INT NOT NULL,
      subject VARCHAR(100) NOT NULL,
      date DATE NOT NULL,
      message TEXT NOT NULL,
      status ENUM('unread', 'read') NOT NULL DEFAULT 'unread',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_parent_notification (student_id, subject, date),
      KEY idx_parent_notification_student (student_id),
      KEY idx_parent_notification_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  );

  ensuredTable.value = true;
};

type NotificationRow = RowDataPacket & {
  id: number;
  student_id: number;
  subject: string;
  date: Date | string;
  message: string;
  status: "unread" | "read";
  created_at: Date | string;
  updated_at: Date | string;
};

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const toIsoDate = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && ISO_DATE_REGEX.test(value)) {
    return value.slice(0, 10);
  }
  return new Date(value).toISOString().slice(0, 10);
};

const toIsoDateTime = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
};

export async function GET(request: NextRequest) {
  await ensureNotificationsTable();

  const url = new URL(request.url);
  const studentIdsParam = url.searchParams.get("studentIds");
  const statusParam = url.searchParams.get("status");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const studentIds: number[] = [];
  if (studentIdsParam) {
    for (const part of studentIdsParam.split(",")) {
      const parsed = Number(part.trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        studentIds.push(parsed);
      }
    }
  }

  const validStatuses = new Set(["unread", "read"] as const);
  const statusFilter = statusParam && validStatuses.has(statusParam as "unread" | "read") ? statusParam : null;

  const params: Array<string | number> = [];
  let sql = `SELECT id, student_id, subject, date, message, status, created_at, updated_at FROM parent_notifications`;

  const conditions: string[] = [];
  if (studentIds.length) {
    const placeholders = studentIds.map(() => "?").join(",");
    conditions.push(`student_id IN (${placeholders})`);
    params.push(...studentIds);
  }

  if (statusFilter) {
    conditions.push(`status = ?`);
    params.push(statusFilter);
  }

  if (fromParam && ISO_DATE_REGEX.test(fromParam)) {
    conditions.push(`date >= ?`);
    params.push(fromParam);
  }

  if (toParam && ISO_DATE_REGEX.test(toParam)) {
    conditions.push(`date <= ?`);
    params.push(toParam);
  }

  if (conditions.length) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  sql += ` ORDER BY date DESC, created_at DESC`;

  const [rows] = await query<NotificationRow[]>(sql, params);

  const notifications = rows.map((row) => ({
    id: Number(row.id),
    studentId: Number(row.student_id),
    subject: row.subject,
    date: toIsoDate(row.date),
    message: row.message,
    status: row.status,
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  }));

  return NextResponse.json({ success: true, notifications });
}

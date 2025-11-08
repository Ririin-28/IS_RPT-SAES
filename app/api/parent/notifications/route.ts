import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query, tableExists } from "@/lib/db";

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

const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
};

const parseDateValue = (value: Date | string | null | undefined): Date | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : new Date(timestamp);
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const normalized = text.replace(" ", "T");
  const fallback = new Date(normalized);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return null;
};

const normalizeRequestStatus = (value: string | null | undefined): string | null => {
  const raw = toNullableString(value);
  if (!raw) {
    return null;
  }
  const normalized = raw.toLowerCase();
  if (["1", "approved", "accept", "accepted", "granted", "true", "yes", "ok"].includes(normalized)) {
    return "Approved";
  }
  if (["0", "pending", "awaiting", "waiting", "submitted", "for approval"].includes(normalized)) {
    return "Pending";
  }
  if (["rejected", "declined", "denied", "cancelled", "canceled", "void"].includes(normalized)) {
    return "Declined";
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const hashStringToInt = (input: string): number => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

type NormalizedNotification = {
  id: number;
  studentId: number;
  subject: string;
  date: string;
  message: string;
  status: "unread" | "read";
  createdAt: string;
};

type ApprovedActivityRow = RowDataPacket & {
  request_id: number;
  plan_batch_id: string | null;
  week_ref: string | null;
  title: string | null;
  grade_level: string | null;
  subject: string | null;
  status: string | null;
  start_date: Date | string | null;
  end_date: Date | string | null;
  approved_at: Date | string | null;
  approved_by: string | null;
  requested_at: Date | string | null;
  updated_at: Date | string | null;
};

const APPROVED_STATUS_TOKENS = ["approved", "accept", "accepted", "granted", "true", "yes", "ok", "1"] as const;

// Surface approved calendar activities from master teacher requests as read-only parent notifications.
const buildApprovedActivityNotifications = async (): Promise<NormalizedNotification[]> => {
  if (!(await tableExists("mt_calendar_requests"))) {
    return [];
  }

  const placeholders = APPROVED_STATUS_TOKENS.map(() => "?").join(",");
  const [rows] = await query<ApprovedActivityRow[]>(
    `SELECT request_id, plan_batch_id, week_ref, title, grade_level, subject, status, start_date, end_date, approved_at, approved_by, requested_at, updated_at
     FROM mt_calendar_requests
     WHERE status IS NOT NULL AND TRIM(LOWER(status)) IN (${placeholders})
     ORDER BY request_id DESC
     LIMIT 200`,
    [...APPROVED_STATUS_TOKENS],
  );

  if (!rows.length) {
    return [];
  }

  const grouped = new Map<string, ApprovedActivityRow[]>();

  for (const row of rows) {
    const status = normalizeRequestStatus(row.status);
    if (status !== "Approved") {
      continue;
    }

    const planBatchId = toNullableString(row.plan_batch_id);
    const weekRef = toNullableString(row.week_ref);
    const groupingKey = planBatchId ? `plan:${planBatchId}` : weekRef ? `week:${weekRef}` : `request:${row.request_id}`;

    if (!grouped.has(groupingKey)) {
      grouped.set(groupingKey, []);
    }
    grouped.get(groupingKey)!.push(row);
  }

  const notifications: NormalizedNotification[] = [];

  for (const [groupKey, groupRows] of grouped.entries()) {
    if (!groupRows.length) {
      continue;
    }

    const primary = groupRows[0];
    const title = toNullableString(primary.title);
    const grade = toNullableString(primary.grade_level);
    const subject = toNullableString(primary.subject);
    const approvedBy = toNullableString(primary.approved_by);

    const startDates: Date[] = [];
    const endDates: Date[] = [];
    const approvalDates: Date[] = [];
    const updatedDates: Date[] = [];
    const requestedDates: Date[] = [];

    for (const row of groupRows) {
      const start = parseDateValue(row.start_date);
      if (start) {
        startDates.push(start);
      }

      const end = parseDateValue(row.end_date);
      if (end) {
        endDates.push(end);
      }

      const approvedAt = parseDateValue(row.approved_at);
      if (approvedAt) {
        approvalDates.push(approvedAt);
      }

      const updatedAt = parseDateValue(row.updated_at);
      if (updatedAt) {
        updatedDates.push(updatedAt);
      }

      const requestedAt = parseDateValue(row.requested_at);
      if (requestedAt) {
        requestedDates.push(requestedAt);
      }
    }

    const rangeStart = startDates.length
      ? new Date(Math.min(...startDates.map((date) => date.getTime())))
      : requestedDates.length
        ? new Date(Math.min(...requestedDates.map((date) => date.getTime())))
        : null;

    const rangeEnd = endDates.length
      ? new Date(Math.max(...endDates.map((date) => date.getTime())))
      : rangeStart;

    const createdDate = approvalDates.length
      ? new Date(Math.max(...approvalDates.map((date) => date.getTime())))
      : updatedDates.length
        ? new Date(Math.max(...updatedDates.map((date) => date.getTime())))
        : requestedDates.length
          ? new Date(Math.max(...requestedDates.map((date) => date.getTime())))
          : rangeStart ?? new Date();

  const createdAtIso = createdDate.toISOString();
  const scheduledStartIso = rangeStart ? toIsoDate(rangeStart) : null;
  const scheduledEndIso = rangeEnd ? toIsoDate(rangeEnd) : null;
  const hasScheduledRange = Boolean(scheduledStartIso || scheduledEndIso);

    const descriptorTokens: string[] = [];
    if (grade) {
      descriptorTokens.push(grade);
    }
    if (subject) {
      descriptorTokens.push(subject);
    }

    const descriptor = descriptorTokens.length ? ` for ${descriptorTokens.join(" • ")}` : "";

    let message = `${title ?? subject ?? "Calendar activity"} has been approved${descriptor}`;
    if (approvedBy) {
      message += ` by ${approvedBy}`;
    }

    if (hasScheduledRange && scheduledStartIso && scheduledEndIso) {
      if (scheduledStartIso === scheduledEndIso) {
        message += `. Scheduled on ${scheduledStartIso}.`;
      } else {
        message += `. Scheduled from ${scheduledStartIso} to ${scheduledEndIso}.`;
      }
    } else if (hasScheduledRange && scheduledStartIso) {
      message += `. Scheduled on ${scheduledStartIso}.`;
    } else {
      message += ".";
    }

    const planBatchId = toNullableString(primary.plan_batch_id) ?? toNullableString(primary.week_ref);
    const numericRequestId = Number(primary.request_id);
    const hashedId = planBatchId ? hashStringToInt(planBatchId) : hashStringToInt(`${groupKey}`);
    const normalizedId = Number.isFinite(numericRequestId) && numericRequestId > 0
      ? -Math.abs(numericRequestId)
      : -Math.abs(hashedId || hashStringToInt(`${groupKey}:${createdAtIso}`));

    notifications.push({
      id: normalizedId,
      studentId: 0,
      subject: subject ?? title ?? "Approved Activity",
  date: scheduledStartIso ?? createdAtIso.slice(0, 10),
      message,
      status: "unread",
      createdAt: createdAtIso,
    });
  }

  return notifications;
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

  const baseNotifications: NormalizedNotification[] = rows.map((row) => {
    const createdAt = toIsoDateTime(row.created_at);
    const createdAtIso = createdAt ?? new Date().toISOString();
    const primaryDate = toIsoDate(row.date);
    const fallbackDate = primaryDate ?? createdAtIso.slice(0, 10);

    return {
      id: Number(row.id),
      studentId: Number(row.student_id),
      subject: row.subject,
      date: fallbackDate,
      message: row.message,
      status: row.status,
      createdAt: createdAtIso,
    } satisfies NormalizedNotification;
  });

  const derivedNotifications = await buildApprovedActivityNotifications();

  const combined = [...baseNotifications, ...derivedNotifications];

  combined.sort((a, b) => {
    const aTime = parseDateValue(a.createdAt)?.getTime() ?? Number.NEGATIVE_INFINITY;
    const bTime = parseDateValue(b.createdAt)?.getTime() ?? Number.NEGATIVE_INFINITY;
    return bTime - aTime;
  });

  return NextResponse.json({ success: true, notifications: combined });
}

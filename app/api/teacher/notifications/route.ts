import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { requireTeacher } from "@/lib/server/teacher-auth";

export const dynamic = "force-dynamic";

const NOTIFICATIONS_TABLE = "teacher_notifications";

let ensureTablePromise: Promise<void> | null = null;

const ensureNotificationsTable = async () => {
  if (!ensureTablePromise) {
    ensureTablePromise = query(
      `CREATE TABLE IF NOT EXISTS ${NOTIFICATIONS_TABLE} (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        teacher_id VARCHAR(64) NULL,
        message TEXT NOT NULL,
        status ENUM('unread', 'read') NOT NULL DEFAULT 'unread',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_teacher_notifications_teacher (teacher_id),
        KEY idx_teacher_notifications_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    )
      .then(() => undefined)
      .catch((error) => {
        ensureTablePromise = null;
        throw error;
      });
  }

  await ensureTablePromise;
};

const normalizeTeacherIdentifier = (teacherId: string | null, userId: number): string => {
  const trimmedTeacherId = typeof teacherId === "string" ? teacherId.trim() : "";
  if (trimmedTeacherId) {
    return trimmedTeacherId;
  }
  return String(userId);
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTeacher(request);
    if (!auth.ok) {
      return auth.response;
    }

    await ensureNotificationsTable();

    const teacherIdentifier = normalizeTeacherIdentifier(auth.teacherId, auth.userId);

    const [rows] = await query<RowDataPacket[]>(
      `SELECT id, message, status, created_at FROM ${NOTIFICATIONS_TABLE}
       WHERE teacher_id IS NULL OR teacher_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [teacherIdentifier],
    );

    const notifications = rows.map((row) => ({
      id: Number(row.id),
      message: row.message ? String(row.message) : "",
      status: row.status === "read" ? "read" : "unread",
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(String(row.created_at)).toISOString(),
    }));

    const unreadCount = notifications.reduce((count, note) => count + (note.status === "unread" ? 1 : 0), 0);

    return NextResponse.json({ success: true, notifications, unreadCount });
  } catch (error) {
    console.error("Failed to load teacher notifications", error);
    return NextResponse.json({ success: false, error: "Unable to load notifications." }, { status: 500 });
  }
}

type PatchPayload = {
  id?: number | string | null;
  markAll?: boolean | null;
};

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireTeacher(request);
    if (!auth.ok) {
      return auth.response;
    }

    await ensureNotificationsTable();

    const teacherIdentifier = normalizeTeacherIdentifier(auth.teacherId, auth.userId);
    const payload = (await request.json().catch(() => null)) as PatchPayload | null;

    const noteId = Number(payload?.id ?? NaN);

    if (Number.isFinite(noteId) && noteId > 0) {
      await query(
        `UPDATE ${NOTIFICATIONS_TABLE}
         SET status = 'read'
         WHERE id = ?
           AND status = 'unread'
           AND (teacher_id IS NULL OR teacher_id = ?)`,
        [noteId, teacherIdentifier],
      );

      return NextResponse.json({ success: true, mode: "single" });
    }

    if (payload?.markAll === false) {
      return NextResponse.json({ success: false, error: "Nothing to update." }, { status: 400 });
    }

    await query(
      `UPDATE ${NOTIFICATIONS_TABLE}
       SET status = 'read'
       WHERE status = 'unread'
         AND (teacher_id IS NULL OR teacher_id = ?)`,
      [teacherIdentifier],
    );

    return NextResponse.json({ success: true, mode: "all" });
  } catch (error) {
    console.error("Failed to update teacher notifications", error);
    return NextResponse.json({ success: false, error: "Unable to update notifications." }, { status: 500 });
  }
}

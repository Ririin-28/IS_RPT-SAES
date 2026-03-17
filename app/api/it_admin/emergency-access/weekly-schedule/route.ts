import { NextRequest, NextResponse } from "next/server";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getTableColumns, runWithConnection } from "@/lib/db";
import { requireItAdmin } from "@/lib/server/it-admin-auth";
import {
  canManagePrincipalCalendars,
  hasActiveEmergencyAccess,
  writeEmergencyAuditLog,
} from "@/lib/server/emergency-access";
import { resolveRequestIp } from "@/lib/server/security-audit";

export const dynamic = "force-dynamic";

const WEEKLY_TABLE = "weekly_subject_schedule";
const SUBJECTS_TABLE_CANDIDATES = ["subjects", "subject"] as const;
const VALID_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const DEFAULT_SUBJECTS = ["Assessment", "English", "Filipino", "Math"] as const;

type Weekday = (typeof VALID_WEEKDAYS)[number];

type SubjectSchedulePayload = Record<Weekday, string> & { startTime: string; endTime: string };

const ALLOWED_SUBJECTS = new Set<string>(DEFAULT_SUBJECTS);
const SUBJECT_NAME_TO_ID: Record<string, number> = DEFAULT_SUBJECTS.reduce((acc, name, idx) => {
  acc[name] = idx + 1;
  return acc;
}, {} as Record<string, number>);

const sanitizeString = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const dedupeStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((v) => v?.trim()).filter(Boolean))) as string[];

const normalizeTimeValue = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = /^([01]\d|2[0-3]):[0-5]\d$/.exec(trimmed);
  return match ? trimmed : "";
};

async function ensureWeeklyTable(): Promise<void> {
  const columns = await getTableColumns(WEEKLY_TABLE);
  for (const col of ["day_of_week", "subject_id", "created_by", "start_time", "end_time"]) {
    if (!columns.has(col)) {
      throw new Error(`Missing column ${col} in ${WEEKLY_TABLE}`);
    }
  }
}

async function subjectsLookupAvailable() {
  for (const table of SUBJECTS_TABLE_CANDIDATES) {
    try {
      const cols = await getTableColumns(table);
      const idCol = cols.has("subject_id") ? "subject_id" : cols.has("id") ? "id" : null;
      const nameCol = cols.has("name") ? "name" : cols.has("subject_name") ? "subject_name" : null;
      if (idCol && nameCol) return { table, idCol, nameCol };
    } catch {
      // Ignore table lookup failure and fallback.
    }
  }
  return null;
}

async function fetchAllSubjects(connection: PoolConnection): Promise<Array<{ id: number; name: string }>> {
  const lookup = await subjectsLookupAvailable();
  if (!lookup) {
    return DEFAULT_SUBJECTS.map((name, i) => ({ id: i + 1, name }));
  }

  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT \`${lookup.idCol}\` AS subject_id, \`${lookup.nameCol}\` AS name FROM \`${lookup.table}\``,
  );

  return rows
    .map((r: RowDataPacket) => ({
      id: Number(r.subject_id),
      name: sanitizeString((r as { name?: string | null; subject_name?: string | null }).name ?? (r as { subject_name?: string | null }).subject_name),
    }))
    .filter((s: { id: number; name: string }) => s.id && ALLOWED_SUBJECTS.has(s.name));
}

async function getSubjectIdByName(connection: PoolConnection, name: string): Promise<number | null> {
  const trimmed = sanitizeString(name);
  if (!trimmed || !ALLOWED_SUBJECTS.has(trimmed)) return null;

  const subjects = await fetchAllSubjects(connection);
  return subjects.find((s) => s.name === trimmed)?.id ?? SUBJECT_NAME_TO_ID[trimmed];
}

export async function GET(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:content.manage" });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    await ensureWeeklyTable();
    return await runWithConnection(async (connection) => {
      const permission = await canManagePrincipalCalendars(connection, {
        userId: auth.userId,
        canonicalRole: auth.canonicalRole,
      });
      if (!permission.allowed) {
        return NextResponse.json({ success: false, error: "Emergency Calendars access is not active." }, { status: 403 });
      }

      const weeklyColumns = await getTableColumns(WEEKLY_TABLE);
      const whereActive = weeklyColumns.has("is_archived") ? " WHERE COALESCE(is_archived, 0) = 0" : "";
      const subjects = await fetchAllSubjects(connection);
      const map = new Map(subjects.map((s) => [s.id, s.name]));

      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT day_of_week, subject_id, start_time, end_time FROM \`${WEEKLY_TABLE}\`${whereActive}`,
      );

      const schedule = VALID_WEEKDAYS.reduce(
        (acc, d) => ({ ...acc, [d]: "" }),
        {} as SubjectSchedulePayload,
      );
      schedule.startTime = "";
      schedule.endTime = "";

      for (const r of rows) {
        if (map.has(Number(r.subject_id))) {
          schedule[r.day_of_week as Weekday] = map.get(Number(r.subject_id)) ?? "";
        }
        if (!schedule.startTime && r.start_time) {
          schedule.startTime = String(r.start_time);
        }
        if (!schedule.endTime && r.end_time) {
          schedule.endTime = String(r.end_time);
        }
      }

      return NextResponse.json({
        success: true,
        schedule,
        options: { subjects: dedupeStrings(subjects.map((s) => s.name)) },
      });
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Unable to load weekly schedule." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:content.manage" });
  if (!auth.ok) {
    return auth.response;
  }

  const ipAddress = resolveRequestIp(request);

  try {
    await ensureWeeklyTable();
    return await runWithConnection(async (connection) => {
      const permission = await canManagePrincipalCalendars(connection, {
        userId: auth.userId,
        canonicalRole: auth.canonicalRole,
      });
      if (!permission.allowed) {
        return NextResponse.json({ success: false, error: "Emergency Calendars access is not active." }, { status: 403 });
      }

      const active = await hasActiveEmergencyAccess(connection, auth.userId, "Calendars");
      if (!active.active || !active.session) {
        return NextResponse.json({ success: false, error: "Emergency Calendars access is not active." }, { status: 403 });
      }

      const body = await request.json().catch(() => null);
      const entries: { day: Weekday; subjectId: number }[] = [];
      const startTime = normalizeTimeValue(body?.schedule?.startTime);
      const endTime = normalizeTimeValue(body?.schedule?.endTime);

      if (!startTime || !endTime) {
        return NextResponse.json({ success: false, error: "Start and end time are required." }, { status: 400 });
      }

      for (const day of VALID_WEEKDAYS) {
        const id = await getSubjectIdByName(connection, body?.schedule?.[day]);
        if (!id) {
          return NextResponse.json(
            { success: false, error: `Invalid subject for ${day}` },
            { status: 400 },
          );
        }
        entries.push({ day, subjectId: id });
      }

      const weeklyColumns = await getTableColumns(WEEKLY_TABLE);
      if (!weeklyColumns.has("is_archived")) {
        return NextResponse.json(
          { success: false, error: "weekly_subject_schedule.is_archived is required for safe reset." },
          { status: 500 },
        );
      }

      const [existingRows] = await connection.query<RowDataPacket[]>(
        `SELECT day_of_week, subject_id, start_time, end_time
         FROM \`${WEEKLY_TABLE}\`
         WHERE COALESCE(is_archived, 0) = 0`,
      );

      const archiveAssignments = ["is_archived = 1"];
      if (weeklyColumns.has("archived_at")) {
        archiveAssignments.push("archived_at = NOW()");
      }
      if (weeklyColumns.has("archived_by")) {
        archiveAssignments.push("archived_by = ?");
      }

      await connection.beginTransaction();
      try {
        await connection.execute<ResultSetHeader>(
          `UPDATE \`${WEEKLY_TABLE}\` SET ${archiveAssignments.join(", ")} WHERE COALESCE(is_archived, 0) = 0`,
          weeklyColumns.has("archived_by") ? [auth.userId] : [],
        );

        for (const entry of entries) {
          await connection.execute<ResultSetHeader>(
            `INSERT INTO \`${WEEKLY_TABLE}\`
             (day_of_week, subject_id, start_time, end_time, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [entry.day, entry.subjectId, startTime, endTime, auth.userId],
          );
        }

        await writeEmergencyAuditLog(connection, {
          action: "EMERGENCY_WEEKLY_SUBJECT_SCHEDULE_UPDATED",
          userId: auth.userId,
          emergencyAccessId: Number(active.session.emergency_access_id),
          targetModule: "Calendars",
          targetRecordId: "weekly_subject_schedule",
          ipAddress,
          details: {
            performed_by_role: "IT Admin",
            performed_via: "Emergency Access",
            target_table: WEEKLY_TABLE,
            old_value: existingRows,
            new_value: {
              schedule: body?.schedule ?? null,
              startTime,
              endTime,
            },
          },
        });

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Unable to update weekly schedule." }, { status: 500 });
  }
}

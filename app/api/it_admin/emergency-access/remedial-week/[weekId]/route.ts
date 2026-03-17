import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { requireItAdmin } from "@/lib/server/it-admin-auth";
import {
  canManagePrincipalCalendars,
  hasActiveEmergencyAccess,
  writeEmergencyAuditLog,
} from "@/lib/server/emergency-access";
import { resolveRequestIp } from "@/lib/server/security-audit";

export const dynamic = "force-dynamic";

const REMEDIAL_WEEK_TABLE = "remedial_week";

function normalizeDateInput(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ weekId: string }> },
) {
  const auth = await requireItAdmin(request, { permission: "it_admin:content.manage" });
  if (!auth.ok) {
    return auth.response;
  }

  const { weekId: rawWeekId } = await params;
  const weekId = Number(rawWeekId);
  if (!Number.isInteger(weekId) || weekId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid week id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    week_start_date?: unknown;
    week_end_date?: unknown;
  } | null;

  const weekStartDate = normalizeDateInput(body?.week_start_date);
  const weekEndDate = normalizeDateInput(body?.week_end_date);
  if (!weekStartDate || !weekEndDate) {
    return NextResponse.json(
      { success: false, error: "Valid week_start_date and week_end_date are required." },
      { status: 400 },
    );
  }
  if (new Date(`${weekStartDate}T00:00:00`).getTime() > new Date(`${weekEndDate}T00:00:00`).getTime()) {
    return NextResponse.json({ success: false, error: "week_start_date cannot be after week_end_date." }, { status: 400 });
  }

  const ipAddress = resolveRequestIp(request);

  try {
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

      const [existingRows] = await connection.execute<RowDataPacket[]>(
        `SELECT week_id, week_number, week_start_date, week_end_date
         FROM ${REMEDIAL_WEEK_TABLE}
         WHERE week_id = ?
         LIMIT 1`,
        [weekId],
      );
      const existing = existingRows[0];
      if (!existing) {
        return NextResponse.json({ success: false, error: "Week not found." }, { status: 404 });
      }

      await connection.execute<ResultSetHeader>(
        `UPDATE ${REMEDIAL_WEEK_TABLE}
         SET week_start_date = ?, week_end_date = ?
         WHERE week_id = ?
         LIMIT 1`,
        [weekStartDate, weekEndDate, weekId],
      );

      await writeEmergencyAuditLog(connection, {
        action: "EMERGENCY_REMEDIAL_WEEK_UPDATED",
        userId: auth.userId,
        emergencyAccessId: Number(active.session.emergency_access_id),
        targetModule: "Calendars",
        targetRecordId: weekId,
        ipAddress,
        details: {
          performed_by_role: "IT Admin",
          performed_via: "Emergency Access",
          target_table: REMEDIAL_WEEK_TABLE,
          target_record_id: weekId,
          old_value: {
            week_start_date: existing.week_start_date,
            week_end_date: existing.week_end_date,
          },
          new_value: {
            week_start_date: weekStartDate,
            week_end_date: weekEndDate,
          },
        },
      });

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error("Failed to update remedial week", error);
    return NextResponse.json({ success: false, error: "Unable to update remedial week." }, { status: 500 });
  }
}

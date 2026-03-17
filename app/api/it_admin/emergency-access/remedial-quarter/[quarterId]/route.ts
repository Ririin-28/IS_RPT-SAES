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

const REMEDIAL_QUARTER_TABLE = "remedial_quarter";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ quarterId: string }> },
) {
  const auth = await requireItAdmin(request, { permission: "it_admin:content.manage" });
  if (!auth.ok) {
    return auth.response;
  }

  const { quarterId: rawQuarterId } = await params;
  const quarterId = Number(rawQuarterId);
  if (!Number.isInteger(quarterId) || quarterId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid quarter id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    start_month?: unknown;
    end_month?: unknown;
  } | null;

  const startMonth = Number(body?.start_month);
  const endMonth = Number(body?.end_month);
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    return NextResponse.json({ success: false, error: "start_month must be between 1 and 12." }, { status: 400 });
  }
  if (!Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12) {
    return NextResponse.json({ success: false, error: "end_month must be between 1 and 12." }, { status: 400 });
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
        `SELECT quarter_id, school_year, quarter_name, start_month, end_month
         FROM ${REMEDIAL_QUARTER_TABLE}
         WHERE quarter_id = ?
         LIMIT 1`,
        [quarterId],
      );
      const existing = existingRows[0];
      if (!existing) {
        return NextResponse.json({ success: false, error: "Quarter not found." }, { status: 404 });
      }

      await connection.execute<ResultSetHeader>(
        `UPDATE ${REMEDIAL_QUARTER_TABLE}
         SET start_month = ?, end_month = ?
         WHERE quarter_id = ?
         LIMIT 1`,
        [startMonth, endMonth, quarterId],
      );

      await writeEmergencyAuditLog(connection, {
        action: "EMERGENCY_REMEDIAL_QUARTER_UPDATED",
        userId: auth.userId,
        emergencyAccessId: Number(active.session.emergency_access_id),
        targetModule: "Calendars",
        targetRecordId: quarterId,
        ipAddress,
        details: {
          performed_by_role: "IT Admin",
          performed_via: "Emergency Access",
          target_table: REMEDIAL_QUARTER_TABLE,
          target_record_id: quarterId,
          old_value: {
            start_month: existing.start_month,
            end_month: existing.end_month,
          },
          new_value: {
            start_month: startMonth,
            end_month: endMonth,
          },
        },
      });

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error("Failed to update remedial quarter", error);
    return NextResponse.json({ success: false, error: "Unable to update remedial quarter." }, { status: 500 });
  }
}

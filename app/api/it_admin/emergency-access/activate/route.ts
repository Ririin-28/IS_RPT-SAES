import { NextRequest, NextResponse } from "next/server";
import { runWithConnection } from "@/lib/db";
import { requireItAdmin } from "@/lib/server/it-admin-auth";
import {
  activateEmergencyAccess,
  mapEmergencyAccessResponse,
  validateEmergencyReason,
  writeEmergencyAuditLog,
} from "@/lib/server/emergency-access";
import { resolveRequestIp } from "@/lib/server/security-audit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireItAdmin(request, { permission: "it_admin:maintenance.execute" });
  if (!auth.ok) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as { reason?: unknown; expires_at?: unknown } | null;
  const reason = validateEmergencyReason(body?.reason);

  if (!reason) {
    return NextResponse.json(
      { success: false, error: "A reason with at least 10 characters is required." },
      { status: 400 },
    );
  }

  const expiresAt = typeof body?.expires_at === "string" ? body.expires_at.trim() : null;
  const ipAddress = resolveRequestIp(request);

  try {
    return await runWithConnection(async (connection) => {
      const result = await activateEmergencyAccess(connection, auth.userId, reason, expiresAt);

      if (!result.created) {
        return NextResponse.json(
          {
            success: false,
            error: "An emergency access session is already active.",
            emergency_access: mapEmergencyAccessResponse(result.session),
          },
          { status: 409 },
        );
      }

      await writeEmergencyAuditLog(connection, {
        action: "EMERGENCY_ACCESS_ACTIVATED",
        userId: auth.userId,
        emergencyAccessId: Number(result.session.emergency_access_id),
        targetModule: "EmergencyAccess",
        targetRecordId: Number(result.session.emergency_access_id),
        ipAddress,
        details: {
          performed_by_role: "IT Admin",
          activated_for_role: "Principal",
          scope_modules: ["Calendars", "Requests"],
          reason,
          expires_at: result.session.expires_at ? String(result.session.expires_at) : null,
        },
      });

      return NextResponse.json({
        success: true,
        emergency_access: mapEmergencyAccessResponse(result.session),
      });
    });
  } catch (error) {
    console.error("Failed to activate emergency access", error);
    return NextResponse.json({ success: false, error: "Unable to activate emergency access." }, { status: 500 });
  }
}
